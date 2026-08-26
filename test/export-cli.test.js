import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { findChromeExecutable } from "../skills/figthread/runtime/browser-text.js";

const execFileAsync=promisify(execFile);
const root=new URL("../",import.meta.url);
const script=new URL("../skills/figthread/scripts/export.mjs",import.meta.url);
const baseInputs=["skills/figthread/examples/minimal.figure.json","skills/figthread/examples/minimal.visual.json","skills/figthread/examples/minimal.layout-target.json","skills/figthread/examples/minimal.motion.json"];
const svgInputs=[...baseInputs,"skills/figthread/examples/minimal.export.json"];
const pngInputs=[...baseInputs,"skills/figthread/examples/minimal.png-export.json"];

test("export CLI promotes the canonical standalone SVG example",async()=>{const dir=await mkdtemp(join(tmpdir(),"figthread-export-"));try{const out=join(dir,"figure.svg");const {stdout}=await execFileAsync(process.execPath,[script.pathname,...svgInputs,"--promote","--out",out],{cwd:root.pathname});const result=JSON.parse(stdout);assert.equal(result.promoted,true,JSON.stringify(result.report));assert.match(result.payload.data,/^\[written:/);const svg=await readFile(out,"utf8");assert.match(svg,/^<svg\b/);assert.match(svg,/data-figthread-root="true"/);}finally{await rm(dir,{recursive:true,force:true});}});

test("export CLI captures and promotes PNG through the bundled Chrome adapter",async(t)=>{const chrome=findChromeExecutable();if(!chrome){t.skip("Chrome/Chromium unavailable");return;}const dir=await mkdtemp(join(tmpdir(),"figthread-png-export-"));try{const out=join(dir,"figure.png"),plan=join(dir,"capture-plan.json");const {stdout}=await execFileAsync(process.execPath,[script.pathname,...pngInputs,"--promote","--browser",chrome,"--out",out,"--capture-plan",plan],{cwd:root.pathname,maxBuffer:8*1024*1024});const result=JSON.parse(stdout);assert.equal(result.promoted,true,JSON.stringify(result.report));assert.equal(result.export_artifact.mime_type,"image/png");assert.equal(result.export_artifact.determinism_scope,"same-inputs-same-environment-visual");assert.match(result.payload.data,/^\[written:/);const png=await readFile(out);assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);const capture=JSON.parse(await readFile(plan,"utf8"));assert.equal(capture.width_px,800);assert.equal(capture.height_px,300);assert.equal(capture.expected_local_time_ms,0);}finally{await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}});
