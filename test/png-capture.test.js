import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createChromePngCaptureAdapter, PNG_CAPTURE_ADAPTER_VERSION } from "../skills/figthread/runtime/png-capture.js";

const installed=new URL("../skills/figthread/examples/minimal.png-export.json",import.meta.url);
const mirror=new URL("../examples/minimal.png-export.json",import.meta.url);

test("PNG export example root mirror matches the installable skill",async()=>{assert.equal(await readFile(installed,"utf8"),await readFile(mirror,"utf8"));});

test("bundled PNG capture exposes a stable injectable adapter surface",()=>{assert.match(PNG_CAPTURE_ADAPTER_VERSION,/^\d+\.\d+\.\d+$/);const adapter=createChromePngCaptureAdapter();assert.equal(typeof adapter,"function");});
