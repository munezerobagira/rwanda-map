# Features and integration map

Audit: 2026-11-14; baseline `develop` (all text files in `src/` read before edits).

## Existing runtime

Next.js 16.2.6 App Router, React 19, TypeScript, pnpm, Tailwind 4; Leaflet 1.9.
`app/page.tsx` dynamically loads the client-only `Workstation`, which owns view,
selection and basemap/year state. No database, account, analytics or ML service.
`instrumentation.ts` warms a process-local `SpatialStore`. It reads local GeoJSON,
rounds coordinates, computes approximate areas, and lazily builds geojson-vt
indexes. Server routes serve compressed batched JSON tiles, selection geometries,
coordinate resolution and name search. Large boundary files use Git LFS.

| Feature | Owner / shared interface | Integration and limitations |
| --- | --- | --- |
| Map and boundaries | `InteractiveMap`, `BoundaryTiles`, `boundaryTiles.worker`, `tileWorker` | Canvas tiles in a worker; SVG hover/selection; zoom determines province → village tier. Keep worker snapshot support for export. |
| Selection | `Workstation.selectAt`, `selection.ts`, `/api/feature`, `/api/search-coordinate` | One Polygon/MultiPolygon plus point, tier and properties. Shared by focus mask, inspector, breadcrumb and URL. No drawn polygon/rectangle yet. |
| Search/navigation | `SearchBar`, `OverlayCards`, `adminLevels` | Local place names, coordinates, geolocation, ancestor navigation. Correct five local admin names already present. |
| Results | `InspectorPanel` | Area/code, selected point, simulated electricity values, building-analysis placeholder. New analyses must use this panel and shared selection. |
| Layers | `basemaps.ts`, `Sidebar`, `LayerLegend` | Registry generates cards and Leaflet layers. Baseline includes seven providers; audit in data-sources.md. |
| Time | `TimelineScrubber`, `/api/satellite-capabilities` | One annual EOX selector with play/pause; no comparison. Hardcoded fallback years can claim unavailable layers. Daily keyed provider has no functioning date UI. |
| Export | `InteractiveMap.exportMapImage`, `InspectorPanel.exportElementAsPng` | Full-view PNG; polygon-clipped selected PNG with restore-view; inspector PNG via lazy html2canvas. Worker re-renders boundary snapshots. No source credits burned into map PNG; no CSV/GeoJSON. |
| Shareable state | `urlState` | Center/zoom, basemap/year, admin selection point/tier; no language or comparison dates. |
| Language | None | English strings plus local tier subtitles; shared i18n must be introduced before new user-facing capabilities. |
| Mobile/accessibility | Workstation media-query state and floating panels | Collapsible left panel, right inspector, search keyboard support, live announcement; touch target and panel collision checks needed. |
| Legacy stats | `/api/stats`, `SpatialStore` village enrichment | Synthetic electricity numbers; explicitly simulated in inspector but stats endpoint lacks provenance. Not real evidence for planning/valuation. |

## Required common contracts

Extend the existing selection rather than inventing analysis-only geometry. A dated
analysis request holds geometry, selected feature types, source version/date,
comparison periods and locale. Modules return metrics, methodology, confidence,
limitations and map features. Workstation owns results; inspector, map and export
consume that same result object. Source identities and dates belong in cache keys.
Registry entries define sources, method, confidence rules, style and validation.
Derived modules consume other results; unavailable data stays unavailable, not zero.

Keep existing dark tokens, glass panels, icons, layer cards and export buttons.
Do not introduce standalone analysis pages. Add reversible feature flags for
unvalidated analysis and retain existing PNG capture behavior during changes.

## Implemented after baseline audit (2026-11-14)

- `lib/imagery/catalog.ts` queries keyless Earth Search and validates source URLs,
  periods and UTM zones. `render.ts` reads bounded COG windows and reprojects RGB.
  `/api/imagery/scenes` publishes candidate capture/cloud metadata and catalog
  revision; `/api/imagery/tiles` serves bounded, cached, version-keyed WebP tiles.
