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
import { composeFigthreadDocument, promoteFigthreadDocument } from "../runtime/document.js";

function usage(){console.error("usage: document.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] [--mode draft|gate] [--runtime-mode interactive|clean|static] [--promote] [--out figure.html]");}
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),runtimeIndex=args.indexOf("--runtime-mode"),outIndex=args.indexOf("--out"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const runtimeMode=runtimeIndex>=0?args[runtimeIndex+1]:null,valueIndexes=new Set([modeIndex+1,runtimeIndex+1,outIndex+1].filter(i=>i>0)),flags=new Set(["--promote","--mode","--runtime-mode","--out"]),positional=args.filter((arg,index)=>!flags.has(arg)&&!valueIndexes.has(index));
if(![3,4].includes(positional.length)||!["draft","gate"].includes(mode)||(runtimeMode&&!['interactive','clean','static'].includes(runtimeMode))||(outIndex>=0&&!args[outIndex+1])){usage();process.exitCode=2;}else{
  try{
    const docs=await Promise.all(positional.map(file=>readFile(resolve(file),"utf8").then(JSON.parse)));
    const [figure,visual,target,motion=null]=docs;
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
                  const options={mode,...(runtimeMode?{initialMode:runtimeMode}:{})};
                  const result=promote?promoteFigthreadDocument(authorities,canonical,options):composeFigthreadDocument(authorities,canonical,options);
                  const documentResult=promote?result.figthread_document:result;
                  const html=documentResult?.html;
                  if(html&&outIndex>=0)await writeFile(resolve(args[outIndex+1]),html,"utf8");
                  const output=promote?{...result,figthread_document:result.figthread_document?{manifest:result.figthread_document.manifest,html:outIndex>=0?`[written:${args[outIndex+1]}]`:result.figthread_document.html,html_hash:result.figthread_document.html_hash}:undefined}:{...result,html:outIndex>=0&&html?`[written:${args[outIndex+1]}]`:html};
                  console.log(JSON.stringify(output,null,2));
                  const ok=promote?result.promoted:result.status!=="fail";if(!ok)process.exitCode=1;
                }
              }
            }
          }
        }
      }
    }
  }catch(error){console.error(JSON.stringify({stage:"document",status:"fail",error:error.message},null,2));process.exitCode=2;}
}
