# Export

Export is a derivative stage. It may package or capture promoted output, but it may not reinterpret semantic state, change grammar, move geometry, reroute connectors, or repair visual defects.

## Authority

- The promoted Figthread document is the canonical HTML source for export.
- The promoted rendered SVG is the vector source for standalone SVG export.
- PNG is a browser capture of the exact promoted HTML runtime after the runtime has been prepared for the requested semantic frame.
- ExportSpec selects target, format, frame, background, scale, and live-text policy. It does not own semantic or geometry authority.
- ExportPlan records the exact source hashes and capture instructions before bytes are produced.
- ExportArtifact records the content hash, byte length, determinism scope, and browser environment fingerprint when one is required.
- The bundled Chrome/Chromium PNG adapter executes an ExportPlan. It is not a second renderer and cannot synthesize alternate geometry.

## Formats

### HTML

HTML export is the exact promoted self-contained document. Use `frame.kind = "document"`, profile background, scale `1`, and live text. Do not strip the manifest or runtime in order to make a smaller derivative.

### SVG

Standalone SVG export uses the promoted static-summary render. It remains live text and may change only the outer presentation scale and explicit background requested by ExportSpec. The exporter fails if the SVG contains raster images, foreign objects, scripts, external references, or another construct outside the vector-safe subset.

The default SVG request with profile background and scale `1` is byte-identical to the promoted rendered SVG.

### PNG

PNG must be captured from the promoted HTML document rather than reconstructed by a second raster renderer. The installed export CLI wires the bundled Chrome/Chromium adapter automatically. Set `FIGTHREAD_CHROME` or pass `--browser <executable>` when browser discovery needs an explicit path.

The adapter launches an isolated headless browser through the DevTools pipe, injects the exact promoted self-contained HTML into an `about:blank` page, performs no public-network navigation, waits for the document runtime and fonts, prepares the requested semantic state, captures only the planned SVG surface, and returns PNG bytes plus environment evidence.

For a static-summary frame:

1. Load the exact promoted HTML and wait for `window.Figthread.getStatus().ready`.
2. Call `window.Figthread.prepareExport()` so the runtime projects the semantic static-summary state.
3. Bind the returned target, build, SVG, and state hashes to the requested frame.
4. Remove host-page padding/scaling only for the capture projection so one promoted SVG unit maps to one CSS pixel before requested export scale is applied.
5. Apply only the ExportPlan background override to the existing SVG background element when requested.
6. Capture the planned `#figthread-stage svg` surface at scale `1`, `2`, `3`, or `4`.

For a time frame:

1. Set runtime mode to `clean`.
2. Call `renderAt(time_ms)`.
3. Read `getStateHash()` and `getStatus().time_ms` and bind the deterministic event-sourced state to the requested frame.
4. Apply only the requested export background projection.
5. Capture the same promoted SVG surface.

The adapter also records actual Chrome product/version, browser revision/protocol, OS/platform identity, device scale factor, and a content hash over platform fonts that Chrome reports for rendered SVG text. The exporter verifies PNG signature/chunks/CRCs, exact pixel dimensions, target/build/SVG identity, frame identity, deterministic semantic state hash, and the environment fingerprint before promotion.

The low-level export API still accepts an injected `capturePng` function for testing or alternate conforming environments. If no conforming adapter is supplied there, it fails closed with `EXP009_CAPTURE`. Agent-facing CLI workflows should use the bundled adapter rather than fabricate capture evidence.

Example:

```bash
node <skill-root>/scripts/export.mjs \
  <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] \
  <png-export-spec.json> --promote --out figure.png --capture-plan capture-plan.json
```

## Determinism

HTML and SVG derivatives are exact-byte deterministic for the same promoted source and ExportSpec.

PNG is content-addressed after capture, but the portability guarantee is visual determinism within the same browser/font/environment fingerprint. Do not claim cross-platform PNG binary identity. Requested export scale and background are derivative presentation choices; they do not rewrite canonical layout geometry.

## Recovery

Repair export failures at their owner:

- `EXP001` — malformed request or missing promoted authority
- `EXP002` — source hash or document/render mismatch
- `EXP003` — target/profile mismatch
- `EXP004` — invalid frame policy
- `EXP005` — format policy mismatch
- `EXP006` — unsupported live-text policy
- `EXP007` — non-vector-safe SVG
- `EXP009` — browser discovery, runtime preparation, platform-font evidence, screenshot, PNG structure, dimensions, or capture binding failure
- `EXP010` — unsupported export extension or purity failure

Do not edit exported bytes by hand and then present them as promoted output. Reopen the renderer, document, motion, or export request that owns the cause.
