#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promoteFigureSpec } from "../runtime/validator.js";
import { promoteVisualSpec } from "../runtime/visual.js";
import { promoteProfilePlan } from "../runtime/profile.js";
import { promoteProfileLayout } from "../runtime/visual-layout.js";
import { compileProfileMotion, promoteProfileMotionProgram } from "../runtime/profile-motion.js";

function usage(){console.error("usage: motion.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> <motion-spec.json> [--mode draft|gate] [--promote]");}
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const positional=args.filter((arg,index)=>arg!=="--promote"&&arg!=="--mode"&&!(modeIndex>=0&&index===modeIndex+1));
if(positional.length!==4||!["draft","gate"].includes(mode)){usage();process.exitCode=2;}else{
  try{
    const [figure,visual,target,motion]=await Promise.all(positional.map(file=>readFile(resolve(file),"utf8").then(JSON.parse)));
    const figurePromotion=promoteFigureSpec(figure);
    if(!figurePromotion.promoted){console.log(JSON.stringify({stage:"semantic",promoted:false,report:figurePromotion.report},null,2));process.exitCode=1;}
    else{
      const visualPromotion=promoteVisualSpec(figurePromotion,visual);
      if(!visualPromotion.promoted){console.log(JSON.stringify({stage:"visual",promoted:false,report:visualPromotion.report},null,2));process.exitCode=1;}
      else{
        const profilePromotion=promoteProfilePlan(figurePromotion,visualPromotion,target);
        if(!profilePromotion.promoted){console.log(JSON.stringify({stage:"profile",promoted:false,report:profilePromotion.report},null,2));process.exitCode=1;}
        else{
          const layoutPromotion=promoteProfileLayout(figurePromotion,visualPromotion,profilePromotion);
          if(!layoutPromotion.promoted){console.log(JSON.stringify({stage:"layout",promoted:false,report:layoutPromotion.report},null,2));process.exitCode=1;}
          else{
            const result=promote?promoteProfileMotionProgram(figurePromotion,profilePromotion,layoutPromotion,motion):compileProfileMotion(figurePromotion,profilePromotion,layoutPromotion,motion,{mode});
            console.log(JSON.stringify(result,null,2));
            const ok=promote?result.promoted:result.status!=="fail";
            if(!ok)process.exitCode=1;
          }
        }
      }
    }
  }catch(error){console.error(JSON.stringify({stage:"motion",status:"fail",error:error.message},null,2));process.exitCode=2;}
}
