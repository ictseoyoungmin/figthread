import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChromeExecutable } from "./browser-text.js";
import { sha256Canonical } from "./canonicalize.js";

export const VISUAL_AUDIT_ENGINE_VERSION = "0.1.0";
export const VISUAL_AUDIT_PLAN_SCHEMA_VERSION = "figthread.visual-audit-plan/0.1";
export const VISUAL_AUDIT_OBSERVATION_SCHEMA_VERSION = "figthread.visual-audit-observation/0.1";
export const VISUAL_AUDIT_EVIDENCE_SCHEMA_VERSION = "figthread.visual-audit-evidence/0.1";

const severityOrder = { error: 0, warning: 1, note: 2 };
const issue = (code, severity, message, extra = {}) => ({ code, severity, stage_owner: "visual-audit", message, ...extra });
const sortIssues = (issues) => issues.sort((a,b) => severityOrder[a.severity]-severityOrder[b.severity] || a.code.localeCompare(b.code) || (a.element_id??"").localeCompare(b.element_id??"") || a.message.localeCompare(b.message));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const GEOMETRY_TAGS = new Set(["path","line","polyline","polygon","rect","circle","ellipse","use"]);
const STRUCTURAL_TAGS = new Set(["g","svg","title","desc","tspan","textpath","a","switch","style"]);
const SUPPRESS_ROOTS = new Set(["defs","clippath","mask","marker","pattern","symbol","lineargradient","radialgradient","filter"]);
const AUDIT_ROLES = new Set(["essential","connector","container","decorative"]);
const DEFAULTS = Object.freeze({ bounds_tolerance_px: 0.5, collision_tolerance_px: 0.5, text_padding_px: 2, connector_clearance_px: 1 });

function deepFreeze(value, seen = new Set()) { if (value === null || typeof value !== "object" || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) deepFreeze(child, seen); return Object.freeze(value); }
function hashBase(object, field) { const copy = structuredClone(object); delete copy[field]; return sha256Canonical(copy); }
function receiptValid(promotion) { if (!promotion?.promoted || !promotion.promotion_receipt) return false; const { promotion_hash, ...base } = promotion.promotion_receipt; return sha256Canonical(base) === promotion_hash; }
function finiteBox(box) { return box && [box.x,box.y,box.w,box.h].every(Number.isFinite) && box.w >= 0 && box.h >= 0; }
function boxWithin(inner, outer, tolerance = 0) { return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.w <= outer.x + outer.w + tolerance && inner.y + inner.h <= outer.y + outer.h + tolerance; }
function insetBox(box, inset) { return { x: box.x + inset, y: box.y + inset, w: Math.max(0, box.w - inset * 2), h: Math.max(0, box.h - inset * 2) }; }
function expandBox(box, amount) { return { x: box.x - amount, y: box.y - amount, w: box.w + amount * 2, h: box.h + amount * 2 }; }
function intersectionArea(a,b) { const w=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y); return Math.max(0,w)*Math.max(0,h); }
function pointInBox(point, box) { return point.x >= box.x && point.y >= box.y && point.x <= box.x + box.w && point.y <= box.y + box.h; }
function attrValue(attrs, name) { const re = new RegExp(`\\b${name}\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')`, "i"); const m = re.exec(attrs); return m ? (m[1] ?? m[2] ?? "") : null; }

export function scanCustomSvg(localSvg) {
  const elements = [], unsupported = [];
  const re = /<\/?([A-Za-z][A-Za-z0-9:_-]*)\b([^>]*)>/g;
  let match, suppressedDepth = 0, ordinal = 0;
  while ((match = re.exec(String(localSvg ?? "")))) {
    const token = match[0], tag = match[1].toLowerCase(), attrs = match[2] ?? "", closing = token.startsWith("</"), selfClosing = /\/\s*>$/.test(token);
    if (closing) { if (SUPPRESS_ROOTS.has(tag) && suppressedDepth > 0) suppressedDepth -= 1; continue; }
    const suppressRoot = SUPPRESS_ROOTS.has(tag);
    if (suppressedDepth === 0 && !suppressRoot) {
      if (tag === "text") {
        elements.push({ ordinal: ordinal++, tag, role: "text" });
      } else if (GEOMETRY_TAGS.has(tag)) {
        const explicit = attrValue(attrs, "data-figthread-audit");
        const legacyEssential = attrValue(attrs, "data-essential") === "true";
        const role = explicit && AUDIT_ROLES.has(explicit) ? explicit : legacyEssential ? "essential" : "unclassified";
        elements.push({ ordinal: ordinal++, tag, role });
      } else if (!STRUCTURAL_TAGS.has(tag)) {
        unsupported.push({ tag, ordinal: unsupported.length });
      }
    }
    if (suppressRoot) { suppressedDepth += 1; if (selfClosing) suppressedDepth -= 1; }
  }
  return { elements, unsupported };
}

