const SCHEMA_VERSION = "figthread.figure/0.1";
const ID_PATTERN = /^(claim|node|relation|state|snapshot):[a-z0-9][a-z0-9._-]*$/;
const GEOMETRY_KEYS = new Set(["x", "y", "w", "h", "width", "height", "cx", "cy", "path", "d"]);
const SEVERITY_ORDER = { error: 0, warning: 1, note: 2 };

const issue = (code, message, options = {}) => ({
  code,
  severity: options.severity ?? "error",
  ...(options.object_id ? { object_id: options.object_id } : {}),
  ...(options.path ? { path: options.path } : {}),
  stage_owner: options.stage_owner ?? "figure-ir",
  message,
  ...(options.repair_hint ? { repair_hint: options.repair_hint } : {})
});

const asArray = (value) => (Array.isArray(value) ? value : []);
const asObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function collectEntries(document) {
  return [
    ...asArray(document.claims),
    ...asArray(document.nodes),
    ...asArray(document.relations),
    ...asArray(document.states),
    ...asArray(document.snapshots)
  ];
}

function addGeometryIssues(value, path, objectId, issues, seen = new Set()) {
  if (!asObject(value) || seen.has(value)) return;
  seen.add(value);

  for (const [key, child] of Object.entries(value)) {
    if (GEOMETRY_KEYS.has(key)) {
      issues.push(issue("IR008", `resolved geometry key '${key}' is not allowed in semantic IR`, {
        object_id: objectId,
        path: `${path}.${key}`,
        repair_hint: "Move geometry to ResolvedLayout."
      }));
    }
    addGeometryIssues(child, `${path}.${key}`, objectId, issues, seen);
  }
}

function validateStateDomain(state, issues) {
  const domain = state.domain;
  if (!asObject(domain) || typeof domain.type !== "string") {
    issues.push(issue("IR006", "state domain must declare a type", { object_id: state.id, path: `${state.id}.domain` }));
    return;
  }

  const valid = domain.type === "boolean"
    ? typeof state.initial === "boolean" && typeof state.summary === "boolean"
    : domain.type === "number" || domain.type === "count" || domain.type === "ratio"
      ? [state.initial, state.summary].every((value) => typeof value === "number" && Number.isFinite(value))
      : domain.type === "enum"
        ? Array.isArray(domain.values) && domain.values.length > 0 && domain.values.includes(state.initial) && domain.values.includes(state.summary)
        : false;

  if (!valid) {
    issues.push(issue("IR006", "state initial and summary values must belong to the declared domain", {
      object_id: state.id,
      path: `${state.id}.domain`,
      repair_hint: "Align values with domain.type and domain.values/min/max."
    }));
  }

  for (const [name, value] of [["initial", state.initial], ["summary", state.summary]]) {
    if (typeof value === "number" && (domain.min !== undefined && value < domain.min || domain.max !== undefined && value > domain.max)) {
      issues.push(issue("IR006", `${name} value is outside the declared numeric bounds`, { object_id: state.id, path: `${state.id}.${name}` }));
    }
  }
}

function validateParentGraph(nodes, nodeById, issues) {
  const visiting = new Set();
  const visited = new Set();

  function walk(node) {
    if (visited.has(node.id)) return true;
    if (visiting.has(node.id)) {
      issues.push(issue("IR003", "parent graph contains a cycle", { object_id: node.id, path: `${node.id}.parent_id` }));
      return false;
    }
    visiting.add(node.id);
    if (node.parent_id) {
      const parent = nodeById.get(node.parent_id);
      if (parent) walk(parent);
    }
    visiting.delete(node.id);
    visited.add(node.id);
    return true;
  }

  for (const node of nodes) walk(node);
}

