const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const typeMatches = (value, type) => ({ object: isObject(value), array: Array.isArray(value), string: typeof value === "string", number: typeof value === "number" && Number.isFinite(value), integer: Number.isInteger(value), boolean: typeof value === "boolean", null: value === null })[type] ?? true;

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`only local schema refs are supported: ${ref}`);
  return ref.slice(2).split("/").reduce((value, segment) => value?.[segment.replace(/~1/g, "/").replace(/~0/g, "~")], root);
}
function structuralIssue(path, keyword, message) { return { code: "SCH001", severity: "error", path, stage_owner: "figure-ir", message, keyword }; }
function walk(schema, value, path, root, issues) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) return walk(resolveRef(root, schema.$ref), value, path, root, issues);
  if (Object.hasOwn(schema, "const") && value !== schema.const) issues.push(structuralIssue(path, "const", `must equal ${JSON.stringify(schema.const)}`));
  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) issues.push(structuralIssue(path, "enum", `must be one of: ${schema.enum.join(", ")}`));
  if (schema.type && !typeMatches(value, schema.type)) { issues.push(structuralIssue(path, "type", `must be ${schema.type}`)); return; }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) issues.push(structuralIssue(path, "minLength", `must contain at least ${schema.minLength} character(s)`));
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) issues.push(structuralIssue(path, "pattern", `must match ${schema.pattern}`));
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) issues.push(structuralIssue(path, "minimum", `must be >= ${schema.minimum}`));
    if (schema.maximum !== undefined && value > schema.maximum) issues.push(structuralIssue(path, "maximum", `must be <= ${schema.maximum}`));
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) issues.push(structuralIssue(path, "minItems", `must contain at least ${schema.minItems} item(s)`));
    if (schema.items) value.forEach((entry, index) => walk(schema.items, entry, `${path}[${index}]`, root, issues));
  }
  if (isObject(value)) {
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) issues.push(structuralIssue(`${path}.${required}`, "required", "is required"));
    if (schema.additionalProperties === false && schema.properties) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties, key)) issues.push(structuralIssue(`${path}.${key}`, "additionalProperties", "is not allowed"));
    if (schema.propertyNames?.pattern) { const pattern = new RegExp(schema.propertyNames.pattern); for (const key of Object.keys(value)) if (!pattern.test(key)) issues.push(structuralIssue(`${path}.${key}`, "propertyNames", `property name must match ${schema.propertyNames.pattern}`)); }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) if (Object.hasOwn(value, key)) walk(childSchema, value[key], `${path}.${key}`, root, issues);
  }
}
export function validateStructure(document, schema) { const issues = []; walk(schema, document, "$", schema, issues); return issues.sort((a, b) => a.path.localeCompare(b.path) || a.keyword.localeCompare(b.keyword) || a.message.localeCompare(b.message)); }
