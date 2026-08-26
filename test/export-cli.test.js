import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync=promisify(execFile);
const root=new URL("../",import.meta.url);
const script=new URL("../skills/figthread/scripts/export.mjs",import.meta.url);
const inputs=["skills/figthread/examples/minimal.figure.json","skills/figthread/examples/minimal.visual.json","skills/figthread/examples/minimal.layout-target.json","skills/figthread/examples/minimal.motion.json","skills/figthread/examples/minimal.export.json"];

test("export CLI promotes the canonical standalone SVG example",async()=>{const dir=await mkdtemp(join(tmpdir(),"figthread-export-"));try{const out=join(dir,"figure.svg");const {stdout}=await execFileAsync(process.execPath,[script.pathname,...inputs,"--promote","--out",out],{cwd:root.pathname});const result=JSON.parse(stdout);assert.equal(result.promoted,true,JSON.stringify(result.report));assert.match(result.payload.data,/^\[written:/);const svg=await readFile(out,"utf8");assert.match(svg,/^<svg\b/);assert.match(svg,/data-figthread-root="true"/);}finally{await rm(dir,{recursive:true,force:true});}});
