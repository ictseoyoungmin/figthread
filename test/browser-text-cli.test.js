import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { findChromeExecutable } from "../skills/figthread/runtime/browser-text.js";

const chrome=findChromeExecutable();
test("browser text CLI captures real Chrome evidence when Chrome is available",{skip:!chrome},async()=>{
  const root=await mkdtemp(join(tmpdir(),"figthread-browser-text-cli-")),out=join(root,"evidence.json"),observation=join(root,"observation.json");
  const args=["skills/figthread/scripts/browser-text.mjs","skills/figthread/examples/minimal.figure.json","skills/figthread/examples/minimal.visual.json","skills/figthread/examples/minimal.layout-target.json","skills/figthread/examples/minimal.motion.json","--promote","--browser",chrome,"--out",out,"--observation-out",observation];
  const result=spawnSync(process.execPath,args,{cwd:fileURLToPath(new URL("..",import.meta.url)),encoding:"utf8",timeout:45000});
  assert.equal(result.status,0,`${result.stdout}\n${result.stderr}`);const evidence=JSON.parse(await readFile(out,"utf8")),observed=JSON.parse(await readFile(observation,"utf8"));assert.equal(evidence.metrics.browser_text_extent_certified,true);assert.equal(evidence.metrics.platform_font_identity_certified,true);assert.ok(evidence.metrics.platform_font_families.length>0);assert.ok(observed.measurements.every(x=>x.platform_fonts.length>0));
});