function readFigurePromotion(promotion) {
  if (!receiptValid(promotion) || !promotion.validated_figure) return null;
  const receipt = promotion.promotion_receipt;
  if (sha256Canonical(promotion.validated_figure) !== receipt.input_hash) return null;
  return { figure: promotion.validated_figure, receipt };
}
function readVisualPromotion(promotion) {
  if (!receiptValid(promotion) || !promotion.primitive_plan || !promotion.validated_visual) return null;
  const receipt = promotion.promotion_receipt, plan = promotion.primitive_plan;
  const { plan_hash, ...base } = plan;
  if (sha256Canonical(base) !== plan_hash || receipt.primitive_plan_hash !== plan_hash || sha256Canonical(promotion.validated_visual) !== receipt.visual_hash) return null;
  return { visual: promotion.validated_visual, plan, receipt };
}
function readLayoutPromotion(promotion) {
  if (!receiptValid(promotion) || !promotion.resolved_layout) return null;
  const receipt = promotion.promotion_receipt, layout = promotion.resolved_layout;
  const { layout_hash, ...base } = layout;
  if (sha256Canonical(base) !== layout_hash || receipt.layout_hash !== layout_hash) return null;
  return { layout, receipt };
}
function readRenderPromotion(promotion) {
  if (!receiptValid(promotion) || !promotion.rendered_svg) return null;
  const receipt = promotion.promotion_receipt, rendered = promotion.rendered_svg;
  if (rendered.svg_hash !== receipt.svg_hash || rendered.render_hash !== receipt.render_hash || rendered.evidence?.evidence_hash !== receipt.evidence_hash) return null;
  return { rendered, receipt };
}

