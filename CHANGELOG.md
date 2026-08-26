# Changelog

## 1.5.0 — browser-resolved full-SVG visual audit

- added a content-addressed visual-audit plan, browser observation, promoted evidence record, and immutable promotion receipt over exact promoted figure, visual, profile, layout, render, SVG, target, and browser identities
- added a zero-dependency Chrome/Chromium DevTools-pipe adapter that measures the exact promoted static SVG without becoming semantic, primitive, layout, or renderer authority
- expanded browser evidence coverage from semantic primary labels to every custom-primitive text element, every classified visible custom geometry leaf, and every promoted relation connector
- added explicit custom geometry roles for `container`, `essential`, `connector`, and `decorative`, while preserving `data-essential="true"` as an essential-mark compatibility path
- made unclassified or unsupported visible custom geometry fail closed instead of remaining outside evidence coverage
- added browser-resolved owner/viewport containment, internal text padding, visibility, platform-font glyph attribution, text-to-text collision, text-to-protected-mark collision, and connector-clearance checks
- added `AUD001`–`AUD010` diagnostics with upstream reopen guidance instead of downstream geometry repair
- added `visual:audit` / `visual:audit:promote` CLI commands, installed/root runtime and schema mirrors, generalized custom audit fixture, and regression coverage
- made the Node 20/22 CI hard gate run a real Chrome audit over custom internal text and classified custom geometry
- extended installed skill guidance, repository documentation, boundary guards, package metadata, and Claude/Codex plugin metadata to 1.5.0 using generalized capability language

## 1.4.0 — installed browser PNG capture

- added a bundled zero-dependency Chrome/Chromium DevTools-pipe PNG capture adapter over exact promoted self-contained HTML
- wired PNG promotion into the installed export CLI with automatic browser discovery plus `FIGTHREAD_CHROME` / `--browser` override support
- kept the capture adapter derivative-only: it prepares semantic runtime state, removes host-page scaling/padding from the capture projection, and never recalculates promoted layout geometry
- added static-summary and event-sourced time-frame capture paths bound to target/build/SVG/frame/state evidence
- added export-only profile/transparent/explicit background projection and exact integer 1x–4x screenshot scaling
- collected actual Chrome product/version/revision/protocol, OS/platform, device scale factor, and platform-font fingerprint evidence for promoted PNG artifacts
- reused existing fail-closed PNG signature/chunk CRC/dimension/source/state/environment validation before ExportArtifact promotion
- added a canonical PNG export example, root runtime/example mirrors, real-Chrome CLI regression coverage, and a Node 20/22 PNG promotion hard gate
- documented same-input/same-browser-font-environment visual determinism without claiming cross-platform screenshot byte identity
- bumped package, installed skill, Claude plugin, and Codex plugin metadata to 1.4.0

## 1.3.0 — deterministic topology-specific radial layout

- added a deterministic radial solver without force-directed placement, randomness, browser auto-layout, or hidden solver seeds
- added one-ring clockwise lifecycle and feedback-loop placement that preserves composition order from 12 o'clock
- added explicit-hub radial network placement with the hub fixed at the exact target safe-area center
- added deterministic architecture hub-spoke inference by grammar-internal degree with composition-order and stable-ID tie breaks
- added fixed preferred-to-minimum footprint search, deterministic ring rotation candidates, safe-area radius bounds, and hard minimum-gap collision rejection
- kept nested radial descendants deterministic with local top-down packing and kept all final geometry inside `ResolvedLayout`
- extended orthogonal routing for radial geometry with four-side anchor selection and deterministic elbow/perimeter candidates
- added `LAY009_RADIAL_TOPOLOGY` for radial grammar/variant combinations without a registered deterministic topology solver
- retained fail-closed `LAY001_UNSAT` behavior when a supported radial topology cannot fit promoted minimum geometry
- added full-chain radial lifecycle/network promotion coverage plus architecture, feedback-loop, deterministic hashing, collision, routing, and tight-viewport regression coverage
- updated installed layout guidance and bumped package/skill/plugin metadata to 1.3.0

