---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second. Meaning, grammar, visual binding, readability constraints, geometry, static rendering, browser text evidence, motion, document packaging, export, and execution evidence have separate authorities. Never let a downstream stage silently repair or replace an upstream authority.

For work that spans multiple stages, may be interrupted, or must survive worker handoff, use the execution workspace as external memory. Conversation history, screenshots, and path existence are not completion proof.

## Required reading

For resumable or multi-stage work, read first:

1. `references/execution-workspace.md`
2. `schemas/run-manifest.schema.json`
3. `schemas/stage-receipt.schema.json`

Before semantic authoring, read `references/figure-ir.md`, `schemas/figure-spec.schema.json`, and `templates/figure-spec.json`.

Before grammar resolution, also read `references/figure-grammar.md` and `grammars/registry.json`.

Before visual binding, also read `references/visual-primitives.md`, `schemas/visual-spec.schema.json`, `templates/visual-spec.json`, and `primitives/registry.json`.

Before profile/target resolution, also read `references/profile-thresholds.md`, `profiles/registry.json`, `schemas/layout-target.schema.json`, and `templates/layout-target.json`.

Before deterministic layout, read `references/layout-resolution.md`.

Before static rendering, read `references/rendering.md`.

When motion adds explanatory value, read `references/motion-ir.md`, `schemas/motion-spec.schema.json`, and `templates/motion-spec.json`.

Before final HTML packaging, read `references/document-runtime.md` and `schemas/document-manifest.schema.json`.

Before browser-resolved typography review, read `references/browser-text-evidence.md` and `schemas/browser-text-evidence.schema.json`.

Before delivery derivatives, read `references/export.md`, `schemas/export-spec.schema.json`, and `templates/export-spec.json`.

## Resumable execution workflow

Initialize a run from the exact source bytes:

```bash
node <skill-root>/scripts/workspace.mjs init <runs-root> <source-file>
```

At the beginning of every fresh-worker session or handoff, resume from disk:

```bash
node <skill-root>/scripts/workspace.mjs resume <run-dir>
```

The canonical stage frontier is:

`understanding → claims → figure-ir → grammar-visual → layout → motion → document → review → export`

For the reported frontier, work only in its active revision directory, inspect the exact current artifact when visual evidence is relevant, save evidence inside the run directory, and promote only after artifact and evidence are ready:

```bash
node <skill-root>/scripts/workspace.mjs promote <run-dir> <stage> \
  --artifact <artifact-path> \
  --evidence <evidence-path>
```

Repeat `--artifact` and `--evidence` when needed. Bind upstream promoted identities with `--authority name=sha256:...` when they materially define the stage result. A stage receipt binds exact source provenance, predecessor receipt, artifact bytes, evidence bytes, optional authority hashes, and revision. Promotion advances the frontier and writes a checkpoint. A final-looking file without the active receipt is not complete.

If review exposes an earlier cause, reopen that cause instead of compensating downstream:

```bash
node <skill-root>/scripts/workspace.mjs reopen <run-dir> <stage> --reason "<cause>"
```

Reopen creates new revision directories for the causal stage and every affected stage that had already started. It invalidates the selected active receipt plus all active descendants while preserving prior promoted bytes. If `resume` reports `reopen-required`, reopen at the reported earliest invalid stage or an earlier causal stage, never later.

## Semantic authoring and promotion

1. Understand provenance, audience, target profile, exclusions, and the primary question.
2. Extract claims and author `FigureSpec`.
3. Gate with `node <skill-root>/scripts/validate.mjs <figure-spec.json> --mode gate`.
4. Repair semantic causes until zero errors.
5. Promote with the same command and `--promote`.
6. Only `validated_figure` is semantic authority downstream.

## Grammar resolution and promotion

1. Start from promoted semantic authority.
2. Choose exactly one root grammar from the installed registry.
3. Bind required semantic roles, registered variant, and reading axis.
4. Gate with `node <skill-root>/scripts/grammar.mjs <figure-spec.json> --mode gate`.
5. Repair `GRM` failures at type, role, cardinality, relation, order, cycle, composition, split, or hybrid cause.
6. Promote and treat only `GrammarPlan` as grammar authority for layout.

## Visual binding and promotion

1. Bind every semantic node to exactly one registered core or validated custom primitive.
2. Declare variant, salience, props, and only state channels exposed by the primitive.
3. Use a custom primitive for thesis-bearing or novel structure that would lose meaning as a generic archetype.
4. Gate with `node <skill-root>/scripts/visual.mjs <figure-spec.json> <visual-spec.json> --mode gate`.
5. Repair `PRM` failures at binding, registry, intrinsic-size, interface, state-channel, salience, custom-definition, or purity owner.
6. Promote and treat only `PrimitivePlan` as primitive-bound visual authority.

