# LayoutIntent and deterministic layout

Layout consumes only matching promoted semantic, primitive, and profile artifacts. Raw semantic input, hand-authored node measurements, and unprofiled target geometry are not authoritative layout inputs.

## Authority boundary

- `FigureSpec` owns semantic identity, relations, composition order, and reading-axis intent.
- `PrimitivePlan` owns resolved primitive bindings and primitive intrinsic node measurements.
- `ProfilePlan` strengthens those measurements with readability floors and owns the effective target spacing policy for one profile/target combination.
- The layout target supplies one explicit viewport, profile, safe area, and solver options before profile refinement.
- `LayoutIntent` owns target, regions, hard/strong/soft constraints, allowed ports, topology intent, and routing policy. It contains no resolved `x/y/path` geometry.
- `ResolvedLayout` owns boxes, anchors, connector points/path, diagnostics, and `layout_hash`.
- Renderer code must consume `ResolvedLayout`; it must not invent alternate placement.

The layout engine still has an internal measurement bridge, but agent-facing authoring does not supply it. The promoted profile plan is the only valid source for the final intrinsic metrics passed to the solver.

## Determinism

The engine supports `left-right`, `top-down`, and registered topology-specific `radial` solving. It never uses force-directed placement, randomness, browser auto-layout, or a hidden optimization seed. The same promoted figure, primitive plan, profile plan, target, and engine version must produce the same `LayoutIntent` and `ResolvedLayout` hashes.

Visual and profile identity are carried into `LayoutIntent` and `ResolvedLayout` through their content hashes. Changing a primitive binding or selected profile threshold therefore changes layout identity even when the final numeric box dimensions happen to match.

## Radial topology policy

Radial intent is solved only when the registered figure grammar gives it a stable semantic topology:

- `lifecycle` `cycle` / `ring` and `mechanism` `feedback-loop` use one ordered ring. The first composition item starts at 12 o'clock and remaining items proceed clockwise in semantic reading order.
- `network` `radial` uses the grammar's explicit `hub` role. The hub is placed at the exact safe-area center and the remaining direct children form one ordered ring.
- `architecture` `hub-spoke` uses one deterministic component hub. The solver selects the direct component with highest grammar-internal degree, then breaks ties by composition order and stable ID. Remaining direct children form the ring.

The solver first tries preferred intrinsic sizes and preferred spacing, then moves through a fixed deterministic sequence toward promoted minimum sizes. It tests a fixed set of ring rotations, computes the largest legal radius for each node's actual footprint, and rejects candidates that violate minimum spacing or safe-area containment. It never adds a second ring, changes semantic order, invents a hub, or uses force-directed relaxation to manufacture a fit.

Nested children inside a radial ring or hub box use deterministic local top-down packing. If a supported radial topology cannot fit at promoted minimum sizes, layout fails with `LAY001_UNSAT`. If the grammar/variant has no registered radial solver, it fails with `LAY009_RADIAL_TOPOLOGY`.

## Solve order

1. verify semantic, grammar, primitive, and profile promotion receipts and matching identities;
2. validate the target viewport, profile, safe area, and options during profile compilation;
3. start from primitive intrinsic measurements;
4. strengthen them with deterministic profile-owned text floors;
5. strengthen target spacing to the profile's hard minimum;
6. compile grammar/composition into `LayoutIntent` regions and constraints;
7. compute recursive intrinsic footprints;
8. select the registered linear or radial topology solver;
9. for linear layout, place children in stable reading order and reduce soft gap before shrinking preferred size toward the strengthened minimum;
10. for radial layout, preserve the topology's hub/ring policy and search only the fixed size/rotation sequence;
11. refuse a solve if any strengthened minimum geometry cannot fit;
12. freeze boxes and anchors;
13. route relations orthogonally using stable candidate scoring;
14. audit overflow, unrelated box collision, obstacle penetration, and crossing budget;
15. bind grammar/visual/profile hashes into final layout identity and promote only with zero hard errors.

No text or font size is silently reduced by the layout runtime. Primitive minimum dimensions and profile-strengthened text floors are both hard lower bounds.

## Routing

Relations keep their semantic `from/to` from `FigureSpec`. Linear layout chooses east/west or north/south anchors after box placement. Radial layout permits all four anchors and selects the dominant center-to-center axis deterministically for each relation.

Candidate paths remain orthogonal. Radial routes add stable horizontal/vertical elbow candidates and safe-area perimeter detours to the existing candidate set. Every candidate is scored by semantic obstacle hits, crossings against already-routed relations, bends, length, then deterministic candidate order.

## Diagnostics

- `LAY001_UNSAT` — invalid promoted input, profile-plan mismatch, or hard minimum geometry cannot fit.
- `LAY003_OVERFLOW` — box or connector path leaves the target safe area.
- `LAY004_COLLISION` — unrelated semantic boxes overlap or a route penetrates a semantic obstacle.
- `LAY005_ROUTE_DENSE` — crossing budget exceeded.
- `LAY008_TARGET_MISSING` — target is missing, malformed, or profile-incompatible.
- `LAY009_RADIAL_TOPOLOGY` — radial intent has no registered deterministic topology solver or lacks a required direct hub/ring role.

Profile-owned target, spacing, and density failures use `PRF` diagnostics before the layout solver runs.

`LAY002`, `LAY006`, and `LAY007` are reserved protocol codes and must not be repurposed by local patches.

## Unsupported operations

The radial solver is intentionally topology-specific and single-ring. It does not provide generic force-directed graphs, automatic multi-ring packing, stochastic relaxation, or renderer/browser-driven fallback geometry. If a figure needs one of those structures, change the upstream grammar/composition or fail explicitly rather than hand-positioning nodes downstream.

## Recovery rule

Repair `LAY` failures at their owning layout, profile, visual, grammar, or upstream semantic cause. Do not compensate for an invalid `ResolvedLayout` with renderer CSS, manual SVG offsets, alternate DOM geometry, or ad-hoc replacement measurements.
