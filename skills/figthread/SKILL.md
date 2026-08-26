---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second. Meaning, grammar, visual binding, readability constraints, geometry, static rendering, browser text evidence, motion, single-target documents, multi-target packaging, export, and execution evidence have separate authorities. Never let a downstream stage silently repair or replace an upstream authority.

For work that spans multiple stages, may be interrupted, or must survive worker handoff, use the execution workspace as external memory. Conversation history, screenshots, and path existence are not completion proof.

## Required reading

For resumable or multi-stage work, read `references/execution-workspace.md`, `schemas/run-manifest.schema.json`, and `schemas/stage-receipt.schema.json` first.

Before semantic authoring, read `references/figure-ir.md`, `schemas/figure-spec.schema.json`, and `templates/figure-spec.json`.

Before grammar resolution, also read `references/figure-grammar.md` and `grammars/registry.json`.

Before visual binding, also read `references/visual-primitives.md`, `schemas/visual-spec.schema.json`, `templates/visual-spec.json`, and `primitives/registry.json`.

Before profile/target resolution, also read `references/profile-thresholds.md`, `profiles/registry.json`, `schemas/layout-target.schema.json`, and `templates/layout-target.json`.

Before deterministic layout, read `references/layout-resolution.md`. Before static rendering, read `references/rendering.md`.

When motion adds explanatory value, read `references/motion-ir.md`, `schemas/motion-spec.schema.json`, and `templates/motion-spec.json`.

Before single-target HTML packaging, read `references/document-runtime.md` and `schemas/document-manifest.schema.json`.

Before browser-resolved typography review, read `references/browser-text-evidence.md` and `schemas/browser-text-evidence.schema.json`.

Before combining independently promoted targets, read `references/document-package.md` and `schemas/document-package.schema.json`.

Before delivery derivatives, read `references/export.md`, `schemas/export-spec.schema.json`, and `templates/export-spec.json`.

## Resumable execution workflow

Initialize a run from exact source bytes with `node <skill-root>/scripts/workspace.mjs init <runs-root> <source-file>`. At every fresh-worker session or handoff, resume with `node <skill-root>/scripts/workspace.mjs resume <run-dir>`.

The canonical stage frontier is:

`understanding → claims → figure-ir → grammar-visual → layout → motion → document → review → export`

For the active frontier, work only in its active revision directory, inspect the exact artifact when visual evidence matters, save evidence inside the run, and promote only when artifact and evidence are ready:

```bash
node <skill-root>/scripts/workspace.mjs promote <run-dir> <stage> \
  --artifact <artifact-path> \
  --evidence <evidence-path>
```

Bind material upstream identities with repeated `--authority name=sha256:...`. A stage receipt binds exact source provenance, predecessor receipt, artifact bytes, evidence bytes, optional authority hashes, and revision. A final-looking path without the active receipt is not complete.

If review exposes an earlier cause, reopen that cause instead of compensating downstream:

```bash
node <skill-root>/scripts/workspace.mjs reopen <run-dir> <stage> --reason "<cause>"
```

Reopen creates new revision directories for the causal stage and every affected stage that had already started, invalidates the selected active receipt plus all active descendants, and preserves prior promoted bytes. If resume reports `reopen-required`, reopen at the reported stage or an earlier causal stage, never later.

## Core promotion chain

Semantic authoring: extract claims, author `FigureSpec`, gate with `validate.mjs`, repair semantic causes, and treat only `validated_figure` as downstream semantic authority.

Grammar: choose exactly one registered root grammar, bind required roles/variant/axis, gate with `grammar.mjs`, and treat only `GrammarPlan` as grammar authority.

Visual binding: bind every semantic node to one registered core or validated custom primitive, gate with `visual.mjs`, and treat only `PrimitivePlan` as primitive-bound visual authority. Thesis-bearing novel structure that loses meaning as a generic archetype requires a custom primitive.

Profile: choose an explicit target viewport/profile/safe area/options, gate with `profile.mjs`, never shrink below primitive/profile floors, and treat only `ProfilePlan` as strengthened measurement/spacing authority.

Layout: run `layout.mjs` from matching promoted semantic/grammar/visual/profile artifacts. Left-right and top-down layouts are deterministic linear solves; registered radial lifecycle, feedback-loop, network, and hub-spoke layouts use deterministic topology-specific ring/hub solving. Treat only `ResolvedLayout` as actual box, anchor, and connector geometry authority. Never patch renderer CSS to hide a layout failure.