export function compileVisualAuditPlan(figurePromotion, visualPromotion, layoutPromotion, renderPromotion, options = {}) {
  const mode = options.mode ?? "gate";
  if (!["draft","gate"].includes(mode)) throw new TypeError("visual audit mode must be 'draft' or 'gate'");
  const figure = readFigurePromotion(figurePromotion), visual = readVisualPromotion(visualPromotion), layout = readLayoutPromotion(layoutPromotion), render = readRenderPromotion(renderPromotion), issues = [];
  if (!figure || !visual || !layout || !render) return { mode, status:"fail", promotion_eligible:false, visual_audit_engine_version:VISUAL_AUDIT_ENGINE_VERSION, issues:[issue("AUD001_BIND","error","visual audit planning requires valid promoted figure, visual, layout, and rendered SVG authorities")] };
  const fHash = figure.receipt.input_hash;
  if (visual.receipt.figure_hash !== fHash || layout.receipt.figure_hash !== fHash || render.receipt.figure_hash !== fHash) issues.push(issue("AUD001_BIND","error","upstream figure identities do not match"));
  if (layout.receipt.visual_hash !== visual.receipt.visual_hash || render.receipt.visual_hash !== visual.receipt.visual_hash) issues.push(issue("AUD001_BIND","error","upstream visual identities do not match"));
  if (layout.receipt.primitive_plan_hash !== visual.receipt.primitive_plan_hash || render.receipt.primitive_plan_hash !== visual.receipt.primitive_plan_hash) issues.push(issue("AUD001_BIND","error","primitive plan identities do not match"));
  if (render.receipt.layout_hash !== layout.receipt.layout_hash || render.receipt.target_id !== layout.receipt.target_id) issues.push(issue("AUD001_BIND","error","rendered SVG does not match the promoted layout target"));
  const viewport = layout.layout.target?.viewport;
  if (!Number.isFinite(viewport?.width) || !Number.isFinite(viewport?.height) || viewport.width <= 0 || viewport.height <= 0) issues.push(issue("AUD001_BIND","error","promoted target viewport is invalid"));
  const boxes = layout.layout.boxes ?? {};
  const elements = [];
  for (const node of figure.figure.nodes) {
    const box = boxes[node.id];
    if (!finiteBox(box)) issues.push(issue("AUD001_BIND","error",`resolved layout is missing a valid owner box for ${node.id}`,{object_id:node.id}));
    elements.push({ element_id:`primary:${node.id}`, owner_id:node.id, source:"semantic-label", tag:"text", role:"text", owner_box:box?{x:box.x,y:box.y,w:box.w,h:box.h}:null });
  }
  for (const binding of visual.plan.bindings.filter((entry) => entry.source === "custom").sort((a,b)=>a.node_id.localeCompare(b.node_id))) {
    const ownerBox = boxes[binding.node_id];
    const scanned = scanCustomSvg(binding.local_svg);
    for (const item of scanned.elements) {
      if (item.role === "unclassified") issues.push(issue("AUD003_COVERAGE","error",`custom geometry ${binding.node_id}#${item.ordinal} must declare data-figthread-audit or data-essential=\"true\"`,{object_id:binding.node_id,element_id:`custom:${binding.node_id}:${item.ordinal}`}));
      elements.push({ element_id:`custom:${binding.node_id}:${item.ordinal}`, owner_id:binding.node_id, source:"custom", tag:item.tag, role:item.role, owner_box:ownerBox?{x:ownerBox.x,y:ownerBox.y,w:ownerBox.w,h:ownerBox.h}:null });
    }
    for (const item of scanned.unsupported) issues.push(issue("AUD003_COVERAGE","error",`custom SVG contains unsupported visible element <${item.tag}>`,{object_id:binding.node_id}));
  }
  for (const relation of figure.figure.relations) elements.push({ element_id:`relation:${relation.id}`, owner_id:relation.id, source:"relation", tag:"path", role:"connector", owner_box:null });
  elements.sort((a,b)=>a.element_id.localeCompare(b.element_id));
  const base = {
    schema_version:VISUAL_AUDIT_PLAN_SCHEMA_VERSION,
    figure_hash:fHash,
    visual_hash:visual.receipt.visual_hash,
    primitive_plan_hash:visual.receipt.primitive_plan_hash,
    profile_plan_hash:layout.receipt.profile_plan_hash,
    layout_hash:layout.receipt.layout_hash,
    render_hash:render.receipt.render_hash,
    svg_hash:render.receipt.svg_hash,
    target_id:render.receipt.target_id,
    viewport:{width:viewport?.width ?? 0,height:viewport?.height ?? 0},
    tolerances:{...DEFAULTS},
    elements
  };
  const plan = deepFreeze({ ...base, plan_hash:sha256Canonical(base) });
  const sorted = sortIssues(issues), hasErrors = sorted.some((entry)=>entry.severity==="error");
  return { mode, status:hasErrors?"fail":"pass", promotion_eligible:mode==="gate"&&!hasErrors, visual_audit_engine_version:VISUAL_AUDIT_ENGINE_VERSION, plan_hash:plan.plan_hash, visual_audit_plan:plan, issues:sorted };
}

