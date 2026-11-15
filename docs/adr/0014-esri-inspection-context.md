# ADR 0014 — Closer Esri inspection and source-date context

2026-11-15, user asks to improve accuracy and inspect the result over Esri.

## Inspection zoom decision
Compare a global increase to map zoom20 for all sources with per-provider display
limits from the existing basemap registry. Choose per-provider limits: Esri is
already registered to display20/fetch19, but L.map and initial tile prefetch
hard-cap18. Respect that explicit provider limit, retain18 for other sources,
and keep the OSM background visible up to the largest registered display zoom
(fetch capped19). Boundary worker already overzooms bounded source tiles and
actual selected source polygons stay in geographic coordinates. A provider switch
clamps the view to its own limit; URL restore, boundary prefetch and PNG fitting
must agree. Zoom is inspection magnification, not measured source accuracy.

Live z19 tile probes200JPEG/CORS* at user-current point(16,872bytes) and rural
Amahoro(2,521bytes). A delivered tile is not proof of native spatial resolution;
no new countrywide submeter claim. Esri service metadata advertises LODs0–23,
but actual imagery/sampling coverage varies. Keep variable native resolution.

## Source metadata investigation (UI not yet implemented)
Alternatives: retain only current global unknown-date note versus query Esri's
own keyless point metadata at the selection/view location. Live identify metadata
for user-current point reportsSRC_DATE20251214, SRC_RES0.34, SAMP_RES0.3,
SRC_ACC8.47, levels12–19, Vantor/Vivid Advanced. Amahoro reports20250627,
SRC_RES0.34, SAMP_RES0.6,SRC_ACC5, levels12–18,Vantor/Vivid. Dates/resolution/
accuracy fields differ; do not conflate sampling with positional accuracy.
No confidence convention for SRC_ACC verified, so do not interpret as survey
accuracy/probability. Query is metadata only, not extraction/training from pixels.

Before enabling: bounded allowed endpoint/no keys, explicit point scope (not
entire village), dedup/caching and clear mixed/no-data cases, safe typed field/date
parsing, rw/en/fr inspector/PNG/CSV/GeoJSON provenance and stale-request guards.
Do not relabel current Esri image date as selected A/B period or building release
date. No automatic geometry shifts to match Esri without independent controls.

Primary sources accessed2026-11-15:
- https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson
- https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/9?f=pjson
- https://developers.arcgis.com/rest/services-reference/enterprise/identify-map-service/
- https://content.esri.com/learnarcgis/educators/using-global-imagery-basemaps.pdf

Actual metadata probes use identify withgeometry=lon,lat,sr4326,
geometryTypeesriGeometryPoint,layersall:9,10,11,tolerance0,point±.001mapExtent,
imageDisplay1024,1024,96,returnGeometryfalse,returnFieldNametrue,
returnUnformattedValuestrue. Raw nonpersonal research responses under/tmp/rwanda-
esri-{user,Amahoro}-metadata.json; not a dated imagery snapshot/history service.

### Coverage guard discovered before enabling higher zoom
HTTP200 is insufficient: Amahoro's z19 response is a2,521-byte no-data placeholder.
Official tilemap19 reportsdata0 there, versusdata1 at the current Kigali point.
The source MaxMapLevel18 metadata is consistent with this. Do not ship a uniform
19fetchcap at higher map zoom; it would replace rural imagery with a placeholder.
Need a bounded view/tile coverage guard and18parent fallback before enabling19.
Compare per-tile adaptive canvas tiles (best mixed-resolution display but changes
PNG capture) with view-wide tilemap availability (smaller change, use19only when
all visible tiles available, default18). Prefer a view-wide guard initially;
prototype/verify all transitions and export consistency before enabling zoom.

### Implemented coverage guard
Level19tilemap checks are bounded to64×64cells inside/near Rwanda; source cache
bundle boundaries split into<=4nonoverlapping requests, never accept clipped/
partial results as complete. Same-source backend only(no callerURL),32KB response
cap,4s fetch timeout,2workers/16waiting/2squeue,128cached chunks/10min. Browser
check8s; defaultexisting level18 retained on zero/unknown/timeout/failure. Cancel
and restore18on view movement; only current full-view+buffer proof may enable19.
Public API says availability only, no image date/resolution/accuracy guarantee.

Provider-specific map display20 can magnify existing18 imagery in rural coverage;
where all tiles exist it fetches19. OSM background remains visible at20 with fetch
cap19, other active sources keep18display limit. Initial URL/prefetch and map PNG
fit share limits. PNG waits pending coverage before tile readiness; vector outlines
stay actual geographic source shapes. No adaptive image canvas/cropping change.

Live API5×5grids: currentKigali availabletrue; Amahoro availablefalse.43tests pass,
including no-data200response guard, complete bundle splitting and malformed-grid
refusal. Actual browser pan/zoom/export interaction is still unverified because
supplied browser host is unavailable. The point acquisition-date UI remains next.

### Point metadata implementation (2026-11-15)
`/api/imagery/esri-metadata` queries only the fixed official identify endpoint,
with zero tolerance, no historical time parameter and no returned geometry. Input
is restricted to Rwanda, rounded explicitly to five decimal degrees and returned
with the result. Two workers, 16 waiting requests/2s queue deadline, 4s source
fetch, 64KB body, 32 records and 128 cached points/10min bound the work. Identical
pending requests coalesce; failures do not enter the successful cache.

The selected reference point (first corner for drawn areas), rather than the
whole selected polygon, owns this metadata. The inspector displays that coordinate.
No selected point means no metadata lookup. Requests stop on source/point changes
or drawing, with an 8s browser deadline; old point results cannot appear under a
new point. Source/metadata changes invalidate in-progress PNG captures. Metadata
is shared through Workstation to inspector/PNG/CSV/GeoJSON, with rw/en/fr context.
It is separate from Sentinel A/B scenes and building snapshots/release dates.

Only validated YYYYMMDD calendar dates and finite positive numeric resolution
fields are exposed; unknowns stay null. Provider/product text is bounded, rendered
as text and CSV-escaped. Matching source/date/resolution/zoom records from layers
9/10/11 are collapsed. Distinct records are all retained as mixed metadata,
without choosing a preferred acquisition date; empty results are no-data, and
malformed/truncated/error responses are unavailable. Source and sampling resolution
are labelled separately. SRC_ACC remains deliberately omitted because its
confidence convention has not been verified. Point source metadata describes
provider records, not proof that a particular displayed pixel at any zoom uses
that acquisition, nor a countrywide date, native-resolution or positional-accuracy
claim. Explicit UI/export notes explain spatial/zoom variability.

Live local API probes: (-1.946,30.06) returns 2025-12-14, source0.34m,
sampling0.3m, levels12–19; (-2.15605,30.54348) returns2025-06-27,
source0.34m/sampling0.6m, levels12–18. These are metadata observations, not
independent building validation or historical imagery comparisons.
