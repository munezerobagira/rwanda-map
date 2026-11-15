# ADR 0006 — Drawn areas use the same selection contract

2026-11-14. Accepted for implementation; actual pointer/touch QA is pending.

Users must analyze an area without relying on uncertain reference village
boundaries. Compare (1) Leaflet.draw (MIT), providing a full separate toolbar,
editing and many geometry types, with its own global localization; (2) existing
Leaflet click events, polygon/polyline preview and the current glass toolbar,
with bounded two-tap rectangles and tap-vertex polygons. Choose 2 for this first
small-area workflow: no extra download/global UI system, no drag-only gesture,
and only the two requested area shapes. Leaflet.draw remains a reasonable
alternative if hole editing/snapping/large geometry editing becomes necessary.
Neither alternative establishes cadastral accuracy.

Extend Selection with an `area` variant, never a fake administrative level.
Geometry/area helpers are shared with the analysis validator. Both variants use
the same inspector, dates, analysis registry, focus layer and PNG/CSV/GeoJSON
exports. Drawing temporarily hides the previous inspector/focus, retains its
selection, and Escape/Cancel restores it. Finishing atomically replaces it;
admin clicks are suppressed while drawing. Undo removes the last vertex.
Rectangles use two opposite corners followed by Done; polygons require >=3 vertices and Done.

Round input to 5 decimal degrees (~1m) before analysis and export, cap at 64
vertices and 50km², reject invalid/outside-Rwanda-bounds/self-crossing shapes.
This is a UI/compute bound, not a claim of survey precision. No browser storage,
server persistence, identifying names, or owner data is added. Put bounded drawn
geometry in the URL fragment rather than query parameters: fragments are not
sent in ordinary HTTP requests/referrers. A copied link still deliberately shares
its geometry and must say so. Existing admin query links remain compatible.
Capture a geometry creation date distinct from imagery/building source dates.

Alternatives for sharing: no share support breaks existing integration; a server
short-link store adds persistence and infrastructure; bounded fragments preserve
the current copy-address workflow without creating that store. Use fragments.

Acceptance: rectangle/polygon construction, invalid geometry, hash size/roundtrip,
legacy links, same two-date tally and all three translated exports have tests.
Manual tap/pan/zoom/Undo/Done/Escape, inspector, swipe and both PNG downloads on
mobile/desktop remain a separate browser-host gate. Work remains feature flagged.

Sources accessed 2026-11-14:
- https://leafletjs.com/reference-1.9.4.html — map click/keyboard events,
  noninteractive vector layers, polygons, rectangles and GeoJSON.
- https://leaflet.github.io/Leaflet.draw/docs/leaflet-draw-latest.html — toolbar,
  localization/touch options, unsupported multigeometry editing.
- https://github.com/Leaflet/Leaflet.draw — MIT license and project integration.
