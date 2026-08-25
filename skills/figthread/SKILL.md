---
name: figthread
description: >-
  Design and validate publication-ready semantic figures from claims, papers,
  data, or system concepts. Use when the reader must follow a clear visual
  thread; do not use for decorative graphics without an explanatory claim.
---

# Figthread

Figure first, motion second. D-001 establishes semantic authority; D-002 establishes deterministic geometry authority. No downstream renderer or motion work may bypass either promotion gate.

## Required reading

For D-001 read `references/figure-ir.md`, `schemas/figure-spec.schema.json`, and `templates/figure-spec.json`.
Before D-002 also read `references/layout-resolution.md`, `schemas/layout-request.schema.json`, and `templates/layout-request.json`.

## D-001 workflow

1. Understand source provenance, audience, target profile, exclusions, and primary question.
2. Extract claims and author FigureSpec 0.1.
3. Run `node <skill-root>/scripts/validate.mjs <figure-spec.json> --mode gate`.
4. Repair semantic causes until zero errors, then run the same command with `--promote`.
5. Only the promoted `validated_figure` is authoritative downstream.

## D-002 workflow

1. Start from the D-001 promoted FigureSpec; never layout a raw document.
2. Choose one target viewport/profile/safe area.
3. Supply intrinsic min/preferred measurements for every non-root semantic node. This bridge remains explicit until later VisualSpec/primitive/profile slices own measurement.
4. Run `node <skill-root>/scripts/layout.mjs <figure-spec.json> <layout-request.json> --mode gate`.
5. Repair LAY failures at their layout/upstream cause; do not compensate in renderer CSS.
6. Promote with `node <skill-root>/scripts/layout.mjs <figure-spec.json> <layout-request.json> --promote`.
7. Pass only the promoted `ResolvedLayout` to future rendering/motion work.

## Non-negotiables

- FigureSpec owns meaning. LayoutIntent owns constraints/regions/ports. ResolvedLayout owns actual geometry.
- LayoutIntent must not contain resolved x/y/path geometry.
- Same promoted figure + normalized measurements + target + options + engine version => same layout hash.
- Minimum intrinsic dimensions are hard floors. Reduce soft gaps/preferred sizes first; fail rather than shrink below minimum.
- No force-directed or stochastic fallback exists in D-002.
- Connector semantics remain in FigureSpec; router chooses actual anchors/path only after boxes freeze.
- Browser/CSS auto-layout is never canonical geometry.
- Draft mode is non-authoritative. Only gate promotion unlocks the next slice.
- Resolve `<skill-root>` from this installed skill; never substitute the user's project npm scripts.

## Current slice boundary

D-002 supports deterministic left-right and top-down base solving. Radial/topology-specific grammar adapters, VisualSpec, primitive measurement, profile font floors, text reflow, MotionSpec, SVG rendering, and export remain later slices.
