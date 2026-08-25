# D-002 — LayoutIntent and deterministic layout

D-002 consumes only a D-001 `validated_figure` with a valid promotion receipt. Raw FigureSpec input is never authoritative layout input.

## Authority boundary

- `FigureSpec` owns semantic identity, relations, composition order, and reading-axis intent.
- `LayoutRequest` supplies one explicit target and intrinsic node measurements. Measurements are an input bridge until VisualSpec/primitive/profile measurement slices own them.
- `LayoutIntent` owns target, regions, hard/strong/soft constraints, allowed ports, and routing policy. It contains no resolved `x/y/path` geometry.
- `ResolvedLayout` owns boxes, anchors, connector points/path, diagnostics, and `layout_hash`.
- Renderer code must consume `ResolvedLayout`; it must not invent alternate placement.

## Determinism

The v0.1 engine supports `left-right` and `top-down` dominant axes. It deliberately does not use force-directed or stochastic layout. The same promoted figure, normalized intrinsic measurements, target, options, and engine version must produce the same LayoutIntent and ResolvedLayout hashes.

Intrinsic measurements are normalized by `node_id` before hashing, so array order is not authority.

## Solve order

1. verify D-001 promotion receipt and canonical figure hash;
2. validate LayoutRequest target, safe area, measurements, and options;
3. compile grammar/composition into LayoutIntent regions and constraints;
4. compute recursive intrinsic footprints;
5. place children in stable reading order;
6. reduce soft gap before shrinking preferred size toward declared minimum;
7. refuse a solve if any minimum size cannot fit;
8. freeze boxes and anchors;
9. route relations orthogonally using stable candidate scoring;
10. audit overflow, unrelated box collision, obstacle penetration, and crossing budget;
11. hash and promote only with zero hard errors.

No text/font size is silently reduced by this slice. `min_w/min_h` are hard intrinsic floors supplied by the measurement owner.

## Routing

Relations keep their semantic `from/to` from FigureSpec. The router chooses actual east/west or north/south anchors after box placement. Candidate paths are scored by semantic obstacle hits, crossings against already-routed relations, bends, length, then deterministic candidate order.

## Diagnostics

- `LAY001_UNSAT` — invalid request, invalid promoted input, unsupported axis, or hard minimum geometry cannot fit.
- `LAY003_OVERFLOW` — box or connector path leaves the target safe area.
- `LAY004_COLLISION` — unrelated semantic boxes overlap or a route penetrates a semantic obstacle.
- `LAY005_ROUTE_DENSE` — crossing budget exceeded.
- `LAY008_TARGET_MISSING` — target is missing, malformed, or profile-incompatible.

D-002 reserves `LAY002`, `LAY006`, and `LAY007` for later font/reflow/manual-patch integrations already defined by the design baseline.

## Scope boundary

This slice does not implement VisualSpec, primitive intrinsic measurement, profile font floors, grammar-specific radial topology, MotionSpec, SVG rendering, or export. Those later slices may replace the explicit `measurements` bridge, but must preserve the LayoutIntent/ResolvedLayout authority boundary and deterministic promotion contract.
