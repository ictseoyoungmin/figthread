import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
const execFileAsync=promisify(execFile), script=new URL("../skills/figthread/scripts/motion.mjs",import.meta.url).pathname, figure=new URL("../skills/figthread/examples/minimal.figure.json",import.meta.url).pathname, layout=new URL("../skills/figthread/examples/minimal.layout-request.json",import.meta.url).pathname, motion=new URL("../skills/figthread/examples/minimal.motion.json",import.meta.url).pathname;
async function run(args){const {stdout}=await execFileAsync(process.execPath,[script,...args]);return JSON.parse(stdout);}
test("motion CLI accepts default gate mode with three positional files",async()=>{const result=await run([figure,layout,motion]);assert.equal(result.status,"pass");assert.equal(result.promotion_eligible,true);assert.ok(result.motion_program.program_hash);});
test("motion CLI promotion emits a stable MotionProgram receipt",async()=>{const a=await run([figure,layout,motion,"--promote"]),b=await run([figure,layout,motion,"--promote"]);assert.equal(a.promoted,true);assert.equal(a.promotion_receipt.promotion_hash,b.promotion_receipt.promotion_hash);});
test("motion CLI explicit draft mode remains non-authoritative",async()=>{const result=await run([figure,layout,motion,"--mode","draft"]);assert.equal(result.status,"pass");assert.equal(result.promotion_eligible,false);});