Static rendering: run `render.mjs`, repair `RND` failures at their semantic/primitive/profile/layout owner, and treat only promoted `rendered_svg` as the certified static derivative. Serialized render evidence does not by itself certify browser-shaped glyph extents or platform-font identity.

Motion: use only when sequence, transfer, propagation, state change, accumulation, routing, or comparison becomes clearer. Author semantic beats/effects/cues in `MotionSpec`; do not author resolved coordinates, SVG paths, CSS keyframes, or callbacks. Gate with `motion.mjs` and treat only `MotionProgram` as executable motion authority. Seeking is event-sourced from initial semantic state.

Single-target document: after semantic, grammar, primitive, profile, layout, rendering, and optional motion promotion, run `document.mjs`. Treat runtime mode as ephemeral view state; DOM/CSS state is never semantic or geometry authority.

## Browser text review and promotion

Run browser text review after the matching document and rendered SVG have promoted and before visual review is considered complete:

```bash
node <skill-root>/scripts/browser-text.mjs \
  <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] \
  --mode gate
```

The bundled adapter launches Chrome or Chromium through the DevTools pipe, injects exact promoted SVG bytes into an evidence-only `about:blank` harness, waits for fonts, measures SVG glyph bounds, and asks Chrome which platform fonts supplied glyphs. It performs no public-network navigation and does not use Puppeteer or Playwright.

Repair `TXT` failures at their source-copy, typography, primitive measurement, profile, layout, or environment owner. The evidence layer may reject copy or geometry but may never move, resize, reroute, or rewrite it to manufacture a pass. Promote with `--promote --out <browser-text-evidence.json>`; retain raw observation with `--observation-out` when needed. Browser/platform font identity is environment-specific evidence, not a cross-platform identity promise.

## Multi-target document packaging

Use multi-target packaging only after deciding that one delivery must contain two or more real target authorities. Do not create a "mobile" target by scaling a desktop target.

A package request supplies at least two inline layout targets. The package CLI reruns the complete target-specific chain independently for every entry. The target profile may differ from the base FigureSpec profile; the CLI changes only profile selection before semantic promotion and verifies that all packaged children preserve the same semantic figure content apart from profile.

```bash
node <skill-root>/scripts/package.mjs \
  <figure-spec.json> <visual-spec.json> <package-request.json> [motion-spec.json] \
  --promote --out <figure.package.html>
```

Each target gets its own profile plan, resolved layout, rendered SVG, optional motion promotion, and self-contained document promotion. A target entry may override `motion`; `null` means explicit no-motion for that target. Motion still has to satisfy that target profile.

The resulting `DocumentPackage` binds exact child document hashes and embeds their exact HTML bytes. The package runtime may select among embedded targets but may not recompute geometry, synthesize missing targets, or use CSS geometry scaling. A host viewport smaller than a target scrolls the exact target rather than silently shrinking it.

Use `window.FigthreadPackage.listTargets()` and `activateTarget(id)` only as view selection over already promoted child documents. If one target fails layout, browser text evidence, motion, or document promotion, repair that target upstream before packaging.

## Export derivatives and promotion

Start from the promoted self-contained single-target document and matching rendered SVG. Author `ExportSpec`, gate with `export.mjs`, repair `EXP` failures at request/source/target/frame/vector/text/capture/purity owner, and treat only `ExportArtifact` as a certified derivative. HTML preserves exact promoted document bytes. Standalone SVG originates from promoted static SVG.

PNG promotion through the installed CLI uses the bundled Chrome/Chromium DevTools-pipe adapter automatically. It loads the exact promoted HTML without public-network navigation, prepares the requested static-summary or event-sourced time frame through `window.Figthread`, removes only host-page scaling/padding from the capture projection, applies only the requested export background override, captures the exact promoted SVG surface at the requested integer scale, and binds actual browser/platform-font evidence to the PNG artifact. Set `FIGTHREAD_CHROME` or pass `--browser <executable>` if browser discovery needs an explicit path. The low-level export runtime remains adapter-injected and must fail closed when no conforming adapter is supplied.

```bash
node <skill-root>/scripts/export.mjs \
  <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] \
  <png-export-spec.json> --promote --out figure.png --capture-plan capture-plan.json
```

Multi-target package HTML is a delivery container of independently promoted documents; do not pass it through the single-target export API as though it were one target. Export a selected child target through its own promoted document/render authority, or deliver the promoted package HTML itself.

## Authority model

