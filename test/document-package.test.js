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
import { composeFigthreadPackage, promoteFigthreadPackage, readDocumentPackagePromotion } from "../skills/figthread/runtime/document-package.js";

const load = (name) => readFile(new URL(`../skills/figthread/examples/${name}`, import.meta.url), "utf8").then(JSON.parse);
async function fixtures(){const [figure,visual,request,motion]=await Promise.all([load("minimal.figure.json"),load("minimal.visual.json"),load("minimal.package.json"),load("minimal.motion.json")]);return{figure,visual,request,motion};}
function promoteChild(figure,visual,target,motion){
  const variant=structuredClone(figure);variant.profile=target.target.profile;
  const f=promoteFigureSpec(variant);assert.equal(f.promoted,true);
  const g=promoteGrammarPlan(f);assert.equal(g.promoted,true);
  const v=promoteVisualSpec(f,visual);assert.equal(v.promoted,true);
  const p=promoteProfilePlan(f,v,target);assert.equal(p.promoted,true);
  const l=promoteProfileLayout(f,g,v,p);assert.equal(l.promoted,true);
  const r=promoteRenderedSvg(f,v,p,l);assert.equal(r.promoted,true);
  const m=motion?promoteProfileMotionProgram(f,p,l,motion):null;if(motion)assert.equal(m.promoted,true);
  const d=promoteFigthreadDocument({figurePromotion:f,grammarPromotion:g,visualPromotion:v,profilePromotion:p,layoutPromotion:l,renderPromotion:r,motionPromotion:m},{figure:variant,visual,target,motion},{initialMode:"interactive"});assert.equal(d.promoted,true);return d;
}
async function promotedChildren(){const {figure,visual,request,motion}=await fixtures();return request.targets.map(entry=>promoteChild(figure,visual,entry.layout_target,motion));}

test("packages independently promoted target documents without CSS geometry scaling",async()=>{
  const children=await promotedChildren();const result=promoteFigthreadPackage(children,{packageId:"package:test-responsive",defaultTargetId:"web-wide",initialMode:"interactive"});
  assert.equal(result.promoted,true);assert.deepEqual(result.figthread_document_package.manifest.target_order,["web-compact","web-wide"]);assert.equal(result.figthread_document_package.manifest.default_target_id,"web-wide");assert.equal(result.figthread_document_package.manifest.runtime.css_geometry_scaling,false);assert.doesNotMatch(result.figthread_document_package.html,/transform\s*:\s*scale\s*\(/i);assert.match(result.figthread_document_package.html,/FigthreadPackage/);
  const hashes=Object.fromEntries(children.map(x=>[x.promotion_receipt.target_id,x.promotion_receipt.html_hash]));assert.deepEqual(result.promotion_receipt.child_html_hashes,hashes);assert.ok(readDocumentPackagePromotion(result));
});

test("duplicate target ids fail closed",async()=>{const children=await promotedChildren();const result=composeFigthreadPackage([children[0],children[0]],{packageId:"package:duplicate"});assert.equal(result.status,"fail");assert.ok(result.issues.some(x=>x.code==="PKG004_DUPLICATE"));});

test("semantic drift across targets is rejected even when each child is independently promoted",async()=>{const {figure,visual,request,motion}=await fixtures();const first=promoteChild(figure,visual,request.targets[0].layout_target,motion),changed=structuredClone(figure);changed.nodes.find(x=>x.id==="node:output").label="Different result";const second=promoteChild(changed,visual,request.targets[1].layout_target,motion);const result=composeFigthreadPackage([first,second],{packageId:"package:drift"});assert.equal(result.status,"fail");assert.ok(result.issues.some(x=>x.code==="PKG002_SEMANTIC"));});

test("tampered child document cannot enter a package",async()=>{const children=await promotedChildren();const bad=structuredClone(children[0]);bad.figthread_document.html+="<!--tamper-->";const result=composeFigthreadPackage([bad,children[1]],{packageId:"package:tamper"});assert.equal(result.status,"fail");assert.ok(result.issues.some(x=>x.code==="PKG001_BIND"));});

test("package promotion reader rejects package html tampering",async()=>{const children=await promotedChildren();const result=promoteFigthreadPackage(children,{packageId:"package:reader"});const bad=structuredClone(result);bad.figthread_document_package.html+="<!--tamper-->";assert.equal(readDocumentPackagePromotion(bad),null);});
