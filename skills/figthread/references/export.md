# Export

Export is a derivative stage. It may package or capture promoted output, but it may not reinterpret semantic state, change grammar, move geometry, reroute connectors, or repair visual defects.

## Authority

- The promoted Figthread document is the canonical HTML source for export.
- The promoted rendered SVG is the vector source for standalone SVG export.
- PNG is a browser capture of the promoted HTML runtime after the runtime has been prepared for the requested semantic frame.
- ExportSpec selects target, format, frame, background, scale, and live-text policy. It does not own semantic or geometry authority.
- ExportPlan records the exact source hashes and capture instructions before bytes are produced.
- ExportArtifact records the content hash, byte length, determinism scope, and browser environment fingerprint when one is required.

## Formats

### HTML

HTML export is the exact promoted self-contained document. Use `frame.kind = "document"`, profile background, scale `1`, and live text. Do not strip the manifest or runtime in order to make a smaller derivative.

### SVG

Standalone SVG export uses the promoted static-summary render. It remains live text and may change only the outer presentation scale and explicit background requested by ExportSpec. The exporter fails if the SVG contains raster images, foreign objects, scripts, external references, or another construct outside the vector-safe subset.

The default SVG request with profile background and scale `1` is byte-identical to the promoted rendered SVG.

### PNG

PNG must be captured from the promoted HTML document rather than reconstructed by a second raster renderer. The capture adapter must use the stable Figthread runtime API and return preparation evidence before the bytes can be promoted.

For a static-summary frame:

1. Load the exact promoted HTML without external network dependencies.
2. Wait for `window.Figthread.getStatus().ready`.
3. Call `window.Figthread.prepareExport()` to enter the semantic static-summary state.
4. Apply only the ExportPlan background override to the SVG background element when requested.
5. Capture the planned `#figthread-stage svg` selector at the planned scale.
6. Return the runtime preparation evidence and browser environment fingerprint with the PNG bytes.

For a time frame:

1. Set runtime mode to `clean`.
2. Call `renderAt(time_ms)`.
3. Read `getStateHash()` and bind that hash to the capture evidence.
4. Apply the requested export-only background override.
5. Capture the same SVG selector.

The exporter verifies PNG structure, chunk CRCs, exact pixel dimensions, target/build/SVG identity, frame identity, and deterministic semantic state hash. If a browser capture adapter is unavailable, return the capture plan and fail promotion instead of silently substituting a different renderer.

## Determinism

HTML and SVG derivatives are exact-byte deterministic for the same promoted source and ExportSpec.

PNG is content-addressed after capture, but the portability guarantee is visual determinism within the same browser/font/environment fingerprint. Do not claim cross-platform binary identity for browser screenshots.

## Recovery

Repair export failures at their owner:

- `EXP001` — malformed request or missing promoted authority
- `EXP002` — source hash or document/render mismatch
- `EXP003` — target/profile mismatch
- `EXP004` — invalid frame policy
- `EXP005` — format policy mismatch
- `EXP006` — unsupported live-text policy
- `EXP007` — non-vector-safe SVG
- `EXP009` — browser capture or PNG evidence failure
- `EXP010` — unsupported export extension or purity failure

Do not edit exported bytes by hand and then present them as promoted output. Reopen the renderer, document, motion, or export request that owns the cause.
