const ID_PATTERN = /^(claim|node|relation|state|snapshot):[a-z0-9][a-z0-9._-]*$/;
const GEOMETRY_KEYS = new Set(["x", "y", "w", "h", "width", "height", "cx", "cy", "path", "d"]);
const EXTENSION_NAMESPACE = /^[a-z][a-z0-9.-]*$/;
const EXTENSION_KIND = /^[a-z][a-z0-9.-]*:[a-z][a-z0-9.-]*$/;
const asArray = (value) => Array.isArray(value) ? value : [];
const asObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const issue = (code, message, options = {}) => ({ code, severity: options.severity ?? "error", ...(options.object_id ? { object_id: options.object_id } : {}), ...(options.path ? { path: options.path } : {}), stage_owner: options.stage_owner ?? "figure-ir", message, ...(options.repair_hint ? { repair_hint: options.repair_hint } : {}) });

function addGeometryIssues(value, path, objectId, issues, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) return value.forEach((child, index) => addGeometryIssues(child, `${path}[${index}]`, objectId, issues, seen));
  for (const [key, child] of Object.entries(value)) {
    if (GEOMETRY_KEYS.has(key)) issues.push(issue("IR008", `resolved geometry key '${key}' is not allowed in semantic IR`, { object_id: objectId, path: `${path}.${key}`, repair_hint: "Move geometry to ResolvedLayout." }));
    addGeometryIssues(child, `${path}.${key}`, objectId, issues, seen);
  }
}
function valueInDomain(value, domain) {
  if (!asObject(domain)) return false;
  if (domain.type === "boolean") return typeof value === "boolean";
  if (domain.type === "enum") return Array.isArray(domain.values) && domain.values.length > 0 && domain.values.some((candidate) => Object.is(candidate, value));
  if (!["number", "count", "ratio"].includes(domain.type) || typeof value !== "number" || !Number.isFinite(value)) return false;
  if (domain.type === "count" && (!Number.isInteger(value) || value < 0)) return false;
  if (domain.min !== undefined && value < domain.min) return false;
  if (domain.max !== undefined && value > domain.max) return false;
  return true;
}
function collectRoleBindingRefs(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((entry) => collectRoleBindingRefs(entry, out));
  else if (asObject(value)) Object.values(value).forEach((entry) => collectRoleBindingRefs(entry, out));
  return out;
}

