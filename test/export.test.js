import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promoteFigureSpec } from "../skills/figthread/runtime/validator.js";
import { promoteGrammarPlan } from "../skills/figthread/runtime/grammar.js";
import { promoteVisualSpec } from "../skills/figthread/runtime/visual.js";
import { promoteProfilePlan } from "../skills/figthread/runtime/profile.js";
import { promoteProfileLayout } from "../skills/figthread/runtime/visual-layout.js";
import { promoteRenderedSvg } from "../skills/figthread/runtime/renderer.js";
import { promoteProfileMotionProgram } from "../skills/figthread/runtime/profile-motion.js";
import { promoteFigthreadDocument } from "../skills/figthread/runtime/document.js";
import { compileExport, exportPayloadToBuffer, promoteExportArtifact } from "../skills/figthread/runtime/export.js";
import { sha256Canonical } from "../skills/figthread/runtime/canonicalize.js";

const figure=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.figure.json",import.meta.url),"utf8"));
const visual=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.visual.json",import.meta.url),"utf8"));
const target=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.layout-target.json",import.meta.url),"utf8"));
const motion=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.motion.json",import.meta.url),"utf8"));
const svgRequest=JSON.parse(await readFile(new URL("../skills/figthread/examples/minimal.export.json",import.meta.url),"utf8"));

function chain(withMotion=true){
  const figurePromotion=promoteFigureSpec(figure);assert.equal(figurePromotion.promoted,true);
  const grammarPromotion=promoteGrammarPlan(figurePromotion);assert.equal(grammarPromotion.promoted,true);
  const visualPromotion=promoteVisualSpec(figurePromotion,visual);assert.equal(visualPromotion.promoted,true);
  const profilePromotion=promoteProfilePlan(figurePromotion,visualPromotion,target);assert.equal(profilePromotion.promoted,true);
  const layoutPromotion=promoteProfileLayout(figurePromotion,grammarPromotion,visualPromotion,profilePromotion);assert.equal(layoutPromotion.promoted,true,JSON.stringify(layoutPromotion.report));
  const renderPromotion=promoteRenderedSvg(figurePromotion,visualPromotion,profilePromotion,layoutPromotion);assert.equal(renderPromotion.promoted,true,JSON.stringify(renderPromotion.report));
  const motionPromotion=withMotion?promoteProfileMotionProgram(figurePromotion,profilePromotion,layoutPromotion,motion):null;if(withMotion)assert.equal(motionPromotion.promoted,true,JSON.stringify(motionPromotion.report));
  const authorities={figurePromotion,grammarPromotion,visualPromotion,profilePromotion,layoutPromotion,renderPromotion,motionPromotion};
  const canonical={figure,visual,target,motion:withMotion?motion:null};
  const documentPromotion=promoteFigthreadDocument(authorities,canonical);assert.equal(documentPromotion.promoted,true,JSON.stringify(documentPromotion.report));
  return {documentPromotion,renderPromotion,motionPromotion};
}
function request(format,overrides={}){
  const base={...svgRequest,id:`export:test-${format}`,format,frame:format==="html"?{kind:"document"}:{kind:"static-summary"},background:"profile",scale:1,live_text:format!=="png",extensions:{}};
  return {...base,...overrides,frame:overrides.frame??base.frame};
}
function crcTable(){const table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;}
const CRC_TABLE=crcTable();
function crc32(bytes){let c=0xffffffff;for(const byte of bytes)c=CRC_TABLE[(c^byte)&0xff]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data=Buffer.alloc(0)){const t=Buffer.from(type,"ascii"),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([len,t,data,crc]);}
function png(width,height){const signature=Buffer.from([137,80,78,71,13,10,26,10]),ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;return Buffer.concat([signature,chunk("IHDR",ihdr),chunk("IDAT",Buffer.from([0x78,0x9c,0x03,0x00,0x00,0x00,0x00,0x01])),chunk("IEND")]);}
const environment={browser_name:"Chromium",browser_version:"test-1",os:"linux-test",font_fingerprint:"sha256:test-fonts",device_scale_factor:1};

test("export schema and example mirrors match installed skill",async()=>{const [a,b,c,d]=await Promise.all([readFile(new URL("../skills/figthread/schemas/export-spec.schema.json",import.meta.url),"utf8"),readFile(new URL("../schemas/export-spec.schema.json",import.meta.url),"utf8"),readFile(new URL("../skills/figthread/examples/minimal.export.json",import.meta.url),"utf8"),readFile(new URL("../examples/minimal.export.json",import.meta.url),"utf8")]);assert.equal(a,b);assert.equal(c,d);});

test("default SVG export is byte-identical to the promoted rendered SVG",async()=>{const c=chain(true),compiled=compileExport(c.documentPromotion,c.renderPromotion,svgRequest);assert.equal(compiled.status,"pass");assert.equal(compiled.artifact_ready,true);assert.equal(compiled.payload.data,c.renderPromotion.rendered_svg.svg);const promoted=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,svgRequest);assert.equal(promoted.promoted,true,JSON.stringify(promoted.report));assert.equal(promoted.export_artifact.content_hash,c.renderPromotion.promotion_receipt.svg_hash);assert.equal(promoted.export_artifact.determinism_scope,"exact-bytes");assert.equal(Object.isFrozen(promoted.export_plan),true);});

