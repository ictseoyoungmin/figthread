# LayoutIntent and deterministic layout

Layout consumes only a promoted `validated_figure` with a valid promotion receipt. Raw `FigureSpec` input is never authoritative layout input.

## Authority boundary

- `FigureSpec` owns semantic identity, relations, composition order, and reading-axis intent.
- `LayoutRequest` supplies one explicit target and intrinsic node measurements.
- `LayoutIntent` owns target, regions, hard/strong/soft constraints, allowed ports, and routing policy. It contains no resolved `x/y/path` geometry.
- `ResolvedLayout` owns boxes, anchors, connector points/path, diagnostics, and `layout_hash`.
- Renderer code must consume `ResolvedLayout`; it must not invent alternate placement.

Intrinsic measurements are explicit inputs to the current layout runtime. Treat declared minimum/preferred sizes as authoritative for the solve; do not infer replacements from browser or renderer CSS.

## Determinism

The current engine supports `left-right` and `top-down` dominant axes. It deliberately does not use force-directed or stochastic layout. The same promoted figure, normalized intrinsic measurements, target, options, and engine version must produce the same `LayoutIntent` and `ResolvedLayout` hashes.

Intrinsic measurements are normalized by `node_id` before hashing, so measurement array order is not authoritative.

## Solve order

1. verify the semantic promotion receipt and canonical figure hash;
2. validate `LayoutRequest` target, safe area, measurements, and options;
3. compile grammar/composition into `LayoutIntent` regions and constraints;
4. compute recursive intrinsic footprints;
5. place children in stable reading order;
6. reduce soft gap before shrinking preferred size toward declared minimum;
7. refuse a solve if any minimum size cannot fit;
8. freeze boxes and anchors;
9. route relations orthogonally using stable candidate scoring;
10. audit overflow, unrelated box collision, obstacle penetration, and crossing budget;
11. hash and promote only with zero hard errors.

No text or font size is silently reduced by the layout runtime. `min_w/min_h` are hard intrinsic floors supplied by the measurement owner.

## Routing

Relations keep their semantic `from/to` from `FigureSpec`. The router chooses actual east/west or north/south anchors after box placement. Candidate paths are scored by semantic obstacle hits, crossings against already-routed relations, bends, length, then deterministic candidate order.

## Diagnostics

- `LAY001_UNSAT` — invalid request, invalid promoted input, unsupported axis, or hard minimum geometry cannot fit.
- `LAY003_OVERFLOW` — box or connector path leaves the target safe area.
- `LAY004_COLLISION` — unrelated semantic boxes overlap or a route penetrates a semantic obstacle.
- `LAY005_ROUTE_DENSE` — crossing budget exceeded.
- `LAY008_TARGET_MISSING` — target is missing, malformed, or profile-incompatible.

`LAY002`, `LAY006`, and `LAY007` are reserved protocol codes and must not be repurposed by local patches.

## Unsupported operations

The installed runtime does not provide topology-specific radial solving, automatic visual-primitive measurement, profile-owned font measurement, SVG rendering, or export. When a request depends on an unavailable capability, preserve the semantic/layout authority boundary and fail explicitly rather than using a stochastic, browser-driven, or hand-positioned fallback.

## Recovery rule

Repair `LAY` failures at their owning layout or upstream semantic cause. Do not compensate for an invalid `ResolvedLayout` with renderer CSS, manual SVG offsets, or alternate DOM geometry.
