import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sha256Canonical } from "./canonicalize.js";

export const BROWSER_TEXT_ENGINE_VERSION = "0.1.0";
export const BROWSER_TEXT_PLAN_SCHEMA_VERSION = "figthread.browser-text-plan/0.1";
export const BROWSER_TEXT_OBSERVATION_SCHEMA_VERSION = "figthread.browser-text-observation/0.1";
export const BROWSER_TEXT_EVIDENCE_SCHEMA_VERSION = "figthread.browser-text-evidence/0.1";

const registryUrl = new URL("../profiles/registry.json", import.meta.url);
const PROFILE_REGISTRY = JSON.parse(readFileSync(fileURLToPath(registryUrl), "utf8"));
const severityOrder = { error: 0, warning: 1, note: 2 };
const issue = (code, severity, message, extra = {}) => ({ code, severity, stage_owner: "browser-text", message, ...extra });
const sortIssues = (issues) => issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.code.localeCompare(b.code) || (a.text_id ?? "").localeCompare(b.text_id ?? "") || a.message.localeCompare(b.message));
function deepFreeze(value, seen = new Set()) { if (value === null || typeof value !== "object" || seen.has(value)) return value; seen.add(value); for (const child of Object.values(value)) deepFreeze(child, seen); return Object.freeze(value); }
function sha256Text(text) { return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`; }
function hashBase(object, field) { const copy = structuredClone(object); delete copy[field]; return sha256Canonical(copy); }
function finiteBox(box) { return box && [box.x, box.y, box.w, box.h].every(Number.isFinite) && box.w >= 0 && box.h >= 0; }
function receiptValid(promotion) { if (!promotion?.promoted || !promotion.promotion_receipt) return false; const { promotion_hash, ...base } = promotion.promotion_receipt; return sha256Canonical(base) === promotion_hash; }
function readDocumentPromotion(promotion) {
  if (!receiptValid(promotion) || !promotion.figthread_document) return null;
  const receipt = promotion.promotion_receipt, doc = promotion.figthread_document;
  if (receipt.kind !== "figthread_document" || sha256Text(doc.html) !== receipt.html_hash || doc.html_hash !== receipt.html_hash) return null;
  if (doc.manifest?.document_id !== receipt.document_id || doc.manifest?.build_hash !== receipt.build_hash || doc.manifest?.canonical?.canonical_hash !== receipt.canonical_hash || doc.manifest?.compile_key !== receipt.compile_key) return null;
  return { receipt, doc };
}
function readRenderPromotion(promotion) {
  if (!receiptValid(promotion) || !promotion.rendered_svg) return null;
  const receipt = promotion.promotion_receipt, rendered = promotion.rendered_svg;
  if (receipt.kind !== "rendered_svg" || rendered.svg_hash !== receipt.svg_hash || rendered.render_hash !== receipt.render_hash || rendered.evidence?.evidence_hash !== receipt.evidence_hash) return null;
  return { receipt, rendered };
}
function profileDefinition(document) {
  const id = document.doc.manifest.runtime.profile;
  const definition = PROFILE_REGISTRY.definitions.find((entry) => entry.id === id) ?? null;
  if (!definition) return null;
  const thresholdHash = sha256Canonical(definition);
  if (thresholdHash !== document.doc.manifest.compiled.authorities.profile_threshold_hash) return null;
  return { definition, thresholdHash };
}
function expectedTextEntries(document) {
  const figure = document.doc.manifest.canonical.figure;
  const boxes = document.doc.manifest.compiled.resolved_layout.boxes;
  return figure.nodes.map((node) => ({
    text_id: `text:${node.id}:primary-label`,
    owner_id: node.id,
    role: "primary-label",
    text: node.label,
    owner_box: boxes[node.id] ? { x: boxes[node.id].x, y: boxes[node.id].y, w: boxes[node.id].w, h: boxes[node.id].h } : null
  })).sort((a, b) => a.text_id.localeCompare(b.text_id));
}

export function compileBrowserTextPlan(documentPromotion, renderPromotion, options = {}) {
  const mode = options.mode ?? "gate";
  if (!["draft", "gate"].includes(mode)) throw new TypeError("browser text mode must be 'draft' or 'gate'");
  const document = readDocumentPromotion(documentPromotion), render = readRenderPromotion(renderPromotion), issues = [];
  if (!document || !render) return { mode, status: "fail", promotion_eligible: false, browser_text_engine_version: BROWSER_TEXT_ENGINE_VERSION, issues: [issue("TXT001_BIND", "error", "browser text planning requires valid promoted document and rendered SVG authorities")] };
  const authorities = document.doc.manifest.compiled.authorities;
  if (authorities.svg_hash !== render.receipt.svg_hash || authorities.render_hash !== render.receipt.render_hash) issues.push(issue("TXT001_BIND", "error", "document and rendered SVG authorities do not match"));
  if (document.receipt.target_id !== render.receipt.target_id) issues.push(issue("TXT001_BIND", "error", "document and rendered SVG targets do not match"));
  const profile = profileDefinition(document);
  if (!profile) issues.push(issue("TXT001_BIND", "error", "document profile threshold identity does not match the installed registry"));
  const text = expectedTextEntries(document);
  for (const entry of text) if (!finiteBox(entry.owner_box)) issues.push(issue("TXT001_BIND", "error", `resolved layout is missing a valid owner box for ${entry.owner_id}`, { text_id: entry.text_id, object_id: entry.owner_id }));
  const viewport = document.doc.manifest.compiled.resolved_layout.target.viewport;
  if (!Number.isFinite(viewport?.width) || !Number.isFinite(viewport?.height) || viewport.width <= 0 || viewport.height <= 0) issues.push(issue("TXT001_BIND", "error", "document target viewport is invalid"));
  const base = profile ? {
    schema_version: BROWSER_TEXT_PLAN_SCHEMA_VERSION,
    document_id: document.receipt.document_id,
    canonical_hash: document.receipt.canonical_hash,
    compile_key: document.receipt.compile_key,
    build_hash: document.receipt.build_hash,
    html_hash: document.receipt.html_hash,
    svg_hash: render.receipt.svg_hash,
    render_hash: render.receipt.render_hash,
    layout_hash: render.receipt.layout_hash,
    profile_id: document.doc.manifest.runtime.profile,
    profile_threshold_hash: profile.thresholdHash,
    target_id: document.receipt.target_id,
    viewport: { width: viewport.width, height: viewport.height },
    primary_font_floor_px: profile.definition.type.primary_floor_px,
    overflow_tolerance_px: 0.5,
    text
  } : null;
  const plan = base ? deepFreeze({ ...base, plan_hash: sha256Canonical(base) }) : null;
  const sorted = sortIssues(issues), hasErrors = sorted.some((entry) => entry.severity === "error");
  return { mode, status: hasErrors ? "fail" : "pass", promotion_eligible: mode === "gate" && !hasErrors, browser_text_engine_version: BROWSER_TEXT_ENGINE_VERSION, plan_hash: plan?.plan_hash ?? null, browser_text_plan: plan, issues: sorted };
}

function boxWithin(inner, outer, tolerance) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.w <= outer.x + outer.w + tolerance && inner.y + inner.h <= outer.y + outer.h + tolerance;
}
function intersectionArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return Math.max(0, w) * Math.max(0, h);
}
function observationHashValid(observation) { return observation?.observation_hash && hashBase(observation, "observation_hash") === observation.observation_hash; }
function validateObservation(plan, observation) {
  const issues = [];
  if (!observation || observation.schema_version !== BROWSER_TEXT_OBSERVATION_SCHEMA_VERSION || !observationHashValid(observation)) return [issue("TXT010_EVIDENCE", "error", "browser text observation is missing, incompatible, or has an invalid content hash")];
  for (const [field, expected] of [["document_id", plan.document_id], ["build_hash", plan.build_hash], ["html_hash", plan.html_hash], ["svg_hash", plan.svg_hash], ["target_id", plan.target_id]]) if (observation[field] !== expected) issues.push(issue("TXT001_BIND", "error", `browser observation ${field} does not match the promoted source`, { path: `$.${field}` }));
  if (observation.viewport?.width !== plan.viewport.width || observation.viewport?.height !== plan.viewport.height) issues.push(issue("TXT001_BIND", "error", "browser observation viewport does not match the promoted target"));
  const expected = new Map(plan.text.map((entry) => [entry.text_id, entry])), seen = new Set();
  const measurements = Array.isArray(observation.measurements) ? observation.measurements : [];
  for (const measurement of measurements) {
    const target = expected.get(measurement.text_id);
    if (!target) { issues.push(issue("TXT008_COVERAGE", "error", `browser returned an unexpected text measurement ${String(measurement.text_id)}`, { text_id: measurement.text_id })); continue; }
    if (seen.has(measurement.text_id)) { issues.push(issue("TXT008_COVERAGE", "error", "browser returned a duplicate text measurement", { text_id: measurement.text_id })); continue; }
    seen.add(measurement.text_id);
    if (measurement.owner_id !== target.owner_id || measurement.role !== target.role) issues.push(issue("TXT001_BIND", "error", "browser text ownership does not match the plan", { text_id: measurement.text_id }));
    if (measurement.text !== target.text) issues.push(issue("TXT009_SOURCE", "error", `browser text '${measurement.text}' does not match semantic label '${target.text}'`, { text_id: measurement.text_id }));
    if (!Number.isFinite(measurement.font_size_px) || measurement.font_size_px + 1e-9 < plan.primary_font_floor_px) issues.push(issue("TXT002_FONT", "error", `browser-resolved font size ${String(measurement.font_size_px)}px is below the ${plan.primary_font_floor_px}px floor`, { text_id: measurement.text_id }));
    if (measurement.fonts_status !== "loaded" || measurement.requested_font_available !== true) issues.push(issue("TXT002_FONT", "error", "browser font loading/availability check did not pass", { text_id: measurement.text_id }));
    const platformFonts = Array.isArray(measurement.platform_fonts) ? measurement.platform_fonts : [];
    if (!platformFonts.length || platformFonts.reduce((sum, font) => sum + (Number.isFinite(font.glyph_count) ? font.glyph_count : 0), 0) <= 0) issues.push(issue("TXT002_FONT", "error", "Chrome reported no platform font glyphs for this text node", { text_id: measurement.text_id }));
    if (!finiteBox(measurement.bbox) || measurement.bbox.w <= 0 || measurement.bbox.h <= 0) issues.push(issue("TXT003_GLYPH", "error", "browser glyph bounding box is missing or empty", { text_id: measurement.text_id }));
    else {
      if (!boxWithin(measurement.bbox, target.owner_box, plan.overflow_tolerance_px)) issues.push(issue("TXT004_OVERFLOW", "error", "browser glyph bounds overflow the promoted owner box", { text_id: measurement.text_id, object_id: target.owner_id }));
      const viewport = { x: 0, y: 0, w: plan.viewport.width, h: plan.viewport.height };
      if (!boxWithin(measurement.bbox, viewport, plan.overflow_tolerance_px)) issues.push(issue("TXT005_VIEWPORT", "error", "browser glyph bounds leave the promoted viewport", { text_id: measurement.text_id }));
    }
    if (measurement.display === "none" || measurement.visibility === "hidden" || !Number.isFinite(measurement.opacity) || measurement.opacity <= 0) issues.push(issue("TXT003_GLYPH", "error", "browser text is not visibly rendered", { text_id: measurement.text_id }));
  }
  for (const entry of plan.text) if (!seen.has(entry.text_id)) issues.push(issue("TXT008_COVERAGE", "error", "browser did not return a measurement for promoted text", { text_id: entry.text_id }));
  const validMeasurements = measurements.filter((m) => expected.has(m.text_id) && finiteBox(m.bbox));
  for (let i = 0; i < validMeasurements.length; i += 1) for (let j = i + 1; j < validMeasurements.length; j += 1) {
    const a = validMeasurements[i], b = validMeasurements[j];
    if (a.owner_id !== b.owner_id && intersectionArea(a.bbox, b.bbox) > plan.overflow_tolerance_px * plan.overflow_tolerance_px) issues.push(issue("TXT006_OVERLAP", "error", `browser glyph bounds overlap ${b.text_id}`, { text_id: a.text_id, other_text_id: b.text_id }));
  }
  const env = observation.environment;
  if (!env || typeof env.browser_product !== "string" || !env.browser_product || typeof env.user_agent !== "string" || !env.user_agent || typeof env.platform !== "string" || !env.platform || !Number.isFinite(env.device_pixel_ratio) || env.device_pixel_ratio <= 0) issues.push(issue("TXT007_ENVIRONMENT", "error", "browser environment fingerprint is incomplete"));
  return sortIssues(issues);
}

export function compileBrowserTextEvidence(documentPromotion, renderPromotion, observation, options = {}) {
  const mode = options.mode ?? "gate", planned = compileBrowserTextPlan(documentPromotion, renderPromotion, { mode });
  if (!planned.browser_text_plan || planned.issues.some((entry) => entry.severity === "error")) return { ...planned, observation_hash: observation?.observation_hash ?? null };
  const issues = validateObservation(planned.browser_text_plan, observation), hasErrors = issues.some((entry) => entry.severity === "error");
  const environmentHash = observation?.environment ? sha256Canonical(observation.environment) : null;
  const platformFontFamilies = [...new Set((observation?.measurements ?? []).flatMap((m) => (m.platform_fonts ?? []).map((f) => f.family_name)).filter(Boolean))].sort();
  const fontSizes = (observation?.measurements ?? []).map((m) => m.font_size_px).filter(Number.isFinite);
  const evidenceBase = {
    schema_version: BROWSER_TEXT_EVIDENCE_SCHEMA_VERSION,
    document_id: planned.browser_text_plan.document_id,
    plan_hash: planned.browser_text_plan.plan_hash,
    observation_hash: observation?.observation_hash ?? null,
    environment_hash: environmentHash,
    build_hash: planned.browser_text_plan.build_hash,
    html_hash: planned.browser_text_plan.html_hash,
    svg_hash: planned.browser_text_plan.svg_hash,
    render_hash: planned.browser_text_plan.render_hash,
    layout_hash: planned.browser_text_plan.layout_hash,
    profile_threshold_hash: planned.browser_text_plan.profile_threshold_hash,
    target_id: planned.browser_text_plan.target_id,
    metrics: {
      text_count: observation?.measurements?.length ?? 0,
      min_browser_font_size_px: fontSizes.length ? Math.min(...fontSizes) : null,
      platform_font_families: platformFontFamilies,
      browser_text_extent_certified: !hasErrors,
      platform_font_identity_certified: !hasErrors && platformFontFamilies.length > 0,
      overflow_count: issues.filter((entry) => entry.code === "TXT004_OVERFLOW" || entry.code === "TXT005_VIEWPORT").length,
      overlap_count: issues.filter((entry) => entry.code === "TXT006_OVERLAP").length
    }
  };
  const evidence = deepFreeze({ ...evidenceBase, evidence_hash: sha256Canonical(evidenceBase) });
  return { mode, status: hasErrors ? "fail" : "pass", promotion_eligible: mode === "gate" && !hasErrors, browser_text_engine_version: BROWSER_TEXT_ENGINE_VERSION, plan_hash: planned.browser_text_plan.plan_hash, observation_hash: observation?.observation_hash ?? null, browser_text_plan: planned.browser_text_plan, browser_text_evidence: evidence, issues };
}

export function promoteBrowserTextEvidence(documentPromotion, renderPromotion, observation) {
  const result = compileBrowserTextEvidence(documentPromotion, renderPromotion, observation, { mode: "gate" });
  if (!result.promotion_eligible) return { promoted: false, report: result };
  const evidence = result.browser_text_evidence;
  const receiptBase = {
    kind: "browser_text_evidence",
    schema_version: BROWSER_TEXT_EVIDENCE_SCHEMA_VERSION,
    document_id: evidence.document_id,
    plan_hash: evidence.plan_hash,
    observation_hash: evidence.observation_hash,
    environment_hash: evidence.environment_hash,
    build_hash: evidence.build_hash,
    html_hash: evidence.html_hash,
    svg_hash: evidence.svg_hash,
    render_hash: evidence.render_hash,
    layout_hash: evidence.layout_hash,
    profile_threshold_hash: evidence.profile_threshold_hash,
    target_id: evidence.target_id,
    evidence_hash: evidence.evidence_hash,
    engine_version: BROWSER_TEXT_ENGINE_VERSION
  };
  return { promoted: true, report: result, browser_text_plan: result.browser_text_plan, browser_text_evidence: evidence, promotion_receipt: deepFreeze({ ...receiptBase, promotion_hash: sha256Canonical(receiptBase) }) };
}

export function findChromeExecutable(preferred = null) {
  const candidates = [...new Set([preferred, process.env.FIGTHREAD_CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].filter(Boolean))];
  for (const candidate of candidates) { const result = spawnSync(candidate, ["--version"], { stdio: "ignore" }); if (!result.error && result.status === 0) return candidate; }
  return null;
}

class CdpPipe {
  constructor(child) {
    this.child = child; this.nextId = 1; this.pending = new Map(); this.buffer = Buffer.alloc(0);
    const output = child.stdio[4], input = child.stdio[3]; this.input = input;
    output.on("data", (chunk) => this.onData(chunk));
    const fail = (error) => { for (const { reject } of this.pending.values()) reject(error); this.pending.clear(); };
    child.on("error", fail); child.on("exit", (code, signal) => fail(new Error(`Chrome exited before CDP completed (${code ?? "null"}/${signal ?? "none"})`)));
  }
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const index = this.buffer.indexOf(0); if (index < 0) break;
      const frame = this.buffer.subarray(0, index).toString("utf8"); this.buffer = this.buffer.subarray(index + 1); if (!frame) continue;
      let message; try { message = JSON.parse(frame); } catch { continue; }
      if (!message.id || !this.pending.has(message.id)) continue;
      const pending = this.pending.get(message.id); this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`)); else pending.resolve(message.result ?? {});
    }
  }
  send(method, params = {}, sessionId = null) {
    const id = this.nextId++, payload = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, method }); this.input.write(`${JSON.stringify(payload)}\0`, "utf8", (error) => { if (error && this.pending.delete(id)) reject(error); }); });
  }
}

