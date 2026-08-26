import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";

export const DOCUMENT_ENGINE_VERSION = "0.1.0";
export const DOCUMENT_SCHEMA_VERSION = "figthread.document/0.1";
const MODES = Object.freeze(["interactive", "clean", "static", "error"]);
const schemaUrl = new URL("../schemas/document-manifest.schema.json", import.meta.url);
const DOCUMENT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(schemaUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };

const issue = (code, severity, message, extra = {}) => ({ code, severity, stage_owner: "document", message, ...extra });
const sortIssues = (issues) => issues.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||a.code.localeCompare(b.code)||(a.path??"").localeCompare(b.path??"")||a.message.localeCompare(b.message));
function deepFreeze(value, seen=new Set()){ if(value===null||typeof value!=="object"||seen.has(value))return value; seen.add(value); for(const child of Object.values(value))deepFreeze(child,seen); return Object.freeze(value); }
function sha256Text(text){ return `sha256:${createHash("sha256").update(text,"utf8").digest("hex")}`; }
function receiptValid(promotion){ if(!promotion?.promoted||!promotion.promotion_receipt)return false; const {promotion_hash,...base}=promotion.promotion_receipt; return sha256Canonical(base)===promotion_hash; }
function escapeScriptJson(value){ return JSON.stringify(value).replaceAll("<","\\u003c").replaceAll(">","\\u003e").replaceAll("&","\\u0026"); }
function documentId(figureId){ return `document:${String(figureId).replace(/^fig:/,"").replace(/[^a-z0-9._-]/g,"-")}`; }

function validateAuthorities(a, canonical){
  const issues=[];
  for(const [name,promotion] of Object.entries({semantic:a.figurePromotion,grammar:a.grammarPromotion,visual:a.visualPromotion,profile:a.profilePromotion,layout:a.layoutPromotion,render:a.renderPromotion})) if(!receiptValid(promotion)) issues.push(issue("DOC001_AUTHORITY","error",`${name} authority is missing, unpromoted, or has an invalid promotion receipt`,{path:`$.${name}`}));
  if(issues.length)return sortIssues(issues);
  const f=a.figurePromotion.promotion_receipt,g=a.grammarPromotion.promotion_receipt,v=a.visualPromotion.promotion_receipt,p=a.profilePromotion.promotion_receipt,l=a.layoutPromotion.promotion_receipt,r=a.renderPromotion.promotion_receipt;
  const figureHash=f.input_hash;
  if(sha256Canonical(canonical.figure)!==figureHash)issues.push(issue("DOC002_CANONICAL","error","canonical figure does not match semantic promotion",{path:"$.canonical.figure"}));
  if(sha256Canonical(canonical.visual)!==v.visual_hash)issues.push(issue("DOC002_CANONICAL","error","canonical visual spec does not match visual promotion",{path:"$.canonical.visual"}));
  for(const [name,hash] of [["grammar",g.figure_hash],["visual",v.figure_hash],["profile",p.figure_hash],["layout",l.figure_hash],["render",r.figure_hash]]) if(hash!==figureHash)issues.push(issue("DOC004_COMPILE","error",`${name} authority belongs to a different semantic figure`));
  if(l.grammar_plan_hash!==g.grammar_plan_hash)issues.push(issue("DOC004_COMPILE","error","layout is not bound to the promoted grammar plan"));
  if(p.primitive_plan_hash!==v.primitive_plan_hash||l.primitive_plan_hash!==v.primitive_plan_hash||r.primitive_plan_hash!==v.primitive_plan_hash)issues.push(issue("DOC004_COMPILE","error","primitive-plan identity diverges across profile/layout/render authorities"));
  if(l.profile_plan_hash!==p.profile_plan_hash||r.profile_plan_hash!==p.profile_plan_hash)issues.push(issue("DOC004_COMPILE","error","profile-plan identity diverges across layout/render authorities"));
  if(r.layout_hash!==l.layout_hash)issues.push(issue("DOC004_COMPILE","error","rendered SVG is not bound to the promoted layout"));
  if(r.target_id!==l.target_id)issues.push(issue("DOC005_TARGET","error","render and layout target identities differ"));
  const rendered=a.renderPromotion.rendered_svg;
  if(!rendered?.svg||rendered.svg_hash!==r.svg_hash||rendered.render_hash!==r.render_hash||rendered.evidence?.evidence_hash!==r.evidence_hash)issues.push(issue("DOC006_RENDER","error","rendered SVG payload does not match its promotion receipt"));
  if(a.motionPromotion){
    if(!receiptValid(a.motionPromotion))issues.push(issue("DOC007_MOTION","error","motion authority has an invalid promotion receipt"));
    else {
      const m=a.motionPromotion.promotion_receipt;
      if(!canonical.motion||sha256Canonical(canonical.motion)!==m.motion_hash)issues.push(issue("DOC002_CANONICAL","error","canonical motion spec does not match motion promotion",{path:"$.canonical.motion"}));
      if(m.figure_hash!==figureHash||m.layout_hash!==l.layout_hash)issues.push(issue("DOC007_MOTION","error","motion program is not bound to the document figure/layout authorities"));
      if(a.motionPromotion.motion_program?.program_hash!==m.program_hash)issues.push(issue("DOC007_MOTION","error","motion program payload does not match its promotion receipt"));
    }
  } else if(canonical.motion!==null&&canonical.motion!==undefined) issues.push(issue("DOC007_MOTION","error","canonical motion is present without a promoted MotionProgram"));
  return sortIssues(issues);
}