- Registry now contains dated Sentinel-2 (10m), clearly static EOX 2016 (10m),
  and OSM reference cartography. Missing tiles retain reference streets and show
  an error. A historical fallback never pretends to match the requested period.
- Workstation owns A/B periods, swipe and common `ImagerySnapshot` objects.
  TimelineScrubber now accepts date intervals and same-season year comparisons;
  the second tile layer is clipped within the same map, so all selection/panning
  remains shared. `ImageryDetails` reads those same snapshots in timeline/inspector.
- URL state retains old year links and now includes both intervals, comparison
  toggle and locale. Legacy removed-source links fall back to the compliant map.
- `I18nProvider` adds rw/en/fr switching without recreating selections; major
  existing controls and new comparison copy are translated. Translation coverage
  is still being audited; proper source/place names stay unchanged.
- CSV/GeoJSON export shares selection+snapshots+locale via `selectionExport.ts`.
  Map PNG capture retains worker boundary snapshots and cutout/restore behavior,
  adds swipe clipping and source/period/acquisition-candidate footer. Details PNG
  includes metadata in the same inspector. Missing imagery is marked in exports.
- All browser visual/export/mobile acceptance checks remain pending because the
  provided browser host is unavailable. Eight automated tests and live local
  metadata/current+historical+rural raster requests support backend correctness;
  they do not substitute for visual interaction checks.

## Building analysis integration (implementation underway)

`lib/analysis/types.ts` defines common geometry/date/type → metrics/features
contracts; registry.ts holds source/method/style/validation/confidence rules and
reversible feature flags. Workstation owns enabled types and the dated result;
its hook rejects stale responses on selection/date changes. The same result feeds
AnalysisResults inside the existing inspector, map canvas dots, PNG footer/dots,
and combined CSV/GeoJSON. Analysis selection is restored through the existing URL.

Two immutable project-owned OSM indexes (Jan 2025 / Jan 2026) retain source hashes,
ODbL, mapping timestamps and non-personal attributes only. Runtime reads bounded
z12 gzip tiles with a 24-tile process cache. No public Overpass service is involved.
A source at or before requested date is identified explicitly; missing history
stays unavailable, and the same source version yields no false comparison.
Counts use point-in-footprint inclusion with holes/multipart selection support.
Positive source IDs are ways, negative are relations; ingestion suppresses outer
member ways after assembling a valid building relation.

The UI separates mapped structures, tagged houses, other residential, unknown
and non-residential use. Experimental classification range applies **only to
mapped objects**, is not a total-house estimate or statistical confidence interval,
and is labelled low confidence. Ground-truth accuracy/three-village validation
and drawn-area interactions remain outstanding; do not claim completion.

## Export integrity checkpoint
`lib/imageExport.ts` holds the actual shared canvas renderer, readable wrapped
footer layout and view/source consistency contract. Native-canvas regressions
cover transparent selection holes, worker snapshots, A/B clipping and fractional
DPR pixel preservation. Both PNG download paths reject stale state; map export
uses bounded tile/worker waits and preserves source pixels. Browser interaction
QA is still outstanding and is tracked separately from these renderer tests.

`panelLayout.ts` computes shared map/panel insets from ResizeObserver measurements
of the bottom stack. Timeline layout spans tablet widths, and selection closes
the layer dock below 1200px. The actual browser layout remains an unverified gate.

Raster work uses a bounded process-local `WorkCache`, sharing identical pending
promises before completed caching. Source revision and date are part of the key;
failed jobs clear pending state for retries without multiplying the raster queue.

## Drawn areas (ADR0006; browser QA pending)
Selection now has a bounded `area` variant alongside admin `feature`/`outside`.
Workstation owns the temporary drawing draft and atomically applies canonical
geometry through the same selection/results contract. InteractiveMap provides
noninteractive previews and the existing toolbar starts rectangles/polygons;
DrawingControls supplies Undo/Cancel/Done and keyboard center entry. Cancel
retains the old selection. Drawing hides its old inspector/focus, suppresses admin
resolution, and keeps imagery/time state. Analysis and every export consume the
canonical rounded geometry. URL fragments carry bounded area geometry/creation
date without a new server store; existing admin query links remain supported.
User-created geometry is distinct from source boundary dates and cadastral data.