## Profile resolution and promotion

1. Choose one explicit target viewport, matching profile, safe area, and layout options.
2. Gate with `node <skill-root>/scripts/profile.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
3. Repair `PRF` failures at target, density, spacing, or motion-storyboard owner. Never shrink below primitive/profile floors.
4. Promote and treat only `ProfilePlan` as profile-strengthened measurement and spacing authority.

## Deterministic layout and promotion

1. Start from matching promoted semantic, grammar, primitive, and profile artifacts.
2. Run `node <skill-root>/scripts/layout.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
3. Repair `LAY` failures at layout or the upstream authority that caused them. Do not patch renderer CSS.
4. Promote and treat only `ResolvedLayout` as actual box, anchor, and connector geometry authority.

## Static rendering and promotion

1. Run `node <skill-root>/scripts/render.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
2. Repair `RND` failures at semantic state, primitive, profile token, or layout owner.
3. Promote with `--promote`; use `--out <figure.svg>` and `--evidence <evidence.json>` when files are needed.
4. Treat only promoted `rendered_svg` as the certified static derivative for that layout/profile target.
5. Renderer evidence certifies serialized SVG facts such as explicit type size, stroke, contrast, grayscale, coverage, and purity. It does not by itself certify browser-shaped glyph extents or platform-font identity.
6. Do not hand-edit generated SVG and claim promotion.

## Semantic motion and promotion

Use motion only when it clarifies sequence, transfer, propagation, state change, accumulation, routing, or comparison.

1. Author `MotionSpec` with integer-millisecond semantic beats, state effects, and cues. Do not author resolved coordinates, SVG paths, CSS keyframes, or callbacks.
2. Gate with `node <skill-root>/scripts/motion.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> <motion-spec.json> --mode gate`.
3. Repair profile motion-envelope failures before downstream `MOT` failures.
4. Promote and treat only `MotionProgram` as executable motion authority.
5. Seeking is event-sourced from initial semantic state, never from the previous DOM frame.
6. If motion is intentionally absent in a resumable run, promote an explicit no-motion decision artifact and evidence for the motion execution stage rather than skipping it.

## Self-contained document and promotion

1. Start after semantic, grammar, primitive, profile, layout, and static rendering promotion. Include motion authority only when explanatory motion exists.
2. Run `node <skill-root>/scripts/document.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] --mode gate`.
3. Repair `DOC` failures at canonical input, authority chain, target, render, motion, manifest hash, or runtime purity.
4. Promote with `--promote --out <figure.html>` for delivery.
5. Runtime mode is only view state. DOM/CSS state is never semantic or geometry authority.

## Browser text review and promotion

Run browser text review after the matching document and rendered SVG have promoted and before treating visual review as complete.

```bash
node <skill-root>/scripts/browser-text.mjs \
  <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] \
  --mode gate