function browserRuntimeSource(){ return String.raw`(()=>{
"use strict";
const diagnostics=[]; let manifest=null,svg=null,mode="error",ready=false,currentMs=0,playing=false,raf=0,playStart=0,playBase=0;
const stage=(code,message,extra={})=>diagnostics.push({code,severity:"error",stage_owner:"document-runtime",message,...extra});
const canon=v=>{if(v===null||typeof v==="boolean"||typeof v==="string")return JSON.stringify(v);if(typeof v==="number"){if(!Number.isFinite(v))throw new TypeError("non-finite canonical number");return Object.is(v,-0)?"0":JSON.stringify(v)}if(Array.isArray(v))return "["+v.map(canon).join(",")+"]";if(typeof v==="object"){const k=Object.keys(v).sort();return "{"+k.map(x=>JSON.stringify(x)+":"+canon(v[x])).join(",")+"}"}throw new TypeError("unsupported canonical value")};
const sha=async v=>{if(!globalThis.crypto?.subtle)throw new Error("WebCrypto unavailable");const bytes=new TextEncoder().encode(typeof v==="string"?v:canon(v));const digest=await crypto.subtle.digest("SHA-256",bytes);return "sha256:"+[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")};
const clone=v=>JSON.parse(JSON.stringify(v));
const localTime=ms=>{const p=manifest?.compiled?.motion_program;if(!p)return 0;const n=Math.max(0,Math.trunc(ms));return p.loop?.mode==="repeat"&&p.duration_ms>0?n%p.duration_ms:Math.min(n,p.duration_ms)};
const sampleState=ms=>{const p=manifest.compiled.motion_program;if(!p)return {};const t=localTime(ms),state=clone(p.initial_state||{});for(const track of p.tracks||[]){if(track.at_ms>t)continue;for(const effect of track.effects||[]){const cur=state[effect.state_id];state[effect.state_id]=effect.op==="add"?cur+effect.value:effect.value}}return state};
const progress=(cue,t)=>{if(t<cue.start_ms)return -1;if(cue.duration_ms<=0)return 1;return Math.max(0,Math.min(1,(t-cue.start_ms)/cue.duration_ms))};
const ease=(p,name)=>name==="ease-in"?p*p:name==="ease-out"?1-(1-p)*(1-p):name==="ease-in-out"?(p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2):p;
const node=id=>[...svg.querySelectorAll("[data-node-id]")].find(el=>el.getAttribute("data-node-id")===id)||null;
const relation=id=>[...svg.querySelectorAll("[data-relation-id]")].find(el=>el.getAttribute("data-relation-id")===id)||null;
const ns="http://www.w3.org/2000/svg";
function overlay(){let g=svg.querySelector("#figthread-runtime-overlay");if(!g){g=document.createElementNS(ns,"g");g.id="figthread-runtime-overlay";g.setAttribute("pointer-events","none");svg.append(g)}while(g.firstChild)g.firstChild.remove();return g}
function resetProjection(){for(const el of svg.querySelectorAll("[data-node-id]")){el.style.opacity="";el.style.transform="";el.removeAttribute("data-figthread-active")}for(const el of svg.querySelectorAll("[data-relation-id]"))el.removeAttribute("data-figthread-active")}
function staticProjection(){resetProjection();overlay();const p=manifest.compiled.motion_program,state=p?.static_state||{};svg.setAttribute("data-figthread-state",JSON.stringify(state));currentMs=0;return state}
function renderAt(ms){if(!ready&&mode!=="error")throw new Error("runtime not ready");if(mode==="static")return staticProjection();const p=manifest.compiled.motion_program;if(!p){currentMs=0;return {}};const t=localTime(ms);currentMs=t;resetProjection();const g=overlay(),state=sampleState(t);svg.setAttribute("data-figthread-state",JSON.stringify(state));
for(const track of p.tracks||[])for(const cue of track.cues||[]){const raw=progress(cue,t);if(cue.kind==="reveal"){const el=node(cue.target_id);if(el)el.style.opacity=raw<0?"0":String(ease(raw,cue.easing))}else if(raw>=0&&raw<=1&&cue.kind==="focus"){const el=node(cue.target_id),box=cue.target_box;if(el&&box){el.setAttribute("data-figthread-active","true");const r=document.createElementNS(ns,"rect");r.setAttribute("x",box.x-4);r.setAttribute("y",box.y-4);r.setAttribute("width",box.w+8);r.setAttribute("height",box.h+8);r.setAttribute("rx","7");r.setAttribute("fill","none");r.setAttribute("stroke","currentColor");r.setAttribute("stroke-width","2");r.setAttribute("vector-effect","non-scaling-stroke");r.setAttribute("opacity",String(.35+.55*(1-Math.abs(.5-ease(raw,cue.easing))*2)));g.append(r)}}else if(raw>=0&&raw<=1&&cue.kind==="trace"){const rel=relation(cue.via_relation);if(rel)rel.setAttribute("data-figthread-active","true");const path=document.createElementNS(ns,"path");path.setAttribute("d",cue.path_d);path.setAttribute("fill","none");path.setAttribute("stroke","currentColor");path.setAttribute("stroke-width","3");path.setAttribute("vector-effect","non-scaling-stroke");path.setAttribute("pathLength","1");path.setAttribute("stroke-dasharray","1");path.setAttribute("stroke-dashoffset",String(1-ease(raw,cue.easing)));g.append(path)}else if(raw>=0&&raw<=1&&cue.kind==="transfer"){const path=document.createElementNS(ns,"path");path.setAttribute("d",cue.path_d);path.setAttribute("fill","none");path.setAttribute("stroke","none");g.append(path);const total=path.getTotalLength(),pt=path.getPointAtLength(total*ease(raw,cue.easing)),dot=document.createElementNS(ns,"circle");dot.setAttribute("cx",pt.x);dot.setAttribute("cy",pt.y);dot.setAttribute("r","5");dot.setAttribute("fill","currentColor");dot.setAttribute("data-figthread-transfer",cue.subject_id||"");g.append(dot)}else if(raw>=0&&raw<=1&&cue.kind==="morph-state"){const el=node(cue.target_id);if(el){el.setAttribute("data-figthread-active","true");el.style.opacity=String(.72+.28*ease(raw,cue.easing))}}}
document.dispatchEvent(new CustomEvent("figthread:state",{detail:{time_ms:t,state:clone(state)}}));const slider=document.querySelector("#figthread-time");if(slider)slider.value=String(t);const label=document.querySelector("#figthread-time-label");if(label)label.textContent=t+" ms";return clone(state)}
function setMode(next){if(!manifest.runtime.allowed_modes.includes(next)||next==="error")throw new Error("unsupported runtime mode: "+next);mode=next;document.documentElement.dataset.figthreadMode=mode;const controls=document.querySelector("#figthread-controls");if(controls)controls.hidden=mode!=="interactive"||!manifest.runtime.has_motion;if(mode==="static"){pause();staticProjection()}else renderAt(currentMs);return mode}
function pause(){playing=false;if(raf)cancelAnimationFrame(raf);raf=0;const b=document.querySelector("#figthread-play");if(b)b.textContent="Play"}
function tick(now){if(!playing)return;renderAt(playBase+(now-playStart));raf=requestAnimationFrame(tick)}
function play(){if(!manifest.runtime.has_motion||mode!=="interactive")return false;if(playing){pause();return false}playing=true;playStart=performance.now();playBase=currentMs;const b=document.querySelector("#figthread-play");if(b)b.textContent="Pause";raf=requestAnimationFrame(tick);return true}
async function bootstrap(){try{
  const raw=document.querySelector("#figthread-manifest");svg=document.querySelector("#figthread-stage svg");if(!raw||!svg)throw Object.assign(new Error("document payload missing"),{code:"DOC001_MANIFEST"});
  manifest=JSON.parse(raw.textContent);if(manifest.schema_version!=="figthread.document/0.1")throw Object.assign(new Error("incompatible document schema"),{code:"DOC002_SCHEMA"});
  const build=clone(manifest);delete build.build_hash;if(await sha(build)!==manifest.build_hash)throw Object.assign(new Error("document build hash mismatch"),{code:"DOC003_HASH"});
  const canonical=clone(manifest.canonical);const canonicalHash=canonical.canonical_hash;delete canonical.canonical_hash;if(await sha(canonical)!==canonicalHash)throw Object.assign(new Error("canonical payload hash mismatch"),{code:"DOC003_HASH"});if(await sha(manifest.compiled.authorities)!==manifest.compile_key)throw Object.assign(new Error("compile-key mismatch"),{code:"DOC004_COMPILE"});
  const target=manifest.compiled.resolved_layout.target;if(target.id!==manifest.runtime.target_id)throw Object.assign(new Error("target identity mismatch"),{code:"DOC005_TARGET"});const vb=(svg.getAttribute("viewBox")||"").trim().split(/\s+/).map(Number);if(vb.length!==4||vb[2]!==target.viewport.width||vb[3]!==target.viewport.height)throw Object.assign(new Error("SVG viewport does not match promoted target"),{code:"DOC005_TARGET"});
  if(document.querySelector("script[src],link[rel=stylesheet][href],img[src^='http'],iframe[src],object[data],embed[src]"))throw Object.assign(new Error("external runtime dependency detected"),{code:"DOC008_PURITY"});
  mode=manifest.runtime.initial_mode;ready=true;document.documentElement.dataset.figthreadStatus="ready";document.documentElement.dataset.figthreadMode=mode;
  const slider=document.querySelector("#figthread-time");if(slider){slider.max=String(manifest.runtime.duration_ms);slider.addEventListener("input",()=>renderAt(Number(slider.value)))}const button=document.querySelector("#figthread-play");if(button)button.addEventListener("click",play);
  if(mode==="static")staticProjection();else renderAt(0);setMode(mode);
 }catch(error){ready=false;mode="error";stage(error.code||"DOC006_BOOTSTRAP",error.message);document.documentElement.dataset.figthreadStatus="error";document.documentElement.dataset.figthreadMode="error";const e=document.querySelector("#figthread-error");if(e){e.hidden=false;e.textContent="Figthread runtime error: "+error.message}}
}
window.Figthread=Object.freeze({
  getStatus:()=>Object.freeze({ready,mode,target_id:manifest?.runtime?.target_id||null,time_ms:currentMs,has_motion:manifest?.runtime?.has_motion||false}),
  listTargets:()=>manifest?[Object.freeze({id:manifest.runtime.target_id,profile:manifest.runtime.profile,viewport:clone(manifest.compiled.resolved_layout.target.viewport),active:true})]:[],
  activateTarget:id=>{if(!manifest||id!==manifest.runtime.target_id)throw new Error("target not embedded: "+id);return id},
  renderAt,
  setMode,
  prepareExport:async()=>{setMode("static");return Object.freeze({target_id:manifest.runtime.target_id,build_hash:manifest.build_hash,svg_hash:manifest.compiled.rendered.svg_hash,state_hash:await sha(manifest.compiled.motion_program?.static_state||{})})},
  getStateHash:async()=>sha(mode==="static"?(manifest?.compiled?.motion_program?.static_state||{}):sampleState(currentMs)),
  getDiagnostics:()=>clone(diagnostics)
});
bootstrap();
})();`; }

