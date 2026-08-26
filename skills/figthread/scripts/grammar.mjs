#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promoteFigureSpec } from "../runtime/validator.js";
import { promoteGrammarPlan, validateGrammar } from "../runtime/grammar.js";

function usage(){console.error("usage: grammar.mjs <figure-spec.json> [--mode draft|gate] [--promote]");}
const args=process.argv.slice(2),promote=args.includes("--promote"),modeIndex=args.indexOf("--mode"),mode=modeIndex>=0?args[modeIndex+1]:"gate";
const positional=args.filter((arg,index)=>arg!=="--promote"&&arg!=="--mode"&&!(modeIndex>=0&&index===modeIndex+1));
if(positional.length!==1||!["draft","gate"].includes(mode)){usage();process.exitCode=2;}else{
  try{
    const figure=JSON.parse(await readFile(resolve(positional[0]),"utf8"));
    const figurePromotion=promoteFigureSpec(figure);
    if(!figurePromotion.promoted){console.log(JSON.stringify({stage:"semantic",promoted:false,report:figurePromotion.report},null,2));process.exitCode=1;}
    else{
      const result=promote?promoteGrammarPlan(figurePromotion):validateGrammar(figurePromotion,{mode});
      console.log(JSON.stringify(result,null,2));
      const ok=promote?result.promoted:result.status!=="fail";
      if(!ok)process.exitCode=1;
    }
  }catch(error){console.error(JSON.stringify({stage:"grammar",status:"fail",error:error.message},null,2));process.exitCode=2;}
}