```

The bundled adapter launches Chrome or Chromium through the DevTools pipe, injects the exact promoted SVG bytes into an isolated evidence-only `about:blank` harness, waits for browser fonts, measures SVG glyph bounds, and asks Chrome which platform fonts actually supplied glyphs. It does not navigate to the public internet and has no Puppeteer or Playwright dependency.

1. Repair `TXT` failures at their source-copy, typography, primitive measurement, profile, layout, or environment cause. Never move or shrink content in the evidence layer.
2. Promote with the same command and `--promote --out <browser-text-evidence.json>`.
3. Use `--observation-out <observation.json>` when the raw environment-bound browser measurement must be retained.
4. Bind the promoted browser text evidence and, when useful, its observation into the execution workspace `review` receipt.
5. `browser_text_extent_certified` means actual browser glyph bounds passed coverage, visibility, owner-box, viewport, overlap, and profile font-size checks for the recorded environment.
6. `platform_font_identity_certified` means Chrome reported the actual platform font families and glyph counts used by every measured label. It is environment-specific evidence, not a promise that every platform chooses the same font.
7. If no supported Chrome/Chromium executable is available, the review fails explicitly. Never replace browser evidence with estimated text metrics and claim a pass.

## Export derivatives and promotion

1. Start from the promoted self-contained document and matching rendered SVG.
2. Author `ExportSpec` with exact document ID, target, profile, format, frame, background, scale, and live-text policy.
3. Gate with `node <skill-root>/scripts/export.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] <export-spec.json> --mode gate`.
4. Repair `EXP` failures at request, source authority, target, frame, vector eligibility, text policy, capture, or purity owner.
5. Promote HTML or SVG with `--promote --out <artifact>`.
6. PNG promotion requires a conforming browser capture adapter. Without one, preserve the capture plan and fail rather than inventing a second raster renderer.
7. Treat only `ExportArtifact` as a certified delivery derivative.

## Authority model

- `FigureSpec` owns meaning and semantic state domains.
- The grammar registry and `GrammarPlan` own root grammar, roles, topology, variant, order, and split policy.
- `VisualSpec`, primitive definitions, and `PrimitivePlan` own primitive binding, local intrinsic size, interfaces, local SVG, and state channels.
- The profile registry and `ProfilePlan` own readability floors, density budgets, effective measurements, target constraints, and motion envelopes.
- `LayoutIntent` owns layout intent; `ResolvedLayout` alone owns actual boxes, anchors, and connector geometry.
- The renderer owns deterministic SVG serialization and serialized rendered-profile evidence, not semantic or geometry reinterpretation.
- `MotionSpec` owns semantic timing/effects/cues; `MotionProgram` owns deterministic compiled tracks resolved against promoted layout.
- The document manifest binds canonical input hashes to compiled authority hashes and the exact self-contained runtime build.
- `BrowserTextPlan` binds the exact promoted document/render/layout/profile/target and semantic text that must be checked.
- `BrowserTextObservation` records browser-measured glyph, computed-style, font-loading, platform-font, and environment facts.
- `BrowserTextEvidence` certifies a valid observation against its plan; it cannot own or modify copy or geometry.
- `ExportSpec` selects a derivative; `ExportPlan` binds that request to promoted sources; `ExportArtifact` owns derivative bytes and evidence.
- The run manifest owns the active execution frontier and revision counters.
- Stage receipts own immutable evidence-bound promotion history. Checkpoints own resumable snapshots of the active receipt set.
- Browser/runtime/export projection state is ephemeral and may not be promoted upstream as semantic or geometry authority.

## Recovery and execution invariants

- The run directory is external memory; fresh workers resume from it rather than relying on chat history.
- Only one writer may mutate a run at a time. Mutating commands use an exclusive writer lock.
- Use `recover-lock` only after confirming a writer crashed; recovery is audit-recorded.
- Promoted receipts and checkpoints are immutable. Reopen creates new revisions; it never patches old history or reuses started revision directories.
- Changed or missing promoted artifact/evidence bytes invalidate the stage that bound them.
- Reopen automatically invalidates all active descendants of the causal stage.
- A changed intake source or untrustworthy run manifest cannot be hidden by reopen; restore provenance or start a new run.
- Artifacts must remain inside the active revision directory, except final export artifacts may be bound under `final/`.
- Paths may never escape the run directory.

## Non-negotiables

- Figure first, motion second.
- Every downstream stage consumes promoted upstream authority only.
- Every figure has exactly one promoted root grammar before layout promotion.
- Every semantic node has exactly one visual binding before profile/layout promotion.
- Thesis-bearing novel structure requires a custom primitive.
- Custom SVG may not contain scripts, event handlers, foreign objects, or external references.
- Primitive minimums and profile floors are hard floors.
- Browser/CSS auto-layout is never canonical geometry.
- `LayoutIntent` contains no resolved global geometry.
- Static rendering uses the declared semantic summary snapshot, never an arbitrary animation frame.
- Color cannot be the sole discriminator for explanatory meaning.
- Browser text evidence may reject promoted geometry or copy but may never mutate either one to manufacture a pass.
- Browser-resolved font identity is bound to the recorded environment; do not generalize it into cross-platform binary or font-selection identity.
- Motion contains no executable callbacks or canonical resolved geometry.
- Repeat motion explicitly restores initial semantic state before loop closure.
- The generated HTML is self-contained and performs no external runtime I/O.
- Static, print, reduced-motion, and default SVG export use the semantic summary state.
- HTML export preserves exact promoted document bytes.
- Standalone SVG export originates from the promoted static SVG and fails outside the vector-safe subset.
- PNG is captured from promoted HTML; cross-platform screenshot binary identity is not claimed.
- Draft mode is non-authoritative. Only gate promotion unlocks downstream authority.
- Resolve `<skill-root>` from this installed skill; never substitute a user's project npm wrappers for the skill-local protocol.
- If a capability is unsupported, fail explicitly or reopen the appropriate upstream decision. Never fabricate a pass.

## Current runtime capabilities

The installed runtime supports semantic, grammar, primitive, profile, deterministic layout, static SVG, browser-resolved glyph-bound and platform-font evidence through a bundled zero-dependency Chrome/Chromium DevTools adapter, semantic motion, self-contained HTML, HTML/SVG export, browser-capture planning for PNG, and resumable evidence-bound execution with source provenance, immutable stage receipts, content-hashed checkpoints, single-writer locking, revisioned reopen, stale-descendant invalidation, exact artifact/evidence verification, and fresh-worker resume.

Topology-specific radial solving, multi-target document packaging, and an installed PNG capture adapter remain outside the runtime. Keep those limitations explicit.
