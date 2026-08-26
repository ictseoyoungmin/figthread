---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second.

Semantic figure state must be validated and promoted before grammar, visual, profile, layout, render, motion, document, or export work may depend on it. One canonical figure grammar must then be validated and promoted before layout treats reading order, topology, or composition rules as authoritative. Visual binding must be validated and promoted before a profile may strengthen readability and density constraints. A promoted profile plan must exist before layout treats measurements or target spacing as authoritative. Deterministic layout must be validated and promoted before rendering or motion treats geometry as authoritative. Static rendering must consume the promoted semantic summary snapshot and audit the SVG it actually emitted. Semantic motion must satisfy both the selected profile envelope and semantic motion validation before a runtime treats animation tracks as authoritative. The final document may compose those promoted authorities into one self-contained HTML runtime, but DOM or CSS state may never replace them. Export may package or capture only promoted derivatives and may never repair upstream meaning or geometry. Do not bypass an upstream promotion gate.

## Required reading

Before semantic authoring, read:

1. `references/figure-ir.md`
2. `schemas/figure-spec.schema.json`
3. `templates/figure-spec.json`

Before grammar resolution, also read:

1. `references/figure-grammar.md`
2. `grammars/registry.json`

Before visual binding, also read:

1. `references/visual-primitives.md`
2. `schemas/visual-spec.schema.json`
3. `templates/visual-spec.json`
4. `primitives/registry.json`

Before target/profile resolution, also read:

1. `references/profile-thresholds.md`
2. `profiles/registry.json`
3. `schemas/layout-target.schema.json`
4. `templates/layout-target.json`

Before deterministic layout, also read:

1. `references/layout-resolution.md`

Before static SVG rendering, also read:

1. `references/rendering.md`

When motion adds explanatory value, also read:

1. `references/motion-ir.md`
2. `schemas/motion-spec.schema.json`
3. `templates/motion-spec.json`

Before packaging the final HTML document, also read:

1. `references/document-runtime.md`
2. `schemas/document-manifest.schema.json`

Before producing delivery derivatives, also read:

1. `references/export.md`
2. `schemas/export-spec.schema.json`
3. `templates/export-spec.json`

## Semantic authoring and promotion

1. Understand source provenance, audience, target profile, exclusions, and the primary question.
2. Extract claims and author `FigureSpec`.
3. Run `node <skill-root>/scripts/validate.mjs <figure-spec.json> --mode gate`.
4. Repair semantic causes until the gate reports zero errors.
5. Run the same command with `--promote`.
6. Treat only the promoted `validated_figure` as semantic authority downstream.

## Grammar resolution and promotion

1. Start from a promoted `validated_figure`.
2. Choose exactly one root grammar from the installed registry according to the reader's primary question.
3. Bind the grammar's required semantic roles to ordered node IDs in `composition.grammar.role_bindings`.
4. Choose only a registered variant and reading axis. Do not invent a hybrid layout when a split or multi-panel figure is required.
5. Run `node <skill-root>/scripts/grammar.mjs <figure-spec.json> --mode gate`.
6. Repair `GRM` failures at their type, role, cardinality, relation, order, cycle, composition, split, or hybrid cause.
7. Promote with the same command and `--promote`.
8. Treat only the promoted `GrammarPlan` as grammar authority for layout.

## Visual binding and promotion

1. Start from a promoted `validated_figure`.
2. Bind every semantic node to exactly one core or custom primitive in `VisualSpec`.
3. Choose a registered variant, declare salience, and bind semantic states only to channels exposed by that primitive.
4. Use a custom primitive for thesis-bearing or novel explanatory structure that would lose meaning if replaced by a generic archetype.
5. Run `node <skill-root>/scripts/visual.mjs <figure-spec.json> <visual-spec.json> --mode gate`.
6. Repair `PRM` failures at the binding, registry, intrinsic-size, interface, state-channel, salience, custom-definition, or purity owner.
7. Promote with the same command and `--promote`.
8. Treat only the promoted `PrimitivePlan` as primitive-bound visual authority.

## Profile resolution and promotion

