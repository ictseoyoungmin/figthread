import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { arch, platform, tmpdir } from "node:os";
import { join } from "node:path";
import { findChromeExecutable } from "./browser-text.js";
import { sha256Canonical } from "./canonicalize.js";

export const PNG_CAPTURE_ADAPTER_VERSION = "0.1.0";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CdpPipe {
  constructor(child) {
    this.child = child;
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = Buffer.alloc(0);
    this.input = child.stdio[3];
    const output = child.stdio[4];
    output.on("data", (chunk) => this.onData(chunk));
    const fail = (error) => {
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
    };
    child.on("error", fail);
    child.on("exit", (code, signal) => fail(new Error(`Chrome exited before PNG capture completed (${code ?? "null"}/${signal ?? "none"})`)));
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const index = this.buffer.indexOf(0);
      if (index < 0) break;
      const frame = this.buffer.subarray(0, index).toString("utf8");
      this.buffer = this.buffer.subarray(index + 1);
      if (!frame) continue;
      let message;
      try { message = JSON.parse(frame); } catch { continue; }
      if (!message.id || !this.pending.has(message.id)) continue;
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
    }
  }

  send(method, params = {}, sessionId = null) {
    const id = this.nextId++;
    const payload = { id, method, params, ...(sessionId ? { sessionId } : {}) };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.input.write(`${JSON.stringify(payload)}\0`, "utf8", (error) => {
        if (error && this.pending.delete(id)) reject(error);
      });
    });
  }
}

function evalValue(result) {
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "browser evaluation failed");
  return result.result?.value;
}

async function evaluate(cdp, sessionId, expression) {
  return evalValue(await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId));
}

async function attachPage(cdp) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const { targetInfos = [] } = await cdp.send("Target.getTargets");
    const target = targetInfos.find((entry) => entry.type === "page" && entry.url.startsWith("about:blank")) ?? targetInfos.find((entry) => entry.type === "page");
    if (target) return (await cdp.send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId;
    await delay(25);
  }
  throw new Error("Chrome did not expose a page target for PNG capture");
}

async function waitForRuntime(cdp, sessionId) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const state = await evaluate(cdp, sessionId, `({status:document.documentElement.dataset.figthreadStatus||"",diagnostics:globalThis.Figthread?.getDiagnostics?.()||[]})`);
    if (state?.status === "ready") return;
    if (state?.status === "error") throw new Error(`promoted HTML runtime failed before capture: ${JSON.stringify(state.diagnostics)}`);
    await delay(25);
  }
  throw new Error("promoted HTML runtime did not become ready before PNG capture");
}

function validateInput(input) {
  if (!input || typeof input.html !== "string" || !input.html) throw new TypeError("PNG capture input requires exact promoted HTML bytes");
  if (!input.document_manifest || typeof input.document_manifest !== "object") throw new TypeError("PNG capture input requires the promoted document manifest");
  const capture = input.capture;
  if (!capture || typeof capture !== "object") throw new TypeError("PNG capture input requires a capture plan");
  if (typeof capture.selector !== "string" || !capture.selector) throw new TypeError("PNG capture plan selector must be non-empty");
  if (!["static-summary", "time"].includes(capture.frame?.kind)) throw new TypeError("PNG capture plan requires static-summary or time frame");
  if (![1, 2, 3, 4].includes(capture.scale)) throw new TypeError("PNG capture scale must be one of 1, 2, 3, or 4");
  for (const key of ["width_px", "height_px"]) if (!Number.isInteger(capture[key]) || capture[key] <= 0) throw new TypeError(`PNG capture ${key} must be a positive integer`);
  const viewport = input.document_manifest.compiled?.resolved_layout?.target?.viewport;
  if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) throw new TypeError("PNG capture document target viewport is invalid");
  if (viewport.width * capture.scale !== capture.width_px || viewport.height * capture.scale !== capture.height_px) throw new TypeError("PNG capture pixel dimensions do not match target viewport and scale");
  return { capture, viewport };
}

function browserIdentity(product, revision) {
  const slash = String(product ?? "").indexOf("/");
  if (slash > 0) return { name: product.slice(0, slash), version: product.slice(slash + 1) || revision || "unknown" };
  return { name: String(product || "Chromium"), version: String(revision || "unknown") };
}

async function platformFontFingerprint(cdp, sessionId) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true }, sessionId);
  const { nodeIds = [] } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "#figthread-stage svg text" }, sessionId);
  const aggregate = new Map();
  for (const nodeId of nodeIds) {
    const { fonts = [] } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId }, sessionId);
    for (const font of fonts) {
      const family = String(font.familyName ?? "");
      if (!family) continue;
      const current = aggregate.get(family) ?? { family_name: family, glyph_count: 0, is_custom_font: false };
      current.glyph_count += Number.isFinite(font.glyphCount) ? font.glyphCount : 0;
      current.is_custom_font ||= Boolean(font.isCustomFont);
      aggregate.set(family, current);
    }
  }
  const fonts = [...aggregate.values()].sort((a, b) => a.family_name.localeCompare(b.family_name));
  if (nodeIds.length > 0 && fonts.reduce((sum, font) => sum + font.glyph_count, 0) <= 0) throw new Error("Chrome reported no platform-font glyphs for PNG capture");
  return { fonts, fingerprint: sha256Canonical(fonts) };
}

