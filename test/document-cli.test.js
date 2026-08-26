import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root=new URL("../",import.meta.url);
const figure=new URL("../skills/figthread/examples/minimal.figure.json",import.meta.url).pathname;
const visual=new URL("../skills/figthread/examples/minimal.visual.json",import.meta.url).pathname;
const target=new URL("../skills/figthread/examples/minimal.layout-target.json",import.meta.url).pathname;
const motion=new URL("../skills/figthread/examples/minimal.motion.json",import.meta.url).pathname;

test("document CLI writes promoted self-contained HTML",()=>{const dir=mkdtempSync(join(tmpdir(),"figthread-document-")),out=join(dir,"figure.html");const stdout=execFileSync(process.execPath,[new URL("../skills/figthread/scripts/document.mjs",import.meta.url).pathname,figure,visual,target,motion,"--promote","--out",out],{cwd:root,encoding:"utf8"});const report=JSON.parse(stdout);assert.equal(report.promoted,true,JSON.stringify(report.report));const html=readFileSync(out,"utf8");assert.match(html,/^<!doctype html>/);assert.match(html,/id="figthread-manifest"/);assert.match(html,/window\.Figthread/);});
