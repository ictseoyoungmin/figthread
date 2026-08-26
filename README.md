# Figthread

Figthread is a semantic figure authoring system whose canonical delivery surfaces are exact self-contained HTML documents and, when needed, one self-contained multi-target package made from independently promoted child documents.

The implementation retains the ten promoted architecture slices closed through 1.0.x:

- **D-001** — FigureSpec structural + semantic gate
- **D-002** — LayoutIntent + deterministic ResolvedLayout gate
- **D-003** — MotionSpec + deterministic MotionProgram gate
- **D-004** — VisualSpec + primitive registry + PrimitivePlan gate
- **D-005** — profile threshold registry + ProfilePlan gate
- **D-006** — deterministic static SVG renderer + rendered-profile evidence gate
- **D-007** — canonical figure grammar registry + GrammarPlan gate
- **D-008** — self-contained FigthreadDocument + fail-closed browser runtime gate
- **D-009** — content-addressed HTML/SVG export + browser-evidenced PNG capture contract
- **D-010** — resumable run directory + immutable StageReceipt/checkpoint/reopen gate

Version **1.0.1** added full fresh-worker benchmark dogfooding and repaired reopen revision reuse. Version **1.1.0** added actual Chrome-resolved glyph bounds and platform-font evidence. Version **1.2.0** added multi-target document packaging without turning CSS scaling or runtime resize into canonical geometry. Version **1.3.0** closed topology-specific deterministic radial layout for the registered radial grammar families. Version **1.4.0** installed the Chrome/Chromium PNG capture adapter and wired it into the export CLI. Version **1.5.0** adds browser-resolved full-SVG visual audit for all rendered text, classified custom geometry, and promoted relation connectors.

Generic force-directed graph layout and automatic multi-ring radial packing remain intentionally unsupported.

## Source of truth

The installable skill under `skills/figthread/` is the runtime source of truth. Root `src/`, `schemas/`, `grammars/`, `profiles/`, `examples/`, `benchmarks/`, and `test/` are repository development mirrors and harnesses.

## Single-target promotion model

```text
source / claims
  -> FigureSpec
  -> GrammarPlan + PrimitivePlan
  -> ProfilePlan
  -> ResolvedLayout
  -> promoted static SVG
  -> browser-resolved full-SVG visual audit
  -> optional MotionProgram
  -> self-contained FigthreadDocument
  -> browser-resolved text evidence
  -> review
  -> export
```

The full-SVG visual audit measures exact browser geometry for rendered semantic labels, all custom-primitive text, classified visible custom geometry, and relation connectors. It certifies declared coverage, containment, visibility, text/mark collision clearance, connector clearance, and platform-font glyph evidence without becoming geometry authority.

The browser text stage remains a document-bound typography check over semantic primary labels. It measures the exact promoted SVG in the document context and certifies glyph bounds, computed typography, font readiness, platform-font attribution, visibility, owner/viewport containment, and cross-owner label overlap. Neither browser evidence layer may repair copy or geometry.

## Deterministic layout

The base solver has three deterministic geometry modes: left-right, top-down, and topology-specific radial. No mode uses force-directed placement, randomness, browser auto-layout, or a hidden solver seed.

Radial support is deliberately tied to grammar semantics rather than offered as a generic graph-layout switch:

- `lifecycle` `cycle` / `ring`: one clockwise ring, starting at 12 o'clock in composition order;
- `mechanism` `feedback-loop`: one clockwise ring preserving the causal cycle order;
- `network` `radial`: the declared `hub` is fixed at the exact safe-area center and the remaining direct children form the ring;
- `architecture` `hub-spoke`: the direct component with highest internal degree is the deterministic hub, with ties broken by composition order then ID.