export function validateFigureSpec(document) {
  const issues = [];

  if (!asObject(document)) {
    return {
      document_id: undefined,
      schema_version: SCHEMA_VERSION,
      validator_version: "0.1.0",
      status: "fail",
      issues: [issue("IR000", "FigureSpec must be a JSON object", { path: "$", repair_hint: "Pass a parsed FigureSpec object." })]
    };
  }

  if (document.schema_version !== SCHEMA_VERSION) {
    issues.push(issue("IR000", `unsupported schema_version; expected '${SCHEMA_VERSION}'`, { path: "schema_version" }));
  }

  const entries = collectEntries(document);
  const ids = new Map();
  for (const entry of entries) {
    if (!asObject(entry) || typeof entry.id !== "string") continue;
    if (!ID_PATTERN.test(entry.id)) {
      issues.push(issue("IR000", "stable ID must use a typed namespace", { object_id: entry.id, path: "id" }));
    }
    if (ids.has(entry.id)) {
      issues.push(issue("IR001", `duplicate stable ID '${entry.id}'`, { object_id: entry.id, path: "id" }));
    } else {
      ids.set(entry.id, entry);
    }
  }

  const claims = asArray(document.claims);
  const nodes = asArray(document.nodes);
  const relations = asArray(document.relations);
  const states = asArray(document.states);
  const snapshots = asArray(document.snapshots);
  const claimIds = new Set(claims.map((claim) => claim?.id).filter(Boolean));
  const nodeIds = new Set(nodes.map((node) => node?.id).filter(Boolean));
  const snapshotIds = new Set(snapshots.map((snapshot) => snapshot?.id).filter(Boolean));
  const nodeById = new Map(nodes.filter((node) => asObject(node) && node.id).map((node) => [node.id, node]));

  if (typeof document.thesis_claim_id !== "string" || !claimIds.has(document.thesis_claim_id)) {
    issues.push(issue("IR002", "thesis_claim_id must reference an existing claim", { path: "thesis_claim_id", stage_owner: "claim-extraction" }));
  }
  if (asObject(document.composition) && document.composition.grammar?.type !== document.figure_type) {
    issues.push(issue("IR002", "composition grammar type must match figure_type", { path: "composition.grammar.type" }));
  }
  if (asObject(document.composition) && !nodeIds.has(document.composition.root_id)) {
    issues.push(issue("IR002", "composition.root_id must reference an existing node", { path: "composition.root_id" }));
  }
  if (!snapshotIds.has(document.static_snapshot_id)) {
    issues.push(issue("IR007", "static_snapshot_id must reference an existing snapshot", { path: "static_snapshot_id" }));
  }

  const checkClaimRefs = (entry) => {
    for (const claimId of asArray(entry.claim_refs)) {
      if (!claimIds.has(claimId)) {
        issues.push(issue("IR002", `claim reference '${claimId}' does not exist`, { object_id: entry.id, path: `${entry.id}.claim_refs`, stage_owner: "claim-extraction" }));
      }
    }
  };

  for (const node of nodes) {
    if (!asObject(node)) continue;
    checkClaimRefs(node);
    if (node.parent_id && !nodeIds.has(node.parent_id)) {
      issues.push(issue("IR002", `parent reference '${node.parent_id}' does not exist`, { object_id: node.id, path: `${node.id}.parent_id` }));
    }
    addGeometryIssues(node, node.id, node.id, issues);
  }

  for (const relation of relations) {
    if (!asObject(relation)) continue;
    for (const endpoint of ["from", "to"]) {
      if (!nodeIds.has(relation[endpoint])) {
        issues.push(issue("IR002", `${endpoint} reference '${relation[endpoint]}' does not exist`, { object_id: relation.id, path: `${relation.id}.${endpoint}` }));
      }
    }
    checkClaimRefs(relation);
    if (relation.kind === "extension" && typeof relation.extension_kind !== "string") {
      issues.push(issue("IR009", "extension relation requires a namespaced extension_kind", { object_id: relation.id, path: `${relation.id}.extension_kind` }));
    }
    if (relation.kind !== "extension" && relation.extension_kind !== undefined) {
      issues.push(issue("IR009", "extension_kind is only valid on extension relations", { object_id: relation.id, path: `${relation.id}.extension_kind` }));
    }
    addGeometryIssues(relation, relation.id, relation.id, issues);
  }

  for (const state of states) {
    if (!asObject(state)) continue;
    if (!nodeIds.has(state.target_id)) {
      issues.push(issue("IR002", `state target '${state.target_id}' does not exist`, { object_id: state.id, path: `${state.id}.target_id` }));
    }
    checkClaimRefs(state);
    validateStateDomain(state, issues);
    addGeometryIssues(state, state.id, state.id, issues);
  }

  for (const snapshot of snapshots) addGeometryIssues(snapshot, snapshot.id, snapshot.id, issues);

  if (asObject(document.extensions)) {
    for (const namespace of Object.keys(document.extensions)) {
      if (!/^[a-z][a-z0-9.-]*$/.test(namespace)) {
        issues.push(issue("IR009", `extension namespace '${namespace}' is not namespaced`, { path: `extensions.${namespace}` }));
      }
    }
  }

  validateParentGraph(nodes, nodeById, issues);

  const witnessedClaimIds = new Set();
  for (const entry of [...nodes, ...relations, ...states]) {
    for (const claimId of asArray(entry?.claim_refs)) witnessedClaimIds.add(claimId);
  }
  for (const claim of claims) {
    if (claim?.role === "primary" || claim?.must_preserve === true) {
      if (!witnessedClaimIds.has(claim.id)) {
        issues.push(issue("IR004", `claim '${claim.id}' has no semantic witness`, { object_id: claim.id, stage_owner: "claim-extraction", repair_hint: "Attach the claim to a node, relation, or state." }));
      }
    }
  }
  for (const node of nodes) {
    if (asArray(node?.claim_refs).length === 0 && !nodes.some((child) => child?.parent_id === node?.id && asArray(child.claim_refs).length > 0)) {
      issues.push(issue("IR005", `node '${node?.id}' has no direct or descendant claim witness`, { object_id: node?.id, repair_hint: "Remove decorative semantics or connect the node to a claim." }));
    }
  }

  issues.sort((left, right) => (
    SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
    || left.code.localeCompare(right.code)
    || (left.object_id ?? "").localeCompare(right.object_id ?? "")
    || (left.path ?? "").localeCompare(right.path ?? "")
  ));

  return {
    document_id: document.id,
    schema_version: document.schema_version,
    validator_version: "0.1.0",
    status: issues.some((entry) => entry.severity === "error") ? "fail" : issues.length ? "pass-with-warnings" : "pass",
    issues
  };
}
