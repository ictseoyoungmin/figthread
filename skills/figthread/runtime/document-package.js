import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";

export const DOCUMENT_PACKAGE_ENGINE_VERSION = "0.1.0";
export const DOCUMENT_PACKAGE_SCHEMA_VERSION = "figthread.document-package/0.1";
const schemaUrl = new URL("../schemas/document-package.schema.json", import.meta.url);
const DOCUMENT_PACKAGE_SCHEMA = JSON.parse(readFileSync(fileURLToPath(schemaUrl), "utf8"));
const MODES = Object.freeze(["interactive", "clean", "static"]);
const severityOrder = { error: 0, warning: 1, note: 2 };
const issue = (code, severity, message, extra = {}) => ({ code, severity, stage_owner: "document-package", message, ...extra });
const sortIssues = (issues) => issues.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||a.code.localeCompare(b.code)||(a.target_id??"").localeCompare(b.target_id??"")||(a.path??"").localeCompare(b.path??"")||a.message.localeCompare(b.message));
function deepFreeze(value, seen=new Set()){ if(value===null||typeof value!=="object"||seen.has(value))return value; seen.add(value); for(const child of Object.values(value))deepFreeze(child,seen); return Object.freeze(value); }
function sha256Text(text){ return `sha256:${createHash("sha256").update(text,"utf8").digest("hex")}`; }
function receiptValid(promotion){ if(!promotion?.promoted||!promotion.promotion_receipt)return false; const {promotion_hash,...base}=promotion.promotion_receipt; return sha256Canonical(base)===promotion_hash; }
function readDocumentPromotion(promotion){
  if(!receiptValid(promotion)||!promotion.figthread_document)return null;
  const receipt=promotion.promotion_receipt,doc=promotion.figthread_document;
  if(receipt.kind!=="figthread_document"||typeof doc.html!=="string"||sha256Text(doc.html)!==receipt.html_hash||doc.html_hash!==receipt.html_hash)return null;
  if(doc.manifest?.document_id!==receipt.document_id||doc.manifest?.build_hash!==receipt.build_hash||doc.manifest?.canonical?.canonical_hash!==receipt.canonical_hash||doc.manifest?.compile_key!==receipt.compile_key)return null;
  if(doc.manifest?.runtime?.target_id!==receipt.target_id)return null;
  return {receipt,doc,promotion_hash:receipt.promotion_hash};
}
function semanticPayload(figure){ const copy=structuredClone(figure); delete copy.profile; return copy; }
function semanticHash(document){ return sha256Canonical(semanticPayload(document.doc.manifest.canonical.figure)); }
function packageId(value,semanticHashValue){
  if(value!==undefined&&value!==null){ if(typeof value!=="string"||!/^package:[a-z0-9][a-z0-9._-]*$/.test(value))throw Object.assign(new Error("package id must match package:<stable-id>"),{code:"PKG003_TARGET"}); return value; }
  return `package:${documentSafeId(semanticHashValue.slice(7,19))}`;
}
function documentSafeId(value){ return String(value).toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"figure"; }
function escapeScriptJson(value){ return JSON.stringify(value).replaceAll("<","\\u003c").replaceAll(">","\\u003e").replaceAll("&","\\u0026"); }
function childEntry(document){
  const manifest=document.doc.manifest,receipt=document.receipt,target=manifest.compiled.resolved_layout.target;
  return {
    target_id: receipt.target_id,
    profile: manifest.runtime.profile,
    viewport: { width: target.viewport.width, height: target.viewport.height },
    document_id: receipt.document_id,
    canonical_hash: receipt.canonical_hash,
    compile_key: receipt.compile_key,
    build_hash: receipt.build_hash,
    html_hash: receipt.html_hash,
    document_promotion_hash: receipt.promotion_hash,
    html_base64: Buffer.from(document.doc.html,"utf8").toString("base64")
  };
}
function packageRuntimeSource(){ return String.raw`(()=>{
"use strict";
let manifest=null,ready=false,activeTargetId=null,mode="error";const diagnostics=[];const frame=document.querySelector("#figthread-package-frame");
const diag=(code,message,extra={})=>diagnostics.push({code,severity:"error",stage_owner:"document-package-runtime",message,...extra});
const canon=v=>{if(v===null||typeof v==="boolean"||typeof v==="string")return JSON.stringify(v);if(typeof v==="number"){if(!Number.isFinite(v))throw new TypeError("non-finite canonical number");return Object.is(v,-0)?"0":JSON.stringify(v)}if(Array.isArray(v))return "["+v.map(canon).join(",")+"]";if(typeof v==="object"){const k=Object.keys(v).sort();return "{"+k.map(x=>JSON.stringify(x)+":"+canon(v[x])).join(",")+"}"}throw new TypeError("unsupported canonical value")};
const sha=async v=>{const bytes=new TextEncoder().encode(typeof v==="string"?v:canon(v));const digest=await crypto.subtle.digest("SHA-256",bytes);return "sha256:"+[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")};
const clone=v=>JSON.parse(JSON.stringify(v));
const decode=b64=>{const bin=atob(b64),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)};
const byId=id=>manifest.targets.find(x=>x.target_id===id)||null;
function setButtons(id){for(const button of document.querySelectorAll("[data-package-target]"))button.setAttribute("aria-pressed",button.dataset.packageTarget===id?"true":"false")}
async function activateTarget(id){if(!ready)throw new Error("package runtime not ready");const target=byId(id);if(!target)throw new Error("target not embedded: "+id);const html=decode(target.html_base64);if(await sha(html)!==target.html_hash)throw new Error("embedded target html hash mismatch: "+id);activeTargetId=id;frame.width=String(target.viewport.width);frame.height=String(target.viewport.height);frame.style.width=target.viewport.width+"px";frame.style.height=target.viewport.height+"px";frame.srcdoc=html;setButtons(id);document.documentElement.dataset.figthreadPackageTarget=id;return Object.freeze({id,profile:target.profile,viewport:clone(target.viewport),html_hash:target.html_hash})}
async function bootstrap(){try{const raw=document.querySelector("#figthread-package-manifest");if(!raw||!frame)throw Object.assign(new Error("package payload missing"),{code:"PKG005_HASH"});manifest=JSON.parse(raw.textContent);if(manifest.schema_version!=="figthread.document-package/0.1")throw Object.assign(new Error("incompatible package schema"),{code:"PKG005_HASH"});const base=clone(manifest);delete base.package_hash;if(await sha(base)!==manifest.package_hash)throw Object.assign(new Error("package hash mismatch"),{code:"PKG005_HASH"});if(new Set(manifest.target_order).size!==manifest.target_order.length||manifest.target_order.length!==manifest.targets.length)throw Object.assign(new Error("package target order is invalid"),{code:"PKG004_DUPLICATE"});for(const target of manifest.targets){if(!manifest.target_order.includes(target.target_id))throw Object.assign(new Error("target missing from package order"),{code:"PKG003_TARGET"});const html=decode(target.html_base64);if(await sha(html)!==target.html_hash)throw Object.assign(new Error("embedded child html hash mismatch: "+target.target_id),{code:"PKG005_HASH"})}mode=manifest.runtime.initial_mode;ready=true;document.documentElement.dataset.figthreadPackageStatus="ready";document.documentElement.dataset.figthreadPackageMode=mode;for(const button of document.querySelectorAll("[data-package-target]"))button.addEventListener("click",()=>activateTarget(button.dataset.packageTarget));await activateTarget(manifest.default_target_id)}catch(error){ready=false;mode="error";diag(error.code||"PKG007_RUNTIME",error.message);document.documentElement.dataset.figthreadPackageStatus="error";const out=document.querySelector("#figthread-package-error");if(out){out.hidden=false;out.textContent="Figthread package runtime error: "+error.message}}}
window.FigthreadPackage=Object.freeze({
 getStatus:()=>Object.freeze({ready,mode,package_id:manifest?.package_id||null,active_target_id:activeTargetId,target_count:manifest?.targets?.length||0}),
 listTargets:()=>manifest?manifest.target_order.map(id=>{const x=byId(id);return Object.freeze({id:x.target_id,profile:x.profile,viewport:clone(x.viewport),active:x.target_id===activeTargetId,html_hash:x.html_hash})}):[],
 activateTarget,
 getActiveTarget:()=>activeTargetId?Object.freeze(clone(byId(activeTargetId))):null,
 getDiagnostics:()=>clone(diagnostics)
});
bootstrap();
})();`; }
function htmlFor(manifest){
  const buttons=manifest.target_order.map(id=>{const target=manifest.targets.find(x=>x.target_id===id);return `<button type="button" data-package-target="${id}" aria-pressed="${id===manifest.default_target_id?"true":"false"}">${id} · ${target.profile} · ${target.viewport.width}×${target.viewport.height}</button>`}).join("");
  return `<!doctype html><html lang="en" data-figthread-package-status="booting"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${manifest.package_id}</title><style>html,body{margin:0;min-height:100%;font-family:ui-sans-serif,system-ui,sans-serif;background:#f6f6f4;color:#1f2328}#figthread-package-shell{display:grid;grid-template-rows:auto 1fr;min-height:100vh}#figthread-package-toolbar{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid #d8d8d4;background:#fff;position:sticky;top:0;z-index:2}#figthread-package-toolbar button{font:inherit;padding:6px 9px;border:1px solid #b8b8b2;border-radius:6px;background:#fff;cursor:pointer}#figthread-package-toolbar button[aria-pressed=true]{font-weight:700;border-color:#555}#figthread-package-stage{overflow:auto;padding:12px}#figthread-package-frame{display:block;border:0;background:#fff;max-width:none;max-height:none}#figthread-package-error{padding:12px;color:#8b1e1e}[data-figthread-package-mode=clean] #figthread-package-toolbar,[data-figthread-package-mode=static] #figthread-package-toolbar{display:none}[data-figthread-package-mode=clean] #figthread-package-stage,[data-figthread-package-mode=static] #figthread-package-stage{padding:0}</style></head><body><main id="figthread-package-shell"><nav id="figthread-package-toolbar" aria-label="Figthread targets">${buttons}</nav><section id="figthread-package-stage"><iframe id="figthread-package-frame" title="Figthread target"></iframe><div id="figthread-package-error" hidden></div></section></main><script id="figthread-package-manifest" type="application/json">${escapeScriptJson(manifest)}</script><script>${packageRuntimeSource()}</script></body></html>`;
}

