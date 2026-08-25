import { readFile } from "node:fs/promises";
import process from "node:process";
import { validateFigureSpec } from "./validator.js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm run validate -- <figure-spec.json>");
  process.exit(2);
}

try {
  const document = JSON.parse(await readFile(filePath, "utf8"));
  const report = validateFigureSpec(document);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "fail") process.exitCode = 1;
} catch (error) {
  console.error(`Unable to validate ${filePath}: ${error.message}`);
  process.exitCode = 1;
}
