# Browser visual audit

The visual audit is evidence over the exact promoted static SVG. It never becomes semantic, primitive, profile, layout, or renderer authority. Its job is to detect browser-resolved spatial defects that serialized markup and coarse owner-box checks cannot certify.

## Audit scope

The bundled Chrome/Chromium adapter measures:

- every rendered primary semantic label;
- every rendered `<text>` inside a custom primitive;
- every classified visible geometry element inside a custom primitive;
- every promoted relation connector.

The audit checks exact element coverage, visibility, browser bounding boxes, owner/viewport containment, minimum internal text padding, platform-font glyph attribution, text-to-text overlap, text-to-protected-mark overlap, and connector clearance through text/protected regions.

The browser is an evidence collector only. A failed audit must reopen the earliest causal stage; the adapter may not move text, resize a primitive, reroute a connector, or rewrite geometry to manufacture a pass.

## Custom geometry roles

Custom primitive text is always audited and needs no role annotation. Visible custom geometry must be classifiable. Add `data-figthread-audit` to geometry that needs an explicit spatial role:

```xml
<rect data-figthread-audit="container" .../>
<path data-figthread-audit="essential" .../>
<line data-figthread-audit="connector" .../>
<circle data-figthread-audit="decorative" .../>
```

Roles mean:

- `container`: may contain text or marks; containment is checked but overlap with its contents is allowed.
- `essential`: protected visual mark; text and connector clearance may not cross its protected bounds.
- `connector`: route-like geometry; sampled browser-resolved points may not cross text or protected marks except the omitted endpoint samples.
- `decorative`: containment and visibility are checked, but it is not a protected collision region.

If no explicit audit role is present, `data-essential="true"` is treated as `essential`. Other unclassified visible custom geometry fails coverage. Geometry inside definitions, clipping/masking resources, markers, patterns, symbols, gradients, or filters is excluded from visible-element enumeration and is audited through the visible element that consumes it.

Supported visible geometry leaves are `path`, `line`, `polyline`, `polygon`, `rect`, `circle`, `ellipse`, and `use`. Unsupported visible element kinds fail closed instead of being silently skipped.

## Browser evidence

The adapter loads the exact promoted SVG bytes into an isolated fixed-size `about:blank` harness with no public-network navigation. It waits for `document.fonts.ready`, resolves the exact promoted viewport, measures geometry in root SVG coordinates through browser transforms, samples connector geometry, and asks Chrome which platform fonts supplied text glyphs.

Evidence is bound to the exact figure, visual plan, profile plan, layout, render, SVG, target, observation, and browser environment hashes. Environment-specific font identity is evidence for that run, not a cross-platform identity claim.

## Diagnostics

- `AUD001_BIND`: promoted authority or target mismatch.
- `AUD002_ENVIRONMENT`: missing or incomplete browser environment evidence.
- `AUD003_COVERAGE`: missing, duplicate, unsupported, or unclassified audited elements.
- `AUD004_BOUNDS`: invalid bounds, owner/viewport overflow, or custom-text padding violation.
- `AUD005_TEXT_COLLISION`: browser-resolved text boxes overlap.
- `AUD006_MARK_COLLISION`: text overlaps an `essential` protected mark.
- `AUD007_CONNECTOR_CLEARANCE`: a connector crosses text or an `essential` protected region.
- `AUD008_VISIBILITY`: an audited element is hidden or transparent.
- `AUD009_FONT`: browser font readiness or platform-font glyph evidence is missing.
- `AUD010_EVIDENCE`: observation integrity failure.

## Reopen policy

Treat audit failures as evidence of an upstream cause:

- wrong or duplicated wording → reopen semantic authoring;
- custom internal composition or role classification → reopen visual binding/custom primitive authoring;
- insufficient owner space or spacing → reopen profile/layout;
- relation route defect → reopen layout;
- missing browser/font capability → repair the environment and rerun evidence collection.

Do not patch the final SVG or HTML after promotion. Regenerate descendants after the causal stage is repaired.

## Command

```bash
node <skill-root>/scripts/visual-audit.mjs \
  <figure-spec.json> <visual-spec.json> <layout-target.json> \
  --promote \
  --out visual-audit-evidence.json \
  --observation-out visual-audit-observation.json
```

Set `FIGTHREAD_CHROME` or pass `--browser <executable>` when automatic Chrome/Chromium discovery needs an explicit executable.
