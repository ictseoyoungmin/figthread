import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateStructure } from "./schema-validator.js";
import { validateSemantics } from "./semantic-validator.js";
import { sha256Canonical } from "./canonicalize.js";

export const VALIDATOR_VERSION = "0.1.0";
function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
const schemaUrl = new URL("../schemas/figure-spec.schema.json", import.meta.url);
const FIGURE_SCHEMA = JSON.parse(readFileSync(fileURLToPath(schemaUrl), "utf8"));
const SEVERITY_ORDER = { error: 0, warning: 1, note: 2 };
function sortIssues(issues) { return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code) || (a.object_id ?? "").localeCompare(b.object_id ?? "") || (a.path ?? "").localeCompare(b.path ?? "") || a.message.localeCompare(b.message)); }

export function validateFigureSpec(document, options = {}) {
  const mode = options.mode ?? "gate";
  if (!["draft", "gate"].includes(mode)) throw new TypeError("validation mode must be 'draft' or 'gate'");
  let inputHash;
  try { inputHash = sha256Canonical(document); } catch { inputHash = undefined; }
  const issues = sortIssues([...validateStructure(document, FIGURE_SCHEMA), ...validateSemantics(document)]);
  const hasErrors = issues.some((entry) => entry.severity === "error");
  return { document_id: document?.id, schema_version: document?.schema_version, mode, status: hasErrors ? "fail" : issues.length ? "pass-with-warnings" : "pass", input_hash: inputHash, validator_version: VALIDATOR_VERSION, promotion_eligible: mode === "gate" && !hasErrors, issues };
}

export function promoteFigureSpec(document) {
  const report = validateFigureSpec(document, { mode: "gate" });
  if (!report.promotion_eligible) return { promoted: false, report };
  const receipt = { kind: "validated_figure", schema_version: document.schema_version, document_id: document.id, input_hash: report.input_hash, validator_version: VALIDATOR_VERSION };
  const validatedFigure = deepFreeze(structuredClone(document));
  const promotionReceipt = deepFreeze({ ...receipt, promotion_hash: sha256Canonical(receipt) });
  return { promoted: true, report, validated_figure: validatedFigure, promotion_receipt: promotionReceipt };
}
