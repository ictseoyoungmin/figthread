import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
const exec=promisify(execFile),script=new URL("../skills/figthread/scripts/workspace.mjs",import.meta.url).pathname;
async function run(args){const {stdout}=await exec(process.execPath,[script,...args]);return JSON.parse(stdout);}

test("workspace CLI exposes canonical stages",async()=>{const out=await run(["stages"]);assert.deepEqual(out.stages.map(x=>x.id),["understanding","claims","figure-ir","grammar-visual","layout","motion","document","review","export"]);});

test("workspace CLI init and resume do not depend on repository npm wrappers",async()=>{const root=await mkdtemp(join(tmpdir(),"figthread-workspace-cli-")),source=join(root,"source.txt");await writeFile(source,"cli source","utf8");const init=await run(["init",join(root,"runs"),source,"--run-id","run-cli"]);assert.equal(init.frontier_stage,"understanding");const resume=await run(["resume",init.run_dir]);assert.equal(resume.status,"ready");assert.equal(resume.revision_dir,"stages/01-understanding/r0001");});
