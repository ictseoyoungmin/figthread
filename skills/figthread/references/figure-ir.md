# FigureSpec 0.1 reference

`FigureSpec` is a semantic intermediate representation, not a renderer scene
graph. It is the only authoritative input allowed to cross the validation gate
into layout.

## Core records

```text
ClaimSpec    { id, role, text, must_preserve?, source_refs? }
NodeSpec     { id, kind, label?, parent_id?, order?, claim_refs, data? }
RelationSpec { id, kind, from, to, claim_refs?, extension_kind? }
StateSpec    { id, target_id, property, domain, initial, summary, claim_refs? }
```

Node kinds are `panel`, `group`, `stage`, `actor`, `object`, `process`, `state`,
`metric`, `result`, and `annotation`. Core relation kinds include `flows-to`,
`routes-to`, `transforms-into`, `contains`, `branches-to`, `merges-from`,
`depends-on`, `compares-with`, `shares-with`, `persists-in`, `emits`,
`consumes`, and `triggers`.

## Promotion gate

The repository validator reports deterministic issues using these core codes:

- `IR001` — every stable ID is unique across the document.
- `IR002` — every typed reference resolves to an existing object.
- `IR003` — parent relationships are cycle-free.
- `IR004` — every primary or must-preserve claim has a node, relation, or state
  witness.
- `IR005` — every semantic node has a direct or descendant claim witness.
- `IR006` — state `initial` and `summary` values belong to their declared domain.
- `IR007` — `static_snapshot_id` points to a real snapshot.
- `IR008` — semantic objects do not contain resolved geometry such as `x`, `y`,
  `w`, `h`, `path`, or `d`.
- `IR009` — extensions use a namespaced container and extension relations use a
  namespaced `extension_kind`.

Schema validation and semantic validation are separate responsibilities. A
JSON document can be structurally shaped yet still fail the semantic gate.

## Grammar registry

The v0.1 root grammar set is:

`comparison`, `architecture`, `pipeline`, `mechanism`, `state-transition`,
`timeline`, `network`, `hierarchy`, `swimlane`, `lifecycle`, `dataflow`, and
`multi-panel`.

The grammar owns required semantic roles, reading axis, allowed relations,
composition slots, and complexity caps. It does not own coordinates. If a
secondary reading axis is independently necessary, use `multi-panel` or split
the figure.
