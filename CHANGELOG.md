# Changelog

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