1. Start from matching promoted semantic and primitive artifacts.
2. Choose one explicit target viewport, matching profile, safe area, and layout options.
3. Run `node <skill-root>/scripts/profile.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
4. Repair `PRF` failures at the target, density, spacing, or motion-storyboard owner. Do not shrink text or primitive geometry to pass the gate.
5. Promote with the same command and `--promote`.
6. Treat only the promoted `ProfilePlan` as the source of profile-strengthened intrinsic measurements and effective spacing floors.
7. A profile may strengthen primitive minimums and target spacing, but may never weaken a primitive minimum or silently relax a profile threshold.

## Deterministic layout and promotion

1. Start from matching promoted semantic, grammar, primitive, and profile artifacts; never supply hand-authored node measurements to the agent-facing layout workflow.
2. Run `node <skill-root>/scripts/layout.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
3. Repair `LAY` failures at their layout, grammar, profile, visual, or upstream semantic cause; do not compensate with downstream CSS patches.
4. Promote with the same command and `--promote`.
5. Treat only the promoted `ResolvedLayout` as geometry authority.

## Static SVG rendering and promotion

1. Start from matching promoted semantic, grammar, primitive, profile, and layout artifacts.
2. Run `node <skill-root>/scripts/render.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
3. Repair `RND` failures at their semantic-state, primitive, profile-token, or layout owner. Do not hand-edit the generated SVG to make the render pass.
4. Promote with the same command and `--promote`; use `--out <figure.svg>` and `--evidence <evidence.json>` when file output is required.
5. Treat only the promoted `rendered_svg` as the certified static SVG derivative for that exact promoted layout and profile target.
6. The renderer audits explicit emitted font size, essential stroke width, contrast, grayscale policy, node/connector coverage, and SVG purity from the SVG it actually serialized.
7. Browser-resolved glyph extents, font fallback identity, and final browser text bounding boxes are not yet certified. Keep that limitation explicit rather than inventing a pass.

## Semantic motion and promotion

Use motion only when it explains sequence, transfer, propagation, state change, accumulation, routing, or comparison more clearly than the static figure alone.

1. Start from matching promoted semantic, grammar, primitive, profile, and layout artifacts.
2. Author `MotionSpec` with integer-millisecond beats, semantic state effects, and semantic cues. Do not author coordinates, SVG paths, CSS keyframes, or DOM callbacks.
3. Run `node <skill-root>/scripts/motion.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> <motion-spec.json> --mode gate`.
4. Repair `PRF` motion-envelope failures before repairing downstream `MOT` failures.
5. Repair `MOT` failures at their semantic, layout, timing, state-domain, cue, loop, or purity owner.
6. Promote with the same command and `--promote`.
7. Treat only the promoted `MotionProgram` as executable motion authority.
8. Seeking must be event-sourced from initial semantic state. Never derive a seek result from the previous DOM frame.

## Self-contained document and promotion

1. Start only after semantic, grammar, primitive, profile, layout, and static rendering have promoted successfully. Include a promoted `MotionProgram` only when explanatory motion is present.
2. Run `node <skill-root>/scripts/document.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] --mode gate`.
3. Repair `DOC` failures at their canonical input, authority chain, target, render, motion, manifest hash, or runtime-purity owner. Do not patch the generated HTML by hand.
4. Promote with the same command and `--promote`; use `--out <figure.html>` for delivery.
5. Use `--runtime-mode interactive|clean|static` only to choose initial view state. Runtime mode is not semantic authority.
6. Treat only the promoted `figthread_document` as the canonical self-contained HTML derivative for the exact embedded authority chain.
7. The embedded bootstrap verifies its build hash, canonical hash, compile key, target viewport, and external-dependency boundary before reporting ready.
8. Runtime seeking is event-sourced. Temporary cue overlays and DOM styles are ephemeral projections and must never be promoted upstream.

## Export derivatives and promotion

1. Start from a promoted `figthread_document` and its matching promoted rendered SVG.
2. Author `ExportSpec` with the exact document ID, target, profile, format, frame, background, scale, and live-text policy.
3. Run `node <skill-root>/scripts/export.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> [motion-spec.json] <export-spec.json> --mode gate`.
4. Repair `EXP` failures at the request, source authority, target, frame, vector eligibility, text policy, capture, or purity owner. Never hand-edit derivative bytes and then claim promotion.
5. Promote HTML or SVG with the same command and `--promote --out <artifact>`. HTML is the exact promoted document. Default standalone SVG is byte-identical to the promoted rendered SVG.
6. PNG promotion requires a conforming browser capture adapter. Without one, preserve the emitted capture plan and fail promotion instead of substituting a second raster renderer.
7. A browser adapter must load the exact promoted HTML, prepare the requested semantic frame through the stable Figthread runtime API, capture the planned SVG selector at the planned scale, and return preparation evidence plus a browser/font/environment fingerprint.
8. Treat only a promoted `ExportArtifact` as a certified delivery derivative.

## Authority model

- `FigureSpec` owns meaning and semantic state domains.
- The grammar registry owns the canonical root grammar set, variants, required roles, topology policy, and split caps.
- `GrammarPlan` owns the promoted root grammar, variant, semantic role bindings, reading order, topology policy, and grammar identity consumed by layout.
- `VisualSpec` owns node-to-primitive binding, primitive variant, salience, props, and state-channel binding.
- `PrimitiveDefinition` owns local intrinsic size, ports, slots, state channels, visual tokens, and custom local SVG when present.
- `PrimitivePlan` owns resolved primitive bindings and primitive intrinsic measurements.
- The profile registry owns readability floors, density budgets, target constraints, and motion envelopes.
- `ProfilePlan` owns the selected threshold identity, density result, profile-strengthened measurements, and effective target spacing.
- `LayoutIntent` owns target, regions, constraints, ports, routing policy, and the promoted grammar identity it compiles from.
- `ResolvedLayout` owns actual boxes, anchors, and connector geometry.
- The static SVG renderer owns deterministic SVG serialization, core primitive drawing implementation, profile-safe visual tokens, and rendered-profile evidence; it may not change promoted geometry or semantics.
- `MotionSpec` owns semantic timing, state effects, and cues, but no resolved geometry.
- `MotionProgram` owns deterministic compiled tracks whose geometry is resolved from `ResolvedLayout`.
- The document manifest binds canonical input hashes to compiled authority hashes and the exact single-target runtime build.
- The browser document runtime owns only ephemeral playback, mode, controls, cue overlays, inspection state, and export-time projection.
- `ExportSpec` selects a derivative from promoted sources. It does not own figure meaning or geometry.
- `ExportPlan` binds the export request to document/render hashes and, for PNG, deterministic browser capture instructions.
- `ExportArtifact` owns derivative byte identity, content hash, byte length, and determinism evidence.
- Semantic relations remain in `FigureSpec`; the router chooses anchors and paths only after boxes freeze.
- Browser or CSS auto-layout is never canonical geometry.
- View/runtime/export projection state must not silently mutate promoted semantic, grammar, visual, profile, layout, render, motion, or document state.

## Non-negotiables

- Every figure has exactly one promoted root grammar before layout promotion.
- Grammar role bindings contain node references only and must satisfy the selected grammar's required cardinalities.
- Layout identity must bind the grammar registry, selected definition, and promoted grammar-plan hashes.
- A grammar topology violation must be repaired semantically; routing cannot hide cycles, disconnected roles, invalid lane ownership, or cross-panel semantics.
- If the explanation substantially requires a second root grammar, reclassify, multi-panel, or split instead of inventing a hybrid geometry.
- Every semantic node has exactly one visual binding before profile/layout promotion.
- Core primitive, grammar, and profile registry identities are hash-verified; do not silently substitute different definitions.
- Thesis-bearing or novel salience requires a custom primitive.
- Custom SVG definitions may not contain scripts, event handlers, foreign objects, or external references.
- Primitive minimum intrinsic dimensions are hard floors.
- Profile text and spacing floors may only strengthen primitive/layout minimums.
- `S3` thesis-bearing nodes consume two semantic density slots.
- A hard profile density violation fails; one soft exceedance up to 20% may warn, but multiple simultaneous soft exceedances fail.
- Presentation targets require at least a 5% safe margin on every side.
- Paper rejects explanatory motion; presentation rejects repeat autoplay by default.
- `LayoutIntent` must not contain resolved `x/y/path` geometry.
- Rendered SVG must use only promoted boxes/routes for global geometry and must not invoke browser/CSS auto-layout.
- Static rendering uses the declared semantic summary snapshot, never an arbitrary motion frame.
- Render evidence is content-hashed and must fail on emitted font/stroke/contrast/grayscale/purity violations that the installed renderer claims to certify.
- Color must not be the sole visual discriminator for emphasis or state.
- `MotionSpec` must not contain resolved geometry or executable callbacks.
- The generated HTML must be self-contained and must not require external scripts, stylesheets, fonts, images, iframes, or network calls.
- Browser bootstrap must fail closed on manifest, schema, hash, compile-key, target, or purity mismatch.
- DOM/CSS/runtime state is ephemeral and may not become semantic or geometry authority.
- `static` document mode uses the declared semantic summary state rather than an arbitrary motion frame.
- HTML export must preserve the exact promoted self-contained document bytes.
- Standalone SVG export must originate from the promoted static SVG and must fail when the vector-safe subset is violated.
- PNG must be captured from the promoted HTML runtime; do not silently replace browser capture with a second renderer.
- PNG capture evidence must bind target, document build, SVG source, requested frame, deterministic state hash, exact pixel dimensions, and environment fingerprint.
- Cross-platform binary identity is not promised for browser PNG screenshots; record the environment fingerprint and content hash instead.
- Same promoted figure + grammar plan + primitive plan + profile plan + engine version must produce the same layout hash.
- Same promoted semantic/grammar/visual/profile/layout authorities + render engine version must produce the same SVG/render hashes.
- Same promoted figure + promoted layout + canonical motion input + motion engine version must produce the same motion program hash.
- Same canonical inputs + promoted compiled authorities + document engine version must produce the same document build and HTML hashes.
- Same promoted document/render authorities + canonical export request + export engine version must produce the same HTML/SVG export plan and exact derivative bytes.
- Force-directed and stochastic layout are not allowed fallbacks.
- Motion evaluation uses integer milliseconds and deterministic event ordering.
- `add` is allowed only for numeric/count/ratio state domains; every resulting value must remain inside the declared domain.
- Concurrent semantic writers to the same state at the same time are invalid.
- Repeat loops must explicitly restore the initial semantic state before the loop boundary.
- Static, print, and reduced-motion behavior uses the declared semantic summary snapshot rather than freezing an arbitrary animation frame.
- Draft mode is non-authoritative. Only gate promotion unlocks downstream authority.
- Resolve `<skill-root>` from this installed skill; never substitute the user's project npm scripts.
- If a requested topology or capability is unsupported by the installed runtime, fail explicitly or reopen the appropriate upstream decision. Do not fabricate geometry or claim an unavailable capability.

## Current runtime capabilities

The installed runtime supports semantic validation, a content-hashed twelve-grammar registry with role/topology/order/split validation, a hash-verified core primitive registry, custom primitive validation, a hash-verified five-profile threshold registry, deterministic profile-owned label/spacing refinement, semantic density gating, presentation safe-margin gating, profile motion-envelope validation, left-right/top-down layout with orthogonal routing, deterministic static SVG rendering for all bundled core primitive families, rendered SVG audits for explicit typography/stroke/contrast/grayscale/purity evidence, deterministic semantic motion compilation/evaluation for state effects and `reveal`, `focus`, `transfer`, `trace`, and `morph-state` cues, deterministic self-contained single-target HTML composition with fail-closed bootstrap and inspection API, exact HTML export, vector-safe static-summary SVG export, and browser-adapter PNG promotion with state/dimension/environment evidence.

Browser-resolved glyph extents and font fallback identity, topology-specific radial solving, and multi-target document packaging are not yet available. The skill-local export CLI does not invent a browser when none is available: PNG promotion requires a conforming capture adapter and otherwise fails closed with a capture plan.