The radial solver preserves promoted intrinsic minimums and profile spacing floors. It searches a fixed preferred-to-minimum size sequence and a fixed set of ring rotations, computes a legal ring radius against the exact safe area, and rejects any candidate with minimum-gap collision. Unsupported radial grammar/variant combinations fail with `LAY009_RADIAL_TOPOLOGY`; supported topologies that cannot fit at minimum geometry fail with `LAY001_UNSAT`.

Nested children inside a radial hub/ring node use local deterministic top-down packing. Relations are still routed orthogonally from promoted boxes, using deterministic anchor selection and obstacle/crossing/bend/length scoring.

## Full-SVG visual audit

Serialized SVG checks cannot prove browser-resolved internal composition for complex custom primitives. The visual audit closes that gap with a zero-dependency Chrome/Chromium DevTools-pipe adapter over the exact promoted static SVG.

Every custom `<text>` is automatically in audit scope. Visible custom geometry must be classifiable with `data-figthread-audit="container|essential|connector|decorative"`; existing `data-essential="true"` is accepted as `essential`. Unclassified visible geometry fails closed instead of being silently ignored.

The audit checks exact element coverage, browser bounds, owner/viewport containment, custom-text internal padding, visibility, browser font readiness/platform-font glyph attribution, text-to-text collisions, text-to-protected-mark collisions, and connector clearance through text/protected regions. Browser measurement is derivative evidence only and cannot move, resize, reroute, or rewrite the promoted SVG.

```bash
npm run visual:audit:promote -- \
  skills/figthread/examples/minimal.figure.json \
  skills/figthread/examples/minimal.visual.json \
  skills/figthread/examples/minimal.layout-target.json \
  --out visual-audit-evidence.json \
  --observation-out visual-audit-observation.json
```

## Multi-target packaging

One target is never resized to impersonate another. Every target is promoted independently:

```text
same semantic figure content
  ├─ target A profile -> layout A -> render A -> motion A -> document A
  ├─ target B profile -> layout B -> render B -> motion B -> document B
  └─ target C profile -> layout C -> render C -> motion C -> document C
                                      ↓
                              DocumentPackage
```

The package runtime validates that every child is a real promoted document and that all child targets share the same semantic figure content apart from profile selection. Target-specific profile/layout/render/motion/document hashes remain independent.

The package manifest binds semantic-content hash, deterministic target order/default selection, each target's profile and promoted viewport, child canonical/compile/build/HTML/promotion hashes, exact base64 child HTML bytes, runtime policy, and one content hash over the complete package manifest.

The browser surface exposes `window.FigthreadPackage` with `getStatus`, `listTargets`, `activateTarget`, `getActiveTarget`, and `getDiagnostics`. A child target is loaded at its exact promoted width and height into a scrollable frame. The package does **not** use `transform: scale(...)` as layout.

Run the bundled example:

```bash
npm run package:promote -- \
  skills/figthread/examples/minimal.figure.json \
  skills/figthread/examples/minimal.visual.json \
  skills/figthread/examples/minimal.package.json \
  skills/figthread/examples/minimal.motion.json \
  --out figure.package.html
```

## Browser-resolved text evidence

The serialized SVG renderer keeps its own `browser_text_extent_certified` metric false because markup alone cannot prove browser shaping. The browser evidence layer closes that proof gap with a zero-dependency Chrome/Chromium DevTools-pipe adapter.

```bash
npm run text:evidence:promote -- \
  skills/figthread/examples/minimal.figure.json \
  skills/figthread/examples/minimal.visual.json \
  skills/figthread/examples/minimal.layout-target.json \
  skills/figthread/examples/minimal.motion.json \
  --out browser-text-evidence.json \
  --observation-out browser-text-observation.json
```

The evidence is environment-specific. Figthread does not claim that every OS resolves the same platform font or screenshot bytes.

## Installed PNG capture

PNG export uses a bundled zero-dependency Chrome/Chromium DevTools-pipe adapter. It does not reconstruct the figure through another raster renderer.

