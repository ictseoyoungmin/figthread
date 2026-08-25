#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { promoteFigureSpec, validateFigureSpec } from "../runtime/validator.js";

const args = process.argv.slice(2);
const modeIndex = args.indexOf("--mode");
const mode = modeIndex >= 0 ? args[modeIndex + 1] : "gate";
if (modeIndex >= 0) args.splice(modeIndex, 2);
const promote = args.includes("--promote");
const filePath = args.find((arg) => !arg.startsWith("--"));
if (!filePath) {
  console.error("Usage: node <skill-root>/scripts/validate.mjs <figure-spec.json> [--mode draft|gate] [--promote]");
  process.exit(2);
}
try {
  const document = JSON.parse(await readFile(filePath, "utf8"));
  const result = promote ? promoteFigureSpec(document) : validateFigureSpec(document, { mode });
  console.log(JSON.stringify(result, null, 2));
  const report = promote ? result.report : result;
  if (report.status === "fail") process.exitCode = 1;
} catch (error) {
  console.error(`Unable to validate ${filePath}: ${error.message}`);
  process.exitCode = 1;
}