Active mapped-building inputs now use explicit processing p2: January2025,
January2026 and October2026. Original p1 assets are archived outside runtime.
Source selection reads actual manifest mapping dates, not version-name suffixes.
Results/export/UI carry processing revision; comparisons refuse incompatible
source series or processing revisions. Zero mapped results disclose potential
source omission in the common limitations and all result-export paths. The
three-setting OSM/Overture audit is research evidence, not a production Overture
layer or ground-truth house validation. Largest trace87.19MiB leaves little room
for additional national files until tracing/storage architecture is improved.

2026-11-15 trace fix: six literal boundary readers replace a dynamic filename
under public/data. Asset URLs/data/behavior stay unchanged. Startup and boundary
functions no longer include building indexes; maximum trace falls from87.19 to
51.35MiB. Structural postbuild checks require all needed assets and reject wrong
dependency groups; analysis keeps its active manifests and tiles (37.42MiB).

2026-11-15 user-requested updates: Esri World Imagery is an explicit non-open
reference option, with current attribution and varying capture dates/resolution
(ADR0010). Reference imagery uses TimelineScrubber's building-date controls with
immediate shared A/B state; dated Sentinel imagery retains interval/swipe UI.
Eligible areas analyze by default, inspector has a count toggle, and URL off
state is explicit. Comparison off produces one dated result throughout map and
exports. Missing mapped coverage withholds a house estimate; both-zero snapshots
withhold change. Count comparison never implies historical Esri imagery.

Count marker inspection uses the same AnalysisPointProperties/presentation helper
as source results. Canvas hit targets open safe text popups without replacing
the selected admin/drawn geometry. Source/date/use/footprint-area and point-vs-
outline limits are explicit; colors and export IDs remain shared. Overture now supplies actual source polygon outlines; OSM remains point-only.
Keyboard map-object inspection and browser-host QA are still outstanding.


Explicit buildingSource (osm/overture) belongs to the shared Workstation and URL.
Each source owns available dates; switching sources resets A/B to those dates,
never mixes source series or adds their counts. Independent buildingsVisible
controls the map/PNG overlay while analysis/CSV/GeoJSON retain the same results.
Common countBuildings helpers are Node-free; adapters own data access. Overture
bundles only dated manifests, loading hash-verified project-owned static objects
through fixed deployment origins. Complete count points stay authoritative;
optional all-selected-ID source polygons are for inspection, with an explicit
unavailable/budget fallback. PNG and GeoJSON use these actual shapes; CSV includes
source/license/attribution/status/public derivative-data index URL. One source
release's geometry is never assumed identical solely from equal count points.

Esri can be inspected at display zoom20; level19 raster fetching requires a
complete positive provider tilemap check for the current buffered view. A map
move cancels stale checks and restores existing level18 detail, including when
Esri returns a successful JPEG no-data placeholder. Source-bundle clipping is
handled explicitly. URL prefetch, provider switches and PNG fitting share zoom
limits; PNG waits a bounded pending coverage check. Other basemaps retain18.
This magnification/coverage guard is independent of count accuracy or image dates.

Point-scoped Esri context (ADR0014): Workstation owns `EsriPointMetadata` for the
selected reference point while Esri is active. A fixed-source, Rwanda-bounded
identify route coalesces/caches bounded metadata requests. The client rejects
stale points/source requests; inspector and both PNG paths use the same localized
presentation, and CSV/GeoJSON retain separate point/source/acquisition/resolution/
sampling/zoom/status provenance. Unknown/mixed/failure cases remain explicit.
Nothing assigns this date to the entire village, a selected building period or
the exact visible pixels at all zooms. SRC_ACC is omitted; no accuracy claim.
