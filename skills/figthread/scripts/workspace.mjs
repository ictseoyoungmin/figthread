#!/usr/bin/env node
import { initializeWorkspace, promoteStage, reopenStage, resumeWorkspace, verifyWorkspace, createWorkspaceCheckpoint, recoverWriterLock, EXECUTION_STAGES } from "../runtime/execution.js";

function usage(){console.error("usage: workspace.mjs <stages|init|verify|resume|promote|reopen|checkpoint|recover-lock> ...\n  stages\n  init <runs-root> <source-file> [--run-id id]\n  verify <run-dir>\n  resume <run-dir>\n  promote <run-dir> <stage> --artifact path [--artifact path...] --evidence path [--evidence path...] [--authority name=sha256:...]\n  reopen <run-dir> <stage> --reason text\n  checkpoint <run-dir> [--reason text]\n  recover-lock <run-dir> --reason text");}
function values(args, flag){const out=[];for(let i=0;i<args.length;i+=1)if(args[i]===flag&&args[i+1])out.push(args[i+1]);return out;}
function one(args, flag){const i=args.indexOf(flag);return i>=0?args[i+1]:null;}
function output(value){console.log(JSON.stringify(value,null,2));}

const args=process.argv.slice(2), command=args[0];
try{
  if(command==="stages") output({stages:EXECUTION_STAGES});
  else if(command==="init"){
    if(!args[1]||!args[2]){usage();process.exitCode=2;} else output(await initializeWorkspace(args[1],args[2],{...(one(args,"--run-id")?{runId:one(args,"--run-id")}:{})}));
  }else if(command==="verify"){
    if(!args[1]){usage();process.exitCode=2;} else {const result=await verifyWorkspace(args[1]);output(result);if(!result.valid)process.exitCode=1;}
  }else if(command==="resume"){
    if(!args[1]){usage();process.exitCode=2;} else {const result=await resumeWorkspace(args[1]);output(result);if(result.status==="reopen-required")process.exitCode=1;}
  }else if(command==="promote"){
    if(!args[1]||!args[2]){usage();process.exitCode=2;} else {
      const authority={};for(const entry of values(args,"--authority")){const split=entry.indexOf("=");if(split<=0)throw new Error(`invalid --authority binding: ${entry}`);authority[entry.slice(0,split)]=entry.slice(split+1);}
      output(await promoteStage(args[1],args[2],{artifacts:values(args,"--artifact"),evidence:values(args,"--evidence"),authority_hashes:authority}));
    }
  }else if(command==="reopen"){
    if(!args[1]||!args[2]||!one(args,"--reason")){usage();process.exitCode=2;} else output(await reopenStage(args[1],args[2],one(args,"--reason")));
  }else if(command==="checkpoint"){
    if(!args[1]){usage();process.exitCode=2;} else output(await createWorkspaceCheckpoint(args[1],one(args,"--reason")??"manual"));
  }else if(command==="recover-lock"){
    if(!args[1]||!one(args,"--reason")){usage();process.exitCode=2;} else output(await recoverWriterLock(args[1],one(args,"--reason")));
  }else{usage();process.exitCode=2;}
}catch(error){
  output({status:"fail",code:error.code??"EXE001_RUN",error:error.message,...(error.verification?{verification:error.verification}:{})});process.exitCode=1;
}
