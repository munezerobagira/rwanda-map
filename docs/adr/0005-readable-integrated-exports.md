# ADR 0005 — Readable, consistent image exports and adaptive panels

Date: 2026-11-14. Accepted for implementation; browser QA still unavailable.

Count results now share geometry, dates and source snapshots with map/export.
The next integration audit found two gaps: long provenance text is squeezed to
fit narrow selected-area cutouts, and panel reservations guess timeline height.

Image export alternatives:
1. Keep narrow canvas and shrink every caption with fillText(maxWidth): preserves
   the old pixel dimensions but makes method/date/confidence and credits illegible.
2. Preserve the captured map pixels/transparent cutout, center them on a minimum
   480px output, wrap a shared source/result footer at a readable font, and derive
   footer height from measured text. Choose 2. PNG remains the output format;
   selected geometry, holes, worker boundary snapshots, comparison clipping and
   restore-view flow are retained. Test wrapping independently and abort captures
   if source/date/selection or map view changes during async worker/tile waits.

Mobile layout alternatives:
1. Reserve a fixed number of pixels per timeline state; expanded acquisition
   metadata/translations can still overlap the inspector or analysis controls.
2. Measure the existing bottom stack with ResizeObserver and reuse that measured
   inset for map controls, inspector and layer dock. Choose 2, keeping existing
   glass panels and responsive layout. Mid-width screens need full-width bottom
   controls instead of an almost-zero gap between both docks. On selecting an
area below 1200px, close the layer dock so the selected map and inspector have
room; the user may explicitly reopen it.

Also preserve every selection ring in the inverted focus mask (including holes),
and collapse identical in-flight imagery tile jobs so metadata/version refreshes
cannot multiply queued raster work. These are integration fixes, not new pages.

Acceptance: unit tests for export text preservation, date/source consistency and
hole-aware mask; existing full/selected PNG flow preserved structurally. Actual
mobile/PNG/swipe interactions remain a recorded browser-host validation gap.

Raster scheduling alternatives (2026-11-14): (1) cache only completed tiles and
let each overlapping browser request occupy a raster/queue slot; (2) keep one
pending promise per actual period/revision/tile/rendition alongside the completed
cache, sharing both success and failure, and remove it after settlement. Choose 2.
Preserve two workers, 24 waiting jobs, 15s queue deadline, 20s render deadline,
64 completed entries and one-hour TTL. A failed job must be retryable. Source
revision/period changes must never share output. This reduces duplicate work
without raising Vercel concurrency or hiding the existing fallback error state.