function evalValue(result) {
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "browser evaluation failed");
  return result.result?.value;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function attachPage(cdp, expectedUrl = "about:blank") {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const { targetInfos = [] } = await cdp.send("Target.getTargets");
    const target = targetInfos.find((entry) => entry.type === "page" && entry.url.startsWith(expectedUrl)) ?? targetInfos.find((entry) => entry.type === "page");
    if (target) return (await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId;
    await delay(25);
  }
  throw new Error("Chrome did not expose a page target for browser text evidence");
}
function cssString(value) { return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"'); }

export async function captureBrowserTextObservation(documentPromotion, renderPromotion, options = {}) {
  const document = readDocumentPromotion(documentPromotion), render = readRenderPromotion(renderPromotion);
  if (!document || !render) throw new Error("browser text capture requires matching promoted Figthread document and rendered SVG authorities");
  if (document.doc.manifest.compiled.authorities.svg_hash !== render.receipt.svg_hash || document.doc.manifest.compiled.authorities.render_hash !== render.receipt.render_hash) throw Object.assign(new Error("document and rendered SVG authorities do not match"), { code: "TXT001_BIND" });
  const executable = findChromeExecutable(options.browserExecutable ?? null);
  if (!executable) throw Object.assign(new Error("no supported Chrome/Chromium executable was found; set FIGTHREAD_CHROME or --browser"), { code: "TXT007_ENVIRONMENT" });
  const profileDir = await mkdtemp(join(tmpdir(), "figthread-chrome-")); let child;
  try {
    child = spawn(executable, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profileDir}`, "--remote-debugging-pipe", "about:blank"], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
    child.stderr?.resume();
    const cdp = new CdpPipe(child), sessionId = await attachPage(cdp);
    await Promise.all([cdp.send("Runtime.enable", {}, sessionId), cdp.send("DOM.enable", {}, sessionId), cdp.send("CSS.enable", {}, sessionId)]);
    const harness = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style></head><body>${render.rendered.svg}</body></html>`;
    const encoded = Buffer.from(harness, "utf8").toString("base64");
    const installExpression = `(()=>{const b=atob(${JSON.stringify(encoded)}),u=Uint8Array.from(b,c=>c.charCodeAt(0)),h=new TextDecoder().decode(u);document.open();document.write(h);document.close();return document.querySelectorAll('text[data-role="primary-label"]').length})()`;
    const installedCount = evalValue(await cdp.send("Runtime.evaluate", { expression: installExpression, returnByValue: true }, sessionId));
    if (!Number.isInteger(installedCount) || installedCount <= 0) throw new Error("browser measurement harness contains no promoted primary labels");
    const measureExpression = `(async()=>{await document.fonts.ready;const svg=document.querySelector("svg[data-figthread-root=true]");if(!svg)throw new Error("promoted SVG root missing");const measurements=[...svg.querySelectorAll('text[data-role="primary-label"]')].map(el=>{const owner=el.closest("[data-node-id]")?.getAttribute("data-node-id")||null,role=el.getAttribute("data-role")||"text",b=el.getBBox(),r=el.getBoundingClientRect(),s=getComputedStyle(el),fontSize=Number.parseFloat(s.fontSize);let available=false;try{available=document.fonts.check(s.fontSize+" "+s.fontFamily,el.textContent||"")}catch{}return{text_id:"text:"+owner+":"+role,owner_id:owner,role,text:el.textContent||"",requested_font_family:el.getAttribute("font-family")||"",computed_font_family:s.fontFamily,font_size_px:fontSize,font_weight:s.fontWeight,bbox:{x:b.x,y:b.y,w:b.width,h:b.height},client_rect:{x:r.x,y:r.y,w:r.width,h:r.height},display:s.display,visibility:s.visibility,opacity:Number.parseFloat(s.opacity||"1"),fonts_status:document.fonts.status,requested_font_available:available}});return{schema_version:"${BROWSER_TEXT_OBSERVATION_SCHEMA_VERSION}",document_id:${JSON.stringify(document.receipt.document_id)},build_hash:${JSON.stringify(document.receipt.build_hash)},html_hash:${JSON.stringify(document.receipt.html_hash)},svg_hash:${JSON.stringify(render.receipt.svg_hash)},target_id:${JSON.stringify(document.receipt.target_id)},viewport:${JSON.stringify(document.doc.manifest.compiled.resolved_layout.target.viewport)},user_agent:navigator.userAgent,platform:navigator.platform,language:navigator.language,device_pixel_ratio:window.devicePixelRatio,measurements}})()`;
    const observation = evalValue(await cdp.send("Runtime.evaluate", { expression: measureExpression, awaitPromise: true, returnByValue: true }, sessionId));
    const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
    for (const measurement of observation.measurements) {
      const selector = `[data-node-id="${cssString(measurement.owner_id)}"] > text[data-role="primary-label"]`;
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector }, sessionId);
      if (!nodeId) { measurement.platform_fonts = []; continue; }
      const { fonts = [] } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId }, sessionId);
      measurement.platform_fonts = fonts.map((font) => ({ family_name: font.familyName, glyph_count: font.glyphCount, is_custom_font: Boolean(font.isCustomFont) })).sort((a, b) => a.family_name.localeCompare(b.family_name) || a.glyph_count - b.glyph_count);
    }
    const browser = await cdp.send("Browser.getVersion");
    const environment = { browser_product: browser.product ?? "", browser_revision: browser.revision ?? "", protocol_version: browser.protocolVersion ?? "", js_version: browser.jsVersion ?? "", user_agent: observation.user_agent, platform: observation.platform, language: observation.language, device_pixel_ratio: observation.device_pixel_ratio };
    delete observation.user_agent; delete observation.platform; delete observation.language; delete observation.device_pixel_ratio;
    const base = { ...observation, environment }; return deepFreeze({ ...base, observation_hash: sha256Canonical(base) });
  } catch (error) {
    throw Object.assign(new Error(`${error.message}${error?.code ? ` (${error.code})` : ""}`), { code: error?.code ?? "TXT007_ENVIRONMENT" });
  } finally {
    if (child && !child.killed) { const exited = once(child, "exit").catch(() => []); child.kill("SIGKILL"); await Promise.race([exited, delay(1000)]); }
    await rm(profileDir, { recursive: true, force: true });
  }
}
