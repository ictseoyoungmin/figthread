---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second.

Semantic figure state must be validated and promoted before visual binding. Visual binding must be validated and promoted before a profile may strengthen readability and density constraints. A promoted profile plan must exist before layout treats measurements or target spacing as authoritative. Deterministic layout must be validated and promoted before rendering or motion treats geometry as authoritative. Static rendering must consume the promoted semantic summary snapshot and audit the SVG it actually emitted. Semantic motion must satisfy both the selected profile envelope and semantic motion validation before a runtime treats animation tracks as authoritative. Do not bypass an upstream promotion gate.

## Required reading

Before semantic authoring, read:

1. `references/figure-ir.md`
2. `schemas/figure-spec.schema.json`
3. `templates/figure-spec.json`

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

## Semantic authoring and promotion

1. Understand source provenance, audience, target profile, exclusions, and the primary question.
2. Extract claims and author `FigureSpec`.
3. Run `node <skill-root>/scripts/validate.mjs <figure-spec.json> --mode gate`.
4. Repair semantic causes until the gate reports zero errors.
5. Run the same command with `--promote`.
6. Treat only the promoted `validated_figure` as semantic authority downstream.

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

1. Start from matching promoted semantic, primitive, and profile artifacts; never supply hand-authored node measurements to the agent-facing layout workflow.
2. Run `node <skill-root>/scripts/layout.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
3. Repair `LAY` failures at their layout, profile, visual, or upstream semantic cause; do not compensate with downstream CSS patches.
4. Promote with the same command and `--promote`.
5. Treat only the promoted `ResolvedLayout` as geometry authority.

## Static SVG rendering and promotion

1. Start from matching promoted semantic, primitive, profile, and layout artifacts.
2. Run `node <skill-root>/scripts/render.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> --mode gate`.
3. Repair `RND` failures at their semantic-state, primitive, profile-token, or layout owner. Do not hand-edit the generated SVG to make the render pass.
4. Promote with the same command and `--promote`; use `--out <figure.svg>` and `--evidence <evidence.json>` when file output is required.
5. Treat only the promoted `rendered_svg` as the certified static SVG derivative for that exact promoted layout and profile target.
6. The renderer audits explicit emitted font size, essential stroke width, contrast, grayscale policy, node/connector coverage, and SVG purity from the SVG it actually serialized.
7. Browser-resolved glyph extents, font fallback identity, and final browser text bounding boxes are not yet certified. Keep that limitation explicit rather than inventing a pass.

## Semantic motion and promotion

Use motion only when it explains sequence, transfer, propagation, state change, accumulation, routing, or comparison more clearly than the static figure alone.

1. Start from matching promoted semantic, primitive, profile, and layout artifacts.
2. Author `MotionSpec` with integer-millisecond beats, semantic state effects, and semantic cues. Do not author coordinates, SVG paths, CSS keyframes, or DOM callbacks.
3. Run `node <skill-root>/scripts/motion.mjs <figure-spec.json> <visual-spec.json> <layout-target.json> <motion-spec.json> --mode gate`.
4. Repair `PRF` motion-envelope failures before repairing downstream `MOT` failures.
5. Repair `MOT` failures at their semantic, layout, timing, state-domain, cue, loop, or purity owner.
6. Promote with the same command and `--promote`.
7. Treat only the promoted `MotionProgram` as executable motion authority.
8. Seeking must be event-sourced from initial semantic state. Never derive a seek result from the previous DOM frame.

## Authority model

- `FigureSpec` owns meaning and semantic state domains.
- `VisualSpec` owns node-to-primitive binding, primitive variant, salience, props, and state-channel binding.
- `PrimitiveDefinition` owns local intrinsic size, ports, slots, state channels, visual tokens, and custom local SVG when present.
- `PrimitivePlan` owns resolved primitive bindings and primitive intrinsic measurements.
- The profile registry owns readability floors, density budgets, target constraints, and motion envelopes.
- `ProfilePlan` owns the selected threshold identity, density result, profile-strengthened measurements, and effective target spacing.
- `LayoutIntent` owns target, regions, constraints, ports, and routing policy.
- `ResolvedLayout` owns actual boxes, anchors, and connector geometry.
- The static SVG renderer owns deterministic SVG serialization, core primitive drawing implementation, profile-safe visual tokens, and rendered-profile evidence; it may not change promoted geometry or semantics.
- `MotionSpec` owns semantic timing, state effects, and cues, but no resolved geometry.
- `MotionProgram` owns deterministic compiled tracks whose geometry is resolved from `ResolvedLayout`.
- Semantic relations remain in `FigureSpec`; the router chooses anchors and paths only after boxes freeze.
- Browser or CSS auto-layout is never canonical geometry.
- View/runtime state must not silently mutate promoted semantic, visual, profile, layout, render, or motion state.

## Non-negotiables

- Every semantic node has exactly one visual binding before profile/layout promotion.
- Core primitive and profile registry identities are hash-verified; do not silently substitute different definitions.
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
- Same promoted figure + primitive plan + profile plan + engine version must produce the same layout hash.
- Same promoted semantic/visual/profile/layout authorities + render engine version must produce the same SVG/render hashes.
- Same promoted figure + promoted layout + canonical motion input + motion engine version must produce the same motion program hash.
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

The installed runtime supports semantic validation, a hash-verified core primitive registry, custom primitive validation, a hash-verified five-profile threshold registry, deterministic profile-owned label/spacing refinement, semantic density gating, presentation safe-margin gating, profile motion-envelope validation, left-right/top-down layout with orthogonal routing, deterministic static SVG rendering for all bundled core primitive families, rendered SVG audits for explicit typography/stroke/contrast/grayscale/purity evidence, and deterministic semantic motion compilation/evaluation for state effects and `reveal`, `focus`, `transfer`, `trace`, and `morph-state` cues.

Browser-resolved glyph extents and font fallback identity, topology-specific radial solving, animated HTML runtime composition, and final export packaging are not yet available. When one of those checks is required, fail closed or preserve it as explicit audit evidence rather than pretending the current deterministic renderer has proved it.
