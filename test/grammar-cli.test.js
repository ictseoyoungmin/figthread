import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
const exec=promisify(execFile);
const script=new URL("../skills/figthread/scripts/grammar.mjs",import.meta.url);
const figure=new URL("../skills/figthread/examples/minimal.figure.json",import.meta.url);
test("grammar CLI gates and promotes the canonical example",async()=>{ const gate=JSON.parse((await exec(process.execPath,[script.pathname,figure.pathname,"--mode","gate"])).stdout); assert.notEqual(gate.status,"fail"); const promoted=JSON.parse((await exec(process.execPath,[script.pathname,figure.pathname,"--promote"])).stdout); assert.equal(promoted.promoted,true); assert.equal(promoted.grammar_plan.grammar_id,"pipeline"); });
