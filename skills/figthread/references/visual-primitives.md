# Visual binding and primitive resolution

`VisualSpec` binds semantic nodes to a compact primitive vocabulary without changing semantic meaning or resolved geometry. A successful visual promotion produces an immutable `PrimitivePlan` that profile resolution consumes before layout.

## Authority boundary

- `FigureSpec` decides what an object means.
- `VisualSpec` decides which primitive expresses that object, which registered variant is used, which salience class applies, and which semantic states bind to exposed state channels.
- `PrimitiveDefinition` decides local SVG vocabulary, intrinsic size, ports, slots, state channels, and visual tokens.
- `PrimitivePlan` resolves those bindings against the exact registry hash and owns the primitive intrinsic measurement baseline.
- `ProfilePlan` may only strengthen that baseline with readability and spacing floors for the selected target.
- `ResolvedLayout` still owns all final x/y/path geometry.

A primitive may not invent a semantic relation, state, claim, or reading order that is absent from `FigureSpec`.

## Core registry

The installed registry intentionally stays compact:

- structural: frame, group, label-stack, badge, port, connector, bracket, annotation
- semantic: actor, compute, store, queue, artifact, model, router, boundary
- mechanism: token, sequence, cell, array, stack, matrix, tree, meter

Registry identity is content-hashed. `VisualSpec.registry_hash` must match the installed registry exactly; silent registry substitution is a hard failure.

## Salience

Use salience to decide whether a generic primitive is semantically sufficient:

- `S0` — connective or framing object; a structural/micro primitive is normally enough.
- `S1` — supporting semantic object; a semantic archetype is normally enough.
- `S2` — explanatory mechanism where internal state or structure matters; prefer mechanism composition or a sufficiently expressive semantic primitive.
- `S3` — thesis-bearing or novel explanatory structure; a custom primitive is required.

If replacing an object's internal structure with a generic icon would erase the explanation, do not lower salience to avoid making a custom primitive.

## Custom primitives

Custom definitions are local, self-contained SVG descriptions with explicit intrinsic size and interfaces. They must:

- use a `custom.*` ID and never shadow a core ID;
- declare one or more supported variants;
- declare positive minimum/preferred intrinsic dimensions;
- declare ports, slots, state channels, and tokens explicitly;
- contain no scripts, event-handler attributes, `foreignObject`, remote hrefs, or remote CSS/image URLs;
- remain deterministic and independent of DOM state, wall clock, randomness, or network access.

Unused custom definitions are reported so the final visual specification does not accumulate dead vocabulary.

## State-channel binding

A state binding maps a primitive channel such as `occupancy` or `active` to a `StateSpec` ID. The channel must exist on the selected primitive, the state ID must resolve, and that state must target the same semantic node.

Motion later refers to semantic states and node/relation IDs. It does not address primitive DOM selectors.

## Intrinsic measurements

Primitive measurements are derived from promoted primitive definitions. Agent-facing layout input contains target/profile/safe-area/options only; it does not contain hand-authored node measurements.

Primitive minimum dimensions are hard floors and preferred dimensions are soft targets. Profile resolution then derives a deterministic conservative label floor and spacing floor. The profile may raise `min_w`, `min_h`, preferred size, or layout gaps, but may never reduce a primitive minimum.

Exact browser glyph metrics remain renderer evidence; they are not substituted back into `PrimitivePlan`.

## Diagnostics

- `PRM001_BIND` — malformed visual input, figure mismatch, unknown node, or invalid promoted semantic input.
- `PRM002_REGISTRY` — registry hash mismatch or unknown primitive.
- `PRM003_VARIANT` — selected primitive variant is not registered.
- `PRM004_INTRINSIC` — primitive intrinsic metrics are invalid.
- `PRM005_INTERFACE` — duplicate or invalid primitive interface declaration.
- `PRM006_STATE` — invalid state-channel binding.
- `PRM007_SALIENCE` — thesis-bearing/novel structure uses a generic core primitive.
- `PRM008_PURITY` — unsafe SVG or unregistered visual extension behavior.
- `PRM009_CUSTOM` — invalid, duplicate, shadowing, or unused custom primitive definition.
- `PRM010_COVERAGE` — semantic node is missing a binding or has multiple bindings.

## Recovery rule

Repair the visual cause rather than compensating downstream. Do not modify layout coordinates to hide an underspecified primitive, and do not downgrade salience merely to pass the gate. If the visual structure reveals that the semantic decomposition itself is wrong, reopen semantic authoring.