export function validateSemantics(document) {
  const issues = [];
  if (!asObject(document)) return [issue("IR000", "FigureSpec must be an object", { path: "$" })];
  const claims = asArray(document.claims), nodes = asArray(document.nodes), relations = asArray(document.relations), states = asArray(document.states), snapshots = asArray(document.snapshots);
  const entries = [...claims, ...nodes, ...relations, ...states, ...snapshots];
  const ids = new Map();
  for (const entry of entries) {
    if (!asObject(entry) || typeof entry.id !== "string") continue;
    if (!ID_PATTERN.test(entry.id)) issues.push(issue("IR002", "stable ID uses an invalid typed namespace", { object_id: entry.id, path: `${entry.id}.id` }));
    if (ids.has(entry.id)) issues.push(issue("IR001", `duplicate stable ID '${entry.id}'`, { object_id: entry.id, path: `${entry.id}.id` })); else ids.set(entry.id, entry);
  }
  const claimIds = new Set(claims.map((x) => x?.id).filter(Boolean));
  const nodeIds = new Set(nodes.map((x) => x?.id).filter(Boolean));
  const relationIds = new Set(relations.map((x) => x?.id).filter(Boolean));
  const stateIds = new Set(states.map((x) => x?.id).filter(Boolean));
  const snapshotIds = new Set(snapshots.map((x) => x?.id).filter(Boolean));
  const nodeById = new Map(nodes.filter((x) => asObject(x) && x.id).map((x) => [x.id, x]));
  const stateById = new Map(states.filter((x) => asObject(x) && x.id).map((x) => [x.id, x]));
  const rootId = document.composition?.root_id;
  const checkClaimRefs = (entry) => asArray(entry?.claim_refs).forEach((ref) => { if (!claimIds.has(ref)) issues.push(issue("IR002", `claim reference '${ref}' does not exist`, { object_id: entry.id, path: `${entry.id}.claim_refs`, stage_owner: "claim-extraction" })); });

  if (!claimIds.has(document.thesis_claim_id)) issues.push(issue("IR002", "thesis_claim_id must reference an existing claim", { path: "thesis_claim_id", stage_owner: "claim-extraction" }));
  if (document.composition?.grammar?.type !== document.figure_type) issues.push(issue("IR002", "composition grammar type must match figure_type", { path: "composition.grammar.type" }));
  if (!nodeIds.has(rootId)) issues.push(issue("IR002", "composition.root_id must reference an existing node", { path: "composition.root_id" }));
  else if (nodeById.get(rootId)?.parent_id !== undefined) issues.push(issue("IR003", "composition root must not declare parent_id", { object_id: rootId, path: `${rootId}.parent_id`, repair_hint: "Make composition.root_id the top of the semantic parent tree." }));
  for (const ref of asArray(document.composition?.order)) if (!nodeIds.has(ref)) issues.push(issue("IR002", `composition order reference '${ref}' does not exist`, { path: "composition.order" }));
  for (const ref of collectRoleBindingRefs(document.composition?.grammar?.role_bindings)) if (!nodeIds.has(ref)) issues.push(issue("IR002", `grammar role binding '${ref}' must resolve to a node`, { path: "composition.grammar.role_bindings" }));

  for (const node of nodes) {
    if (!asObject(node)) continue;
    checkClaimRefs(node);
    if (node.parent_id && !nodeIds.has(node.parent_id)) issues.push(issue("IR002", `parent reference '${node.parent_id}' does not exist`, { object_id: node.id, path: `${node.id}.parent_id` }));
    addGeometryIssues(node, node.id, node.id, issues);
  }
  for (const relation of relations) {
    if (!asObject(relation)) continue;
    checkClaimRefs(relation);
    for (const endpoint of ["from", "to"]) if (!nodeIds.has(relation[endpoint])) issues.push(issue("IR002", `${endpoint} reference '${relation[endpoint]}' does not exist`, { object_id: relation.id, path: `${relation.id}.${endpoint}` }));
    if (relation.kind === "extension" && !EXTENSION_KIND.test(relation.extension_kind ?? "")) issues.push(issue("IR009", "extension relation requires a namespaced extension_kind", { object_id: relation.id, path: `${relation.id}.extension_kind` }));
    if (relation.kind !== "extension" && relation.extension_kind !== undefined) issues.push(issue("IR009", "extension_kind is only valid on extension relations", { object_id: relation.id, path: `${relation.id}.extension_kind` }));
    addGeometryIssues(relation, relation.id, relation.id, issues);
  }
  for (const state of states) {
    if (!asObject(state)) continue;
    checkClaimRefs(state);
    if (!nodeIds.has(state.target_id)) issues.push(issue("IR002", `state target '${state.target_id}' does not exist`, { object_id: state.id, path: `${state.id}.target_id` }));
    if (asObject(state.domain) && state.domain.min !== undefined && state.domain.max !== undefined && state.domain.min > state.domain.max) issues.push(issue("IR006", "state domain min must be <= max", { object_id: state.id, path: `${state.id}.domain`, repair_hint: "Correct the numeric domain bounds." }));
    if (!valueInDomain(state.initial, state.domain) || !valueInDomain(state.summary, state.domain)) issues.push(issue("IR006", "state initial and summary values must belong to the declared domain", { object_id: state.id, path: `${state.id}.domain`, repair_hint: "Align initial/summary with the declared domain and numeric bounds." }));
    addGeometryIssues(state, state.id, state.id, issues);
  }
  for (const snapshot of snapshots) {
    if (!asObject(snapshot)) continue;
    addGeometryIssues(snapshot, snapshot.id, snapshot.id, issues);
    for (const [stateId, value] of Object.entries(asObject(snapshot.state_values) ? snapshot.state_values : {})) {
      const state = stateById.get(stateId);
      if (!state) issues.push(issue("IR002", `snapshot state reference '${stateId}' does not exist`, { object_id: snapshot.id, path: `${snapshot.id}.state_values.${stateId}` }));
      else if (!valueInDomain(value, state.domain)) issues.push(issue("IR007", `snapshot value for '${stateId}' is outside its declared domain`, { object_id: snapshot.id, path: `${snapshot.id}.state_values.${stateId}` }));
    }
  }
  if (!snapshotIds.has(document.static_snapshot_id)) issues.push(issue("IR007", "static_snapshot_id must reference an existing snapshot", { path: "static_snapshot_id" }));
  else {
    const snapshot = snapshots.find((x) => x?.id === document.static_snapshot_id);
    for (const state of states) {
      if (!Object.hasOwn(snapshot?.state_values ?? {}, state.id)) issues.push(issue("IR007", `static snapshot must explicitly reproduce summary value for '${state.id}'`, { object_id: snapshot.id, path: `${snapshot.id}.state_values.${state.id}` }));
      else if (!Object.is(snapshot.state_values[state.id], state.summary)) issues.push(issue("IR007", `static snapshot value for '${state.id}' must equal StateSpec.summary`, { object_id: snapshot.id, path: `${snapshot.id}.state_values.${state.id}` }));
    }
  }
  for (const [bucket, refs] of Object.entries(document.emphasis ?? {})) for (const ref of asArray(refs)) if (!(nodeIds.has(ref) || relationIds.has(ref) || stateIds.has(ref))) issues.push(issue("IR002", `emphasis reference '${ref}' does not exist`, { path: `emphasis.${bucket}` }));
  for (const namespace of Object.keys(asObject(document.extensions) ? document.extensions : {})) if (!EXTENSION_NAMESPACE.test(namespace)) issues.push(issue("IR009", `extension namespace '${namespace}' is not namespaced`, { path: `extensions.${namespace}` }));

  const visiting = new Set(), visited = new Map();
  const reachesRoot = (node) => {
    if (!node || !rootId) return false;
    if (node.id === rootId) return true;
    if (visited.has(node.id)) return visited.get(node.id);
    if (visiting.has(node.id)) { issues.push(issue("IR003", "parent graph contains a cycle", { object_id: node.id, path: `${node.id}.parent_id` })); return false; }
    visiting.add(node.id);
    const result = node.parent_id ? reachesRoot(nodeById.get(node.parent_id)) : false;
    visiting.delete(node.id); visited.set(node.id, result); return result;
  };
  for (const node of nodes) if (asObject(node) && node.id !== rootId && !reachesRoot(node)) issues.push(issue("IR003", `node '${node.id}' does not reach composition.root_id '${rootId}' through parent_id`, { object_id: node.id, path: `${node.id}.parent_id`, repair_hint: "Attach the semantic node under the composition root or remove it." }));

  const children = new Map(nodes.map((node) => [node?.id, []]));
  for (const node of nodes) if (node?.parent_id && children.has(node.parent_id)) children.get(node.parent_id).push(node.id);
  const descendantHasClaim = (nodeId, seen = new Set()) => {
    if (seen.has(nodeId)) return false;
    seen.add(nodeId);
    const node = nodeById.get(nodeId);
    if (!node) return false;
    if (asArray(node.claim_refs).length) return true;
    return asArray(children.get(nodeId)).some((childId) => descendantHasClaim(childId, seen));
  };
  for (const node of nodes) if (asObject(node) && !descendantHasClaim(node.id)) issues.push(issue("IR005", `node '${node.id}' has no direct or descendant claim witness`, { object_id: node.id, repair_hint: "Remove decorative semantics or connect a descendant to a claim." }));

  const reachableNodes = new Set(nodes.filter((node) => asObject(node) && reachesRoot(node)).map((node) => node.id));
  if (rootId) reachableNodes.add(rootId);
  const witnessed = new Set();
  for (const node of nodes) if (reachableNodes.has(node?.id)) asArray(node.claim_refs).forEach((ref) => witnessed.add(ref));
  for (const relation of relations) if (reachableNodes.has(relation?.from) && reachableNodes.has(relation?.to)) asArray(relation.claim_refs).forEach((ref) => witnessed.add(ref));
  for (const state of states) if (reachableNodes.has(state?.target_id)) asArray(state.claim_refs).forEach((ref) => witnessed.add(ref));
  for (const claim of claims) if ((claim?.role === "primary" || claim?.must_preserve === true) && !witnessed.has(claim.id)) issues.push(issue("IR004", `claim '${claim.id}' has no semantic witness in the reading composition`, { object_id: claim.id, stage_owner: "claim-extraction", repair_hint: "Attach the claim to a reachable node, relation, or state." }));
  return issues;
}