test("SVG presentation scale and background do not rewrite canonical geometry",async()=>{const c=chain(true),spec=request("svg",{scale:2,background:"transparent"}),promoted=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,spec);assert.equal(promoted.promoted,true,JSON.stringify(promoted.report));const svg=promoted.payload.data;assert.match(svg,/width="1600"/);assert.match(svg,/height="600"/);assert.match(svg,/viewBox="0 0 800 300"/);assert.match(svg,/data-background="true"/);assert.match(svg,/fill="none"[^>]*data-background="true"/);assert.equal(promoted.promotion_receipt.svg_hash,c.renderPromotion.promotion_receipt.svg_hash);assert.notEqual(promoted.export_artifact.content_hash,c.renderPromotion.promotion_receipt.svg_hash);});

test("HTML export preserves the exact promoted self-contained document",async()=>{const c=chain(true),spec=request("html"),promoted=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,spec);assert.equal(promoted.promoted,true,JSON.stringify(promoted.report));assert.equal(promoted.payload.data,c.documentPromotion.figthread_document.html);assert.equal(promoted.export_artifact.content_hash,c.documentPromotion.promotion_receipt.html_hash);const bad=compileExport(c.documentPromotion,c.renderPromotion,{...spec,frame:{kind:"static-summary"}});assert.equal(bad.status,"fail");assert.ok(bad.issues.some(i=>i.code==="EXP004_FRAME"));});

test("PNG promotion fails closed without a browser capture adapter and exposes its capture plan",async()=>{const c=chain(true),spec=request("png"),result=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,spec);assert.equal(result.promoted,false);assert.equal(result.report.status,"fail");assert.ok(result.report.issues.some(i=>i.code==="EXP009_CAPTURE"));assert.equal(result.capture_plan.selector,"#figthread-stage svg");assert.equal(result.capture_plan.runtime_mode,"static");assert.equal(result.capture_plan.width_px,800);assert.equal(result.capture_plan.height_px,300);});

test("PNG browser capture binds semantic state, target, source hashes, dimensions, and environment",async()=>{const c=chain(true),spec=request("png",{scale:2}),compiled=compileExport(c.documentPromotion,c.renderPromotion,spec);const capture=compiled.export_plan.capture;const result=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,spec,{capturePng:async()=>({data_base64:png(capture.width_px,capture.height_px).toString("base64"),prepared:{target_id:spec.target_id,build_hash:c.documentPromotion.promotion_receipt.build_hash,svg_hash:c.renderPromotion.promotion_receipt.svg_hash,frame:spec.frame,state_hash:capture.expected_state_hash},environment})});assert.equal(result.promoted,true,JSON.stringify(result.report));assert.equal(result.export_artifact.mime_type,"image/png");assert.equal(result.export_artifact.determinism_scope,"same-inputs-same-environment-visual");assert.equal(result.export_artifact.environment_fingerprint,sha256Canonical(environment));assert.equal(exportPayloadToBuffer(result.payload).length,result.export_artifact.byte_length);});

test("time-frame PNG plan uses deterministic event-sourced motion state",async()=>{const c=chain(true),spec=request("png",{frame:{kind:"time",time_ms:1500}}),compiled=compileExport(c.documentPromotion,c.renderPromotion,spec);assert.equal(compiled.status,"pass");assert.equal(compiled.export_plan.capture.runtime_mode,"clean");assert.equal(compiled.export_plan.capture.expected_local_time_ms,1500);const result=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,spec,{capturePng:async input=>({data_base64:png(input.capture.width_px,input.capture.height_px).toString("base64"),prepared:{target_id:spec.target_id,build_hash:c.documentPromotion.promotion_receipt.build_hash,svg_hash:c.renderPromotion.promotion_receipt.svg_hash,frame:spec.frame,state_hash:input.capture.expected_state_hash},environment})});assert.equal(result.promoted,true,JSON.stringify(result.report));});

test("PNG capture rejects wrong dimensions or semantic preparation evidence",async()=>{const c=chain(true),spec=request("png"),compiled=compileExport(c.documentPromotion,c.renderPromotion,spec),capture=compiled.export_plan.capture;const wrongSize=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,spec,{capturePng:async()=>({data_base64:png(1,1).toString("base64"),prepared:{target_id:spec.target_id,build_hash:c.documentPromotion.promotion_receipt.build_hash,svg_hash:c.renderPromotion.promotion_receipt.svg_hash,frame:spec.frame,state_hash:capture.expected_state_hash},environment})});assert.equal(wrongSize.promoted,false);assert.ok(wrongSize.report.issues.some(i=>i.code==="EXP009_CAPTURE"));const wrongState=await promoteExportArtifact(c.documentPromotion,c.renderPromotion,spec,{capturePng:async()=>({data_base64:png(800,300).toString("base64"),prepared:{target_id:spec.target_id,build_hash:c.documentPromotion.promotion_receipt.build_hash,svg_hash:c.renderPromotion.promotion_receipt.svg_hash,frame:spec.frame,state_hash:"sha256:"+"0".repeat(64)},environment})});assert.equal(wrongState.promoted,false);assert.ok(wrongState.report.issues.some(i=>i.code==="EXP009_CAPTURE"));});

test("export rejects source drift, unsupported extensions, and invalid live-text policy",()=>{const c=chain(true);const badSource=structuredClone(c.renderPromotion);badSource.promotion_receipt.svg_hash="sha256:"+"0".repeat(64);assert.equal(compileExport(c.documentPromotion,badSource,svgRequest).status,"fail");const ext=compileExport(c.documentPromotion,c.renderPromotion,{...svgRequest,extensions:{"example.export":{}}});assert.equal(ext.status,"fail");assert.ok(ext.issues.some(i=>i.code==="EXP010_PURITY"));const text=compileExport(c.documentPromotion,c.renderPromotion,{...svgRequest,live_text:false});assert.equal(text.status,"fail");assert.ok(text.issues.some(i=>i.code==="EXP006_TEXT"));});