## 1.2.0 — multi-target document packaging

- added a content-addressed `DocumentPackage` that embeds two or more exact independently promoted child HTML documents in one self-contained delivery
- made semantic equivalence across child targets explicit while allowing target-specific profile selection, layout, rendering, and motion decisions
- added fail-closed package diagnostics for child authority tampering, semantic drift, invalid/duplicate targets, manifest/hash failure, external dependencies, and runtime activation failure
- added a browser package runtime with exact target switching through `window.FigthreadPackage`
- made each child frame use its promoted viewport dimensions and explicitly prohibited CSS transform scaling as a substitute for target-specific layout
- added a full-chain package CLI that reruns semantic → grammar → visual → profile → layout → render → optional motion → document independently for every target
- added multi-target package manifest schema, root/runtime mirrors, package request example, agent-facing reference, and regression/CLI coverage
- added Node 20/22 CI promotion for the multi-target package example
- extended agent-facing boundary guards to package contract names and bumped package/skill/plugin metadata to 1.2.0

## 1.1.0 — browser-resolved text evidence

- added deterministic BrowserTextPlan identity bound to the exact promoted document, rendered SVG, layout, profile threshold, target viewport, semantic labels, and owner boxes
- added a zero-dependency Chrome/Chromium DevTools-pipe adapter that measures the exact promoted SVG bytes in an isolated evidence-only `about:blank` harness
- added browser `getBBox()` and client-rect measurement, computed typography/visibility capture, and `document.fonts` readiness/availability evidence
- added actual platform-font family and glyph-count evidence through `CSS.getPlatformFontsForNode`
- added environment-bound BrowserTextObservation and promoted BrowserTextEvidence hashes without granting browser layout geometry authority
- added fail-closed `TXT001`–`TXT010` diagnostics for authority mismatch, font floors, glyph bounds, owner/viewport overflow, overlap, environment, coverage, source-copy drift, and evidence integrity
- added a full-chain browser text CLI, installed/root evidence schema, runtime re-export, agent-facing reference, and boundary guard coverage
- added real Chrome CLI regression coverage when Chrome is available and made browser text promotion a hard Node 20/22 CI gate
- kept renderer evidence honest: serialized SVG evidence alone still does not claim browser glyph certification; the browser stage is a separate environment-bound proof
- bumped package, installed skill, Claude plugin, and Codex plugin metadata to 1.1.0

## 1.0.1 — full execution dogfood hardening

- added a repository benchmark that drives source understanding through claims, semantic promotion, grammar/visual, profile/layout/render, motion, document, exact artifact review, causal reopen, repaired descendants, and export
- split the benchmark across two Node processes so the second worker must resume from run-directory state rather than process memory
- made the first review deliberately expose a source-wording defect that passes core gates, proving the need for exact artifact review and upstream reopen
- fixed reopen revision reuse: every already-started affected descendant, including an unpromoted frontier, now advances to a new revision instead of reusing an older directory
- added targeted regression coverage that preserves prior revision bytes and forbids downstream `r0001` reuse after causal reopen
- added a receipt-bound dogfood report and developer finding record
- added `npm run benchmark:dogfood` and CI coverage on Node 20 and 22
- bumped package, installed skill, Claude plugin, and Codex plugin metadata to 1.0.1

## 1.0.0 — D-010 workspace / execution closure

- added a durable run-directory protocol that treats filesystem state as external memory for long-running figure work
- added exact intake source provenance, a content-hashed mutable run manifest, nine fixed execution stages, and one explicit active frontier
- added immutable content-addressed StageReceipt records that bind source, predecessor, exact artifact bytes, exact evidence bytes, and optional promoted authority hashes
- added content-hashed checkpoints after initialization, promotion, and reopen, with previous-checkpoint chaining and active receipt/revision/frontier snapshots
- added fresh-worker resume that verifies source, receipt chain, artifact/evidence bytes, and checkpoint state without conversation history
- added earliest-invalid-stage detection for tampered or missing promoted artifacts/evidence
- added revisioned reopen that preserves history and automatically invalidates every active descendant of the causal stage
- made changed intake provenance or an invalid run manifest fatal rather than allowing reopen to hide provenance damage
- added exclusive single-writer locking plus explicit audit-recorded stale-lock recovery
- added path containment and active-revision ownership rules, with `final/` allowed only for bound export-stage deliverables
- added `EXE001`–`EXE010` diagnostics, skill-local workspace CLI, agent-facing execution reference, runtime/root schema mirrors, and regression/CLI coverage
- moved the release to 1.0.0 while keeping installed skill prose free of roadmap codes and public contract-version labels

