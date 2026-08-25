# LayoutIntent and deterministic layout

Layout consumes only matching promoted semantic, primitive, and profile artifacts. Raw semantic input, hand-authored node measurements, and unprofiled target geometry are not authoritative layout inputs.

## Authority boundary

- `FigureSpec` owns semantic identity, relations, composition order, and reading-axis intent.
- `PrimitivePlan` owns resolved primitive bindings and primitive intrinsic node measurements.
- `ProfilePlan` strengthens those measurements with readability floors and owns the effective target spacing policy for one profile/target combination.
- The layout target supplies one explicit viewport, profile, safe area, and solver options before profile refinement.
- `LayoutIntent` owns target, regions, hard/strong/soft constraints, allowed ports, and routing policy. It contains no resolved `x/y/path` geometry.
- `ResolvedLayout` owns boxes, anchors, connector points/path, diagnostics, and `layout_hash`.
- Renderer code must consume `ResolvedLayout`; it must not invent alternate placement.

The layout engine still has an internal measurement bridge, but agent-facing authoring does not supply it. The promoted profile plan is the only valid source for the final intrinsic metrics passed to the solver.

## Determinism

The current engine supports `left-right` and `top-down` dominant axes. It deliberately does not use force-directed or stochastic layout. The same promoted figure, promoted primitive plan, promoted profile plan, target, and engine version must produce the same `LayoutIntent` and `ResolvedLayout` hashes.

Visual and profile identity are carried into `LayoutIntent` and `ResolvedLayout` through their content hashes. Changing a primitive binding or selected profile threshold therefore changes layout identity even when the final numeric box dimensions happen to match.

## Solve order

1. verify semantic, primitive, and profile promotion receipts and matching figure/visual identities;
2. validate the target viewport, profile, safe area, and options during profile compilation;
3. start from primitive intrinsic measurements;
4. strengthen them with deterministic profile-owned text floors;
5. strengthen target spacing to the profile's hard minimum;
6. compile grammar/composition into `LayoutIntent` regions and constraints;
7. compute recursive intrinsic footprints;
8. place children in stable reading order;
9. reduce soft gap before shrinking preferred size toward the strengthened minimum;
10. refuse a solve if any strengthened minimum size cannot fit;
11. freeze boxes and anchors;
12. route relations orthogonally using stable candidate scoring;
13. audit overflow, unrelated box collision, obstacle penetration, and crossing budget;
14. bind visual/profile hashes into final layout identity and promote only with zero hard errors.

No text or font size is silently reduced by the layout runtime. Primitive minimum dimensions and profile-strengthened text floors are both hard lower bounds.

## Routing

Relations keep their semantic `from/to` from `FigureSpec`. The router chooses actual east/west or north/south anchors after box placement. Candidate paths are scored by semantic obstacle hits, crossings against already-routed relations, bends, length, then deterministic candidate order.

## Diagnostics

- `LAY001_UNSAT` — invalid promoted input, unsupported axis, profile-plan mismatch, or hard minimum geometry cannot fit.
- `LAY003_OVERFLOW` — box or connector path leaves the target safe area.
- `LAY004_COLLISION` — unrelated semantic boxes overlap or a route penetrates a semantic obstacle.
- `LAY005_ROUTE_DENSE` — crossing budget exceeded.
- `LAY008_TARGET_MISSING` — target is missing, malformed, or profile-incompatible.

Profile-owned target, spacing, and density failures use `PRF` diagnostics before the layout solver runs.

`LAY002`, `LAY006`, and `LAY007` are reserved protocol codes and must not be repurposed by local patches.

## Unsupported operations

The installed runtime does not provide topology-specific radial solving, exact browser glyph measurement, final SVG rendering, or export. When a request depends on an unavailable capability, preserve the semantic/visual/profile/layout authority boundary and fail explicitly rather than using a stochastic, browser-driven, or hand-positioned fallback.

## Recovery rule

Repair `LAY` failures at their owning layout, profile, visual, or upstream semantic cause. Do not compensate for an invalid `ResolvedLayout` with renderer CSS, manual SVG offsets, alternate DOM geometry, or ad-hoc replacement measurements.