function htmlFor(manifest, svg){
  const hasMotion=manifest.runtime.has_motion;
  const controls=hasMotion?`<div id="figthread-controls" class="ft-controls"><button id="figthread-play" type="button">Play</button><input id="figthread-time" type="range" min="0" max="${manifest.runtime.duration_ms}" step="1" value="0" aria-label="Timeline"><output id="figthread-time-label">0 ms</output></div>`:"";
  return `<!doctype html>\n<html lang="en" data-figthread-status="booting" data-figthread-mode="${manifest.runtime.initial_mode}">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${manifest.canonical.figure.id}</title>\n<style>html,body{margin:0;min-height:100%;background:#f4f3ef;color:#1f2328;font-family:ui-sans-serif,system-ui,sans-serif}body{display:grid;place-items:center}.ft-shell{width:min(100%,${manifest.compiled.resolved_layout.target.viewport.width}px);padding:16px;box-sizing:border-box}.ft-stage{position:relative}.ft-stage svg{display:block;width:100%;height:auto;color:#8b3d2f}.ft-controls{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-top:10px}.ft-controls button{font:inherit;padding:6px 12px}.ft-controls input{width:100%}.ft-error{padding:12px;border:1px solid #9b2c2c;background:#fff;color:#7f1d1d}html[data-figthread-mode=clean] .ft-controls,html[data-figthread-mode=static] .ft-controls{display:none}html[data-figthread-status=error] .ft-stage{opacity:.35}@media(prefers-reduced-motion:reduce){.ft-controls{display:none}}</style>\n</head>\n<body>\n<main class="ft-shell" id="figthread-document">\n<div id="figthread-stage" class="ft-stage">${svg}</div>\n${controls}\n<div id="figthread-error" class="ft-error" hidden></div>\n</main>\n<script id="figthread-manifest" type="application/json">${escapeScriptJson(manifest)}</script>\n<script>${browserRuntimeSource()}</script>\n</body>\n</html>\n`;
}