export function composeFigthreadPackage(documentPromotions, options={}){
  const mode=options.mode??"gate",initialMode=options.initialMode??"interactive";
  if(!["draft","gate"].includes(mode))throw new TypeError("document package mode must be 'draft' or 'gate'");
  if(!MODES.includes(initialMode))throw new TypeError("document package initial mode must be interactive, clean, or static");
  const issues=[];
  if(!Array.isArray(documentPromotions)||documentPromotions.length<2)return {mode,status:"fail",promotion_eligible:false,document_package_engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION,issues:[issue("PKG003_TARGET","error","multi-target packaging requires at least two promoted documents")]};
  const documents=documentPromotions.map((promotion,index)=>{const document=readDocumentPromotion(promotion);if(!document)issues.push(issue("PKG001_BIND","error",`target document ${index} is missing, tampered, or not promoted`,{path:`$.documents[${index}]`}));return document;}).filter(Boolean);
  if(issues.length)return {mode,status:"fail",promotion_eligible:false,document_package_engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION,issues:sortIssues(issues)};
  const semanticHashes=documents.map(semanticHash),semanticIdentity=semanticHashes[0];
  for(let i=1;i<semanticHashes.length;i++)if(semanticHashes[i]!==semanticIdentity)issues.push(issue("PKG002_SEMANTIC","error","all packaged targets must share the same semantic figure content apart from profile selection",{target_id:documents[i].receipt.target_id}));
  const entries=documents.map(childEntry).sort((a,b)=>a.target_id.localeCompare(b.target_id));
  const ids=entries.map(x=>x.target_id),duplicates=ids.filter((id,index)=>ids.indexOf(id)!==index);
  for(const id of [...new Set(duplicates)])issues.push(issue("PKG004_DUPLICATE","error",`duplicate target id ${id}`,{target_id:id}));
  for(const entry of entries){if(!Number.isFinite(entry.viewport.width)||!Number.isFinite(entry.viewport.height)||entry.viewport.width<=0||entry.viewport.height<=0)issues.push(issue("PKG003_TARGET","error","packaged target viewport is invalid",{target_id:entry.target_id}));}
  const defaultTargetId=options.defaultTargetId??ids[0]; if(!ids.includes(defaultTargetId))issues.push(issue("PKG003_TARGET","error",`default target ${String(defaultTargetId)} is not packaged`,{target_id:defaultTargetId}));
  if(issues.length)return {mode,status:"fail",promotion_eligible:false,document_package_engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION,semantic_hash:semanticIdentity,issues:sortIssues(issues)};
  let resolvedPackageId; try{resolvedPackageId=packageId(options.packageId,semanticIdentity);}catch(error){return {mode,status:"fail",promotion_eligible:false,document_package_engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION,issues:[issue(error.code||"PKG003_TARGET","error",error.message)]};}
  const manifestBase={schema_version:DOCUMENT_PACKAGE_SCHEMA_VERSION,package_id:resolvedPackageId,semantic_hash:semanticIdentity,default_target_id:defaultTargetId,target_order:ids,targets:entries,runtime:{initial_mode:initialMode,allowed_modes:[...MODES],target_switching:"exact-promoted-document",css_geometry_scaling:false}};
  const manifest=deepFreeze({...manifestBase,package_hash:sha256Canonical(manifestBase)});
  const structural=validateStructure(manifest,DOCUMENT_PACKAGE_SCHEMA).map(x=>issue("PKG005_HASH","error",`document package manifest ${x.path}: ${x.message}`,{path:x.path}));
  if(structural.length)return {mode,status:"fail",promotion_eligible:false,document_package_engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION,issues:sortIssues(structural)};
  const html=htmlFor(manifest);
  const purity=[];if(/<(?:script|link|img|iframe|object|embed)[^>]+(?:src|href|data)=["']https?:/i.test(html))purity.push(issue("PKG006_PURITY","error","package HTML contains an external runtime URL"));
  if(/transform\s*:\s*scale\s*\(/i.test(html))purity.push(issue("PKG003_TARGET","error","package HTML may not scale promoted target geometry with CSS transforms"));
  if(purity.length)return {mode,status:"fail",promotion_eligible:false,document_package_engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION,issues:sortIssues(purity)};
  const htmlHash=sha256Text(html);
  return deepFreeze({schema_version:DOCUMENT_PACKAGE_SCHEMA_VERSION,package_id:resolvedPackageId,semantic_hash:semanticIdentity,package_hash:manifest.package_hash,html_hash:htmlHash,mode,status:"pass",promotion_eligible:mode==="gate",document_package_engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION,issues:[],manifest,html});
}

export function promoteFigthreadPackage(documentPromotions,options={}){
  const result=composeFigthreadPackage(documentPromotions,{...options,mode:"gate"});
  if(!result.promotion_eligible)return {promoted:false,report:result};
  const receiptBase={kind:"figthread_document_package",schema_version:DOCUMENT_PACKAGE_SCHEMA_VERSION,package_id:result.package_id,semantic_hash:result.semantic_hash,package_hash:result.package_hash,html_hash:result.html_hash,target_ids:result.manifest.target_order.slice(),child_html_hashes:Object.fromEntries(result.manifest.targets.map(x=>[x.target_id,x.html_hash])),engine_version:DOCUMENT_PACKAGE_ENGINE_VERSION};
  return {promoted:true,report:result,figthread_document_package:deepFreeze({manifest:result.manifest,html:result.html,html_hash:result.html_hash}),promotion_receipt:deepFreeze({...receiptBase,promotion_hash:sha256Canonical(receiptBase)})};
}

export function readDocumentPackagePromotion(promotion){
  if(!receiptValid(promotion)||!promotion.figthread_document_package)return null;
  const receipt=promotion.promotion_receipt,pkg=promotion.figthread_document_package;
  if(receipt.kind!=="figthread_document_package"||pkg.html_hash!==receipt.html_hash||sha256Text(pkg.html)!==receipt.html_hash)return null;
  if(pkg.manifest?.package_hash!==receipt.package_hash||pkg.manifest?.semantic_hash!==receipt.semantic_hash||pkg.manifest?.package_id!==receipt.package_id)return null;
  const {package_hash,...base}=pkg.manifest;if(sha256Canonical(base)!==package_hash)return null;
  if(sha256Canonical(pkg.manifest.target_order)!==sha256Canonical(receipt.target_ids))return null;
  for(const target of pkg.manifest.targets)if(receipt.child_html_hashes?.[target.target_id]!==target.html_hash)return null;
  return deepFreeze({receipt,package:pkg});
}
