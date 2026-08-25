import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script="skills/figthread/scripts/layout.mjs";
const figure="skills/figthread/examples/minimal.figure.json";
const visual="skills/figthread/examples/minimal.visual.json";
const target="skills/figthread/examples/minimal.layout-target.json";
function run(extra=[]){return spawnSync(process.execPath,[script,figure,visual,target,...extra],{cwd:new URL("..",import.meta.url),encoding:"utf8"});}

test("layout CLI accepts default gate mode with semantic, visual, and target inputs",()=>{const result=run();assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);assert.equal(output.status,"pass");assert.equal(output.promotion_eligible,true);assert.ok(output.resolved_layout.layout_hash.startsWith("sha256:"));assert.ok(output.resolved_layout.primitive_plan_hash.startsWith("sha256:"));});
test("layout CLI promotion path emits a visual-bound resolved_layout receipt",()=>{const result=run(["--promote"]);assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);assert.equal(output.promoted,true);assert.equal(output.promotion_receipt.kind,"resolved_layout");assert.ok(output.promotion_receipt.visual_hash.startsWith("sha256:"));assert.ok(output.promotion_receipt.primitive_plan_hash.startsWith("sha256:"));assert.ok(output.promotion_receipt.promotion_hash.startsWith("sha256:"));});
test("layout CLI explicit draft mode remains non-authoritative",()=>{const result=run(["--mode","draft"]);assert.equal(result.status,0,result.stderr);const output=JSON.parse(result.stdout);assert.equal(output.mode,"draft");assert.equal(output.promotion_eligible,false);});
