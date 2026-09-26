# Changelog

Simple running log of notable updates to this project. Newest first.

## 2026-09-25

### UI - "software" restructure, not a dashboard
Reworked the shell to read as a GIS workstation (toolbar + tool dock + docked
inspector + status bar) instead of a stats dashboard, and to leave a clear
extension point for the planned AI building-detection feature.

- Fixed a real bug: the floating administrative-level legend (top-left, on
  the map canvas) could sit directly under the header search bar's results
  dropdown. Moved it off the map entirely into the sidebar's new **Map View**
  section - it can no longer collide with anything, and the map canvas itself
  is cleaner without floating chrome.
- Removed the per-basemap-group icons in the sidebar (Satellite/Night/Vector/
  Physical) added last round - feedback was that they didn't read well. Group
  headers are plain text again.
- Added an **AI Analysis Tools** section to the sidebar with a "Building
  Detection" card (Coming Soon, disabled `Run Analysis` button). This is the
  extension point for the planned house-counting model - wiring it up later
  is "remove the disabled state," not "design a new panel."
- Converted the village/administrative detail card from a floating overlay
  into a **docked Inspector panel**: on desktop (`md:` and up) it's a real
  flex sibling of the map that narrows the canvas, like a GIS app's attribute
  panel, instead of covering part of it; on mobile it's a full overlay (no
  room to dock there). Also added an "AI Analysis" results slot inside it
  (currently a placeholder note) so a future house-count result has a home
  without changing the panel's shape again.
- Fixed an overlap this introduced on mobile: the Inspector panel's top edge
  initially collided with the map's floating Export View/Export Selected
  buttons; pushed the panel down to clear them.
- Tightened the bottom status bar: icon-only "Detect Location" button, added
  a zoom-level readout, consistent with the "status bar," not "stat cards"
  framing.
- Verified with a headless-Chromium pass (desktop 1440x900 and mobile
  390x844): zero console errors, search dropdown no longer overlaps the
  sidebar, Inspector panel docks correctly and no longer overlaps the export
  buttons.

## 2026-09-24

### SEO
- Added `src/app/robots.ts` and `src/app/sitemap.ts` (Next.js App Router conventions) so the app now serves a real `/robots.txt` and `/sitemap.xml`. Both derive their base URL from `NEXT_PUBLIC_SITE_URL`, defaulting to `http://localhost:3000` until a production domain is set - **set that env var once the site has a real domain**, or the sitemap/OG URLs will keep pointing at localhost.
- Expanded `src/app/layout.tsx` metadata: `metadataBase`, a title template, keywords, `robots: { index: true, follow: true }`, Open Graph, and Twitter card fields. Previously only a bare `title`/`description` were set.
- `/api/*` routes are disallowed in `robots.txt` (nothing there is a page worth indexing).

### Performance - boundary sync
- Root cause of slow map panning/zooming: coordinates were stored/served at full float64 precision (~17 significant digits) and API responses were never compressed (verified: a production `next start` server returned a ~38MB uncompressed body for the largest case even when the client sent `Accept-Encoding: gzip, br`).
- `src/lib/spatialStore.ts` now rounds every coordinate to 6 decimal places (~11cm, far more precision than an admin boundary needs) when a layer is loaded, including normalizing any pre-existing on-disk simplified cache.
- Added `src/lib/compressJson.ts` and wired it into `/api/boundaries`: responses are now brotli- (or gzip-) compressed based on the request's `Accept-Encoding`, with brotli quality adaptively lowered for unusually large payloads to keep compression itself fast.
- Combined effect measured on a realistic viewport request: **1.56MB -> ~210KB (about 7.4x smaller)**, serving in ~35-50ms once warm.

### UI/UX
- Added a location search bar in the header (`src/components/SearchBar.tsx`, `/api/search-location`) - search any province/district/sector/cell/village by name and jump straight to it. Fixed to `fitBounds` on the matched feature's real extent instead of flying to a fixed zoom (a province and a village need very different zoom levels).
- Added "Detect My Location" (browser geolocation) with an inline, self-dismissing error toast instead of a blocking `alert()`.
- Added a compact legend + manual administrative-level picker (`src/components/LayerLegend.tsx`) so you can jump straight to Province/District/Sector/Cell/Village instead of only being able to reach a level by guessing the right zoom.
- Clicking a boundary now leaves a persistent highlight on it (previously the highlight vanished the instant the mouse left the shape, even while its detail card was still open).
- Detail card is now responsive (full-width with margins on mobile, scrollable if tall) instead of a fixed 384px box that could overflow small screens.
- Removed decorative/non-functional UI that didn't reflect anything real: the always-on "Database Connected" pill, the ticking "Live" clock (replaced with a real "last updated" timestamp stamped when boundary data actually refreshes), and the sidebar's Dashboard/Explorer/Village Registry tabs (they only swapped which hardcoded numbers a stats footer showed).
- Redesigned the sidebar: basemaps are now grouped by category (Satellite/Vector/Physical/Night) with icons and a selected-state checkmark, plus a footer tip pointing at search/geolocation.
- Redesigned the header: compact brand mark on mobile (sidebar is off-canvas there), and the active-layer/last-updated info consolidated into one responsive status pill.

### Known follow-up (not yet done)
- Per-village `connection_rate` / `peak_load_mw` / `status` in `spatialStore.ts` are formula-generated from the feature's FID, not real measurements, but the UI presents them as if they were. Flagged for a product decision (soften the label vs. wire up real data), not fixed yet.
