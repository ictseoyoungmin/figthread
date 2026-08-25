import { createHash } from "node:crypto";

function canonicalizeValue(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON forbids non-finite numbers");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeValue).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeValue(value[key])}`).join(",")}}`;
  }
  throw new TypeError(`unsupported canonical JSON value: ${typeof value}`);
}

export function canonicalize(value) { return canonicalizeValue(value); }
export function sha256Canonical(value) { return `sha256:${createHash("sha256").update(canonicalize(value), "utf8").digest("hex")}`; }
