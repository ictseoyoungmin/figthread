#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promoteFigureSpec } from "../runtime/validator.js";
import { validateVisualSpec, promoteVisualSpec } from "../runtime/visual.js";

function usage(){console.error("usage: visual.mjs <figure-spec.json> <visual-spec.json> [--mode draft|gate] [--promote]");}
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const positional=args.filter((arg,index)=>arg!=="--promote"&&arg!=="--mode"&&!(modeIndex>=0&&index===modeIndex+1));
if(positional.length!==2||!["draft","gate"].includes(mode)){usage();process.exitCode=2;}else{
  try{
    const [figure,visual]=await Promise.all(positional.map(file=>readFile(resolve(file),"utf8").then(JSON.parse)));
    const figurePromotion=promoteFigureSpec(figure);
    if(!figurePromotion.promoted){console.log(JSON.stringify({stage:"semantic",promoted:false,report:figurePromotion.report},null,2));process.exitCode=1;}
    else{const result=promote?promoteVisualSpec(figurePromotion,visual):validateVisualSpec(figurePromotion,visual,{mode});console.log(JSON.stringify(result,null,2));const ok=promote?result.promoted:result.status!=="fail";if(!ok)process.exitCode=1;}
  }catch(error){console.error(JSON.stringify({stage:"visual",status:"fail",error:error.message},null,2));process.exitCode=2;}
}
