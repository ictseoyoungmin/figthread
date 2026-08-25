import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";
import { readProfilePromotion } from "./profile.js";

export const RENDER_ENGINE_VERSION = "0.1.0";
export const RENDERED_SVG_SCHEMA_VERSION = "figthread.rendered-svg/0.1";

const registryUrl = new URL("../profiles/registry.json", import.meta.url);
const PROFILE_REGISTRY = JSON.parse(readFileSync(fileURLToPath(registryUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };
const CORE_FAMILIES = Object.freeze([
  "frame", "group", "label-stack", "badge", "port", "connector", "bracket", "annotation",
  "actor", "compute", "store", "queue", "artifact", "model", "router", "boundary",
  "token", "sequence", "cell", "array", "stack", "matrix", "tree", "meter"
]);
export const SUPPORTED_CORE_PRIMITIVES = Object.freeze(CORE_FAMILIES.map((family) => `core.${family}@0.1`));

const COLOR_THEMES = Object.freeze({
  paper: Object.freeze({ paper: "#ffffff", ink: "#111111", muted: "#555555", accent: "#222222", rule: "#bbbbbb" }),
  default: Object.freeze({ paper: "#fbfaf6", ink: "#1f2328", muted: "#667085", accent: "#8b3d2f", rule: "#c9c5bc" })
});

function issue(code, severity, message, extra = {}) {
  return { code, severity, stage_owner: "render", message, ...extra };
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
function sha256Text(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}
function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
function number(value) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
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
  if (promotion.primitive_plan.figure_hash !== receipt.figure_hash || promotion.primitive_plan.registry_hash !== receipt.registry_hash) return null;
  return {
    visual: promotion.validated_visual,
    plan: promotion.primitive_plan,
    figureHash: receipt.figure_hash,
    visualHash: receipt.visual_hash,
    primitiveRegistryHash: receipt.registry_hash,
    primitivePlanHash: receipt.primitive_plan_hash
  };
}
function readLayoutPromotion(promotion) {
  if (!promotion?.promoted || !promotion.resolved_layout || !promotion.layout_intent || !promotion.promotion_receipt) return null;
  const receipt = promotion.promotion_receipt;
  const { promotion_hash, ...base } = receipt;
  if (sha256Canonical(base) !== promotion_hash) return null;
  if (sha256Canonical(promotion.layout_intent) !== receipt.layout_intent_hash) return null;
  const { layout_hash, ...resolvedBase } = promotion.resolved_layout;
  if (sha256Canonical(resolvedBase) !== layout_hash || layout_hash !== receipt.layout_hash) return null;
  if (promotion.resolved_layout.figure_hash !== receipt.figure_hash) return null;
  return {
    layout: promotion.resolved_layout,
    intent: promotion.layout_intent,
    figureHash: receipt.figure_hash,
    visualHash: receipt.visual_hash,
    primitivePlanHash: receipt.primitive_plan_hash,
    profileRegistryHash: receipt.profile_registry_hash,
    thresholdHash: receipt.profile_threshold_hash,
    profilePlanHash: receipt.profile_plan_hash,
    layoutHash: receipt.layout_hash,
    targetId: receipt.target_id
  };
}
function registryBase(registry) {
  return { schema_version: registry.schema_version, definitions: registry.definitions };
}
const computedProfileRegistryHash = sha256Canonical(registryBase(PROFILE_REGISTRY));
if (computedProfileRegistryHash !== PROFILE_REGISTRY.registry_hash) throw new Error("bundled profile registry hash mismatch");
function thresholdFor(profileId) {
  return PROFILE_REGISTRY.definitions.find((entry) => entry.id === profileId) ?? null;
}
function themeFor(profileId) {
  return profileId === "paper" ? COLOR_THEMES.paper : COLOR_THEMES.default;
}
function familyOf(primitiveId) {
  const match = /^core\.([a-z0-9-]+)@0\.1$/.exec(primitiveId);
  return match?.[1] ?? null;
}
function staticState(figure) {
  const snapshot = figure.snapshots.find((entry) => entry.id === figure.static_snapshot_id);
  const values = { ...(snapshot?.state_values ?? {}) };
  for (const state of figure.states) if (values[state.id] === undefined) values[state.id] = state.summary;
  return values;
}
function channelState(binding, stateValues) {
  return Object.fromEntries(Object.entries(binding.state_bindings ?? {}).map(([channel, stateId]) => [channel, stateValues[stateId]]));
}
function shapeStyle(binding, threshold, theme) {
  const emphasis = binding.__emphasis ?? "secondary";
  const essential = threshold.geometry.essential_stroke_px;
  if (emphasis === "primary") return { stroke: theme.accent, width: essential * 1.35, dash: null };
  if (emphasis === "muted") return { stroke: theme.muted, width: essential, dash: `${number(essential * 2.5)} ${number(essential * 2)}` };
  return { stroke: theme.ink, width: essential, dash: null };
}
function attrs(style, extra = "") {
  const dash = style.dash ? ` stroke-dasharray="${style.dash}"` : "";
  return `fill="none" stroke="${style.stroke}" stroke-width="${number(style.width)}"${dash} vector-effect="non-scaling-stroke" data-essential="true"${extra}`;
}
function rect(x, y, w, h, style, radius = 0, extra = "") {
  return `<rect x="${number(x)}" y="${number(y)}" width="${number(w)}" height="${number(h)}"${radius ? ` rx="${number(radius)}"` : ""} ${attrs(style, extra)}/>`;
}
function line(x1, y1, x2, y2, style, extra = "") {
  return `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" ${attrs(style, extra)}/>`;
}
function circle(cx, cy, r, style, fill = "none", extra = "") {
  return `<circle cx="${number(cx)}" cy="${number(cy)}" r="${number(r)}" fill="${fill}" stroke="${style.stroke}" stroke-width="${number(style.width)}" vector-effect="non-scaling-stroke" data-essential="true"${extra}/>`;
}
function polygon(points, style, fill = "none", extra = "") {
  return `<polygon points="${points.map(([x, y]) => `${number(x)},${number(y)}`).join(" ")}" fill="${fill}" stroke="${style.stroke}" stroke-width="${number(style.width)}" vector-effect="non-scaling-stroke" data-essential="true"${extra}/>`;
}
function coreShape(binding, threshold, theme, state) {
  const family = familyOf(binding.primitive_id);
  if (!family || !CORE_FAMILIES.includes(family)) return null;
  const [, , vw, vh] = binding.view_box;
  const style = shapeStyle(binding, threshold, theme);
  const W = vw, H = vh;
  const pad = Math.max(5, Math.min(W, H) * 0.09);
  const innerH = Math.max(8, H - pad * 2);
  switch (family) {
    case "frame": return rect(1, 1, W - 2, H - 2, style, binding.variant === "panel" ? 8 : 0);
    case "group": return rect(2, 2, W - 4, H - 4, { ...style, dash: `${number(style.width * 3)} ${number(style.width * 2)}` }, 6);
    case "label-stack": return `${rect(1, 1, W - 2, H - 2, style, 4)}${line(pad, H / 2, W - pad, H / 2, style)}`;
    case "badge": return rect(1, 1, W - 2, H - 2, style, binding.variant === "pill" ? H / 2 : 3);
    case "port": return binding.variant === "dot" ? circle(W / 2, H / 2, Math.min(W, H) * 0.28, style, theme.paper) : rect(W * 0.28, H * 0.18, W * 0.44, H * 0.64, style, 1);
    case "connector": return `${line(pad, H / 2, W - pad, H / 2, style)}${polygon([[W - pad, H / 2], [W - pad - 6, H / 2 - 4], [W - pad - 6, H / 2 + 4]], style, style.stroke)}`;
    case "bracket": {
      const d = binding.variant === "right" ? `M${W-pad} ${pad} L${W-pad/2} ${pad} L${W-pad/2} ${H-pad} L${W-pad} ${H-pad}` :
        binding.variant === "top" ? `M${pad} ${pad} L${pad} ${pad/2} L${W-pad} ${pad/2} L${W-pad} ${pad}` :
        binding.variant === "bottom" ? `M${pad} ${H-pad} L${pad} ${H-pad/2} L${W-pad} ${H-pad/2} L${W-pad} ${H-pad}` :
        `M${pad} ${pad} L${pad/2} ${pad} L${pad/2} ${H-pad} L${pad} ${H-pad}`;
      return `<path d="${d}" ${attrs(style)}/>`;
    }
    case "annotation": return `${rect(1, 1, W - 2, H - 2, style, 5)}${line(W * 0.18, H - 1, W * 0.08, H + H * 0.12, style)}`;
    case "actor": return `${circle(W / 2, pad + innerH * 0.2, innerH * 0.14, style, theme.paper)}${line(W / 2, pad + innerH * 0.34, W / 2, pad + innerH * 0.72, style)}${line(W / 2, pad + innerH * 0.46, W * 0.32, pad + innerH * 0.58, style)}${line(W / 2, pad + innerH * 0.46, W * 0.68, pad + innerH * 0.58, style)}${line(W / 2, pad + innerH * 0.72, W * 0.37, pad + innerH * 0.94, style)}${line(W / 2, pad + innerH * 0.72, W * 0.63, pad + innerH * 0.94, style)}`;
    case "compute": return `${rect(2, 2, W - 4, H - 4, style, 8)}${line(pad, H * 0.24, pad, H * 0.76, style)}${line(W - pad, H * 0.24, W - pad, H * 0.76, style)}`;
    case "store": return `<path d="M${pad} ${H*0.22} C${pad} ${H*0.08},${W-pad} ${H*0.08},${W-pad} ${H*0.22} L${W-pad} ${H*0.76} C${W-pad} ${H*0.9},${pad} ${H*0.9},${pad} ${H*0.76} Z M${pad} ${H*0.22} C${pad} ${H*0.36},${W-pad} ${H*0.36},${W-pad} ${H*0.22}" ${attrs(style)}/>`;
    case "queue": {
      const capacity = Math.max(2, Math.min(8, Number(binding.props?.capacity) || 4));
      const occupancy = Math.max(0, Math.min(capacity, Number(state.occupancy) || 0));
      const x = pad, y = H * 0.28, w = W - pad * 2, h = H * 0.44, cellW = w / capacity;
      let out = rect(x, y, w, h, style, 2);
      for (let i = 1; i < capacity; i += 1) out += line(x + cellW * i, y, x + cellW * i, y + h, style);
      for (let i = 0; i < occupancy; i += 1) out += `<rect x="${number(x + i * cellW + 2)}" y="${number(y + 2)}" width="${number(Math.max(1, cellW - 4))}" height="${number(h - 4)}" fill="${theme.accent}" stroke="${style.stroke}" stroke-width="${number(style.width * 1.5)}" vector-effect="non-scaling-stroke" data-state-mark="occupancy"/>`;
      return out;
    }
    case "artifact": return `<path d="M${pad} ${pad} H${W-pad*1.8} L${W-pad} ${pad*1.8} V${H-pad} H${pad} Z M${W-pad*1.8} ${pad} V${pad*1.8} H${W-pad}" ${attrs(style)}/>`;
    case "model": return `${rect(pad * 0.7, pad * 0.9, W - pad * 1.4, H - pad * 1.8, style, 10)}${rect(pad, pad * 0.55, W - pad * 2, H - pad * 1.1, { ...style, width: Math.max(style.width, threshold.geometry.hairline_stroke_px) }, 10)}`;
    case "router": return polygon([[W / 2, pad], [W - pad, H / 2], [W / 2, H - pad], [pad, H / 2]], style, theme.paper);
    case "boundary": return rect(2, 2, W - 4, H - 4, { ...style, dash: `${number(style.width * 4)} ${number(style.width * 2.5)}` }, 8);
    case "token": return binding.variant === "packet" ? rect(2, 2, W - 4, H - 4, style, 3) : circle(W / 2, H / 2, Math.min(W, H) * 0.34, style, theme.accent);
    case "sequence": {
      const count = 5, x = pad * 0.5, y = H * 0.2, w = W - pad, h = H * 0.6, cellW = w / count;
      let out = rect(x, y, w, h, style, 2);
      for (let i = 1; i < count; i += 1) out += line(x + cellW * i, y, x + cellW * i, y + h, style);
      return out;
    }
    case "cell": return rect(pad * 0.5, pad * 0.5, W - pad, H - pad, style, binding.variant === "value" ? 4 : 0);
    case "array": {
      const count = 6, x = pad * 0.5, y = H * 0.16, w = W - pad, h = H * 0.68, cellW = w / count;
      let out = rect(x, y, w, h, style, 1);
      for (let i = 1; i < count; i += 1) out += line(x + cellW * i, y, x + cellW * i, y + h, style);
      return out;
    }
    case "stack": {
      let out = "";
      const levels = 4, itemH = (H - pad * 2) / levels;
      for (let i = 0; i < levels; i += 1) out += rect(pad, H - pad - itemH * (i + 1), W - pad * 2, itemH - 2, style, 2);
      return out;
    }
    case "matrix": {
      let out = rect(pad, pad, W - pad * 2, H - pad * 2, style, 1);
      for (let i = 1; i < 4; i += 1) {
        out += line(pad + (W - pad * 2) * i / 4, pad, pad + (W - pad * 2) * i / 4, H - pad, style);
        out += line(pad, pad + (H - pad * 2) * i / 4, W - pad, pad + (H - pad * 2) * i / 4, style);
      }
      return out;
    }
    case "tree": {
      const p0 = [W / 2, pad], p1 = [W * 0.3, H * 0.48], p2 = [W * 0.7, H * 0.48], p3 = [W * 0.2, H - pad], p4 = [W * 0.42, H - pad], p5 = [W * 0.62, H - pad], p6 = [W * 0.82, H - pad];
      let out = `${line(...p0, ...p1, style)}${line(...p0, ...p2, style)}${line(...p1, ...p3, style)}${line(...p1, ...p4, style)}${line(...p2, ...p5, style)}${line(...p2, ...p6, style)}`;
      for (const [x, y] of [p0, p1, p2, p3, p4, p5, p6]) out += circle(x, y, Math.max(3, Math.min(W, H) * 0.035), style, theme.paper);
      return out;
    }
    case "meter": {
      const ratio = Math.max(0, Math.min(1, Number(state.ratio ?? state.value) || 0.62));
      const x = pad * 0.6, y = H * 0.3, w = W - pad * 1.2, h = H * 0.4;
      return `${rect(x, y, w, h, style, h / 2)}<rect x="${number(x + 2)}" y="${number(y + 2)}" width="${number(Math.max(0, (w - 4) * ratio))}" height="${number(Math.max(0, h - 4))}" rx="${number(Math.max(0, h / 2 - 2))}" fill="${theme.accent}" data-state-mark="meter"/>`;
    }
    default: return null;
  }
}
function transformFor(binding, box) {
  const [vx, vy, vw, vh] = binding.view_box;
  const sx = box.w / vw, sy = box.h / vh;
  if (binding.intrinsic.aspect_policy === "fixed") {
    const s = Math.min(sx, sy);
    const ox = box.x + (box.w - vw * s) / 2 - vx * s;
    const oy = box.y + (box.h - vh * s) / 2 - vy * s;
    return `translate(${number(ox)} ${number(oy)}) scale(${number(s)})`;
  }
  return `translate(${number(box.x - vx * sx)} ${number(box.y - vy * sy)}) scale(${number(sx)} ${number(sy)})`;
}
function arrowHead(points, size, color) {
  if (!Array.isArray(points) || points.length < 2) return "";
  const a = points[points.length - 2], b = points[points.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  const backX = b.x - ux * size, backY = b.y - uy * size;
  const p1 = [b.x, b.y], p2 = [backX + px * size * 0.55, backY + py * size * 0.55], p3 = [backX - px * size * 0.55, backY - py * size * 0.55];
  return `<polygon points="${[p1, p2, p3].map(([x, y]) => `${number(x)},${number(y)}`).join(" ")}" fill="${color}" data-arrowhead="true"/>`;
}
function renderConnector(relation, routed, threshold, theme) {
  const width = threshold.geometry.essential_stroke_px;
  const path = escapeXml(routed.path_d);
  return `<g data-relation-id="${escapeXml(relation.id)}" data-relation-kind="${escapeXml(relation.kind)}"><path d="${path}" fill="none" stroke="${theme.ink}" stroke-width="${number(width)}" vector-effect="non-scaling-stroke" data-essential="true"/>${arrowHead(routed.points, Math.max(5, width * 4), theme.ink)}</g>`;
}
function renderNode(node, binding, box, threshold, theme, stateValues, emphasis) {
  const resolved = { ...binding, __emphasis: emphasis };
  const state = channelState(binding, stateValues);
  let local;
  if (binding.source === "custom") local = binding.local_svg;
  else local = coreShape(resolved, threshold, theme, state);
  if (typeof local !== "string" || !local.length) return null;
  const transform = transformFor(binding, box);
  const font = threshold.type.primary_floor_px;
  const style = shapeStyle(resolved, threshold, theme);
  const title = escapeXml(node.label || node.id);
  const isRoot = node.kind === "panel" && !node.parent_id;
  const labelX = isRoot ? box.x + Math.max(10, font * 0.85) : box.x + box.w / 2;
  const labelY = isRoot ? box.y + font * 1.45 : box.y + box.h / 2 + font * 0.35;
  const anchor = isRoot ? "start" : "middle";
  const weight = emphasis === "primary" || isRoot ? 650 : 550;
  return `<g data-node-id="${escapeXml(node.id)}" data-primitive-id="${escapeXml(binding.primitive_id)}" data-emphasis="${emphasis}"><title>${title}</title><g transform="${transform}" data-primitive-shape="true">${local}</g><text x="${number(labelX)}" y="${number(labelY)}" text-anchor="${anchor}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${number(font)}" font-weight="${weight}" fill="${theme.ink}" data-role="primary-label">${title}</text>${emphasis === "primary" && !isRoot ? `<line x1="${number(box.x + box.w * 0.28)}" y1="${number(box.y + box.h * 0.72)}" x2="${number(box.x + box.w * 0.72)}" y2="${number(box.y + box.h * 0.72)}" stroke="${style.stroke}" stroke-width="${number(style.width)}" vector-effect="non-scaling-stroke" data-emphasis-mark="true"/>` : ""}</g>`;
}
function parseHex(color) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return null;
  return [0, 2, 4].map((index) => Number.parseInt(match[1].slice(index, index + 2), 16));
}
function luminance(color) {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const values = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
function grayscale(color) {
  const rgb = parseHex(color);
  return !rgb || (rgb[0] === rgb[1] && rgb[1] === rgb[2]);
}
function attributes(tag) {
  const out = {};
  for (const match of tag.matchAll(/([a-zA-Z_:][a-zA-Z0-9_.:-]*)="([^"]*)"/g)) out[match[1]] = match[2];
  return out;
}
export function auditRenderedSvg(svg, threshold, theme) {
  const issues = [];
  const textTags = [...svg.matchAll(/<text\b[^>]*>/g)].map((match) => match[0]);
  const textMetrics = textTags.map(attributes);
  if (textMetrics.some((entry) => entry["font-size"] === undefined)) issues.push(issue("RND004_TYPE", "error", "rendered SVG contains text without an explicit font-size"));
  const fontSizes = textMetrics.map((entry) => Number(entry["font-size"])).filter(Number.isFinite);
  const minFont = fontSizes.length ? Math.min(...fontSizes) : null;
  if (minFont !== null && minFont < threshold.type.primary_floor_px) issues.push(issue("RND004_TYPE", "error", `rendered primary text floor ${minFont}px is below ${threshold.type.primary_floor_px}px`));

  const essentialTags = [...svg.matchAll(/<(?:path|rect|line|circle|polygon)\b[^>]*data-essential="true"[^>]*>/g)].map((match) => match[0]);
  const essentialMetrics = essentialTags.map(attributes);
  const widths = essentialMetrics.map((entry) => Number(entry["stroke-width"])).filter(Number.isFinite);
  const minStroke = widths.length ? Math.min(...widths) : null;
  if (minStroke === null || minStroke < threshold.geometry.essential_stroke_px) issues.push(issue("RND005_STROKE", "error", `rendered essential stroke floor ${String(minStroke)} is below ${threshold.geometry.essential_stroke_px}px`));

  const textContrasts = textMetrics.map((entry) => contrastRatio(entry.fill, theme.paper)).filter(Number.isFinite);
  const markContrasts = essentialMetrics.map((entry) => contrastRatio(entry.stroke, theme.paper)).filter(Number.isFinite);
  const minTextContrast = textContrasts.length ? Math.min(...textContrasts) : null;
  const minMarkContrast = markContrasts.length ? Math.min(...markContrasts) : null;
  if (minTextContrast === null || minTextContrast < threshold.contrast.text_ratio) issues.push(issue("RND006_CONTRAST", "error", `rendered text contrast ${String(minTextContrast)} is below ${threshold.contrast.text_ratio}:1`));
  if (minMarkContrast === null || minMarkContrast < threshold.contrast.essential_mark_ratio) issues.push(issue("RND006_CONTRAST", "error", `rendered essential-mark contrast ${String(minMarkContrast)} is below ${threshold.contrast.essential_mark_ratio}:1`));

  const colors = [...new Set([...svg.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0].toLowerCase()))].sort();
  const grayscaleOk = colors.every(grayscale);
  if (threshold.contrast.grayscale_required && !grayscaleOk) issues.push(issue("RND007_GRAYSCALE", "error", "rendered paper profile contains non-grayscale colors"));

  const scriptCount = (svg.match(/<\s*script\b/gi) ?? []).length;
  const foreignObjectCount = (svg.match(/<\s*foreignObject\b/gi) ?? []).length;
  const externalReferenceCount = [...svg.matchAll(/(?:href|xlink:href)="([^"]+)"/gi)].filter((match) => /^(?:https?:|\/\/)/i.test(match[1])).length;
  if (scriptCount || foreignObjectCount || externalReferenceCount) issues.push(issue("RND008_PURITY", "error", "rendered SVG contains executable, foreign-object, or external-reference content"));

  const customGroups = [...svg.matchAll(/<g\b[^>]*data-primitive-id="custom\.[^"]+"[^>]*>[\s\S]*?<\/g>/g)].map((match) => match[0]);
  for (const group of customGroups) if (!/data-essential="true"/.test(group)) issues.push(issue("RND009_CUSTOM", "error", "custom primitive render proof requires at least one data-essential stroke"));

  const nodeCount = (svg.match(/data-node-id=/g) ?? []).length;
  const connectorCount = (svg.match(/data-relation-id=/g) ?? []).length;
  return {
    status: issues.some((entry) => entry.severity === "error") ? "fail" : issues.length ? "pass-with-warnings" : "pass",
    issues: sortIssues(issues),
    metrics: {
      text_count: textTags.length,
      primary_font_floor_px: minFont,
      essential_stroke_floor_px: minStroke,
      text_contrast_min: minTextContrast === null ? null : Math.round(minTextContrast * 1000) / 1000,
      essential_mark_contrast_min: minMarkContrast === null ? null : Math.round(minMarkContrast * 1000) / 1000,
      grayscale: grayscaleOk,
      colors,
      node_count: nodeCount,
      connector_count: connectorCount,
      script_count: scriptCount,
      foreign_object_count: foreignObjectCount,
      external_reference_count: externalReferenceCount,
      browser_text_extent_certified: false,
      hue_only_encoding: false
    }
  };
}

export function renderPromotedSvg(figurePromotion, visualPromotion, profilePromotion, layoutPromotion, options = {}) {
  const mode = options.mode ?? "gate";
  if (!["draft", "gate"].includes(mode)) throw new TypeError("render mode must be 'draft' or 'gate'");
  const figure = readFigurePromotion(figurePromotion);
  const visual = readVisualPromotion(visualPromotion);
  const profile = readProfilePromotion(profilePromotion);
  const layout = readLayoutPromotion(layoutPromotion);
  if (!figure || !visual || !profile || !layout) {
    return { mode, status: "fail", promotion_eligible: false, render_engine_version: RENDER_ENGINE_VERSION, issues: [issue("RND001_BIND", "error", "rendering requires valid promoted semantic, visual, profile, and layout artifacts")] };
  }
  const aligned = figure.figureHash === visual.figureHash && figure.figureHash === profile.figureHash && figure.figureHash === layout.figureHash &&
    visual.visualHash === profile.visualHash && visual.visualHash === layout.visualHash &&
    visual.primitivePlanHash === profile.primitivePlanHash && visual.primitivePlanHash === layout.primitivePlanHash &&
    profile.profilePlanHash === layout.profilePlanHash && profile.thresholdHash === layout.thresholdHash && profile.profileRegistryHash === layout.profileRegistryHash;
  if (!aligned) return { mode, status: "fail", promotion_eligible: false, render_engine_version: RENDER_ENGINE_VERSION, issues: [issue("RND001_BIND", "error", "promoted render inputs do not share the same authority hashes")] };
  const threshold = thresholdFor(profile.profileId);
  if (!threshold || sha256Canonical(threshold) !== profile.thresholdHash) return { mode, status: "fail", promotion_eligible: false, render_engine_version: RENDER_ENGINE_VERSION, issues: [issue("RND001_BIND", "error", "profile threshold identity cannot be resolved by the renderer", { stage_owner: "profile" })] };
  const theme = themeFor(profile.profileId);
  const bindingByNode = new Map(visual.plan.bindings.map((binding) => [binding.node_id, binding]));
  const stateValues = staticState(figure.figure);
  const emphasis = new Map();
  for (const id of figure.figure.emphasis.primary ?? []) emphasis.set(id, "primary");
  for (const id of figure.figure.emphasis.secondary ?? []) if (!emphasis.has(id)) emphasis.set(id, "secondary");
  for (const id of figure.figure.emphasis.muted ?? []) emphasis.set(id, "muted");
  const rootId = figure.figure.composition.root_id;
  if (!layout.layout.boxes[rootId]) return { mode, status: "fail", promotion_eligible: false, render_engine_version: RENDER_ENGINE_VERSION, issues: [issue("RND003_GEOMETRY", "error", `resolved layout is missing root box ${rootId}`, { object_id: rootId, stage_owner: "layout" })] };
  const order = new Map((figure.figure.composition.order ?? []).map((id, index) => [id, index]));
  const nodes = [...figure.figure.nodes].sort((a, b) => {
    if (a.id === rootId) return -1;
    if (b.id === rootId) return 1;
    const ai = order.get(a.id) ?? Number.MAX_SAFE_INTEGER, bi = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return ai - bi || a.id.localeCompare(b.id);
  });
  const renderIssues = [];
  const root = nodes.find((node) => node.id === rootId);
  const rootBinding = bindingByNode.get(rootId), rootBox = layout.layout.boxes[rootId];
  let rootMarkup = "";
  if (!rootBinding) renderIssues.push(issue("RND002_PRIMITIVE", "error", `root ${rootId} has no promoted primitive binding`, { object_id: rootId, stage_owner: "visual" }));
  else {
    const rendered = renderNode(root, rootBinding, rootBox, threshold, theme, stateValues, emphasis.get(rootId) ?? "secondary");
    if (!rendered) renderIssues.push(issue("RND002_PRIMITIVE", "error", `renderer cannot emit ${rootBinding.primitive_id}`, { object_id: rootId }));
    else rootMarkup = rendered;
  }
  const connectorMarkup = [...figure.figure.relations].sort((a, b) => a.id.localeCompare(b.id)).map((relation) => {
    const routed = layout.layout.connectors[relation.id];
    if (!routed) { renderIssues.push(issue("RND003_GEOMETRY", "error", `resolved layout has no route for ${relation.id}`, { object_id: relation.id, stage_owner: "layout" })); return ""; }
    return renderConnector(relation, routed, threshold, theme);
  }).join("");
  let nodeMarkup = "";
  for (const node of nodes) {
    if (node.id === rootId) continue;
    const binding = bindingByNode.get(node.id), box = layout.layout.boxes[node.id];
    if (!binding) { renderIssues.push(issue("RND002_PRIMITIVE", "error", `${node.id} has no promoted primitive binding`, { object_id: node.id, stage_owner: "visual" })); continue; }
    if (!box) { renderIssues.push(issue("RND003_GEOMETRY", "error", `resolved layout has no box for ${node.id}`, { object_id: node.id, stage_owner: "layout" })); continue; }
    const rendered = renderNode(node, binding, box, threshold, theme, stateValues, emphasis.get(node.id) ?? "secondary");
    if (!rendered) renderIssues.push(issue("RND002_PRIMITIVE", "error", `renderer cannot emit ${binding.primitive_id}`, { object_id: node.id }));
    else nodeMarkup += rendered;
  }
  const viewport = layout.layout.target.viewport;
  const titleId = "figthread-title", descId = "figthread-desc";
  const thesis = figure.figure.claims.find((claim) => claim.id === figure.figure.thesis_claim_id)?.statement ?? figure.figure.id;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${number(viewport.width)}" height="${number(viewport.height)}" viewBox="0 0 ${number(viewport.width)} ${number(viewport.height)}" role="img" aria-labelledby="${titleId} ${descId}" data-figthread-root="true" data-profile="${escapeXml(profile.profileId)}" data-target-id="${escapeXml(layout.targetId)}"><title id="${titleId}">${escapeXml(root?.label ?? figure.figure.id)}</title><desc id="${descId}">${escapeXml(thesis)}</desc><rect x="0" y="0" width="${number(viewport.width)}" height="${number(viewport.height)}" fill="${theme.paper}" data-background="true"/>${rootMarkup}<g data-layer="connectors">${connectorMarkup}</g><g data-layer="nodes">${nodeMarkup}</g></svg>`;
  const audit = auditRenderedSvg(svg, threshold, theme);
  renderIssues.push(...audit.issues);
  if (!audit.metrics.browser_text_extent_certified) renderIssues.push(issue("RND010_EVIDENCE", "note", "SVG font-size is audited exactly, but browser-resolved glyph extents and font fallback are not certified in this renderer"));
  const sorted = sortIssues(renderIssues);
  const hasErrors = sorted.some((entry) => entry.severity === "error");
  const svgHash = sha256Text(svg);
  const evidence = {
    schema_version: "figthread.render-evidence/0.1",
    profile_id: profile.profileId,
    threshold_hash: profile.thresholdHash,
    target_id: layout.targetId,
    static_snapshot_id: figure.figure.static_snapshot_id,
    expected: {
      primary_font_floor_px: threshold.type.primary_floor_px,
      essential_stroke_floor_px: threshold.geometry.essential_stroke_px,
      text_contrast_ratio: threshold.contrast.text_ratio,
      essential_mark_contrast_ratio: threshold.contrast.essential_mark_ratio,
      grayscale_required: threshold.contrast.grayscale_required
    },
    observed: audit.metrics,
    evidence_hash: null
  };
  const { evidence_hash: _unused, ...evidenceBase } = evidence;
  evidence.evidence_hash = sha256Canonical(evidenceBase);
  const base = {
    schema_version: RENDERED_SVG_SCHEMA_VERSION,
    figure_hash: figure.figureHash,
    visual_hash: visual.visualHash,
    primitive_registry_hash: visual.primitiveRegistryHash,
    primitive_plan_hash: visual.primitivePlanHash,
    profile_registry_hash: profile.profileRegistryHash,
    profile_threshold_hash: profile.thresholdHash,
    profile_plan_hash: profile.profilePlanHash,
    layout_hash: layout.layoutHash,
    profile_id: profile.profileId,
    target_id: layout.targetId,
    static_snapshot_id: figure.figure.static_snapshot_id,
    engine_version: RENDER_ENGINE_VERSION,
    svg_hash: svgHash,
    svg,
    evidence
  };
  const rendered = deepFreeze({ ...base, render_hash: sha256Canonical(base) });
  return {
    mode,
    status: hasErrors ? "fail" : sorted.some((entry) => entry.severity === "warning") ? "pass-with-warnings" : "pass",
    promotion_eligible: mode === "gate" && !hasErrors,
    render_engine_version: RENDER_ENGINE_VERSION,
    issues: sorted,
    rendered_svg: rendered,
    svg_hash: svgHash,
    render_hash: rendered.render_hash,
    evidence
  };
}

export function promoteRenderedSvg(figurePromotion, visualPromotion, profilePromotion, layoutPromotion) {
  const result = renderPromotedSvg(figurePromotion, visualPromotion, profilePromotion, layoutPromotion, { mode: "gate" });
  if (!result.promotion_eligible) return { promoted: false, report: result };
  const rendered = result.rendered_svg;
  const receiptBase = {
    kind: "rendered_svg",
    schema_version: RENDERED_SVG_SCHEMA_VERSION,
    figure_hash: rendered.figure_hash,
    visual_hash: rendered.visual_hash,
    primitive_plan_hash: rendered.primitive_plan_hash,
    profile_plan_hash: rendered.profile_plan_hash,
    layout_hash: rendered.layout_hash,
    svg_hash: rendered.svg_hash,
    render_hash: rendered.render_hash,
    evidence_hash: rendered.evidence.evidence_hash,
    target_id: rendered.target_id,
    engine_version: RENDER_ENGINE_VERSION
  };
  return { promoted: true, report: result, rendered_svg: rendered, promotion_receipt: deepFreeze({ ...receiptBase, promotion_hash: sha256Canonical(receiptBase) }) };
}