## 0.9.0 — D-009 export closure

- added ExportSpec validation for exact document/target/profile, format, frame, background, scale, and live-text policy
- added deterministic ExportPlan identity bound to canonical/document/render/motion source hashes
- added exact self-contained HTML derivative promotion
- added vector-safe static-summary SVG export with deterministic background/outer-scale presentation changes and no geometry rewrite
- made the default SVG export byte-identical to the promoted rendered SVG
- added fail-closed vector eligibility checks for scripts, foreign objects, raster images, external references, and URL dependencies
- added adapter-driven PNG capture contract over the promoted HTML runtime rather than a second raster renderer
- added deterministic PNG capture plans with selector, frame, expected semantic state hash/local time, background, scale, and exact pixel dimensions
- added PNG structure/chunk CRC/dimension verification plus runtime preparation, source authority, and browser/font/environment evidence binding
- recorded exact-byte determinism for HTML/SVG and same-input/same-environment visual determinism for browser PNG without claiming cross-platform binary identity
- added immutable ExportArtifact promotion receipts, export CLI, schema/template/example/root mirrors, agent-facing export reference, CI command, and regression coverage
- extended the agent-facing boundary guard to ExportSpec, ExportPlan, and ExportArtifact labels

## 0.8.0 — D-008 self-contained document runtime

- added a deterministic self-contained HTML document compiler over promoted semantic, grammar, visual, profile, layout, render, and optional motion authority
- separated canonical input hash, compiled-authority compile key, manifest build hash, and exact HTML hash
- added a document manifest schema and immutable document promotion receipt
- added a fail-closed embedded browser bootstrap that verifies schema, hashes, compile key, target identity, SVG viewport, and external-dependency purity before reporting ready
- added interactive, clean, static, and error runtime modes without allowing DOM/CSS state to become canonical authority
- added event-sourced runtime seeking and cue projection for reveal, focus, trace, transfer, and morph-state tracks
- added the stable `window.Figthread` inspection API for status, target inspection, seeking, mode switching, export preparation, state hashing, and diagnostics
- added a skill-local document CLI for animated or static single-file HTML output
- added document schema/runtime root mirrors, agent-facing runtime guidance, CI coverage, and regression tests
- kept public skill prose free of roadmap codes and contract-version labels

## 0.7.0 — D-007 canonical figure grammar

- added a content-hashed twelve-grammar registry covering comparison, architecture, pipeline, mechanism, state-transition, timeline, network, hierarchy, swimlane, lifecycle, dataflow, and multi-panel
- added GrammarPlan validation/promotion with immutable receipt and deterministic registry/definition/plan hashes
- made grammar roles ordered semantic node bindings with registered cardinalities, variants, axes, relation vocabularies, topology policy, and split caps
- added pipeline cycle/branch/merge/direct-flow checks, mechanism feedback validation, state-transition state/trigger checks, network isolation checks, hierarchy parent/root/connectivity checks, swimlane ownership checks, lifecycle closure, dataflow role/provenance checks, and multi-panel composition rules
- added hybrid relation detection and explicit GRM diagnostics instead of allowing renderer/layout compensation
- bound grammar registry, selected definition, and GrammarPlan identity into LayoutIntent, ResolvedLayout, and layout promotion receipts
- routed layout, render, and motion CLIs through explicit grammar promotion
- added skill-local grammar CLI/reference/schema, root mirrors, CI commands, and twelve-grammar regression fixtures
- extended agent-facing guards so GrammarPlan/GrammarDefinition contract versions stay out of public prose

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
