#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promoteFigureSpec } from "../runtime/validator.js";
import { promoteGrammarPlan } from "../runtime/grammar.js";
import { promoteVisualSpec } from "../runtime/visual.js";
import { promoteProfilePlan } from "../runtime/profile.js";
import { promoteProfileLayout } from "../runtime/visual-layout.js";
import { promoteRenderedSvg } from "../runtime/renderer.js";
import { promoteProfileMotionProgram } from "../runtime/profile-motion.js";
import { promoteFigthreadDocument } from "../runtime/document.js";
import { composeFigthreadPackage, promoteFigthreadPackage } from "../runtime/document-package.js";

function usage(){console.error("usage: package.mjs <figure-spec.json> <visual-spec.json> <package-request.json> [motion-spec.json] [--mode draft|gate] [--promote] [--out figure.package.html]");}
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),outIndex=args.indexOf("--out"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const valueIndexes=new Set([modeIndex+1,outIndex+1].filter(i=>i>0)),flags=new Set(["--promote","--mode","--out"]),positional=args.filter((arg,index)=>!flags.has(arg)&&!valueIndexes.has(index));
if(![3,4].includes(positional.length)||!["draft","gate"].includes(mode)||(outIndex>=0&&!args[outIndex+1])){usage();process.exitCode=2;}else{
  try{
    const [figure,visual,request,globalMotion=null]=await Promise.all(positional.map(file=>readFile(resolve(file),"utf8").then(JSON.parse)));
    if(request?.schema_version!=="figthread.package-request/0.1"||typeof request.id!=="string"||!Array.isArray(request.targets)||request.targets.length<2)throw new Error("package request must contain id and at least two targets");
    const childPromotions=[];
    for(const [index,entry] of request.targets.entries()){
      const target=entry?.layout_target;
      if(!target?.target?.id||!target?.target?.profile)throw new Error(`package target ${index} is missing layout_target identity`);
      const variantFigure=structuredClone(figure);variantFigure.profile=target.target.profile;
      const targetId=target.target.id;
      const fail=(stage,result)=>{const error=new Error(`target ${targetId} failed at ${stage}`);error.stage=stage;error.target_id=targetId;error.result=result;throw error;};
      const figurePromotion=promoteFigureSpec(variantFigure);if(!figurePromotion.promoted)fail("semantic",figurePromotion);
      const grammarPromotion=promoteGrammarPlan(figurePromotion);if(!grammarPromotion.promoted)fail("grammar",grammarPromotion);
      const visualPromotion=promoteVisualSpec(figurePromotion,visual);if(!visualPromotion.promoted)fail("visual",visualPromotion);
      const profilePromotion=promoteProfilePlan(figurePromotion,visualPromotion,target);if(!profilePromotion.promoted)fail("profile",profilePromotion);
      const layoutPromotion=promoteProfileLayout(figurePromotion,grammarPromotion,visualPromotion,profilePromotion);if(!layoutPromotion.promoted)fail("layout",layoutPromotion);
      const renderPromotion=promoteRenderedSvg(figurePromotion,visualPromotion,profilePromotion,layoutPromotion);if(!renderPromotion.promoted)fail("render",renderPromotion);
      const selectedMotion=Object.prototype.hasOwnProperty.call(entry,"motion")?entry.motion:globalMotion;
      const motionPromotion=selectedMotion?promoteProfileMotionProgram(figurePromotion,profilePromotion,layoutPromotion,selectedMotion):null;if(selectedMotion&&!motionPromotion.promoted)fail("motion",motionPromotion);
      const childMode=entry.runtime_mode??request.child_runtime_mode??"interactive";
      const documentPromotion=promoteFigthreadDocument({figurePromotion,grammarPromotion,visualPromotion,profilePromotion,layoutPromotion,renderPromotion,motionPromotion},{figure:variantFigure,visual,target,motion:selectedMotion},{initialMode:childMode});
      if(!documentPromotion.promoted)fail("document",documentPromotion);
      childPromotions.push(documentPromotion);
    }
    const options={mode,packageId:request.id,defaultTargetId:request.default_target_id,initialMode:request.initial_mode??"interactive"};
    const result=promote?promoteFigthreadPackage(childPromotions,options):composeFigthreadPackage(childPromotions,options);
    const pkg=promote?result.figthread_document_package:result,html=pkg?.html;
    if(html&&outIndex>=0)await writeFile(resolve(args[outIndex+1]),html,"utf8");
    const output=promote?{...result,figthread_document_package:result.figthread_document_package?{manifest:result.figthread_document_package.manifest,html:outIndex>=0?`[written:${args[outIndex+1]}]`:result.figthread_document_package.html,html_hash:result.figthread_document_package.html_hash}:undefined}:{...result,html:outIndex>=0&&html?`[written:${args[outIndex+1]}]`:html};
    console.log(JSON.stringify(output,null,2));
    const ok=promote?result.promoted:result.status!=="fail";if(!ok)process.exitCode=1;
  }catch(error){console.error(JSON.stringify({stage:error.stage??"package",target_id:error.target_id??null,status:"fail",error:error.message,result:error.result??null},null,2));process.exitCode=2;}
}
