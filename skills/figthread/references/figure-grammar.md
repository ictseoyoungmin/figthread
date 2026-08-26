# Figure grammar

A figure has one root grammar. The grammar is chosen from the reader's primary question, not from the shape that is easiest to draw. The promoted grammar plan validates the semantic roles, topology, reading order, variant, and split conditions that layout must preserve.

## Root grammar selection

Use exactly one of these root grammars:

- `comparison` — subjects are judged against shared criteria.
- `architecture` — components, boundaries, and interfaces form the explanation.
- `pipeline` — ordered progress is the claim.
- `mechanism` — a causal transformation explains an outcome.
- `state-transition` — events move a system between semantic states.
- `timeline` — temporal order is the organizing rule.
- `network` — connectivity or clustering is itself the claim.
- `hierarchy` — parent-child or taxonomic structure is the claim.
- `swimlane` — responsibility and cross-lane transfer organize a process.
- `lifecycle` — recurring phases and semantic closure are essential.
- `dataflow` — data or artifacts transform and propagate through operators.
- `multi-panel` — several child views support one thesis through an explicit panel relationship.

Do not combine root grammars ad hoc. If a second grammar becomes necessary to preserve a substantial part of the explanation, reclassify the root, use a valid multi-panel composition, or split the figure.

## Required role bindings

The installed grammar registry is authoritative for exact role names, cardinalities, variants, axes, relation vocabularies, and split caps. Common bindings are:

| Grammar | Required roles |
| --- | --- |
| comparison | `subjects` |
| architecture | `components` |
| pipeline | `stages` |
| mechanism | `components` |
| state-transition | `states` |
| timeline | `events` |
| network | `nodes` |
| hierarchy | `root`, `members` |
| swimlane | `lanes`, `steps` |
| lifecycle | `phases` |
| dataflow | `operators`, `artifacts` |
| multi-panel | `panels` |

Role arrays are ordered semantic node IDs. Their order must agree with `composition.order`. Do not place descriptive metadata strings in `role_bindings`; role bindings are node references.

## Type-specific invariants

- A linear pipeline has a direct forward relation between consecutive stages and contains no semantic cycle.
- A feedback-loop mechanism requires an actual causal cycle.
- State-transition roles bind semantic `state` nodes and require trigger transitions.
- A network cannot contain isolated bound nodes; radial network variants require exactly one hub.
- A hierarchy has one root, exactly one parent edge for every other member, no cycle, and one connected structure.
- Every swimlane step declares `data.lane_id` referencing a bound lane.
- A lifecycle explicitly closes the ordered phase sequence back to its first phase.
- Dataflow operators and artifacts are disjoint roles and every bound role participates in data-provenance relations.
- Multi-panel roles bind direct child panels of the composition root. Cross-panel semantic arrows are forbidden; express the panel story through composition order and panel purpose instead.

## Grammar promotion

After semantic promotion, run:

```bash
node <skill-root>/scripts/grammar.mjs <figure-spec.json> --mode gate
```

Repair `GRM` diagnostics at the semantic/grammar cause, then promote:

```bash
node <skill-root>/scripts/grammar.mjs <figure-spec.json> --promote
```

Only the promoted `GrammarPlan` may supply grammar identity to layout. Layout must bind the grammar registry hash, selected definition hash, and grammar-plan hash into its own identity.

## Recovery

Typical recovery routes:

- `GRM001_TYPE` — reclassify the figure or correct the root grammar declaration.
- `GRM002_ROLE` / `GRM004_CARDINALITY` — repair role bindings or semantic decomposition.
- `GRM003_RELATION` / `GRM006_CYCLE` — repair semantic topology; do not hide it with routing.
- `GRM005_ORDER` — repair reading order at composition level.
- `GRM007_VARIANT` — choose a registered variant/axis that preserves the claim.
- `GRM008_COMPOSITION` — repair lane/panel/containment semantics.
- `GRM009_SPLIT` — split or overview/detail the figure instead of shrinking it.
- `GRM010_HYBRID` — reclassify, multi-panel, or split; do not invent a hybrid layout.
