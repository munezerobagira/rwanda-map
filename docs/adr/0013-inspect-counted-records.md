# ADR 0013 — Inspect the records behind counts

2026-11-15. User asks for higher accuracy and a way to see it, especially on Esri.
While actual polygon coverage is being prototyped, current markers should expose
what evidence they represent. Compare noninteractive colored dots with using the
same marker as a tap/click target showing its source ID/version, mapping date,
use and footprint area. Choose inspection on existing markers; preserve the
selected area and do not turn a marker click into a new village selection.

Use safe text DOM content, no source-derived HTML. Keep colors/dates/point IDs
shared with map/export. A popup is record inspection, not proof of a house or a
surveyed roof outline; explicitly state that point-vs-outline distinction. Do not
invent rectangles from footprint area. Actual source polygons and independently
validated accuracy remain the next coverage milestone. Current inspector hints
must be translated, and marker/source formatting should have regression checks.
Canvas marker keyboard navigation remains an accessibility gap to resolve with
a shared inspection list/keyboard control, not a claim of completed keyboard QA.
