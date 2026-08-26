#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promoteFigureSpec } from "../runtime/validator.js";
import { promoteGrammarPlan } from "../runtime/grammar.js";
import { promoteVisualSpec } from "../runtime/visual.js";
import { promoteProfilePlan } from "../runtime/profile.js";
import { promoteProfileLayout } from "../runtime/visual-layout.js";
import { promoteRenderedSvg, renderPromotedSvg } from "../runtime/renderer.js";

function usage() { console.error("usage: render.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [--mode draft|gate] [--promote] [--out figure.svg] [--evidence evidence.json]"); }
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),outIndex=args.indexOf("--out"),evidenceIndex=args.indexOf("--evidence"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const valueIndexes=new Set([modeIndex+1,outIndex+1,evidenceIndex+1].filter(index=>index>0)),flags=new Set(["--promote","--mode","--out","--evidence"]),positional=args.filter((arg,index)=>!flags.has(arg)&&!valueIndexes.has(index));
if(positional.length!==3||!["draft","gate"].includes(mode)||(outIndex>=0&&!args[outIndex+1])||(evidenceIndex>=0&&!args[evidenceIndex+1])){usage();process.exitCode=2;}else{
  try{
    const [figure,visual,target]=await Promise.all(positional.map(file=>readFile(resolve(file),"utf8").then(JSON.parse)));
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
              const result=promote?promoteRenderedSvg(figurePromotion,visualPromotion,profilePromotion,layoutPromotion):renderPromotedSvg(figurePromotion,visualPromotion,profilePromotion,layoutPromotion,{mode});
              const report=promote?result.report:result,rendered=result.rendered_svg;
              if(rendered&&outIndex>=0)await writeFile(resolve(args[outIndex+1]),`${rendered.svg}\n`,"utf8");
              if(rendered&&evidenceIndex>=0)await writeFile(resolve(args[evidenceIndex+1]),`${JSON.stringify(rendered.evidence,null,2)}\n`,"utf8");
              const output={...result,rendered_svg:rendered?{...rendered,svg:outIndex>=0?`[written:${args[outIndex+1]}]`:rendered.svg}:undefined};
              console.log(JSON.stringify(output,null,2));
              const ok=promote?result.promoted:report.status!=="fail"; if(!ok)process.exitCode=1;
            }
          }
        }
      }
    }
  }catch(error){console.error(JSON.stringify({stage:"render",status:"fail",error:error.message},null,2));process.exitCode=2;}
}
