import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { validateStructure } from "./schema-validator.js";

export const PROFILE_ENGINE_VERSION = "0.1.0";
export const PROFILE_PLAN_SCHEMA_VERSION = "figthread.profile-plan/0.1";

const targetSchemaUrl = new URL("../schemas/layout-target.schema.json", import.meta.url);
const registryUrl = new URL("../profiles/registry.json", import.meta.url);
const TARGET_SCHEMA = JSON.parse(readFileSync(fileURLToPath(targetSchemaUrl), "utf8"));
const PROFILE_REGISTRY = JSON.parse(readFileSync(fileURLToPath(registryUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };

function issue(code, severity, message, extra = {}) {
  return { code, severity, stage_owner: "profile", message, ...extra };
}
function sortIssues(issues) {
  return issues.sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity] ||
    a.code.localeCompare(b.code) ||
    (a.object_id ?? "").localeCompare(b.object_id ?? "") ||
    (a.path ?? "").localeCompare(b.path ?? "") ||
    a.message.localeCompare(b.message)
  );
}
function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}
function registryBase(registry) {
  return { schema_version: registry.schema_version, definitions: registry.definitions };
}
function readFigurePromotion(promotion) {
  if (!promotion?.promoted || !promotion.validated_figure || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt;
  const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (sha256Canonical(promotion.validated_figure) !== receipt.input_hash) return null;
  return { figure: promotion.validated_figure, figureHash: receipt.input_hash };
}
function readVisualPromotion(promotion) {
  if (!promotion?.promoted || !promotion.validated_visual || !promotion.primitive_plan || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt;
  const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (sha256Canonical(promotion.validated_visual) !== receipt.visual_hash) return null;
  const { plan_hash, ...planBase } = promotion.primitive_plan;
  if (sha256Canonical(planBase) !== plan_hash || plan_hash !== receipt.primitive_plan_hash) return null;
  if (promotion.primitive_plan.figure_hash !== receipt.figure_hash) return null;
  return {
    plan: promotion.primitive_plan,
    figureHash: receipt.figure_hash,
    visualHash: receipt.visual_hash,
    primitivePlanHash: receipt.primitive_plan_hash,
    primitiveRegistryHash: receipt.registry_hash
  };
}

export const PROFILE_REGISTRY_HASH = PROFILE_REGISTRY.registry_hash;
const computedRegistryHash = sha256Canonical(registryBase(PROFILE_REGISTRY));
if (computedRegistryHash !== PROFILE_REGISTRY_HASH) throw new Error("bundled profile registry hash mismatch");

function findDefinition(profileId) {
  return PROFILE_REGISTRY.definitions.find((entry) => entry.id === profileId) ?? null;
}
function validateTarget(target, figure, issues) {
  for (const entry of validateStructure(target, TARGET_SCHEMA)) {
    issues.push(issue("PRF001_TARGET", "error", `profile target ${entry.path}: ${entry.message}`, { path: entry.path }));
  }
  if (issues.some((entry) => entry.severity === "error")) return;
  if (target.target.profile !== figure.profile) {
    issues.push(issue("PRF001_TARGET", "error", `target profile ${target.target.profile} does not match promoted figure profile ${figure.profile}`, { path: "$.target.profile" }));
  }
  const { viewport, safe_area } = target.target;
  if (safe_area.left + safe_area.right >= viewport.width || safe_area.top + safe_area.bottom >= viewport.height) {
    issues.push(issue("PRF001_TARGET", "error", "safe area leaves no positive target viewport", { path: "$.target.safe_area" }));
  }
}
function nearestPanel(nodeId, nodeById, rootId) {
  let current = nodeById.get(nodeId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.kind === "panel") return current.id;
    current = current.parent_id ? nodeById.get(current.parent_id) : null;
  }
  return rootId;
}
function weightedItemCount(node, binding) {
  if (node.kind === "panel" || node.kind === "group") return 0;
  return binding?.salience === "S3" ? 2 : 1;
}
function countDensity(figure, visualPlan) {
  const rootId = figure.composition.root_id;
  const nodeById = new Map(figure.nodes.map((node) => [node.id, node]));
  const bindingByNode = new Map(visualPlan.bindings.map((binding) => [binding.node_id, binding]));
  const directPanels = figure.nodes.filter((node) => node.id !== rootId && node.kind === "panel" && node.parent_id === rootId);
  const primaryPanelIds = directPanels.length ? directPanels.map((node) => node.id).sort() : [rootId];
  const panelItems = Object.fromEntries(primaryPanelIds.map((id) => [id, 0]));
  const panelRelations = Object.fromEntries(primaryPanelIds.map((id) => [id, 0]));

  let items = 0;
  for (const node of figure.nodes) {
    if (node.id === rootId) continue;
    const weight = weightedItemCount(node, bindingByNode.get(node.id));
    items += weight;
    const panelId = nearestPanel(node.id, nodeById, rootId);
    const primary = primaryPanelIds.includes(panelId) ? panelId : rootId;
    if (panelItems[primary] !== undefined) panelItems[primary] += weight;
  }
  for (const relation of figure.relations) {
    const fromPanel = nearestPanel(relation.from, nodeById, rootId);
    const toPanel = nearestPanel(relation.to, nodeById, rootId);
    const fromPrimary = primaryPanelIds.includes(fromPanel) ? fromPanel : rootId;
    const toPrimary = primaryPanelIds.includes(toPanel) ? toPanel : rootId;
    if (fromPrimary === toPrimary && panelRelations[fromPrimary] !== undefined) panelRelations[fromPrimary] += 1;
  }
  return {
    items,
    relations: figure.relations.length,
    panels: primaryPanelIds.length,
    items_by_panel: panelItems,
    relations_by_panel: panelRelations
  };
}
function budgetCheck(actual, soft, hard, label, objectId, issues, softTracker) {
  if (typeof hard === "number" && actual > hard) {
    issues.push(issue("PRF006_DENSITY", "error", `${label} ${actual} exceeds hard budget ${hard}`, { object_id: objectId }));
    return;
  }
  if (typeof soft === "number" && actual > soft) {
    const ratio = (actual - soft) / Math.max(1, soft);
    if (ratio > 0.2) {
      issues.push(issue("PRF006_DENSITY", "error", `${label} ${actual} exceeds soft budget ${soft} by more than 20%`, { object_id: objectId }));
    } else {
      issues.push(issue("PRF006_DENSITY", "warning", `${label} ${actual} exceeds soft budget ${soft}`, { object_id: objectId }));
      softTracker.push({ label, objectId });
    }
  }
}
function validateDensity(counts, thresholds, issues) {
  const softTracker = [];
  const d = thresholds.density;
  budgetCheck(counts.items, d.items_soft, d.items_hard, "semantic item count", undefined, issues, softTracker);
  budgetCheck(counts.relations, d.relations_soft, d.relations_hard, "relation count", undefined, issues, softTracker);
  if (counts.panels > d.panels_hard) {
    issues.push(issue("PRF006_DENSITY", "error", `primary panel count ${counts.panels} exceeds hard budget ${d.panels_hard}`));
  }
  for (const panelId of Object.keys(counts.items_by_panel).sort()) {
    budgetCheck(counts.items_by_panel[panelId], d.items_per_panel_soft, d.items_per_panel_hard, `panel item count for ${panelId}`, panelId, issues, softTracker);
    if (counts.relations_by_panel[panelId] > d.relations_per_panel_hard) {
      issues.push(issue("PRF006_DENSITY", "error", `panel relation count for ${panelId} ${counts.relations_by_panel[panelId]} exceeds hard budget ${d.relations_per_panel_hard}`, { object_id: panelId }));
    }
  }
  if (softTracker.length >= 2) {
    issues.push(issue("PRF006_DENSITY", "error", `multiple soft density budgets are exceeded simultaneously (${softTracker.length})`));
  }
}
function refineMeasurement(metric, node, threshold, adjustments) {
  const font = threshold.type.primary_floor_px;
  const label = typeof node?.label === "string" ? node.label : "";
  const chars = Array.from(label).length;
  const textMinW = chars ? Math.ceil(chars * font * threshold.type.avg_advance_em + 2 * font * threshold.type.padding_em) : 0;
  const textMinH = chars ? Math.ceil(font * threshold.type.line_height + 2 * font * threshold.type.padding_em) : 0;
  const next = {
    node_id: metric.node_id,
    min_w: Math.max(metric.min_w, textMinW),
    min_h: Math.max(metric.min_h, textMinH),
    pref_w: Math.max(metric.pref_w, metric.min_w, textMinW),
    pref_h: Math.max(metric.pref_h, metric.min_h, textMinH)
  };
  if (next.min_w !== metric.min_w || next.min_h !== metric.min_h || next.pref_w !== metric.pref_w || next.pref_h !== metric.pref_h) {
    adjustments.push({
      kind: "text-floor",
      node_id: metric.node_id,
      from: { min_w: metric.min_w, min_h: metric.min_h, pref_w: metric.pref_w, pref_h: metric.pref_h },
      to: { ...next },
      font_floor_px: font
    });
  }
  return next;
}
function effectiveTarget(target, threshold, adjustments, issues) {
  const next = structuredClone(target);
  const floor = threshold.geometry.node_gap_px;
  const requestedMin = next.options.min_gap ?? 12;
  const requestedPreferred = next.options.preferred_gap ?? 32;
  const effectiveMin = Math.max(requestedMin, floor);
  const effectivePreferred = Math.max(requestedPreferred, effectiveMin);
  if (effectiveMin !== requestedMin || effectivePreferred !== requestedPreferred) {
    adjustments.push({
      kind: "spacing-floor",
      requested: { min_gap: requestedMin, preferred_gap: requestedPreferred },
      effective: { min_gap: effectiveMin, preferred_gap: effectivePreferred }
    });
    issues.push(issue("PRF004_SPACING", "note", `profile strengthened layout gap floor to ${effectiveMin}px`));
  }
  next.options.min_gap = effectiveMin;
  next.options.preferred_gap = effectivePreferred;

  const ratio = threshold.target_rules.safe_margin_ratio_min ?? 0;
  if (ratio > 0) {
    const { viewport, safe_area } = next.target;
    const minHorizontal = viewport.width * ratio;
    const minVertical = viewport.height * ratio;
    if (safe_area.left < minHorizontal || safe_area.right < minHorizontal || safe_area.top < minVertical || safe_area.bottom < minVertical) {
      issues.push(issue("PRF001_TARGET", "error", `safe margins must be at least ${(ratio * 100).toFixed(1)}% of the target dimensions`, { path: "$.target.safe_area" }));
    }
  }
  return next;
}
function compilePlan(figure, visual, target, threshold, thresholdHash, issues) {
  const counts = countDensity(figure.figure, visual.plan);
  validateDensity(counts, threshold, issues);
  const adjustments = [];
  const nodeById = new Map(figure.figure.nodes.map((node) => [node.id, node]));
  const measurements = visual.plan.measurements
    .map((metric) => refineMeasurement(metric, nodeById.get(metric.node_id), threshold, adjustments))
    .sort((a, b) => a.node_id.localeCompare(b.node_id));
  const resolvedTarget = effectiveTarget(target, threshold, adjustments, issues);
  const base = {
    schema_version: PROFILE_PLAN_SCHEMA_VERSION,
    figure_hash: figure.figureHash,
    visual_hash: visual.visualHash,
    primitive_registry_hash: visual.primitiveRegistryHash,
    primitive_plan_hash: visual.primitivePlanHash,
    profile_registry_hash: PROFILE_REGISTRY_HASH,
    profile_id: threshold.id,
    threshold_hash: thresholdHash,
    target: resolvedTarget.target,
    options: resolvedTarget.options,
    counts,
    measurements,
    intrinsic_metrics_hash: sha256Canonical(measurements),
    adjustments
  };
  return deepFreeze({ ...base, plan_hash: sha256Canonical(base) });
}

export function compileProfilePlan(figurePromotion, visualPromotion, target, options = {}) {
  const mode = options.mode ?? "gate";
  if (!["draft", "gate"].includes(mode)) throw new TypeError("profile mode must be 'draft' or 'gate'");
  const figure = readFigurePromotion(figurePromotion);
  const visual = readVisualPromotion(visualPromotion);
  if (!figure || !visual || figure.figureHash !== visual.figureHash) {
    return {
      mode,
      status: "fail",
      promotion_eligible: false,
      profile_engine_version: PROFILE_ENGINE_VERSION,
      profile_registry_hash: PROFILE_REGISTRY_HASH,
      issues: [issue("PRF001_TARGET", "error", "profile compilation requires matching promoted semantic and visual artifacts")]
    };
  }
  const issues = [];
  validateTarget(target, figure.figure, issues);
  const profileId = target?.target?.profile;
  if (issues.some((entry) => entry.severity === "error")) {
    return {
      figure_hash: figure.figureHash,
      visual_hash: visual.visualHash,
      primitive_plan_hash: visual.primitivePlanHash,
      mode,
      status: "fail",
      promotion_eligible: false,
      profile_engine_version: PROFILE_ENGINE_VERSION,
      profile_registry_hash: PROFILE_REGISTRY_HASH,
      issues: sortIssues(issues)
    };
  }
  const threshold = typeof profileId === "string" ? findDefinition(profileId) : null;
  if (!threshold) {
    issues.push(issue("PRF001_TARGET", "error", `unknown profile ${String(profileId)}`, { path: "$.target.profile" }));
    return {
      figure_hash: figure.figureHash,
      visual_hash: visual.visualHash,
      primitive_plan_hash: visual.primitivePlanHash,
      mode,
      status: "fail",
      promotion_eligible: false,
      profile_engine_version: PROFILE_ENGINE_VERSION,
      profile_registry_hash: PROFILE_REGISTRY_HASH,
      issues: sortIssues(issues)
    };
  }
  const thresholdHash = sha256Canonical(threshold);
  const plan = compilePlan(figure, visual, target, threshold, thresholdHash, issues);
  const sorted = sortIssues(issues);
  const hasErrors = sorted.some((entry) => entry.severity === "error");
  return {
    figure_hash: figure.figureHash,
    visual_hash: visual.visualHash,
    primitive_plan_hash: visual.primitivePlanHash,
    profile_id: threshold.id,
    threshold_hash: thresholdHash,
    profile_registry_hash: PROFILE_REGISTRY_HASH,
    profile_plan_hash: plan.plan_hash,
    mode,
    status: hasErrors ? "fail" : sorted.some((entry) => entry.severity === "warning") ? "pass-with-warnings" : "pass",
    promotion_eligible: mode === "gate" && !hasErrors,
    profile_engine_version: PROFILE_ENGINE_VERSION,
    issues: sorted,
    profile_plan: plan
  };
}

export function promoteProfilePlan(figurePromotion, visualPromotion, target) {
  const result = compileProfilePlan(figurePromotion, visualPromotion, target, { mode: "gate" });
  if (!result.promotion_eligible) return { promoted: false, report: result };
  const plan = result.profile_plan;
  const receiptBase = {
    kind: "profile_plan",
    schema_version: PROFILE_PLAN_SCHEMA_VERSION,
    figure_hash: result.figure_hash,
    visual_hash: result.visual_hash,
    primitive_plan_hash: result.primitive_plan_hash,
    profile_registry_hash: result.profile_registry_hash,
    profile_id: result.profile_id,
    threshold_hash: result.threshold_hash,
    profile_plan_hash: plan.plan_hash,
    intrinsic_metrics_hash: plan.intrinsic_metrics_hash,
    engine_version: PROFILE_ENGINE_VERSION
  };
  return {
    promoted: true,
    report: result,
    profile_plan: plan,
    promotion_receipt: deepFreeze({ ...receiptBase, promotion_hash: sha256Canonical(receiptBase) })
  };
}

export function readProfilePromotion(promotion) {
  if (!promotion?.promoted || !promotion.profile_plan || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt;
  const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  const { plan_hash, ...planBase } = promotion.profile_plan;
  if (sha256Canonical(planBase) !== plan_hash || plan_hash !== receipt.profile_plan_hash) return null;
  if (promotion.profile_plan.figure_hash !== receipt.figure_hash || promotion.profile_plan.visual_hash !== receipt.visual_hash || promotion.profile_plan.primitive_plan_hash !== receipt.primitive_plan_hash) return null;
  if (promotion.profile_plan.threshold_hash !== receipt.threshold_hash || promotion.profile_plan.profile_registry_hash !== receipt.profile_registry_hash) return null;
  return {
    plan: promotion.profile_plan,
    figureHash: receipt.figure_hash,
    visualHash: receipt.visual_hash,
    primitivePlanHash: receipt.primitive_plan_hash,
    profilePlanHash: receipt.profile_plan_hash,
    thresholdHash: receipt.threshold_hash,
    profileRegistryHash: receipt.profile_registry_hash,
    profileId: receipt.profile_id
  };
}

function cueIntervals(motion) {
  const eventById = new Map((motion.events ?? []).map((event) => [event.id, event]));
  const out = [];
  for (const beat of motion.timeline?.beats ?? []) {
    for (const eventId of beat.event_ids ?? []) {
      const event = eventById.get(eventId);
      if (!event) continue;
      for (const [index, cue] of (event.cues ?? []).entries()) {
        const duration = cue.duration_ms ?? Math.max(0, beat.duration_ms - (cue.start_offset_ms ?? 0));
        const start = beat.at_ms + (cue.start_offset_ms ?? 0);
        const group = cue.target_id ?? cue.subject_id ?? cue.via_relation ?? `${event.id}:${index}`;
        out.push({ event_id: event.id, cue_index: index, kind: cue.kind, group, start, end: start + duration, duration });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start || a.end - b.end || a.event_id.localeCompare(b.event_id) || a.cue_index - b.cue_index);
}
function maxConcurrent(intervals) {
  const times = [...new Set(intervals.flatMap((interval) => interval.duration > 0 ? [interval.start, interval.end] : []))].sort((a, b) => a - b);
  let max = 0;
  for (const time of times) {
    const groups = new Set(intervals.filter((interval) => interval.duration > 0 && interval.start <= time && time < interval.end).map((interval) => interval.group));
    max = Math.max(max, groups.size);
  }
  return max;
}

export function validateProfileMotion(profilePromotion, motion, options = {}) {
  const mode = options.mode ?? "gate";
  if (!["draft", "gate"].includes(mode)) throw new TypeError("profile motion mode must be 'draft' or 'gate'");
  const profile = readProfilePromotion(profilePromotion);
  if (!profile) {
    return {
      mode,
      status: "fail",
      promotion_eligible: false,
      profile_engine_version: PROFILE_ENGINE_VERSION,
      issues: [issue("PRF007_MOTION", "error", "profile motion validation requires a valid promoted profile plan")]
    };
  }
  const threshold = findDefinition(profile.profileId);
  const envelope = threshold.motion;
  const issues = [];
  const intervals = cueIntervals(motion);
  if (!envelope.enabled && intervals.length) {
    issues.push(issue("PRF007_MOTION", "error", `${profile.profileId} profile does not allow explanatory motion`));
  }
  if (envelope.enabled && Array.isArray(envelope.cue_ms)) {
    for (const interval of intervals) {
      if (interval.duration < envelope.cue_ms[0] || interval.duration > envelope.cue_ms[1]) {
        issues.push(issue("PRF007_MOTION", "error", `${interval.event_id} cue duration ${interval.duration}ms is outside ${envelope.cue_ms[0]}–${envelope.cue_ms[1]}ms`, { object_id: interval.event_id }));
      }
    }
  }
  const beatStarts = (motion.timeline?.beats ?? [])
    .filter((beat) => (beat.event_ids ?? []).length && beat.duration_ms > 0)
    .map((beat) => beat.at_ms)
    .sort((a, b) => a - b);
  if (envelope.enabled && typeof envelope.dwell_ms === "number") {
    for (let i = 1; i < beatStarts.length; i += 1) {
      const spacing = beatStarts[i] - beatStarts[i - 1];
      if (spacing < envelope.dwell_ms) {
        issues.push(issue("PRF007_MOTION", "error", `semantic beat spacing ${spacing}ms is below profile dwell floor ${envelope.dwell_ms}ms`));
      }
    }
  }
  const loop = motion.timeline?.loop;
  const duration = motion.timeline?.duration_ms;
  if (loop?.mode === "repeat") {
    if (!envelope.repeat_allowed) {
      issues.push(issue("PRF007_MOTION", "error", `${profile.profileId} profile does not allow repeat autoplay loops`));
    }
    if (Array.isArray(envelope.loop_ms) && (duration < envelope.loop_ms[0] || duration > envelope.loop_ms[1])) {
      issues.push(issue("PRF007_MOTION", "error", `repeat loop duration ${duration}ms is outside ${envelope.loop_ms[0]}–${envelope.loop_ms[1]}ms`));
    }
  }
  const concurrent = maxConcurrent(intervals);
  if (concurrent > envelope.moving_groups_hard) {
    issues.push(issue("PRF007_MOTION", "error", `simultaneous moving semantic groups ${concurrent} exceed hard budget ${envelope.moving_groups_hard}`));
  }
  const sorted = sortIssues(issues);
  const hasErrors = sorted.some((entry) => entry.severity === "error");
  return {
    profile_id: profile.profileId,
    profile_plan_hash: profile.profilePlanHash,
    threshold_hash: profile.thresholdHash,
    mode,
    status: hasErrors ? "fail" : sorted.length ? "pass-with-warnings" : "pass",
    promotion_eligible: mode === "gate" && !hasErrors,
    profile_engine_version: PROFILE_ENGINE_VERSION,
    issues: sorted,
    metrics: { cue_count: intervals.length, moving_groups_peak: concurrent }
  };
}