- `FigureSpec` owns meaning and semantic state domains.
- The grammar registry and `GrammarPlan` own root grammar, roles, topology, variant, order, and split policy.
- `VisualSpec`, primitive definitions, and `PrimitivePlan` own primitive binding, local intrinsic size, interfaces, local SVG, and state channels.
- The profile registry and `ProfilePlan` own readability floors, density budgets, effective measurements, target constraints, and motion envelopes.
- `LayoutIntent` owns layout intent; `ResolvedLayout` alone owns actual boxes, anchors, and connector geometry.
- The renderer owns deterministic SVG serialization and serialized rendered-profile evidence, not semantic or geometry reinterpretation.
- `MotionSpec` owns semantic timing/effects/cues; `MotionProgram` owns deterministic compiled tracks resolved against promoted layout.
- The document manifest binds canonical input hashes to compiled authority hashes and the exact self-contained single-target runtime build.
- `BrowserTextPlan`, browser observation, and `BrowserTextEvidence` bind and certify browser-shaped text facts without owning copy or geometry.
- `DocumentPackage` owns target membership, target order/default selection, exact child document bytes/hashes, and package runtime selection policy. It owns no child geometry.
- `ExportSpec`, `ExportPlan`, and `ExportArtifact` own derivative selection, source binding, and derivative bytes/evidence. The PNG capture adapter executes the plan but owns no semantic or layout authority.
- The run manifest owns the active execution frontier and revision counters. Stage receipts own immutable evidence-bound history; checkpoints own resumable snapshots.
- Browser/runtime/package/export projection state is ephemeral and may not be promoted upstream as semantic or geometry authority.

## Recovery and execution invariants

- The run directory is external memory; fresh workers resume from disk rather than chat history.
- Only one writer may mutate a run. Use lock recovery only after confirming a crash; recovery is audit-recorded.
- Promoted receipts/checkpoints are immutable. Reopen creates new revisions and never reuses started revision directories.
- Changed or missing promoted artifact/evidence bytes invalidate the stage that bound them.
- Reopen invalidates all active descendants of the causal stage.
- A changed intake source or untrustworthy run manifest cannot be hidden by reopen.
- Artifacts remain inside the active revision directory except final export artifacts may be bound under `final/`.
- Paths may never escape the run directory.

## Non-negotiables

- Figure first, motion second.
- Every downstream stage consumes promoted upstream authority only.
- Every figure has exactly one promoted root grammar before layout promotion.
- Every semantic node has exactly one visual binding before profile/layout promotion.
- Primitive minimums and profile floors are hard floors.
- Browser/CSS auto-layout is never canonical geometry.
- Radial layout must preserve the registered semantic hub/ring topology and composition order; it may not switch to stochastic placement when space is tight.
- Static rendering uses the declared semantic summary snapshot, never an arbitrary animation frame.
- Color cannot be the sole discriminator for explanatory meaning.
- Browser text evidence may reject promoted geometry or copy but may never mutate either.
- Motion contains no executable callbacks or canonical resolved geometry; repeat motion explicitly restores initial semantic state.
- Generated HTML is self-contained and performs no external runtime I/O.
- A multi-target package contains exact independently promoted child targets; CSS transform scaling is not a target authoring method.
- Package target switching is view state, not a new layout authority.
- Static, print, reduced-motion, and default SVG export use semantic summary state.
- PNG is captured from exact promoted HTML; capture projection may remove host scaling but may not recalculate or rewrite promoted geometry.
- PNG artifacts bind browser/platform-font environment evidence; cross-platform screenshot binary identity is not claimed.
- Draft mode is non-authoritative. Only gate promotion unlocks downstream authority.
- Resolve `<skill-root>` from this installed skill; do not substitute project npm wrappers for the skill-local protocol.
- If a capability is unsupported, fail explicitly or reopen the appropriate upstream decision. Never fabricate a pass.

## Current runtime capabilities

The installed runtime supports semantic, grammar, primitive, profile, deterministic left-right/top-down layout, topology-specific deterministic radial ring/hub layout, static SVG, browser-resolved glyph-bound and platform-font evidence through a bundled Chrome/Chromium DevTools adapter, semantic motion, self-contained single-target HTML, self-contained multi-target HTML packages built from exact promoted child documents, HTML/SVG single-target export, bundled Chrome/Chromium PNG capture with environment-bound promotion evidence, and resumable evidence-bound execution.

Generic force-directed graphs and automatic multi-ring radial packing remain outside the runtime. Keep those limitations explicit.
