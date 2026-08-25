# LayoutIntent and deterministic layout

Layout consumes only matching promoted semantic and primitive artifacts. Raw semantic input and hand-authored node measurements are not authoritative layout inputs.

## Authority boundary

- `FigureSpec` owns semantic identity, relations, composition order, and reading-axis intent.
- `PrimitivePlan` owns resolved primitive bindings and intrinsic node measurements.
- The layout target supplies one explicit viewport, profile, safe area, and solver options.
- `LayoutIntent` owns target, regions, hard/strong/soft constraints, allowed ports, and routing policy. It contains no resolved `x/y/path` geometry.
- `ResolvedLayout` owns boxes, anchors, connector points/path, diagnostics, and `layout_hash`.
- Renderer code must consume `ResolvedLayout`; it must not invent alternate placement.

Agent-facing layout input never supplies node measurements. The promoted primitive plan is the sole measurement authority for deterministic layout.

## Determinism

The current engine supports `left-right` and `top-down` dominant axes. It deliberately does not use force-directed or stochastic layout. The same promoted figure, promoted primitive plan, target, options, and engine version must produce the same `LayoutIntent` and `ResolvedLayout` hashes.

Visual identity is carried into `LayoutIntent` and `ResolvedLayout` through `visual_hash`, `primitive_registry_hash`, and `primitive_plan_hash`. Changing a primitive binding therefore changes layout identity even when two primitives happen to share the same intrinsic dimensions.

## Solve order

1. verify semantic and primitive promotion receipts and matching figure hashes;
2. validate the target viewport, profile, safe area, and options;
3. derive normalized intrinsic measurements from the promoted primitive plan;
4. compile grammar/composition into `LayoutIntent` regions and constraints;
5. compute recursive intrinsic footprints;
6. place children in stable reading order;
7. reduce soft gap before shrinking preferred size toward declared minimum;
8. refuse a solve if any minimum size cannot fit;
9. freeze boxes and anchors;
10. route relations orthogonally using stable candidate scoring;
11. audit overflow, unrelated box collision, obstacle penetration, and crossing budget;
12. bind visual/registry/plan hashes into the final layout identity and promote only with zero hard errors.

No text or font size is silently reduced by the layout runtime. Primitive `min_w/min_h` values are hard intrinsic floors. Profile-owned text measurement may strengthen those floors later but may not weaken them.

## Routing

Relations keep their semantic `from/to` from `FigureSpec`. The router chooses actual east/west or north/south anchors after box placement. Candidate paths are scored by semantic obstacle hits, crossings against already-routed relations, bends, length, then deterministic candidate order.

## Diagnostics

- `LAY001_UNSAT` — invalid target, invalid promoted input, unsupported axis, primitive-plan mismatch, or hard minimum geometry cannot fit.
- `LAY003_OVERFLOW` — box or connector path leaves the target safe area.
- `LAY004_COLLISION` — unrelated semantic boxes overlap or a route penetrates a semantic obstacle.
- `LAY005_ROUTE_DENSE` — crossing budget exceeded.
- `LAY008_TARGET_MISSING` — target is missing, malformed, or profile-incompatible.

`LAY002`, `LAY006`, and `LAY007` are reserved protocol codes and must not be repurposed by local patches.

## Unsupported operations

The installed runtime does not provide topology-specific radial solving, profile-owned font measurement, final SVG rendering, or export. When a request depends on an unavailable capability, preserve the semantic/visual/layout authority boundary and fail explicitly rather than using a stochastic, browser-driven, or hand-positioned fallback.

## Recovery rule

Repair `LAY` failures at their owning layout, visual, or upstream semantic cause. Do not compensate for an invalid `ResolvedLayout` with renderer CSS, manual SVG offsets, alternate DOM geometry, or ad-hoc replacement measurements.
