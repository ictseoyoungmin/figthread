import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";
import { evaluateMotionProgram } from "./motion.js";

export const EXPORT_ENGINE_VERSION = "0.1.0";
export const EXPORT_SPEC_SCHEMA_VERSION = "figthread.export/0.1";
export const EXPORT_PLAN_SCHEMA_VERSION = "figthread.export-plan/0.1";
export const EXPORT_ARTIFACT_SCHEMA_VERSION = "figthread.export-artifact/0.1";

const schemaUrl = new URL("../schemas/export-spec.schema.json", import.meta.url);
const EXPORT_SCHEMA = JSON.parse(readFileSync(fileURLToPath(schemaUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };
const mimeTypes = Object.freeze({ html: "text/html; charset=utf-8", svg: "image/svg+xml; charset=utf-8", png: "image/png" });
const extensions = Object.freeze({ html: "html", svg: "svg", png: "png" });

function issue(code, severity, message, extra = {}) { return { code, severity, stage_owner: "export", message, ...extra }; }
function sortIssues(issues) { return issues.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||a.code.localeCompare(b.code)||(a.path??"").localeCompare(b.path??"")||a.message.localeCompare(b.message)); }
function deepFreeze(value, seen=new Set()){ if(value===null||typeof value!=="object"||seen.has(value))return value; seen.add(value); for(const child of Object.values(value))deepFreeze(child,seen); return Object.freeze(value); }
function sha256Bytes(bytes){ return `sha256:${createHash("sha256").update(bytes).digest("hex")}`; }
function sha256Text(text){ return sha256Bytes(Buffer.from(text,"utf8")); }
function receiptValid(promotion){ if(!promotion?.promoted||!promotion.promotion_receipt)return false; const {promotion_hash,...base}=promotion.promotion_receipt; return sha256Canonical(base)===promotion_hash; }
function artifactId(spec){ return `artifact:${spec.id.replace(/^export:/,"")}`; }
function filenameFor(spec){ return `${spec.id.replace(/^export:/,"")}.${extensions[spec.format]}`; }

function readDocumentPromotion(promotion){
  if(!receiptValid(promotion)||!promotion.figthread_document)return null;
  const receipt=promotion.promotion_receipt,doc=promotion.figthread_document,manifest=doc.manifest;
  if(!manifest||typeof doc.html!=="string"||doc.html_hash!==receipt.html_hash||sha256Text(doc.html)!==receipt.html_hash)return null;
  if(manifest.document_id!==receipt.document_id||manifest.build_hash!==receipt.build_hash||manifest.compile_key!==receipt.compile_key||manifest.canonical?.canonical_hash!==receipt.canonical_hash||manifest.runtime?.target_id!==receipt.target_id)return null;
  const {build_hash,...manifestBase}=manifest;
  if(sha256Canonical(manifestBase)!==build_hash)return null;
  return { doc, manifest, receipt };
}
function readRenderPromotion(promotion){
  if(!receiptValid(promotion)||!promotion.rendered_svg)return null;
  const receipt=promotion.promotion_receipt,rendered=promotion.rendered_svg;
  if(typeof rendered.svg!=="string"||sha256Text(rendered.svg)!==receipt.svg_hash||rendered.svg_hash!==receipt.svg_hash||rendered.render_hash!==receipt.render_hash)return null;
  if(rendered.evidence?.evidence_hash!==receipt.evidence_hash)return null;
  return { rendered, receipt };
}
function summaryState(manifest){
  const program=manifest.compiled.motion_program;
  if(program?.static_state)return structuredClone(program.static_state);
  const figure=manifest.canonical.figure,snapshot=(figure.snapshots??[]).find(entry=>entry.id===figure.static_snapshot_id);
  if(snapshot)return structuredClone(snapshot.state_values??{});
  return Object.fromEntries((figure.states??[]).map(state=>[state.id,state.summary]));
}
function expectedFrameState(manifest, frame){
  if(frame.kind==="static-summary")return {time_ms:0,state:summaryState(manifest)};
  const program=manifest.compiled.motion_program;
  if(!program)return null;
  const sample=evaluateMotionProgram(program,frame.time_ms);
  return {time_ms:sample.time_ms,state:structuredClone(sample.state)};
}
function vectorEligible(svg){
  if(/<(?:script|foreignObject|image|video|canvas)\b/i.test(svg))return false;
  if(/\b(?:href|xlink:href)\s*=|url\s*\(/i.test(svg))return false;
  return true;
}
function setSvgBackground(svg, background){
  if(background==="profile")return svg;
  const fill=background==="transparent"?"none":background.toLowerCase();
  return svg.replace(/<rect\b[^>]*\bdata-background="true"[^>]*\/>/,match=>match.replace(/\bfill="[^"]*"/,`fill="${fill}"`));
}
function setSvgScale(svg, viewport, scale){
  if(scale===1)return svg;
  return svg.replace(/^<svg\b[^>]*>/,tag=>tag.replace(/\bwidth="[^"]*"/,`width="${viewport.width*scale}"`).replace(/\bheight="[^"]*"/,`height="${viewport.height*scale}"`));
}
function svgPayload(rendered, spec, viewport){ return setSvgScale(setSvgBackground(rendered.svg,spec.background),viewport,spec.scale); }

function semanticValidation(document, render, spec){
  const issues=[];
  const manifest=document.manifest;
  if(spec.document_id!==manifest.document_id)issues.push(issue("EXP002_SOURCE","error",`export document_id ${spec.document_id} does not match promoted document ${manifest.document_id}`,{path:"$.document_id"}));
  if(spec.target_id!==manifest.runtime.target_id)issues.push(issue("EXP003_TARGET","error",`export target_id ${spec.target_id} does not match promoted target ${manifest.runtime.target_id}`,{path:"$.target_id"}));
  if(spec.profile!==manifest.runtime.profile)issues.push(issue("EXP003_TARGET","error",`export profile ${spec.profile} does not match promoted profile ${manifest.runtime.profile}`,{path:"$.profile"}));
  if(render.receipt.svg_hash!==manifest.compiled.authorities.svg_hash||render.receipt.render_hash!==manifest.compiled.authorities.render_hash)issues.push(issue("EXP002_SOURCE","error","render authority does not match the promoted document compile key"));
  if(Object.keys(spec.extensions??{}).length)issues.push(issue("EXP010_PURITY","error","no export extension compiler is registered in the installed runtime",{path:"$.extensions"}));

  const hasTime=Object.prototype.hasOwnProperty.call(spec.frame,"time_ms");
  if(spec.frame.kind==="time"&&!hasTime)issues.push(issue("EXP004_FRAME","error","time export requires frame.time_ms",{path:"$.frame.time_ms"}));
  if(spec.frame.kind!=="time"&&hasTime)issues.push(issue("EXP004_FRAME","error",`${spec.frame.kind} export must not declare frame.time_ms`,{path:"$.frame.time_ms"}));
  if(spec.format==="html"){
    if(spec.frame.kind!=="document")issues.push(issue("EXP004_FRAME","error","HTML export preserves the canonical document and requires frame.kind=document"));
    if(spec.background!=="profile"||spec.scale!==1||spec.live_text!==true)issues.push(issue("EXP005_FORMAT","error","HTML export requires profile background, scale 1, and live_text true"));
  }
  if(spec.format==="svg"){
    if(spec.frame.kind!=="static-summary")issues.push(issue("EXP004_FRAME","error","standalone SVG export is certified only for the semantic static-summary frame"));
    if(spec.live_text!==true)issues.push(issue("EXP006_TEXT","error","the installed SVG exporter preserves live text and cannot outline glyphs"));
    if(!vectorEligible(render.rendered.svg))issues.push(issue("EXP007_VECTOR","error","rendered SVG is not eligible for standalone vector export"));
  }
  if(spec.format==="png"){
    if(!["static-summary","time"].includes(spec.frame.kind))issues.push(issue("EXP004_FRAME","error","PNG export requires static-summary or time frame"));
    if(spec.live_text!==false)issues.push(issue("EXP006_TEXT","error","PNG export is raster output and requires live_text false"));
    if(spec.frame.kind==="time"){
      const program=manifest.compiled.motion_program;
      if(!program)issues.push(issue("EXP004_FRAME","error","time-based PNG export requires a promoted MotionProgram"));
      else if(program.loop?.mode!=="repeat"&&spec.frame.time_ms>program.duration_ms)issues.push(issue("EXP004_FRAME","error",`frame.time_ms exceeds non-repeating motion duration ${program.duration_ms}`));
    }
  }
  return sortIssues(issues);
}
function capturePlan(document, spec){
  const viewport=document.manifest.compiled.resolved_layout.target.viewport;
  const sample=expectedFrameState(document.manifest,spec.frame);
  return {
    selector:"#figthread-stage svg",
    runtime_mode:spec.frame.kind==="static-summary"?"static":"clean",
    frame:structuredClone(spec.frame),
    background:spec.background,
    omit_background:spec.background==="transparent",
    scale:spec.scale,
    width_px:viewport.width*spec.scale,
    height_px:viewport.height*spec.scale,
    expected_state_hash:sample?sha256Canonical(sample.state):null,
    expected_local_time_ms:sample?.time_ms??null
  };
}
function planBase(document, render, spec){
  const manifest=document.manifest,viewport=manifest.compiled.resolved_layout.target.viewport;
  const source={
    document_id:manifest.document_id,
    canonical_hash:document.receipt.canonical_hash,
    compile_key:document.receipt.compile_key,
    build_hash:document.receipt.build_hash,
    html_hash:document.receipt.html_hash,
    svg_hash:render.receipt.svg_hash,
    render_hash:render.receipt.render_hash,
    motion_program_hash:manifest.compiled.authorities.motion_program_hash??null
  };
  const base={
    schema_version:EXPORT_PLAN_SCHEMA_VERSION,
    export_id:spec.id,
    request_hash:sha256Canonical(spec),
    source,
    target:{id:manifest.runtime.target_id,profile:manifest.runtime.profile,viewport:structuredClone(viewport)},
    format:spec.format,
    frame:structuredClone(spec.frame),
    background:spec.background,
    scale:spec.scale,
    live_text:spec.live_text,
    capture:spec.format==="png"?capturePlan(document,spec):null,
    engine_version:EXPORT_ENGINE_VERSION
  };
  return deepFreeze({...base,plan_hash:sha256Canonical(base)});
}
function payloadFor(document, render, spec){
  if(spec.format==="html")return {encoding:"utf-8",data:document.doc.html};
  if(spec.format==="svg")return {encoding:"utf-8",data:svgPayload(render.rendered,spec,document.manifest.compiled.resolved_layout.target.viewport)};
  return null;
}

export function compileExport(documentPromotion, renderPromotion, spec, options={}){
  const mode=options.mode??"gate";
  if(!["draft","gate"].includes(mode))throw new TypeError("export mode must be 'draft' or 'gate'");
  const document=readDocumentPromotion(documentPromotion),render=readRenderPromotion(renderPromotion);
  if(!document||!render)return {mode,status:"fail",promotion_eligible:false,export_engine_version:EXPORT_ENGINE_VERSION,issues:[issue("EXP001_AUTHORITY","error","export compilation requires matching promoted document and render authorities")]};
  const structural=validateStructure(spec,EXPORT_SCHEMA).map(entry=>issue("EXP001_SCHEMA","error",`export request ${entry.path}: ${entry.message}`,{path:entry.path}));
  if(structural.length)return {mode,status:"fail",promotion_eligible:false,export_engine_version:EXPORT_ENGINE_VERSION,issues:sortIssues(structural)};
  const issues=semanticValidation(document,render,spec),hasErrors=issues.some(entry=>entry.severity==="error");
  if(hasErrors)return {document_id:document.manifest.document_id,request_hash:sha256Canonical(spec),mode,status:"fail",promotion_eligible:false,export_engine_version:EXPORT_ENGINE_VERSION,issues};
  const plan=planBase(document,render,spec),payload=payloadFor(document,render,spec);
  return deepFreeze({document_id:document.manifest.document_id,request_hash:plan.request_hash,plan_hash:plan.plan_hash,mode,status:issues.some(entry=>entry.severity==="warning")?"pass-with-warnings":"pass",promotion_eligible:mode==="gate",artifact_ready:Boolean(payload),export_engine_version:EXPORT_ENGINE_VERSION,issues,export_plan:plan,payload});
}

function crcTable(){ const table=[]; for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table; }
const CRC_TABLE=crcTable();
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=CRC_TABLE[(c^byte)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;}
function inspectPng(bytes){
  const signature=Buffer.from([137,80,78,71,13,10,26,10]);
  if(bytes.length<33||!bytes.subarray(0,8).equals(signature))throw new Error("capture payload is not a PNG file");
  let offset=8,width=null,height=null,sawIdat=false,sawIend=false,chunkIndex=0;
  while(offset+12<=bytes.length){
    const length=bytes.readUInt32BE(offset),type=bytes.toString("ascii",offset+4,offset+8),dataStart=offset+8,dataEnd=dataStart+length,crcOffset=dataEnd;
    if(crcOffset+4>bytes.length)throw new Error("PNG chunk exceeds payload length");
    const expected=bytes.readUInt32BE(crcOffset),actual=crc32(bytes.subarray(offset+4,dataEnd));
    if(expected!==actual)throw new Error(`PNG ${type} chunk CRC mismatch`);
    if(chunkIndex===0){if(type!=="IHDR"||length!==13)throw new Error("PNG must begin with a 13-byte IHDR chunk");width=bytes.readUInt32BE(dataStart);height=bytes.readUInt32BE(dataStart+4);}
    if(type==="IDAT")sawIdat=true;
    if(type==="IEND"){if(length!==0)throw new Error("PNG IEND chunk must be empty");sawIend=true;offset=crcOffset+4;break;}
    offset=crcOffset+4;chunkIndex++;
  }
  if(!sawIdat||!sawIend||offset!==bytes.length)throw new Error("PNG must contain IDAT and terminal IEND chunks without trailing bytes");
  return {width,height};
}
function validateEnvironment(environment){
  if(!environment||typeof environment!=="object")throw new Error("PNG capture must report an environment fingerprint");
  for(const key of ["browser_name","browser_version","os","font_fingerprint"]){if(typeof environment[key]!=="string"||!environment[key])throw new Error(`PNG environment.${key} must be a non-empty string`);}
  if(typeof environment.device_scale_factor!=="number"||!Number.isFinite(environment.device_scale_factor)||environment.device_scale_factor<=0)throw new Error("PNG environment.device_scale_factor must be a positive finite number");
  return structuredClone(environment);
}
function validatePrepared(prepared, document, render, plan){
  if(!prepared||typeof prepared!=="object")throw new Error("PNG capture must return Figthread.prepareExport evidence");
  if(prepared.target_id!==plan.target.id||prepared.build_hash!==document.receipt.build_hash||prepared.svg_hash!==render.receipt.svg_hash)throw new Error("browser preparation evidence does not match promoted source authorities");
  if(sha256Canonical(prepared.frame)!==sha256Canonical(plan.frame))throw new Error("browser preparation frame does not match export plan");
  if(prepared.state_hash!==plan.capture.expected_state_hash)throw new Error("browser preparation state hash does not match deterministic export state");
}
function contentMetadata(spec, payload, environment=null){
  const bytes=payload.encoding==="base64"?Buffer.from(payload.data,"base64"):Buffer.from(payload.data,"utf8");
  const environmentFingerprint=environment?sha256Canonical(environment):null;
  const base={
    schema_version:EXPORT_ARTIFACT_SCHEMA_VERSION,
    artifact_id:artifactId(spec),
    export_id:spec.id,
    format:spec.format,
    mime_type:mimeTypes[spec.format],
    filename:filenameFor(spec),
    payload_encoding:payload.encoding,
    content_hash:sha256Bytes(bytes),
    byte_length:bytes.length,
    environment_fingerprint:environmentFingerprint,
    determinism_scope:spec.format==="png"?"same-inputs-same-environment-visual":"exact-bytes"
  };
  return deepFreeze({...base,artifact_hash:sha256Canonical(base)});
}
export function exportPayloadToBuffer(payload){ if(!payload||!["utf-8","base64"].includes(payload.encoding))throw new TypeError("invalid export payload"); return payload.encoding==="base64"?Buffer.from(payload.data,"base64"):Buffer.from(payload.data,"utf8"); }

export async function promoteExportArtifact(documentPromotion, renderPromotion, spec, options={}){
  const compiled=compileExport(documentPromotion,renderPromotion,spec,{mode:"gate"});
  if(!compiled.promotion_eligible)return {promoted:false,report:compiled};
  const document=readDocumentPromotion(documentPromotion),render=readRenderPromotion(renderPromotion);
  let payload=compiled.payload,environment=null,prepared=null;
  if(spec.format==="png"){
    if(typeof options.capturePng!=="function"){
      const report={...compiled,status:"fail",promotion_eligible:false,artifact_ready:false,issues:[...compiled.issues,issue("EXP009_CAPTURE","error","PNG promotion requires a browser capture adapter that executes the promoted HTML export plan")]};
      return {promoted:false,report:deepFreeze(report),capture_plan:compiled.export_plan.capture};
    }
    try{
      const captured=await options.capturePng(deepFreeze({html:document.doc.html,document_manifest:document.doc.manifest,capture:compiled.export_plan.capture}));
      if(typeof captured?.data_base64!=="string"||!captured.data_base64)throw new Error("PNG capture adapter returned no base64 payload");
      const bytes=Buffer.from(captured.data_base64,"base64"),dimensions=inspectPng(bytes);
      if(dimensions.width!==compiled.export_plan.capture.width_px||dimensions.height!==compiled.export_plan.capture.height_px)throw new Error(`PNG dimensions ${dimensions.width}x${dimensions.height} do not match planned ${compiled.export_plan.capture.width_px}x${compiled.export_plan.capture.height_px}`);
      environment=validateEnvironment(captured.environment);
      prepared=structuredClone(captured.prepared);
      validatePrepared(prepared,document,render,compiled.export_plan);
      payload={encoding:"base64",data:captured.data_base64};
    }catch(error){
      const report={...compiled,status:"fail",promotion_eligible:false,artifact_ready:false,issues:[...compiled.issues,issue("EXP009_CAPTURE","error",error.message)]};
      return {promoted:false,report:deepFreeze(report),capture_plan:compiled.export_plan.capture};
    }
  }
  const artifact=contentMetadata(spec,payload,environment);
  const receiptBase={
    kind:"export_artifact",
    schema_version:EXPORT_ARTIFACT_SCHEMA_VERSION,
    export_id:spec.id,
    request_hash:compiled.request_hash,
    plan_hash:compiled.plan_hash,
    document_id:document.receipt.document_id,
    canonical_hash:document.receipt.canonical_hash,
    compile_key:document.receipt.compile_key,
    build_hash:document.receipt.build_hash,
    html_hash:document.receipt.html_hash,
    svg_hash:render.receipt.svg_hash,
    render_hash:render.receipt.render_hash,
    content_hash:artifact.content_hash,
    artifact_hash:artifact.artifact_hash,
    environment_fingerprint:artifact.environment_fingerprint,
    engine_version:EXPORT_ENGINE_VERSION
  };
  const report=deepFreeze({...compiled,artifact_ready:true,export_artifact:artifact,prepared:prepared?deepFreeze(prepared):null});
  return {promoted:true,report,export_plan:compiled.export_plan,export_artifact:artifact,payload:deepFreeze(payload),prepared:prepared?deepFreeze(prepared):null,environment:environment?deepFreeze(environment):null,promotion_receipt:deepFreeze({...receiptBase,promotion_hash:sha256Canonical(receiptBase)})};
}
