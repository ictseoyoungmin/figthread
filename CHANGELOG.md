# Changelog

## 0.6.0 — D-006 deterministic static SVG rendering

- added a deterministic standalone SVG renderer that consumes only promoted semantic, primitive, profile, and layout authority
- added deterministic core drawing implementations for all 24 bundled primitive families
- added static-summary state projection into state-aware primitives such as queues and meters
- reused promoted connector routes exactly and kept global geometry outside renderer authority
- added rendered-profile evidence for explicit emitted font size, essential stroke width, contrast, grayscale policy, node/connector coverage, and SVG purity
- added content hashes for SVG, rendered artifact, evidence, and immutable render promotion receipts
- added fail-closed custom primitive evidence rules and explicit browser-glyph-extent limitation reporting
- added skill-local render CLI with SVG/evidence file output
- added renderer/runtime mirrors, agent-facing rendering reference, CI gate, and regression coverage

## 0.5.0 — D-005 profile thresholds

- added a content-hashed five-profile threshold registry
- added ProfilePlan compilation/promotion with immutable receipts and deterministic threshold identity
- added weighted semantic density accounting, hard ceilings, and deterministic soft-budget escalation
- added deterministic profile-owned label measurement refinement that can only strengthen primitive minimums
- added profile spacing floors and presentation safe-margin enforcement
- bound profile registry/threshold/plan identity into LayoutIntent, ResolvedLayout, and layout promotion receipts
- added profile motion-envelope validation for cue duration, semantic-beat dwell, repeat policy/duration, and simultaneous moving groups
- routed layout and motion CLIs through explicit profile promotion
- added a skill-local profile CLI, profile reference, schema, root mirrors, and runtime re-exports
- expanded CI and regression coverage across semantic → visual → profile → layout → motion promotion
- documented exact glyph/stroke/contrast/grayscale proof as renderer-owned evidence rather than fabricated runtime output

## 0.4.0 — D-004 visual primitives

- added VisualSpec schema/template/example and skill-local visual CLI
- added a content-hashed 24-family core primitive registry
- added custom primitive schema and validation for IDs, variants, intrinsic floors, interfaces, state channels, and SVG purity
- added S0–S3 salience with custom primitive enforcement for S3 thesis-bearing/novel structure
- added immutable PrimitivePlan promotion receipts and deterministic plan/measurement hashes
- moved the agent-facing layout workflow from hand-authored measurements to PrimitivePlan-derived measurements
- added a public layout-target contract while retaining the old measurement request only as an internal solver bridge
- bound visual/registry/primitive-plan identity into LayoutIntent and ResolvedLayout hashes
- routed motion CLI through semantic → visual → layout → motion promotion
- expanded CI and regression coverage across the full promotion chain
- extended agent-facing guards to reject version labels for VisualSpec, PrimitiveDefinition, PrimitivePlan, and LayoutTarget

## 0.3.0 — D-003 deterministic semantic motion

- added MotionSpec schema/template/example and skill-local motion CLI
- added promoted-layout-only motion validation, deterministic event scheduling, state-domain effects, and cue compilation
- added event-sourced seeking that never reads the previous DOM frame
- resolved transfer/trace geometry exclusively from promoted ResolvedLayout routes
- added repeat-loop semantic closure, static-summary behavior, purity checks, and MOT diagnostics
- added immutable MotionProgram promotion receipts and deterministic program hashes
- extended CI and regression coverage across semantic, layout, and motion promotion gates
- strengthened agent-facing cleanup so public prose omits both internal D-* roadmap codes and contract version labels

## 0.2.1 — agent-facing boundary cleanup

- removed internal roadmap codes and implementation-slice language from `skills/figthread/`
- rewrote the installed skill around stable capability, authority, promotion, recovery, and unsupported-operation contracts
- added a recursive regression test that forbids `D-*` roadmap codes anywhere under the installed skill tree
- documented that roadmap codes belong only in repository-level developer materials

## 0.2.0 — D-002 deterministic layout

- added LayoutRequest 0.1, LayoutIntent 0.1, and ResolvedLayout 0.1 contracts
- added a D-001-promotion-only deterministic layout compiler
- added recursive intrinsic footprint solving with hard minimum floors and deterministic soft shrink
- added stable box anchors and orthogonal connector routing
- added layout overflow/collision/crossing audits and LAY diagnostics
- added immutable ResolvedLayout promotion receipts and layout hashes
- added skill-local layout CLI, examples, references, mirrors, and D-002 regression tests
- deliberately fail closed on unsupported radial axes instead of introducing stochastic graph layout

## 0.1.0 — D-001 implementation hardening

- froze FigureSpec 0.1 structural contract, including `emphasis` and canonical claim `statement`
- made `skills/figthread/` the self-contained runtime source of truth
- connected structural schema validation to the actual gate
- completed IR001–IR009 semantic invariants, including recursive reachability and snapshot summary checks
- added deterministic input/promotion hashing and draft/gate modes
- expanded boundary tests and CI