export function composeFigthreadDocument(authorities, canonical, options={}){
  const mode=options.mode??"gate",initialMode=options.initialMode??(authorities.motionPromotion?"interactive":"static");
  if(!["draft","gate"].includes(mode))throw new TypeError("document mode must be 'draft' or 'gate'");
  if(!MODES.includes(initialMode)||initialMode==="error")throw new TypeError("initial runtime mode must be interactive, clean, or static");
  const issues=validateAuthorities(authorities,canonical);
  if(issues.length)return {mode,status:"fail",promotion_eligible:false,document_engine_version:DOCUMENT_ENGINE_VERSION,issues};
  const figure=authorities.figurePromotion.validated_figure,grammar=authorities.grammarPromotion,visual=authorities.visualPromotion,profile=authorities.profilePromotion,layout=authorities.layoutPromotion,render=authorities.renderPromotion,motion=authorities.motionPromotion??null;
  const canonicalBase={figure:structuredClone(canonical.figure),visual:structuredClone(canonical.visual),target:structuredClone(canonical.target),motion:canonical.motion?structuredClone(canonical.motion):null};
  const canonicalPayload={...canonicalBase,canonical_hash:sha256Canonical(canonicalBase)};
  const authoritiesPayload={document_engine_version:DOCUMENT_ENGINE_VERSION,figure_hash:authorities.figurePromotion.promotion_receipt.input_hash,grammar_registry_hash:grammar.promotion_receipt.registry_hash,grammar_definition_hash:grammar.promotion_receipt.definition_hash,grammar_plan_hash:grammar.promotion_receipt.grammar_plan_hash,visual_hash:visual.promotion_receipt.visual_hash,primitive_registry_hash:visual.promotion_receipt.registry_hash,primitive_plan_hash:visual.promotion_receipt.primitive_plan_hash,profile_registry_hash:profile.promotion_receipt.profile_registry_hash,profile_threshold_hash:profile.promotion_receipt.threshold_hash,profile_plan_hash:profile.promotion_receipt.profile_plan_hash,layout_hash:layout.promotion_receipt.layout_hash,svg_hash:render.promotion_receipt.svg_hash,render_hash:render.promotion_receipt.render_hash,motion_program_hash:motion?.promotion_receipt?.program_hash??null};
  const rendered={svg_hash:render.promotion_receipt.svg_hash,render_hash:render.promotion_receipt.render_hash,evidence_hash:render.promotion_receipt.evidence_hash,evidence:structuredClone(render.rendered_svg.evidence)};
  const manifestBase={schema_version:DOCUMENT_SCHEMA_VERSION,document_id:documentId(figure.id),canonical:canonicalPayload,compiled:{authorities:authoritiesPayload,grammar_plan:structuredClone(grammar.grammar_plan),primitive_plan:structuredClone(visual.primitive_plan),profile_plan:structuredClone(profile.profile_plan),resolved_layout:structuredClone(layout.resolved_layout),rendered,motion_program:motion?structuredClone(motion.motion_program):null},runtime:{target_id:layout.promotion_receipt.target_id,profile:figure.profile,initial_mode:initialMode,allowed_modes:[...MODES],has_motion:Boolean(motion),duration_ms:motion?.motion_program?.duration_ms??0},compile_key:sha256Canonical(authoritiesPayload)};
  const manifest=deepFreeze({...manifestBase,build_hash:sha256Canonical(manifestBase)});
  const structural=validateStructure(manifest,DOCUMENT_SCHEMA).map(x=>issue("DOC003_HASH","error",`document manifest ${x.path}: ${x.message}`,{path:x.path}));
  if(structural.length)return {mode,status:"fail",promotion_eligible:false,document_engine_version:DOCUMENT_ENGINE_VERSION,issues:sortIssues(structural)};
  const html=htmlFor(manifest,render.rendered_svg.svg);
  const purity=[];
  if(/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=|<iframe\b|<object\b|<embed\b/i.test(html))purity.push(issue("DOC008_PURITY","error","document HTML contains an external or embeddable runtime dependency"));
  if(/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(browserRuntimeSource()))purity.push(issue("DOC008_PURITY","error","browser runtime may not perform network I/O"));
  if(purity.length)return {mode,status:"fail",promotion_eligible:false,document_engine_version:DOCUMENT_ENGINE_VERSION,issues:sortIssues(purity)};
  const result={schema_version:DOCUMENT_SCHEMA_VERSION,document_id:manifest.document_id,canonical_hash:manifest.canonical.canonical_hash,compile_key:manifest.compile_key,build_hash:manifest.build_hash,html_hash:sha256Text(html),mode,status:"pass",promotion_eligible:mode==="gate",document_engine_version:DOCUMENT_ENGINE_VERSION,issues:[],manifest,html};
  return deepFreeze(result);
}

export function promoteFigthreadDocument(authorities,canonical,options={}){
  const result=composeFigthreadDocument(authorities,canonical,{...options,mode:"gate"});
  if(!result.promotion_eligible)return {promoted:false,report:result};
  const receiptBase={kind:"figthread_document",schema_version:DOCUMENT_SCHEMA_VERSION,document_id:result.document_id,canonical_hash:result.canonical_hash,compile_key:result.compile_key,build_hash:result.build_hash,html_hash:result.html_hash,target_id:result.manifest.runtime.target_id,engine_version:DOCUMENT_ENGINE_VERSION};
  return {promoted:true,report:result,figthread_document:deepFreeze({manifest:result.manifest,html:result.html,html_hash:result.html_hash}),promotion_receipt:deepFreeze({...receiptBase,promotion_hash:sha256Canonical(receiptBase)})};
}