The adapter loads the exact promoted self-contained HTML into an isolated `about:blank` page, waits for the fail-closed Figthread runtime and fonts, prepares either the semantic static-summary state or an exact event-sourced time frame, removes host-page padding/scaling only from the capture projection, applies the requested export-only background, and captures the exact promoted SVG surface.

It returns actual browser identity, revision/protocol, OS/platform, device scale factor, and a content hash over the platform fonts Chrome reports for SVG text. `promoteExportArtifact` then revalidates PNG structure, CRCs, exact planned pixel dimensions, source authority, frame/state identity, and environment evidence before promotion. PNG binary identity is not claimed across browser/font/platform environments.

```bash
npm run export:promote -- \
  skills/figthread/examples/minimal.figure.json \
  skills/figthread/examples/minimal.visual.json \
  skills/figthread/examples/minimal.layout-target.json \
  skills/figthread/examples/minimal.motion.json \
  skills/figthread/examples/minimal.png-export.json \
  --out figure.png --capture-plan capture-plan.json
```

Set `FIGTHREAD_CHROME` or pass `--browser <executable>` if automatic browser discovery needs an explicit path. The low-level export API continues to accept an injected conforming `capturePng` function for tests or alternate environments.

## Full benchmark dogfood

`benchmarks/e2e-dogfood/` drives the actual runtime through source understanding, claims, semantic promotion, grammar/visual, profile/layout/render, process handoff, motion, document, exact review, causal reopen, descendant regeneration, export, and completion verification.

The benchmark intentionally lets an early wording defect pass core structural gates so exact artifact review must reopen `figure-ir` rather than patch the downstream SVG/HTML. Worker A and Worker B are separate Node processes; Worker B reconstructs authority from run-directory state rather than chat or process memory.

```bash
npm run benchmark:dogfood
```

## Workspace commands

```bash
npm run workspace -- stages
npm run workspace -- init ./runs ./source.pdf
npm run workspace -- resume ./runs/run-...
npm run workspace -- verify ./runs/run-...
npm run workspace -- promote ./runs/run-... understanding --artifact <path> --evidence <path>
npm run workspace -- reopen ./runs/run-... figure-ir --reason "review exposed upstream cause"
npm run workspace -- checkpoint ./runs/run-... --reason "handoff"
npm run workspace -- recover-lock ./runs/run-... --reason "confirmed crashed worker"
```

## Figure pipeline commands

```bash
npm test
npm run benchmark:dogfood
npm run validate:promote -- skills/figthread/examples/minimal.figure.json
npm run grammar:promote -- skills/figthread/examples/minimal.figure.json
npm run visual:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json
npm run profile:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run layout:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json
npm run render:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json --out figure.svg --evidence evidence.json
npm run visual:audit:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json --out visual-audit-evidence.json
npm run motion:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json
npm run document:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json --out figure.html
npm run text:evidence:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json --out browser-text-evidence.json
npm run package:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.package.json skills/figthread/examples/minimal.motion.json --out figure.package.html
npm run export:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json skills/figthread/examples/minimal.export.json --out figure.svg
npm run export:promote -- skills/figthread/examples/minimal.figure.json skills/figthread/examples/minimal.visual.json skills/figthread/examples/minimal.layout-target.json skills/figthread/examples/minimal.motion.json skills/figthread/examples/minimal.png-export.json --out figure.png
```

## Determinism boundary

Semantic, grammar, visual, profile, linear/radial layout, static SVG, motion, single-target document, multi-target package, HTML export, and vector-safe SVG export identities are content-addressed under their declared inputs. Browser visual audit and browser text evidence additionally bind their exact browser/platform environment.

PNG is captured from exact promoted HTML and content-addressed after capture. Its guarantee is same-input/same-browser-font-environment visual determinism, not cross-platform byte identity. A multi-target package is deterministic because it embeds exact promoted child HTML bytes and hashes. Browser target switching is projection state only.
