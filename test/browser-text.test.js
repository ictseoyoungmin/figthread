import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256Canonical } from "../skills/figthread/runtime/canonicalize.js";
import { promoteFigureSpec } from "../skills/figthread/runtime/validator.js";
import { promoteGrammarPlan } from "../skills/figthread/runtime/grammar.js";
import { promoteVisualSpec } from "../skills/figthread/runtime/visual.js";
import { promoteProfilePlan } from "../skills/figthread/runtime/profile.js";
import { promoteProfileLayout } from "../skills/figthread/runtime/visual-layout.js";
import { promoteRenderedSvg } from "../skills/figthread/runtime/renderer.js";
import { promoteProfileMotionProgram } from "../skills/figthread/runtime/profile-motion.js";
import { promoteFigthreadDocument } from "../skills/figthread/runtime/document.js";
import { BROWSER_TEXT_OBSERVATION_SCHEMA_VERSION, compileBrowserTextEvidence, compileBrowserTextPlan, promoteBrowserTextEvidence } from "../skills/figthread/runtime/browser-text.js";

async function json(name){return JSON.parse(await readFile(new URL(`../skills/figthread/examples/${name}`,import.meta.url),"utf8"));}
async function authorities(){
  const [figure,visual,target,motion]=await Promise.all([json("minimal.figure.json"),json("minimal.visual.json"),json("minimal.layout-target.json"),json("minimal.motion.json")]);
  const figurePromotion=promoteFigureSpec(figure),grammarPromotion=promoteGrammarPlan(figurePromotion),visualPromotion=promoteVisualSpec(figurePromotion,visual),profilePromotion=promoteProfilePlan(figurePromotion,visualPromotion,target),layoutPromotion=promoteProfileLayout(figurePromotion,grammarPromotion,visualPromotion,profilePromotion),renderPromotion=promoteRenderedSvg(figurePromotion,visualPromotion,profilePromotion,layoutPromotion),motionPromotion=promoteProfileMotionProgram(figurePromotion,profilePromotion,layoutPromotion,motion),documentPromotion=promoteFigthreadDocument({figurePromotion,grammarPromotion,visualPromotion,profilePromotion,layoutPromotion,renderPromotion,motionPromotion},{figure,visual,target,motion},{initialMode:"static"});
  for(const promotion of [figurePromotion,grammarPromotion,visualPromotion,profilePromotion,layoutPromotion,renderPromotion,motionPromotion,documentPromotion])assert.equal(promotion.promoted,true);
  return{documentPromotion,renderPromotion};
}
function observationFor(plan, mutate=()=>{}){
  const measurements=plan.text.map(entry=>({text_id:entry.text_id,owner_id:entry.owner_id,role:entry.role,text:entry.text,requested_font_family:"ui-sans-serif,system-ui,sans-serif",computed_font_family:"Arial, sans-serif",font_size_px:plan.primary_font_floor_px,font_weight:"550",bbox:{x:entry.owner_box.x+2,y:entry.owner_box.y+2,w:Math.max(1,Math.min(12,entry.owner_box.w-4)),h:Math.max(1,Math.min(plan.primary_font_floor_px,entry.owner_box.h-4))},client_rect:{x:10,y:10,w:12,h:plan.primary_font_floor_px},display:"inline",visibility:"visible",opacity:1,fonts_status:"loaded",requested_font_available:true,platform_fonts:[{family_name:"Arial",glyph_count:Math.max(1,Array.from(entry.text).length),is_custom_font:false}]}));
  const base={schema_version:BROWSER_TEXT_OBSERVATION_SCHEMA_VERSION,document_id:plan.document_id,build_hash:plan.build_hash,html_hash:plan.html_hash,svg_hash:plan.svg_hash,target_id:plan.target_id,viewport:{...plan.viewport},measurements,environment:{browser_product:"Chrome/140.0",browser_revision:"r1",protocol_version:"1.3",js_version:"14.0",user_agent:"Chrome test",platform:"Linux x86_64",language:"en-US",device_pixel_ratio:1}};
  mutate(base);return{...base,observation_hash:sha256Canonical(base)};
}

test("browser text evidence promotes exact glyph/font/overflow coverage",async()=>{const {documentPromotion,renderPromotion}=await authorities(),planned=compileBrowserTextPlan(documentPromotion,renderPromotion,{mode:"gate"});assert.equal(planned.promotion_eligible,true);assert.equal(planned.browser_text_plan.text.length,4);const result=promoteBrowserTextEvidence(documentPromotion,renderPromotion,observationFor(planned.browser_text_plan));assert.equal(result.promoted,true);assert.equal(result.browser_text_evidence.metrics.browser_text_extent_certified,true);assert.equal(result.browser_text_evidence.metrics.platform_font_identity_certified,true);assert.deepEqual(result.browser_text_evidence.metrics.platform_font_families,["Arial"]);assert.match(result.promotion_receipt.promotion_hash,/^sha256:/);});

test("browser glyph overflow fails instead of being repaired downstream",async()=>{const {documentPromotion,renderPromotion}=await authorities(),plan=compileBrowserTextPlan(documentPromotion,renderPromotion,{mode:"gate"}).browser_text_plan;const observation=observationFor(plan,base=>{const m=base.measurements[1],owner=plan.text.find(x=>x.text_id===m.text_id).owner_box;m.bbox={x:owner.x-20,y:owner.y,w:owner.w+40,h:10};});const result=compileBrowserTextEvidence(documentPromotion,renderPromotion,observation,{mode:"gate"});assert.equal(result.promotion_eligible,false);assert.ok(result.issues.some(x=>x.code==="TXT004_OVERFLOW"));});

test("browser text evidence rejects missing platform font identity and source drift",async()=>{const {documentPromotion,renderPromotion}=await authorities(),plan=compileBrowserTextPlan(documentPromotion,renderPromotion,{mode:"gate"}).browser_text_plan;const observation=observationFor(plan,base=>{base.measurements[0].platform_fonts=[];base.measurements[1].text="Changed copy";});const result=compileBrowserTextEvidence(documentPromotion,renderPromotion,observation,{mode:"gate"});assert.equal(result.status,"fail");assert.ok(result.issues.some(x=>x.code==="TXT002_FONT"));assert.ok(result.issues.some(x=>x.code==="TXT009_SOURCE"));});

test("browser text observation hash is fail-closed",async()=>{const {documentPromotion,renderPromotion}=await authorities(),plan=compileBrowserTextPlan(documentPromotion,renderPromotion,{mode:"gate"}).browser_text_plan,observation=observationFor(plan);observation.measurements[0].font_size_px=1;const result=compileBrowserTextEvidence(documentPromotion,renderPromotion,observation,{mode:"gate"});assert.ok(result.issues.some(x=>x.code==="TXT010_EVIDENCE"));});