class CdpPipe {
  constructor(child) { this.child=child; this.nextId=1; this.pending=new Map(); this.buffer=Buffer.alloc(0); this.input=child.stdio[3]; child.stdio[4].on("data",(chunk)=>this.onData(chunk)); const fail=(error)=>{for(const {reject} of this.pending.values())reject(error);this.pending.clear();}; child.on("error",fail); child.on("exit",(code,signal)=>fail(new Error(`Chrome exited before visual audit completed (${code??"null"}/${signal??"none"})`))); }
  onData(chunk) { this.buffer=Buffer.concat([this.buffer,chunk]); while(true){const index=this.buffer.indexOf(0);if(index<0)break;const frame=this.buffer.subarray(0,index).toString("utf8");this.buffer=this.buffer.subarray(index+1);if(!frame)continue;let message;try{message=JSON.parse(frame);}catch{continue;}if(!message.id||!this.pending.has(message.id))continue;const pending=this.pending.get(message.id);this.pending.delete(message.id);if(message.error)pending.reject(new Error(`${pending.method}: ${message.error.message}`));else pending.resolve(message.result??{});}}
  send(method,params={},sessionId=null){const id=this.nextId++,payload={id,method,params,...(sessionId?{sessionId}:{})};return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject,method});this.input.write(`${JSON.stringify(payload)}\0`,"utf8",(error)=>{if(error&&this.pending.delete(id))reject(error);});});}
}
function evalValue(result){if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text??"browser evaluation failed");return result.result?.value;}
async function evaluate(cdp,sessionId,expression){return evalValue(await cdp.send("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true},sessionId));}
async function attachPage(cdp){for(let attempt=0;attempt<120;attempt+=1){const {targetInfos=[]}=await cdp.send("Target.getTargets");const target=targetInfos.find((entry)=>entry.type==="page"&&entry.url.startsWith("about:blank"))??targetInfos.find((entry)=>entry.type==="page");if(target)return(await cdp.send("Target.attachToTarget",{targetId:target.targetId,flatten:true})).sessionId;await delay(25);}throw new Error("Chrome did not expose a page target for visual audit");}
async function stopChrome(child){if(!child||child.exitCode!==null||child.signalCode!==null)return;child.kill("SIGTERM");await Promise.race([once(child,"exit"),delay(1000)]).catch(()=>{});if(child.exitCode===null&&child.signalCode===null){child.kill("SIGKILL");await Promise.race([once(child,"exit"),delay(1000)]).catch(()=>{});}}

async function attachPlatformFonts(cdp, sessionId, elements) {
  const byId = new Map(elements.map((entry)=>[entry.element_id,entry]));
  const { root } = await cdp.send("DOM.getDocument",{depth:-1,pierce:true},sessionId);
  const { nodeIds=[] } = await cdp.send("DOM.querySelectorAll",{nodeId:root.nodeId,selector:"[data-figthread-visual-audit-id]"},sessionId);
  for (const nodeId of nodeIds) {
    const { attributes=[] } = await cdp.send("DOM.getAttributes",{nodeId},sessionId);
    let id=null; for(let i=0;i<attributes.length;i+=2)if(attributes[i]==="data-figthread-visual-audit-id")id=attributes[i+1];
    const entry=byId.get(id); if(!entry||entry.role!=="text")continue;
    const { fonts=[] }=await cdp.send("CSS.getPlatformFontsForNode",{nodeId},sessionId);
    entry.platform_fonts=fonts.map((font)=>({family_name:String(font.familyName??""),glyph_count:Number.isFinite(font.glyphCount)?font.glyphCount:0,is_custom_font:Boolean(font.isCustomFont)})).filter((font)=>font.family_name).sort((a,b)=>a.family_name.localeCompare(b.family_name));
  }
}

export async function captureVisualAuditObservation(figurePromotion, visualPromotion, layoutPromotion, renderPromotion, options = {}) {
  const planned = compileVisualAuditPlan(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,{mode:"gate"});
  if (!planned.visual_audit_plan || planned.issues.some((entry)=>entry.severity==="error")) throw Object.assign(new Error("visual audit plan is not promotion-eligible"),{code:"AUD003_COVERAGE",report:planned});
  const plan=planned.visual_audit_plan, render=readRenderPromotion(renderPromotion);
  const executable=findChromeExecutable(options.browserExecutable??null); if(!executable)throw Object.assign(new Error("no supported Chrome/Chromium executable was found; set FIGTHREAD_CHROME or --browser"),{code:"AUD002_ENVIRONMENT"});
  const profileDir=await mkdtemp(join(tmpdir(),"figthread-visual-audit-")); let child;
  try {
    child=spawn(executable,["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--disable-background-networking","--disable-component-update","--disable-default-apps","--disable-extensions","--hide-scrollbars","--no-first-run","--no-default-browser-check",`--user-data-dir=${profileDir}`,"--remote-debugging-pipe","about:blank"],{stdio:["ignore","ignore","pipe","pipe","pipe"]}); child.stderr?.resume();
    const cdp=new CdpPipe(child),sessionId=await attachPage(cdp); await Promise.all([cdp.send("Page.enable",{},sessionId),cdp.send("Runtime.enable",{},sessionId),cdp.send("DOM.enable",{},sessionId),cdp.send("CSS.enable",{},sessionId)]);
    await cdp.send("Emulation.setDeviceMetricsOverride",{width:plan.viewport.width,height:plan.viewport.height,deviceScaleFactor:1,mobile:false},sessionId);
    const {frameTree}=await cdp.send("Page.getFrameTree",{},sessionId);
    const html=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:${plan.viewport.width}px;height:${plan.viewport.height}px;overflow:hidden}svg{display:block;width:${plan.viewport.width}px;height:${plan.viewport.height}px;max-width:none}</style><div id="figthread-visual-audit-root">${render.rendered.svg}</div>`;
    await cdp.send("Page.setDocumentContent",{frameId:frameTree.frame.id,html},sessionId);
    const observed=await evaluate(cdp,sessionId,`(async()=>{await document.fonts.ready;const root=document.querySelector('#figthread-visual-audit-root svg');if(!root)throw new Error('promoted SVG root missing');
      const suppressed='defs,clipPath,mask,marker,pattern,symbol,linearGradient,radialGradient,filter';
      const selector='text,path,line,polyline,polygon,rect,circle,ellipse,use';
      const visible=(el)=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number.parseFloat(s.opacity||'1')>0;};
      const globalBox=(el)=>{let b,strokeIncluded=false;try{b=el.getBBox({fill:true,stroke:true,markers:true});strokeIncluded=true;}catch{b=el.getBBox();}const m=el.getCTM();if(!m||!b)return null;const ps=[new DOMPoint(b.x,b.y),new DOMPoint(b.x+b.width,b.y),new DOMPoint(b.x,b.y+b.height),new DOMPoint(b.x+b.width,b.y+b.height)].map(p=>p.matrixTransform(m));let x1=Math.min(...ps.map(p=>p.x)),y1=Math.min(...ps.map(p=>p.y)),x2=Math.max(...ps.map(p=>p.x)),y2=Math.max(...ps.map(p=>p.y));if(!strokeIncluded){const sw=Number.parseFloat(getComputedStyle(el).strokeWidth)||0,scale=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)),e=sw*scale/2;x1-=e;y1-=e;x2+=e;y2+=e;}return{x:x1,y:y1,w:x2-x1,h:y2-y1};};
      const sample=(el)=>{if(typeof el.getTotalLength!=='function'||typeof el.getPointAtLength!=='function')return[];let len=0;try{len=el.getTotalLength();}catch{return[];}if(!Number.isFinite(len)||len<=0)return[];const m=el.getCTM();if(!m)return[];const count=Math.max(12,Math.min(256,Math.ceil(len/4)));const pts=[];for(let i=0;i<=count;i++){const p=el.getPointAtLength(len*i/count).matrixTransform(m);pts.push({x:p.x,y:p.y});}return pts;};
      const measure=(el,id,owner,source,role,tag)=>{const s=getComputedStyle(el),box=globalBox(el),entry={element_id:id,owner_id:owner,source,tag,role,bbox:box,visible:visible(el),display:s.display,visibility:s.visibility,opacity:Number.parseFloat(s.opacity||'1'),stroke_width_px:Number.parseFloat(s.strokeWidth)||0,points:role==='connector'?sample(el):[]};if(role==='text'){entry.text=el.textContent??'';entry.font_size_px=Number.parseFloat(s.fontSize)||0;entry.font_family=s.fontFamily||'';entry.font_weight=s.fontWeight||'';entry.font_available=document.fonts.check((s.fontSize||'16px')+' '+(s.fontFamily||'sans-serif'),entry.text);el.setAttribute('data-figthread-visual-audit-id',id);}return entry;};
      const elements=[];
      for(const text of root.querySelectorAll('text[data-role="primary-label"]')){const owner=text.closest('g[data-node-id]')?.getAttribute('data-node-id');if(owner)elements.push(measure(text,'primary:'+owner,owner,'semantic-label','text','text'));}
      for(const group of root.querySelectorAll('g[data-node-id][data-primitive-id^="custom."]')){const owner=group.getAttribute('data-node-id'),shape=group.querySelector('g[data-primitive-shape="true"]');if(!shape)continue;const active=[...shape.querySelectorAll(selector)].filter((el)=>!el.closest(suppressed));let ordinal=0;for(const el of active){const tag=el.tagName.toLowerCase(),role=tag==='text'?'text':(el.getAttribute('data-figthread-audit')|| (el.getAttribute('data-essential')==='true'?'essential':'unclassified'));elements.push(measure(el,'custom:'+owner+':'+ordinal,owner,'custom',role,tag));ordinal++;}}
      for(const group of root.querySelectorAll('g[data-relation-id]')){const id=group.getAttribute('data-relation-id'),path=group.querySelector('path');if(path)elements.push(measure(path,'relation:'+id,id,'relation','connector','path'));}
      return{elements,viewport:{width:${plan.viewport.width},height:${plan.viewport.height}},environment:{user_agent:navigator.userAgent,platform:navigator.platform,device_pixel_ratio:devicePixelRatio}};})()`);
    if(!observed||!Array.isArray(observed.elements))throw new Error("browser did not return visual audit measurements");
    await attachPlatformFonts(cdp,sessionId,observed.elements);
    const browser=await cdp.send("Browser.getVersion"); observed.environment={...observed.environment,browser_product:String(browser.product??""),browser_revision:String(browser.revision??""),protocol_version:String(browser.protocolVersion??"")};
    const base={schema_version:VISUAL_AUDIT_OBSERVATION_SCHEMA_VERSION,plan_hash:plan.plan_hash,figure_hash:plan.figure_hash,visual_hash:plan.visual_hash,layout_hash:plan.layout_hash,render_hash:plan.render_hash,svg_hash:plan.svg_hash,target_id:plan.target_id,viewport:observed.viewport,elements:observed.elements.sort((a,b)=>a.element_id.localeCompare(b.element_id)),environment:observed.environment};
    return deepFreeze({...base,observation_hash:sha256Canonical(base)});
  } finally { await stopChrome(child); await rm(profileDir,{recursive:true,force:true,maxRetries:10,retryDelay:100}).catch(()=>{}); }
}

function validateObservation(plan, observation) {
  const issues=[];
  if(!observation||observation.schema_version!==VISUAL_AUDIT_OBSERVATION_SCHEMA_VERSION||!observation.observation_hash||hashBase(observation,"observation_hash")!==observation.observation_hash)return[issue("AUD010_EVIDENCE","error","visual audit observation is missing, incompatible, or has an invalid content hash")];
  for(const [field,expected] of [["plan_hash",plan.plan_hash],["figure_hash",plan.figure_hash],["visual_hash",plan.visual_hash],["layout_hash",plan.layout_hash],["render_hash",plan.render_hash],["svg_hash",plan.svg_hash],["target_id",plan.target_id]])if(observation[field]!==expected)issues.push(issue("AUD001_BIND","error",`visual audit observation ${field} does not match the promoted source`,{path:`$.${field}`}));
  if(observation.viewport?.width!==plan.viewport.width||observation.viewport?.height!==plan.viewport.height)issues.push(issue("AUD001_BIND","error","visual audit viewport does not match the promoted target"));
  const expected=new Map(plan.elements.map((entry)=>[entry.element_id,entry])),observed=new Map();
  for(const entry of Array.isArray(observation.elements)?observation.elements:[]){if(observed.has(entry.element_id)){issues.push(issue("AUD003_COVERAGE","error","browser returned duplicate visual audit element",{element_id:entry.element_id}));continue;}observed.set(entry.element_id,entry);const target=expected.get(entry.element_id);if(!target){issues.push(issue("AUD003_COVERAGE","error","browser returned unexpected visual audit element",{element_id:entry.element_id}));continue;}if(entry.owner_id!==target.owner_id||entry.source!==target.source||entry.tag!==target.tag||entry.role!==target.role)issues.push(issue("AUD003_COVERAGE","error","browser element identity/role does not match the audit plan",{element_id:entry.element_id}));}
  for(const target of plan.elements)if(!observed.has(target.element_id))issues.push(issue("AUD003_COVERAGE","error","browser omitted a planned visual audit element",{element_id:target.element_id}));
  const viewport={x:0,y:0,w:plan.viewport.width,h:plan.viewport.height};
  for(const target of plan.elements){const entry=observed.get(target.element_id);if(!entry)continue;if(entry.role==="unclassified")issues.push(issue("AUD003_COVERAGE","error","custom geometry remains unclassified",{element_id:entry.element_id,object_id:entry.owner_id}));if(entry.visible!==true||entry.display==="none"||entry.visibility==="hidden"||!Number.isFinite(entry.opacity)||entry.opacity<=0)issues.push(issue("AUD008_VISIBILITY","error","audited SVG element is not visibly rendered",{element_id:entry.element_id,object_id:entry.owner_id}));if(!finiteBox(entry.bbox)||(entry.role==="text"&&(entry.bbox.w<=0||entry.bbox.h<=0))||(entry.role!=="text"&&entry.bbox.w<=0&&entry.bbox.h<=0)){issues.push(issue("AUD004_BOUNDS","error","audited SVG element has an invalid or empty browser bounding box",{element_id:entry.element_id,object_id:entry.owner_id}));continue;}const bound=target.owner_box??viewport;if(!boxWithin(entry.bbox,bound,plan.tolerances.bounds_tolerance_px))issues.push(issue("AUD004_BOUNDS","error",target.owner_box?"audited SVG element leaves its promoted owner box":"relation connector leaves the promoted viewport",{element_id:entry.element_id,object_id:entry.owner_id}));if(target.source==="custom"&&entry.role==="text"&&!boxWithin(entry.bbox,insetBox(bound,plan.tolerances.text_padding_px),plan.tolerances.bounds_tolerance_px))issues.push(issue("AUD004_BOUNDS","error","custom text violates the minimum internal padding",{element_id:entry.element_id,object_id:entry.owner_id}));if(entry.role==="text"){if(!Number.isFinite(entry.font_size_px)||entry.font_size_px<=0||entry.font_available!==true)issues.push(issue("AUD009_FONT","error","browser font readiness/size check did not pass",{element_id:entry.element_id,object_id:entry.owner_id}));const fonts=Array.isArray(entry.platform_fonts)?entry.platform_fonts:[];if(!fonts.length||fonts.reduce((sum,font)=>sum+(Number.isFinite(font.glyph_count)?font.glyph_count:0),0)<=0)issues.push(issue("AUD009_FONT","error","Chrome reported no platform-font glyphs for audited text",{element_id:entry.element_id,object_id:entry.owner_id}));}}
  const entries=[...observed.values()].filter((entry)=>expected.has(entry.element_id)&&finiteBox(entry.bbox));
  const texts=entries.filter((entry)=>entry.role==="text"), essentials=entries.filter((entry)=>entry.role==="essential"), connectors=entries.filter((entry)=>entry.role==="connector");
  const areaFloor=plan.tolerances.collision_tolerance_px**2;
  for(let i=0;i<texts.length;i+=1)for(let j=i+1;j<texts.length;j+=1)if(intersectionArea(texts[i].bbox,texts[j].bbox)>areaFloor)issues.push(issue("AUD005_TEXT_COLLISION","error",`audited text overlaps ${texts[j].element_id}`,{element_id:texts[i].element_id,other_element_id:texts[j].element_id}));
  for(const text of texts)for(const mark of essentials){const protectedBox=expandBox(mark.bbox,Math.max(plan.tolerances.collision_tolerance_px,(Number(mark.stroke_width_px)||0)/2));if(intersectionArea(text.bbox,protectedBox)>areaFloor)issues.push(issue("AUD006_MARK_COLLISION","error",`audited text overlaps protected mark ${mark.element_id}`,{element_id:text.element_id,other_element_id:mark.element_id}));}
  for(const connector of connectors){const points=Array.isArray(connector.points)?connector.points:[];const interior=points.length>4?points.slice(2,-2):points;for(const text of texts){const protectedBox=expandBox(text.bbox,plan.tolerances.connector_clearance_px);if(interior.some((point)=>pointInBox(point,protectedBox)))issues.push(issue("AUD007_CONNECTOR_CLEARANCE","error",`connector crosses text clearance for ${text.element_id}`,{element_id:connector.element_id,other_element_id:text.element_id}));}for(const mark of essentials){if(connector.element_id===mark.element_id)continue;const protectedBox=expandBox(mark.bbox,Math.max(plan.tolerances.connector_clearance_px,(Number(mark.stroke_width_px)||0)/2));if(interior.some((point)=>pointInBox(point,protectedBox)))issues.push(issue("AUD007_CONNECTOR_CLEARANCE","error",`connector crosses protected mark ${mark.element_id}`,{element_id:connector.element_id,other_element_id:mark.element_id}));}}
  const env=observation.environment;if(!env||typeof env.browser_product!=="string"||!env.browser_product||typeof env.user_agent!=="string"||!env.user_agent||typeof env.platform!=="string"||!env.platform||!Number.isFinite(env.device_pixel_ratio)||env.device_pixel_ratio<=0)issues.push(issue("AUD002_ENVIRONMENT","error","visual audit browser environment fingerprint is incomplete"));
  return sortIssues(issues);
}

export function compileVisualAuditEvidence(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,observation,options={}) {
  const mode=options.mode??"gate",planned=compileVisualAuditPlan(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,{mode});
  if(!planned.visual_audit_plan||planned.issues.some((entry)=>entry.severity==="error"))return{...planned,observation_hash:observation?.observation_hash??null};
  const issues=validateObservation(planned.visual_audit_plan,observation),hasErrors=issues.some((entry)=>entry.severity==="error"),entries=observation?.elements??[];
  const fontFamilies=[...new Set(entries.flatMap((entry)=>(entry.platform_fonts??[]).map((font)=>font.family_name)).filter(Boolean))].sort();
  const metrics={element_count:entries.length,text_count:entries.filter((entry)=>entry.role==="text").length,custom_element_count:entries.filter((entry)=>entry.source==="custom").length,connector_count:entries.filter((entry)=>entry.role==="connector").length,platform_font_families:fontFamilies,full_text_coverage_certified:!hasErrors,custom_geometry_coverage_certified:!hasErrors,owner_bounds_certified:!hasErrors,text_collision_certified:!hasErrors,connector_clearance_certified:!hasErrors,bounds_failure_count:issues.filter((entry)=>entry.code==="AUD004_BOUNDS").length,collision_failure_count:issues.filter((entry)=>["AUD005_TEXT_COLLISION","AUD006_MARK_COLLISION","AUD007_CONNECTOR_CLEARANCE"].includes(entry.code)).length};
  const base={schema_version:VISUAL_AUDIT_EVIDENCE_SCHEMA_VERSION,plan_hash:planned.visual_audit_plan.plan_hash,observation_hash:observation?.observation_hash??null,environment_hash:observation?.environment?sha256Canonical(observation.environment):null,figure_hash:planned.visual_audit_plan.figure_hash,visual_hash:planned.visual_audit_plan.visual_hash,primitive_plan_hash:planned.visual_audit_plan.primitive_plan_hash,profile_plan_hash:planned.visual_audit_plan.profile_plan_hash,layout_hash:planned.visual_audit_plan.layout_hash,render_hash:planned.visual_audit_plan.render_hash,svg_hash:planned.visual_audit_plan.svg_hash,target_id:planned.visual_audit_plan.target_id,metrics};
  const evidence=deepFreeze({...base,evidence_hash:sha256Canonical(base)});
  return{mode,status:hasErrors?"fail":"pass",promotion_eligible:mode==="gate"&&!hasErrors,visual_audit_engine_version:VISUAL_AUDIT_ENGINE_VERSION,plan_hash:planned.visual_audit_plan.plan_hash,observation_hash:observation?.observation_hash??null,visual_audit_plan:planned.visual_audit_plan,visual_audit_evidence:evidence,issues};
}

export function promoteVisualAuditEvidence(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,observation){const result=compileVisualAuditEvidence(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,observation,{mode:"gate"});if(!result.promotion_eligible)return{promoted:false,report:result};const evidence=result.visual_audit_evidence,base={kind:"visual_audit_evidence",schema_version:VISUAL_AUDIT_EVIDENCE_SCHEMA_VERSION,plan_hash:result.plan_hash,observation_hash:result.observation_hash,evidence_hash:evidence.evidence_hash,svg_hash:evidence.svg_hash,render_hash:evidence.render_hash,layout_hash:evidence.layout_hash,target_id:evidence.target_id,engine_version:VISUAL_AUDIT_ENGINE_VERSION};return{promoted:true,report:result,visual_audit_plan:result.visual_audit_plan,visual_audit_evidence:evidence,promotion_receipt:deepFreeze({...base,promotion_hash:sha256Canonical(base)})};}
