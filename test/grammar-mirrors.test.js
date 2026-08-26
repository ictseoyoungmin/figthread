import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
for(const path of ["grammars/registry.json","schemas/grammar-plan.schema.json"]){ test(`${path} root mirror matches installed skill`,async()=>{ const [a,b]=await Promise.all([readFile(new URL(`../${path}`,import.meta.url),"utf8"),readFile(new URL(`../skills/figthread/${path}`,import.meta.url),"utf8")]); assert.equal(a,b); }); }
