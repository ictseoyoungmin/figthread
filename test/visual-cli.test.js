import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
const execFileAsync=promisify(execFile),script=new URL("../skills/figthread/scripts/visual.mjs",import.meta.url).pathname,figure=new URL("../skills/figthread/examples/minimal.figure.json",import.meta.url).pathname,visual=new URL("../skills/figthread/examples/minimal.visual.json",import.meta.url).pathname;
async function run(extra=[]){const {stdout}=await execFileAsync(process.execPath,[script,figure,visual,...extra]);return JSON.parse(stdout);}
test("visual CLI accepts default gate mode",async()=>{const result=await run();assert.equal(result.status,"pass");assert.equal(result.promotion_eligible,true);assert.ok(result.primitive_plan.plan_hash);});
test("visual CLI promotion emits a stable primitive plan receipt",async()=>{const a=await run(["--promote"]),b=await run(["--promote"]);assert.equal(a.promoted,true);assert.equal(a.promotion_receipt.kind,"primitive_plan");assert.equal(a.promotion_receipt.promotion_hash,b.promotion_receipt.promotion_hash);});
test("visual CLI explicit draft mode remains non-authoritative",async()=>{const result=await run(["--mode","draft"]);assert.equal(result.status,"pass");assert.equal(result.promotion_eligible,false);});
