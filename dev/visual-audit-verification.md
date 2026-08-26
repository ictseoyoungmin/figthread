# Full-SVG visual-audit verification

The release gate exercises a generalized custom SVG fixture with internal text and classified visible geometry under both supported Node CI versions.

Verification requires the normal unit/regression suite plus a real Chrome/Chromium `visual:audit:promote` run. The browser audit must cover custom text, classified geometry, promoted relation connectors, owner/viewport bounds, collision checks, connector clearance, visibility, and platform-font glyph evidence.

The fixture and verification language stay domain-neutral. Browser measurements are rejection evidence only and never feed geometry back into semantic, visual, profile, layout, or render authority.
