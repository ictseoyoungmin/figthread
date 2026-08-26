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
import { compileExport, exportPayloadToBuffer, promoteExportArtifact } from "../runtime/export.js";

function usage(){console.error("usage: export.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] <export-spec.json> [--mode draft|gate] [--promote] [--out artifact] [--capture-plan plan.json]");}
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),outIndex=args.indexOf("--out"),captureIndex=args.indexOf("--capture-plan"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const valueIndexes=new Set([modeIndex+1,outIndex+1,captureIndex+1].filter(i=>i>0)),flags=new Set(["--promote","--mode","--out","--capture-plan"]),positional=args.filter((arg,index)=>!flags.has(arg)&&!valueIndexes.has(index));
if(![4,5].includes(positional.length)||!["draft","gate"].includes(mode)||(outIndex>=0&&!args[outIndex+1])||(captureIndex>=0&&!args[captureIndex+1])){usage();process.exitCode=2;}else{
  try{
    const docs=await Promise.all(positional.map(file=>readFile(resolve(file),"utf8").then(JSON.parse)));
    const figure=docs[0],visual=docs[1],target=docs[2],motion=docs.length===5?docs[3]:null,exportSpec=docs.length===5?docs[4]:docs[3];
    const figurePromotion=promoteFigureSpec(figure);
    if(!figurePromotion.promoted){console.log(JSON.stringify({stage:"semantic",promoted:false,report:figurePromotion.report},null,2));process.exitCode=1;}
    else{
      const grammarPromotion=promoteGrammarPlan(figurePromotion);
      if(!grammarPromotion.promoted){console.log(JSON.stringify({stage:"grammar",promoted:false,report:grammarPromotion.report},null,2));process.exitCode=1;}
      else{
        const visualPromotion=promoteVisualSpec(figurePromotion,visual);
        if(!visualPromotion.promoted){console.log(JSON.stringify({stage:"visual",promoted:false,report:visualPromotion.report},null,2));process.exitCode=1;}
        else{
          const profilePromotion=promoteProfilePlan(figurePromotion,visualPromotion,target);
          if(!profilePromotion.promoted){console.log(JSON.stringify({stage:"profile",promoted:false,report:profilePromotion.report},null,2));process.exitCode=1;}
          else{
            const layoutPromotion=promoteProfileLayout(figurePromotion,grammarPromotion,visualPromotion,profilePromotion);
            if(!layoutPromotion.promoted){console.log(JSON.stringify({stage:"layout",promoted:false,report:layoutPromotion.report},null,2));process.exitCode=1;}
            else{
              const renderPromotion=promoteRenderedSvg(figurePromotion,visualPromotion,profilePromotion,layoutPromotion);
              if(!renderPromotion.promoted){console.log(JSON.stringify({stage:"render",promoted:false,report:renderPromotion.report},null,2));process.exitCode=1;}
              else{
                const motionPromotion=motion?promoteProfileMotionProgram(figurePromotion,profilePromotion,layoutPromotion,motion):null;
                if(motion&&!motionPromotion.promoted){console.log(JSON.stringify({stage:"motion",promoted:false,report:motionPromotion.report},null,2));process.exitCode=1;}
                else{
                  const authorities={figurePromotion,grammarPromotion,visualPromotion,profilePromotion,layoutPromotion,renderPromotion,motionPromotion};
                  const canonical={figure,visual,target,motion};
                  const documentPromotion=promoteFigthreadDocument(authorities,canonical);
                  if(!documentPromotion.promoted){console.log(JSON.stringify({stage:"document",promoted:false,report:documentPromotion.report},null,2));process.exitCode=1;}
                  else{
                    const result=promote?await promoteExportArtifact(documentPromotion,renderPromotion,exportSpec):compileExport(documentPromotion,renderPromotion,exportSpec,{mode});
                    const payload=result.payload;
                    if(payload&&outIndex>=0)await writeFile(resolve(args[outIndex+1]),exportPayloadToBuffer(payload));
                    const plan=result.export_plan??result.report?.export_plan;
                    if(plan?.capture&&captureIndex>=0)await writeFile(resolve(args[captureIndex+1]),`${JSON.stringify(plan.capture,null,2)}\n`,"utf8");
                    const output={...result,payload:payload?{encoding:payload.encoding,data:outIndex>=0?`[written:${args[outIndex+1]}]`:`[${payload.encoding}:${exportPayloadToBuffer(payload).length} bytes]`}:undefined};
                    console.log(JSON.stringify(output,null,2));
                    const ok=promote?result.promoted:result.status!=="fail";if(!ok)process.exitCode=1;
                  }
                }
              }
            }
          }
        }
      }
    }
  }catch(error){console.error(JSON.stringify({stage:"export",status:"fail",error:error.message},null,2));process.exitCode=2;}
}
