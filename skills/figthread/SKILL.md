---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second.

Semantic figure state must be validated and promoted before layout. Deterministic layout must be validated and promoted before any consumer treats geometry as authoritative. Do not bypass an upstream promotion gate.

## Required reading

Before semantic authoring, read:

1. `references/figure-ir.md`
2. `schemas/figure-spec.schema.json`
3. `templates/figure-spec.json`

Before deterministic layout, also read:

1. `references/layout-resolution.md`
2. `schemas/layout-request.schema.json`
3. `templates/layout-request.json`

Read `references/motion-ir.md` only when working with semantic motion contracts. Do not assume motion compilation or rendering capabilities that are not present in the installed runtime.

## Semantic authoring and promotion

1. Understand source provenance, audience, target profile, exclusions, and the primary question.
2. Extract claims and author `FigureSpec 0.1`.
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

## Authority model

- `FigureSpec` owns meaning.
- `LayoutIntent` owns target, regions, constraints, ports, and routing policy.
- `ResolvedLayout` owns actual boxes, anchors, and connector geometry.
- Semantic relations remain in `FigureSpec`; the router chooses anchors and paths only after boxes freeze.
- Browser or CSS auto-layout is never canonical geometry.
- View/runtime state must not silently mutate promoted semantic or layout state.

## Non-negotiables

- `LayoutIntent` must not contain resolved `x/y/path` geometry.
- Same promoted figure + normalized measurements + target + options + engine version must produce the same layout hash.
- Minimum intrinsic dimensions are hard floors. Reduce soft gaps and preferred sizes first; fail rather than shrink below minimum.
- Force-directed and stochastic layout are not allowed fallbacks.
- Draft mode is non-authoritative. Only gate promotion unlocks downstream authority.
- Resolve `<skill-root>` from this installed skill; never substitute the user's project npm scripts.
- If a requested topology or capability is unsupported by the installed runtime, fail explicitly or reopen the appropriate upstream decision. Do not fabricate geometry or claim an unavailable capability.

## Current runtime capabilities

The installed layout runtime supports deterministic left-right and top-down base solving with explicit intrinsic measurements and orthogonal routing. Unsupported topology-specific solving must fail closed rather than fall back to stochastic placement.