async function stopChrome(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(1000)]).catch(() => {});
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), delay(1000)]).catch(() => {});
  }
}

export async function capturePngWithChrome(input, options = {}) {
  const { capture, viewport } = validateInput(input);
  const executable = findChromeExecutable(options.browserExecutable ?? null);
  if (!executable) throw new Error("no supported Chrome/Chromium executable was found; set FIGTHREAD_CHROME or pass browserExecutable");
  const profileDir = await mkdtemp(join(tmpdir(), "figthread-png-chrome-"));
  let child;
  try {
    child = spawn(executable, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileDir}`,
      "--remote-debugging-pipe",
      "about:blank"
    ], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
    child.stderr?.resume();
    const cdp = new CdpPipe(child);
    const sessionId = await attachPage(cdp);
    await Promise.all([
      cdp.send("Page.enable", {}, sessionId),
      cdp.send("Runtime.enable", {}, sessionId),
      cdp.send("DOM.enable", {}, sessionId),
      cdp.send("CSS.enable", {}, sessionId)
    ]);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false }, sessionId);
    const { frameTree } = await cdp.send("Page.getFrameTree", {}, sessionId);
    await cdp.send("Page.setDocumentContent", { frameId: frameTree.frame.id, html: input.html }, sessionId);
    await waitForRuntime(cdp, sessionId);

    const setupExpression = `(async()=>{\n` +
      `const capture=${JSON.stringify(capture)};const targetWidth=${JSON.stringify(viewport.width)};const targetHeight=${JSON.stringify(viewport.height)};\n` +
      `await document.fonts.ready;const api=globalThis.Figthread;if(!api)throw new Error("Figthread runtime API missing");\n` +
      `const manifest=JSON.parse(document.querySelector("#figthread-manifest").textContent);let prepared;\n` +
      `if(capture.frame.kind==="static-summary"){const base=await api.prepareExport();prepared={...base,frame:capture.frame,local_time_ms:0};}` +
      `else{api.setMode(capture.runtime_mode);api.renderAt(capture.frame.time_ms);prepared={target_id:manifest.runtime.target_id,build_hash:manifest.build_hash,svg_hash:manifest.compiled.rendered.svg_hash,frame:capture.frame,state_hash:await api.getStateHash(),local_time_ms:api.getStatus().time_ms};}\n` +
      `document.documentElement.style.background="transparent";document.body.style.background="transparent";document.body.style.display="block";document.body.style.width=targetWidth+"px";document.body.style.minHeight=targetHeight+"px";\n` +
      `const shell=document.querySelector("#figthread-document");if(shell){shell.style.width=targetWidth+"px";shell.style.maxWidth="none";shell.style.padding="0";shell.style.margin="0";}\n` +
      `const svg=document.querySelector(capture.selector);if(!svg)throw new Error("capture selector did not resolve");svg.style.width=targetWidth+"px";svg.style.height=targetHeight+"px";svg.style.maxWidth="none";svg.style.transform="none";\n` +
      `const bg=svg.querySelector('[data-background="true"]');if(capture.background!=="profile"){if(!bg)throw new Error("rendered SVG has no exportable background element");bg.setAttribute("fill",capture.background==="transparent"?"none":capture.background.toLowerCase());}\n` +
      `const rect=svg.getBoundingClientRect();if(Math.abs(rect.width-targetWidth)>.01||Math.abs(rect.height-targetHeight)>.01)throw new Error("browser capture surface does not match promoted viewport");\n` +
      `return {prepared,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},user_agent:navigator.userAgent,platform:navigator.platform,language:navigator.language,device_pixel_ratio:devicePixelRatio};})()`;
    const observed = await evaluate(cdp, sessionId, setupExpression);
    if (!observed?.prepared || !observed?.rect) throw new Error("browser did not return preparation evidence and capture bounds");

    if (capture.omit_background) await cdp.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } }, sessionId);
    const font = await platformFontFingerprint(cdp, sessionId);
    const browser = await cdp.send("Browser.getVersion");
    const identity = browserIdentity(browser.product, browser.revision);
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: observed.rect.x, y: observed.rect.y, width: viewport.width, height: viewport.height, scale: capture.scale }
    }, sessionId);
    if (typeof screenshot.data !== "string" || !screenshot.data) throw new Error("Chrome returned no PNG screenshot payload");
    const environment = {
      browser_name: identity.name,
      browser_version: identity.version,
      os: `${String(observed.platform || platform())} (${platform()}/${arch()})`,
      font_fingerprint: font.fingerprint,
      device_scale_factor: Number(observed.device_pixel_ratio) || 1,
      adapter_version: PNG_CAPTURE_ADAPTER_VERSION,
      browser_revision: String(browser.revision ?? ""),
      protocol_version: String(browser.protocolVersion ?? ""),
      platform_fonts: font.fonts
    };
    return { data_base64: screenshot.data, prepared: observed.prepared, environment };
  } finally {
    await stopChrome(child);
    await rm(profileDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(() => {});
  }
}

export function createChromePngCaptureAdapter(options = {}) {
  return (input) => capturePngWithChrome(input, options);
}
