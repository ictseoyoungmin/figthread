# Browser-resolved text evidence

Static SVG rendering proves explicit font sizes, stroke widths, contrast, grayscale policy, and SVG purity from serialized markup. It cannot prove how a real browser shaped glyphs or which platform font actually supplied them. Browser text evidence closes that review gap without giving browser layout authority.

## Authority boundary

The browser is an evidence source only.

- `ResolvedLayout` remains the owner of node boxes and target geometry.
- The promoted rendered SVG remains the owner of serialized visual output.
- The promoted self-contained HTML remains the document identity under review.
- BrowserTextPlan binds the exact document, SVG, render, layout, profile threshold, target viewport, semantic labels, and owner boxes that must be checked.
- BrowserTextObservation records measured browser facts.
- BrowserTextEvidence certifies those facts only after they match promoted authority.

A browser measurement may fail the review, but it may never resize a node, move text, reroute a connector, substitute different copy, or mutate the delivery artifact and then claim the altered result was promoted.

## What is measured

For every primary label in the promoted figure, the browser review records semantic owner and exact rendered text; computed font size, family stack, weight, display, visibility, and opacity; SVG `getBBox()` glyph bounds; browser-space bounds; `document.fonts` status; and Chrome DevTools platform-font records including the actual family names and glyph counts used for the text node.

The review also records browser product/revision, protocol and JavaScript versions, user agent, platform, language, and device-pixel ratio. That environment is content-hashed with the evidence.

## Hard checks

Promotion fails on source/hash mismatch, missing or duplicate labels, browser font sizes below profile floors, unavailable fonts, missing platform-font glyphs, empty glyph bounds, owner-box or viewport overflow, cross-owner label overlap, hidden text, incomplete browser environment identity, or invalid observation/evidence hashes.

Diagnostics use `TXT001` through `TXT010`. Repair typography, copy, primitive measurement, profile, or layout upstream rather than hiding a browser failure downstream.

## Chrome adapter

The bundled adapter uses Chrome or Chromium directly through the DevTools remote-debugging pipe and has no Puppeteer or Playwright dependency. It opens an isolated `about:blank` target, installs an evidence-only measurement harness containing the exact promoted SVG bytes, waits for browser fonts to settle, measures that SVG, asks the DevTools CSS domain which platform fonts supplied glyphs, and then removes the temporary browser profile. The harness cannot become a delivery artifact or geometry authority.

The executable is resolved from `FIGTHREAD_CHROME`, `--browser`, or common Chrome/Chromium names and paths. If no supported browser is available, review fails explicitly instead of substituting estimated metrics.

Run this after document promotion:

```bash
node <skill-root>/scripts/browser-text.mjs \
  <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] \
  --promote --out browser-text-evidence.json
```

A promoted BrowserTextEvidence record should be bound into the execution workspace review-stage receipt as exact evidence.

## Interpretation

`browser_text_extent_certified: true` means the exact promoted SVG passed browser glyph-bound, font-size, visibility, overflow, viewport, overlap, and coverage checks in the recorded environment.

`platform_font_identity_certified: true` means Chrome DevTools returned the platform font families that actually supplied glyphs for every measured label. This identity is environment-specific evidence, not a cross-platform font guarantee.
