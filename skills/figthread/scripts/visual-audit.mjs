#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promoteFigureSpec } from "../runtime/validator.js";
import { promoteGrammarPlan } from "../runtime/grammar.js";
import { promoteVisualSpec } from "../runtime/visual.js";
import { promoteProfilePlan } from "../runtime/profile.js";
import { promoteProfileLayout } from "../runtime/visual-layout.js";
import { promoteRenderedSvg } from "../runtime/renderer.js";
import { captureVisualAuditObservation, compileVisualAuditEvidence, compileVisualAuditPlan, promoteVisualAuditEvidence } from "../runtime/visual-audit.js";

function usage() { console.error("usage: visual-audit.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [--mode draft|gate] [--promote] [--browser executable] [--out evidence.json] [--observation-out observation.json]"); }
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),browserIndex=args.indexOf("--browser"),outIndex=args.indexOf("--out"),observationIndex=args.indexOf("--observation-out"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const valueIndexes=new Set([modeIndex+1,browserIndex+1,outIndex+1,observationIndex+1].filter((i)=>i>0)),flags=new Set(["--promote","--mode","--browser","--out","--observation-out"]),positional=args.filter((arg,index)=>!flags.has(arg)&&!valueIndexes.has(index));
if(positional.length!==3||!["draft","gate"].includes(mode)||(browserIndex>=0&&!args[browserIndex+1])||(outIndex>=0&&!args[outIndex+1])||(observationIndex>=0&&!args[observationIndex+1])){usage();process.exitCode=2;}else{
  try{
    const [figure,visual,target]=await Promise.all(positional.map((file)=>readFile(resolve(file),"utf8").then(JSON.parse)));
    const figurePromotion=promoteFigureSpec(figure);if(!figurePromotion.promoted)throw Object.assign(new Error("semantic promotion failed"),{stage:"semantic",result:figurePromotion});
    const grammarPromotion=promoteGrammarPlan(figurePromotion);if(!grammarPromotion.promoted)throw Object.assign(new Error("grammar promotion failed"),{stage:"grammar",result:grammarPromotion});
    const visualPromotion=promoteVisualSpec(figurePromotion,visual);if(!visualPromotion.promoted)throw Object.assign(new Error("visual promotion failed"),{stage:"visual",result:visualPromotion});
    const profilePromotion=promoteProfilePlan(figurePromotion,visualPromotion,target);if(!profilePromotion.promoted)throw Object.assign(new Error("profile promotion failed"),{stage:"profile",result:profilePromotion});
    const layoutPromotion=promoteProfileLayout(figurePromotion,grammarPromotion,visualPromotion,profilePromotion);if(!layoutPromotion.promoted)throw Object.assign(new Error("layout promotion failed"),{stage:"layout",result:layoutPromotion});
    const renderPromotion=promoteRenderedSvg(figurePromotion,visualPromotion,profilePromotion,layoutPromotion);if(!renderPromotion.promoted)throw Object.assign(new Error("render promotion failed"),{stage:"render",result:renderPromotion});
    const planResult=compileVisualAuditPlan(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,{mode});
    if(planResult.status==="fail"){console.log(JSON.stringify(planResult,null,2));process.exitCode=1;}
    else{
      const observation=await captureVisualAuditObservation(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,{browserExecutable:browserIndex>=0?args[browserIndex+1]:null});
      if(observationIndex>=0)await writeFile(resolve(args[observationIndex+1]),`${JSON.stringify(observation,null,2)}\n`,"utf8");
      const result=promote?promoteVisualAuditEvidence(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,observation):compileVisualAuditEvidence(figurePromotion,visualPromotion,layoutPromotion,renderPromotion,observation,{mode});
      const evidence=result.visual_audit_evidence;if(evidence&&outIndex>=0)await writeFile(resolve(args[outIndex+1]),`${JSON.stringify(evidence,null,2)}\n`,"utf8");
      console.log(JSON.stringify({...result,visual_audit_evidence:evidence?(outIndex>=0?`[written:${args[outIndex+1]}]`:evidence):undefined,observation:observationIndex>=0?`[written:${args[observationIndex+1]}]`:{observation_hash:observation.observation_hash,environment:observation.environment,element_count:observation.elements.length}},null,2));
      const ok=promote?result.promoted:result.status!=="fail";if(!ok)process.exitCode=1;
    }
  }catch(error){if(error.result)console.error(JSON.stringify({stage:error.stage??"visual-audit",status:"fail",error:error.message,report:error.result.report??error.result},null,2));else if(error.report)console.error(JSON.stringify({stage:"visual-audit",status:"fail",code:error.code??null,error:error.message,report:error.report},null,2));else console.error(JSON.stringify({stage:error.stage??"visual-audit",status:"fail",code:error.code??null,error:error.message},null,2));process.exitCode=2;}
}
