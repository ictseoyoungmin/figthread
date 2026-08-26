# Multi-target document packaging

A multi-target package is one self-contained HTML delivery that contains two or more independently promoted Figthread documents for the same semantic figure. It does not resize one promoted target to impersonate another target.

## Authority boundary

Each packaged target must already have its own promoted semantic/profile choice, grammar, visual binding, profile plan, resolved layout, rendered SVG, optional motion program, and self-contained document. Packaging is downstream of those authorities.

The package may choose which promoted target is visible. It may not:

- change semantic copy;
- change primitive binding;
- recompute layout in the browser;
- reroute connectors;
- scale one target's geometry with a CSS transform to stand in for another target;
- synthesize a target that was never promoted.

Targets may use different profiles. The package verifies that their semantic figure content is identical apart from profile selection. Target-specific profile, geometry, rendering, motion allowance, and document hashes remain independent.

## Building a package

Author a package request that satisfies `schemas/package-request.schema.json` and contains at least two inline `layout_target` entries. The base FigureSpec supplies semantic content. For each target, the package CLI selects the target profile, reruns the complete promotion chain, and creates an independently promoted self-contained document.

```bash
node <skill-root>/scripts/package.mjs \
  <figure-spec.json> \
  <visual-spec.json> \
  <package-request.json> \
  [motion-spec.json] \
  --promote \
  --out <figure.package.html>
```

A target entry may set `motion` explicitly. When omitted, the optional global MotionSpec is used. Set `motion` to `null` for a target whose profile intentionally has no explanatory motion. A motion-enabled target still has to satisfy that target profile's motion envelope.

The request chooses a stable package ID, default target, package runtime mode, and child runtime mode. Target IDs must be unique. The installed example is `examples/minimal.package.json`.

## Package identity

The promoted manifest satisfies `schemas/document-package.schema.json` and binds:

- one semantic-content hash shared by every child target;
- ordered target IDs;
- each target's profile and exact viewport;
- child document canonical hash, compile key, build hash, HTML hash, and promotion hash;
- the exact base64-encoded bytes of every promoted child HTML document;
- package runtime policy;
- one content hash over the whole package manifest.

The package promotion receipt additionally binds the exact package HTML hash and the child HTML hash map.

## Browser runtime

The self-contained package exposes `window.FigthreadPackage`.

- `getStatus()` reports package readiness and the active target.
- `listTargets()` reports only embedded promoted targets.
- `activateTarget(id)` verifies the selected child HTML hash and loads those exact bytes.
- `getActiveTarget()` reports the selected target record.
- `getDiagnostics()` reports package-runtime failures.

Each child runs at its promoted viewport dimensions inside a scrollable frame. The parent package does not use geometry scaling. A smaller host viewport scrolls the target rather than silently shrinking it.

The child is still a normal promoted Figthread document with its own `window.Figthread` runtime. Packaging does not replace child document authority.

## Diagnostics

- `PKG001_BIND` — a child document is missing, tampered, or not a valid promotion.
- `PKG002_SEMANTIC` — child targets do not represent the same semantic figure content.
- `PKG003_TARGET` — package ID, target viewport, default target, or target policy is invalid.
- `PKG004_DUPLICATE` — target IDs are not unique.
- `PKG005_HASH` — package manifest or embedded child bytes fail content-hash validation.
- `PKG006_PURITY` — the package introduces an external runtime dependency.
- `PKG007_RUNTIME` — the package browser runtime cannot initialize or activate an embedded target.

## Recovery rule

Repair the owning target before packaging. If a compact target is unsatisfiable, reopen that target's profile/layout decision instead of shrinking the wide target. If two targets diverge semantically, reopen their semantic source until they express the same figure content. Never edit embedded child HTML or package bytes after promotion and still claim certification.
