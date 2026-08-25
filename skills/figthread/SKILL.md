---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second.

Semantic figure state must be validated and promoted before layout. Deterministic layout must be validated and promoted before motion or rendering treats geometry as authoritative. Semantic motion must be validated and promoted before a renderer treats animation tracks as authoritative. Do not bypass an upstream promotion gate.

## Required reading

Before semantic authoring, read:

1. `references/figure-ir.md`
2. `schemas/figure-spec.schema.json`
3. `templates/figure-spec.json`

Before deterministic layout, also read:

1. `references/layout-resolution.md`
2. `schemas/layout-request.schema.json`
3. `templates/layout-request.json`

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

## Deterministic layout and promotion

1. Start from a promoted `validated_figure`; never lay out a raw semantic document.
2. Choose one explicit target viewport, profile, and safe area.
3. Supply intrinsic minimum/preferred measurements for every non-root semantic node. These measurements are explicit layout inputs and must not be invented by renderer CSS.
4. Run `node <skill-root>/scripts/layout.mjs <figure-spec.json> <layout-request.json> --mode gate`.
5. Repair `LAY` failures at their layout or upstream semantic cause; do not compensate with downstream CSS patches.
6. Promote with `node <skill-root>/scripts/layout.mjs <figure-spec.json> <layout-request.json> --promote`.
7. Treat only the promoted `ResolvedLayout` as geometry authority.

## Semantic motion and promotion

Use motion only when it explains sequence, transfer, propagation, state change, accumulation, routing, or comparison more clearly than the static figure alone.

1. Start from matching promoted semantic and layout artifacts.
2. Author `MotionSpec` with integer-millisecond beats, semantic state effects, and semantic cues. Do not author coordinates, SVG paths, CSS keyframes, or DOM callbacks.
3. Run `node <skill-root>/scripts/motion.mjs <figure-spec.json> <layout-request.json> <motion-spec.json> --mode gate`.
4. Repair `MOT` failures at their semantic, layout, timing, state-domain, cue, loop, or purity owner.
5. Promote with the same command and `--promote`.
6. Treat only the promoted `MotionProgram` as executable motion authority.
7. Seeking must be event-sourced from initial semantic state. Never derive a seek result from the previous DOM frame.

## Authority model

- `FigureSpec` owns meaning and semantic state domains.
- `LayoutIntent` owns target, regions, constraints, ports, and routing policy.
- `ResolvedLayout` owns actual boxes, anchors, and connector geometry.
- `MotionSpec` owns semantic timing, state effects, and cues, but no resolved geometry.
- `MotionProgram` owns deterministic compiled tracks whose geometry is resolved from `ResolvedLayout`.
- Semantic relations remain in `FigureSpec`; the router chooses anchors and paths only after boxes freeze.
- Browser or CSS auto-layout is never canonical geometry.
- View/runtime state must not silently mutate promoted semantic, layout, or motion state.

## Non-negotiables

- `LayoutIntent` must not contain resolved `x/y/path` geometry.
- `MotionSpec` must not contain resolved geometry or executable callbacks.
- Same promoted figure + normalized measurements + target + options + engine version must produce the same layout hash.
- Same promoted figure + promoted layout + canonical motion input + motion engine version must produce the same motion program hash.
- Minimum intrinsic dimensions are hard floors. Reduce soft gaps and preferred sizes first; fail rather than shrink below minimum.
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

The installed runtime supports semantic validation, deterministic left-right/top-down layout with explicit intrinsic measurements and orthogonal routing, and deterministic semantic motion compilation/evaluation for state effects and `reveal`, `focus`, `transfer`, `trace`, and `morph-state` cues. Unsupported topology-specific layout, visual-primitive measurement, SVG rendering, and export must fail closed rather than use browser-driven or hand-positioned fallbacks.
