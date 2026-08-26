import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("package CLI promotes a self-contained multi-target HTML",async()=>{
  const root=await mkdtemp(join(tmpdir(),"figthread-package-")),out=join(root,"figure.package.html");
  const result=spawnSync(process.execPath,["skills/figthread/scripts/package.mjs","skills/figthread/examples/minimal.figure.json","skills/figthread/examples/minimal.visual.json","skills/figthread/examples/minimal.package.json","skills/figthread/examples/minimal.motion.json","--promote","--out",out],{cwd:new URL("..",import.meta.url),encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);const parsed=JSON.parse(result.stdout);assert.equal(parsed.promoted,true);assert.deepEqual(parsed.promotion_receipt.target_ids,["web-compact","web-wide"]);const html=await readFile(out,"utf8");assert.match(html,/window\.FigthreadPackage/);assert.match(html,/web-compact/);assert.match(html,/web-wide/);assert.doesNotMatch(html,/transform\s*:\s*scale\s*\(/i);
});

test("package schemas root mirrors match installed skill",async()=>{for(const name of ["document-package.schema.json","package-request.schema.json"]){const [a,b]=await Promise.all([readFile(new URL(`../skills/figthread/schemas/${name}`,import.meta.url),"utf8"),readFile(new URL(`../schemas/${name}`,import.meta.url),"utf8")]);assert.equal(a,b);}});

test("package example root mirror matches installed skill",async()=>{const [a,b]=await Promise.all([readFile(new URL("../skills/figthread/examples/minimal.package.json",import.meta.url),"utf8"),readFile(new URL("../examples/minimal.package.json",import.meta.url),"utf8")]);assert.equal(a,b);});
