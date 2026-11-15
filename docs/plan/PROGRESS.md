# Progress / resume record

Updated: 2026-11-14. Active branch `feat/rwanda-land-intelligence`, off develop.
Initial audit commit `0b500a9`. No push, deployment or PR. Goal remains active;
user requests continuing improvement until explicitly stopped.

## Completed
- Read repo instructions/package/all src before changes; recovered and SHA-256
  verified all 12 Git LFS boundary files. Configured local git-lfs filter paths.
- Initial feature integration/URL/resolution/rights audit, real README, checklist,
  ADRs, scored ideas; fixed 28 pre-existing lint errors without weakening rules.
- Phase 1 implementation: keyless 10m Sentinel COG rendering inside Next/TS,
  bounded queues/ranges/windows/cache and strict public-source allowlist.
- Removed Esri, keyed Sentinel Hub, noncommercial recent EOX, night-lights,
  unverified terrain and CARTO. EOX 2016 is explicitly static; OSM reference
  remains visible during imagery failure with a warning.
- Shared A/B date periods and catalog revision in URL/cache, swipe on the same
  map, scene acquisition/cloud provenance, rw/en/fr context and language control.
- Shared CSV/GeoJSON exports reuse selected geometry + dated imagery snapshots;
  PNG capture extended with swipe clipping and source/date/warning footer.
- Eight tests pass (selection/search/tiles/URLs, dates/leap years, source allowlist,
  partial-grid regression, route validation, per-date/language exports). Lint and
  typecheck clean, production build passed; rerun after any further edits.
- Live server resolves Ishema village for Kigali; app renderer returns usable
  current/rural/historical PNGs. Source probes and caveats in research/imagery.md.

## Critical validation gaps / blockers
- Browser host unavailable via cua_repl. **No visual-pass claim**: mobile panels,
  swipe during pan/zoom, and actual PNG/CSV/GeoJSON downloads need browser QA.
  Keep Phase 1 full acceptance unchecked; continue independent work.
- Existing boundary license/source/effective date unknown (14,823 villages; local
  assets have no provenance metadata). UI/exports mark this; not cadastral data.
- No validated house counts yet. Sentinel-2 is too coarse for individual houses.
  Do not mistake this imagery work for completing the primary milestone.
- Legacy synthetic electricity placeholders still exist and are visibly labelled
  simulated. They must never be inputs to planning/valuation.
- No local ground-truth house labels; never fabricate precision/recall.

## Next steps
1. Finish Phase 1 live/backend/performance checks and code review; commit only
   after tests/lint/typecheck/build pass. Visual acceptance remains blocked.
2. Phase 2 deep research of OSM/Overture/Google/Microsoft footprints, Rwanda
   licensing/coverage/history and bounded serving options; write comparative ADR
   before implementing common dated feature-registry + analysis interfaces.
3. Reuse one selection, inspector/highlight layers, locale and export model for
   polygon/rectangle + selected-village building/house estimates. Explicitly
   separate mapped buildings vs estimated residential structures and data gaps.
4. Continue checklist phases, dataset/legal research, validation and improvements.

## Environment / operations
Node runtime PATH:
`/home/mbx_001/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.
Git LFS binary `/tmp/rwanda-git-lfs/usr/bin/git-lfs` (installed from Ubuntu package);
include `/tmp/rwanda-git-lfs/usr/bin` in PATH for commit hooks. Do not stage raw
LFS payloads without the clean filter. Git author now uses Sostene Munezero Bagira <munezerobagira@gmail.com>
with explicit user authorization (2026-11-15). pnpm is the package manager.
Dev server localhost:3000, log `/tmp/rwanda-dev.log`; build log
`/tmp/rwanda-phase1-build.log`. Public requests tested with correct certificate
validation; Copernicus mosaic entry point TLS error was not bypassed.

- Historical Kigali check exposed low-cloud slivers crowding full scenes out of
  the first catalog page; added nodata<50 filter and catalog schema v2. Rerun
  historical test succeeded (200 PNG, 4.4s cold); all final checks rerunning before commit.

## Phase 2 research underway
- Imagery implementation committed as `31c9661`, all 8 tests/lint/typecheck/build
  passed. Full visual acceptance remains unchecked.
- Avoid public Overpass production backend: upstream manual discourages non-mapper
  apps depending on it; 3 small sequential live probes timed out (~22s each).
- Avoid Overture inspection PMTiles in production: official docs explicitly warn.
  Evaluate project-owned indexes from public GeoParquet or Geofabrik snapshots.
- Downloaded World Bank CC BY 4.0 village archive; 14,815 TM_Rwanda shapes vs repo
  14,823 means source equivalence is NOT established. NISR 2022 layer id 3 has no
  dwelling fields; inspect license item metadata. Documented in buildings.md.
- Temporary GIS ingestion env (Python 3.12 + pyshp/osmium) is isolated under
  `/tmp/rwanda-data/runtime-venv`; no production language switch. PBF snapshot
  downloads to `/tmp/rwanda-data` underway; do not commit big unreviewed raw files.
- Rejected public-looking Kigali SPARC service after item terms explicitly state
  confidential/pilot-only/no redistribution. Queried metadata/schema only; do not
  ingest its records or parcel IDs. Eligible historical EO4Kigali derived polygon
  research data found at Zenodo 3239271 (CC BY 4.0); inspect codebook next.
- OAM per-image audit found no eligible Rwanda high-res imagery: CC-BY drone
  images outside Rwanda; intersecting Maxar scenes NC; 14.68m radar rejected.
- OSM Jan 2025/2026 extracts verified by header timestamps/SHA-256. ~0.99m/~1.17m
  building-tagged ways; most unknown use. House/residential tag redistribution
  proves raw tag changes cannot be called housing construction.
- Display compression benchmark: PNG 206,273 bytes vs WebP90 39,176 bytes (~81%
  reduction); implementation under ADR0003 pending live/header/checks/commit.

- Mobile/deploy improvement verified: real WebP response 39,176 bytes vs original
  PNG 206,273 (~81% reduction); alpha retained. Boundary route production trace
  reduced from 238.1MiB to 51.35MiB and still includes all six required assets.
  Prebuild validates real GeoJSON (fails clearly on missing Git LFS hydration).
  All 8 tests, lint, typecheck and build pass after changes.
- First offline OSM ingest completed: Jan 2025 produces 987,365 point records,
  260 z12 tiles, 10,232,454 compressed bytes. Data is still under /tmp pending
  fixture tests and serving design; no national raw inputs to be committed.

## Current uncommitted counting implementation
- Added offline `scripts/ingest-osm-buildings.py` and a Python fixture test that
  verifies multipolygon/outer-way dedup, hole-safe representative points, no
  private tags, and source SHA-256 mismatch rejection. Fixture passes in the
  isolated /tmp/rwanda-data/runtime-venv environment.
- Jan 2025/2026 derived indexes copied into public/data/buildings (260/267 z12
  files, 10.23MB/12.08MB compressed). `.gitattributes` marks .json.gz for LFS.
  No raw national PBFs are committed. Build validation verifies row schema/hashes.
- Common registry/types + bounded Node snapshot store + /api/analysis implemented.
  Workstation/shared inspector/map dots/PNG/CSV/GeoJSON/URL/rw-en-fr wired up.
- Ishema live API returns 193 mapped structures (Jan 2026) vs 192 (Jan 2025),
  with tagged-house/unknown/non-residential breakdown and wide experimental
  classification range. Independent Shapely check reproduces both counts.
  This verifies spatial tally integration, NOT actual-house accuracy.
- 13 TypeScript tests pass; fixed one follow-on type error in export feature IDs.
  Run final typecheck/lint/build after remaining fixes before any commit.
- Current focus: finish data/export/regression checks, inspect production trace
  size with derived indexes, update source docs and commit. Visual browser QA
  still blocked; drawn polygon/rectangle + independent house validation not done.

- All 13 TypeScript tests + 1 Python ingestion fixture now pass, as do lint and
  typecheck. Offline boundary `--check` verifies all archived originals without
  regenerating/changing current geometries. Final build and all pre/postbuild asset/trace checks pass before commit.
- Found and fixed a shared-startup packaging gap: Next16 did not apply route
  exclusions to standalone instrumentation. Archived 6 original inputs under
  data/raw-boundaries, extracted pure helpers and explicit offline regeneration;
  runtime now uses prebuild-validated computed assets only. Latest production
  trace budget guard passes across every route/startup entry, maximum 72.71MiB.
- Rechecked browser tool: still no browsers/apps; host unavailable. All actual
  interaction/download/mobile QA remains pending. No claim of 3-village physical
  house accuracy; validation report explicitly distinguishes tally checks.
- Next after this commit: address export footer/readability and mobile panel
  reservations, add rectangle/polygon selection through the shared selection
  model, continue Overture/Google/local validation research. Overture Python
  client installation under /tmp is research-only and not a production dependency.

## Export integration iteration (after 4ad99e8)
- Counting/index/packaging work committed as 4ad99e8.
- Extracted actual shared canvas drawing and tested selected alpha/holes, worker
  boundaries, A/B swipe, readable wrapped provenance, exact source pixels at
  fractional device scale, and stale capture guards (7 new regressions).
- Map captures reject unfinished tiles/worker deadlines and cancel on interaction
  or source/date/selection/view changes; inspector uses the same safe PNG/blob
  download helpers. Footer includes localized count method/date/confidence.
- 20 TypeScript tests, lint and typecheck passed; production build/asset and whole
  trace checks passed (72.71MiB maximum). One final post-encoding guard added;
  all checks rerun and pass before commit. Actual browser QA still blocked by missing host.
- Next: measured bottom-stack reservations, duplicate raster promise coalescing,
  then drawn geometry through shared selection and further source validation.

## Adaptive panel iteration (after 0ca4158)
- Export checkpoint committed as 0ca4158 with all 20 tests/lint/types/build passing.
- Replaced guessed timeline heights with ResizeObserver measurement of the real
  error/timeline/breadcrumb stack. Map fit padding/controls, layer dock and
  inspector consume the same measured reservation.
- Tablet timeline spans the viewport instead of squeezing between both docks;
  selecting an area below 1200px closes layers, which can be reopened explicitly.
- 22 tests pass including a dock/viewport/measured-size matrix and tablet widths.
  Typecheck/lint pass; local home responds HTTP200. Production build/asset validation and whole-trace budget pass (72.71MiB max).
  Browser-host gap still prevents any claimed visual/mobile interaction approval.
- Next: collapse identical pending raster work, then drawn-area selection.

## Raster coalescing checkpoint
- Adaptive panels committed as 56d19dc; all tests/lint/types/build passed.
- Actual raster route now shares pending promises keyed by rendition, source
  revision, requested period and tile. Preserves 2 workers/24 queued/15s queue
  deadline/20s render deadline/64 completed tiles/1h TTL. Failures clear state.
- 26 tests, lint/types/build and trace checks pass. Concurrent local real Kigali
  requests each return HTTP200, identical 39,176-byte WebP in ~8.7s cold; unit
  instrumentation proves 41 identical callers execute only one raster job.
- Next: rectangle/polygon drawing integrated through selection/results/time/
  exports/i18n/URL, using bounded coordinates and explicit non-cadastral labels.

## Drawn-area integration in progress (after 9e6ca99)
- Raster coalescing committed as 9e6ca99 with all 26 tests/checks passing.
- ADR0006 compares native bounded Leaflet drawing vs Leaflet.draw and URL fragment
  sharing vs no-sharing/server storage, with official sources/access dates.
- Added area selection variant (no fake admin tier), two-corner rectangles and
  tap polygons, Undo/Cancel/Done plus keyboard map-center entry. Prior selection
  remains available on cancel. Drafts hide old inspector/focus until applied.
- Five-decimal canonical geometry (approx. metre scale), 64 vertices/50km² cap,
  invalid/crossed/out-of-bounds rejection. Common validator now rejects collinear
  self-touching segments too. User-drawn/non-cadastral method/date disclosed.
- Shared analysis, focus, imagery/time comparison, rw/en/fr, inspector PNG, map
  PNG, CSV/GeoJSON and URL fragment all use the same geometry. Fragment sharing
  discloses its geometry; no new server persistence or owner data.
- 29 tests passed, including drawn-shape canonicalization, two dated real source
  results, all locale exports, invalid inputs, legacy links and fragment restore.
  Latest 29 tests/lint/typecheck/build and asset/trace checks pass after final labels/keyboard additions (72.71MiB maximum).
- Local rounded Kigali 0.1112151km² area: Jan2026 mapped37 vs Jan2025 mapped41;
  HTTP200 in0.123s. This is mapping-dataset change, not verified demolition, and
  not house ground truth. Browser host still missing; touch/keyboard/PNG/manual
  QA remains an explicit blocker, not silently marked passed.
- Next: finish drawn checkpoint, compare open Overture coverage on small samples,
  then prioritize source completeness and official boundary rights/history.

## Source-freshness audit after 734cdd3
- Drawn-area checkpoint committed734cdd3. 29 tests/lint/types/build/trace checks pass.
- Overture official anonymous client works on tiny selected area:96 bbox records,
 82 point-on-surface inside (66 OSM/13 Google/3 Microsoft). Most unknown use.
 Not a house count/ground truth; Jan2026 OSM vs Oct2026 Overture is unequal dates.
- Important source-policy finding: Overture now removes public release geometry
 after60 days. Historical release notes do NOT imply downloadable old data.
- Promoted recent OSM snapshot freshness and cross-source/lifecycle audit. Added
 four scored iteration3 ideas. Downloading immutable Oct1 OSM extract for a fairer
 source-era comparison; Sept2026 Overture probe running. No production Overture
 integration or claims of improved physical-house accuracy yet.

## Fresh-source checkpoint before commit
- Added immutable October1,2026 OSM source, SHA256 verified and header retained.
  P2 active snapshots Jan2025/Jan2026/Oct2026 total3,615,441 derived points.
  Recent index1,461,775 records/15,145,287 gzip bytes;3 invalid geometries skipped.
- Lifecycle fixtures now retain standing disused buildings as unknown use.
  Processing p2 is explicit in version IDs/manifests/results/CSV/UI; cross-source
  or cross-processing comparisons are withheld. January point rows unchanged.
- Archived p1 outside runtime (LFS preserved) rather than overwrite them. Prebuild
  uses the region pack; postbuild rejects archived indexes in every server trace.
- Independent same-selection Shapely/source audit: Ishema254/Overture476,
  Nyakarambi289/669, Nyakarekare0/390 for Oct2026 source-era data. Overture
  Sep/Oct selected totals equal; not evidence of no real construction. Unknown
  use/source dependence/geometry dates prohibit any accuracy inference.
- Zero mapped result now explicitly warns that the source may omit the area;
  inspector/map PNG and CSV/GeoJSON share that limitation and low confidence.
- 31 TS tests +2 Python fixtures, lint/typecheck/build/asset+trace guards pass.
  Largest trace87.19MiB/100MiB. Live API3 samples HTTP200 in0.847/0.574/0.041s.
  Browser pointer/touch/keyboard/download acceptance still blocked by absent host.
- Next priority: architecture/trace isolation before adding larger Overture
  derived coverage. Only12.81MiB headroom remains because broad boundary file
  tracing includes building data. Inspect minimal literal asset paths/separate
  static directory vs remote object storage/PMTiles; record >=2 alternatives.
  Continue licensed boundary provenance/migration and real house validation.

## Trace isolation checkpoint (2026-11-15, after cf51c39)
- Recent OSM/processing/data audit committed cf51c39. User requested a test URL;
  checked local home HTTP200 and supplied http://localhost:3000, clearly saying
  public rwanda-map.vercel.app has not received these changes. Work continues.
- ADR0008 compared exclusions, explicit literal readers, directory moves and new
  storage. Six explicit file readers fix tracer over-inclusion without moving
  active URLs/data or changing any map/API/selection/time/export behavior.
- Measured maximum trace drops87.19→51.35MiB (~41%); instrumentation now49.81MiB
  and has no building indexes, analysis37.42MiB still includes every active tile.
- Postbuild now verifies six required boundary assets in boundary/startup traces,
  absence of building data there, and presence of every active analysis manifest/
  tile; archived/raw assets remain forbidden.31 tests/lint/typecheck/build pass.
  Live coordinate/name APIs return expected Ishema data. Browser host gap remains.
- Next: commit checked trace fix, finish architecture alternatives/storage/cost
  ADR from official sources, prototype minimized national Overture indexing and
  content-addressed tile dedup if measurements justify it. No production switch.
- Hosting research correction: official June29,2026 Vercel changelog introduced
  optional5GB Fluid large-function beta; older cached docs still cite250MB.
  Do not describe250MB as a universal current limit or assume this deployment's
  beta/Fluid settings. Keep our own100MiB budget irrespective of provider maximum.

## Current user steering: Esri + count comparison (2026-11-15)
- User explicitly asked to restore Esri; restored original anonymous tiles as a
  specific exception to previous source constraints (ADR0010), preserving dated
  Sentinel imagery. Live service credits now name Vantor, not old Maxar; credits
  burned into PNGs, variable resolution/date clearly disclosed, no fake Esri A/B.
- User then reported house-count comparison not working and requested both
  comparison/non-comparison modes. Current user village (-2.15605,30.54348)
  has0 OSM points at both dates, earlier cell(-2.07736,30.10657) has300 vs285.
- Fixed discoverability: eligible selections automatically analyze (default),
  explicit count toggle in inspector, explicit analysis=off URL preference.
  Esri/reference timeline now shows immediate mapping-date selects and compare
  checkbox independently of imagery. Comparison off sends1 date and removes B
  and delta from results/map/exports. Actual available snapshots are selectable.
- Zero mapped structures show unavailable house estimate rather than a fake
  zero-house claim. Both-zero comparison is withheld, low-confidence/coverage
  warning remains. Larger-than50km² selections do not send invalid requests.
- Added four regression tests: rendered Esri count controls(one/two date), actual
  user cell300/285 + toggling on/off/on + rw/en/fr CSV/GeoJSON, user village
  missing coverage, Esri explicit off preference reload.35 tests/lint/types pass;
  production build/asset/trace checks also pass after final fallback credits (51.35MiB max).
- Browser host still unavailable even though ambient in-app tab exists; getTab
  returned host-unavailable. No pointer/touch/actual download QA claimed.
- Supplied user a comparison-enabled local link to their earlier populated cell.
  Public deployment not updated. Continue improving source coverage after this
  fix: current rural village needs an additional open footprint source; no
  invented count or Esri-based ML/ground-truth use is permitted by restoration.
- Uncommitted ADR0009 architecture/cost document also prepared from official
  sources; it is separate background mission work. Next: finish checks/commit,
  prototype minimized nationwide Overture data and safe two-version storage.

## Latest committed user fixes and next coverage work
- Esri + explicit one/two-date counting fix committed6c4bbf0.35 tests/lint/types/
  build pass, max trace51.35MiB. No production deployment. User can test local.
- Amahoro(village at-2.15605,30.54348) has0 OSM points, but an anonymous Overture
  Oct2026 bbox download yields973 representatives inside the exact selection
  (849 Google Open Buildings/124 Microsoft ML; all residential subtype unknown).
  This explains the coverage problem; it is not a verified973-house estimate.
- Next: prototype national Overture min-attribute tiles and2 dated versions,
  retaining source choice and no mixed-source growth. Research country clipping
  with an explicitly licensed boundary (World Bank2012 districts candidate).
- geoBoundaries RWA ADM0 API reports CC BY4 but an unusual Sentinel-LULC source;
  do not silently treat that mask as authoritative political boundary. World
  Bank village archive checked fields/codes/ITRF2005 TM_Rwanda projection; can
  support a separate reviewed licensed-boundary migration later. Current runtime
  boundary license/date still explicitly unresolved, never relabel it.

## Accuracy/visibility steering in progress
- User says the count is far off and wants highest possible accuracy and a way
  to inspect it, especially on Esri. Explained current footprint lookup can miss
  visible roofs and include non-houses; no measured accuracy is claimed.
- Added tap/click inspection on current colored records: source ID/version/date,
  use, footprint area and explicit point-not-roof-outline/low-confidence note.
  Uses text DOM, suppresses administrative reselection, shares existing colors/
  data/export IDs, translated rw/en/fr and dark map styling. ADR0013.36 tests/
  lint/types/build/asset and trace guards pass(51.35MiB max). Actual pointer host unavailable.
- National anonymous Overture prototype is running (session80771). Script
  /tmp/rwanda-data/probe-overture-index.py, log/tmp/rwanda-overture-national-probe.log,
  output/tmp/rwanda-data/overture-prototype/2026-10-21.0. No runtime source switch.
  Projection only id/geometry/subtype/class/sources; names/addresses never kept.
  Writes minimized point rows+actual polygon coordinates to SQLite and later
  gzip z12 point tiles, preserving full source IDs and existence confidence.
- Country mask research: downloaded World Bank CC BY4 district archive
  https://datacatalogfiles.worldbank.org/ddh-published/0041453/1/DR0051757/rwa_district.zip;
 30 valid district polygons in ITRF2005 TM_Rwanda dissolved/transformed to WGS84.
 Mask/tmp/rwanda-data/country-mask-wb2012.geojson (explicit2012 provenance),
 ~24,306km² district/land coverage. This is a research clip, not a cadastral or
 silently relabelled current runtime boundary. Original runtime rights unresolved.
- Prototype uses pinned overturemaps2.1.1 private query preparation (inspected:
 anonymous=True S3) with projected PyArrow columns/8,192-row batches, bbox STAC
 prunes to5 files, then exact country-mask point filtering. At206s:3.10m bbox
 source rows,1.76m accepted,1.34m neighbors filtered. Source fields all unknown
 residential in Amahoro; confidence is footprint existence, never house accuracy.
- Next after prototype: measure point/geometry size, derive content-addressed
 z14 outline tiles (outside server query traces), check identical tile reuse
 between accessible Sep23/Oct21 releases; retain explicit source series, actual
 date controls and shared selected IDs. No lossy ID hashing, fake footprints,
 additive source totals, or mixed-source growth. Need actual outline PNG/GeoJSON
 integration and independent lawful time-matched validation before enabling.

### 2026-11-15 — Broader national source and inspectable outlines in progress
- October Overture national scan complete:5,727,334 point records,183,747,914
  compressed point bytes+307,302,577 actual outline bytes. Keep OSM default,
  explicit Overture source selector/date family/URL and show-hide map overlay.
  957OVT vs66OSM for user's latest village,973vs0 in Amahoro; every OVT selected
  record has an actual source Polygon/MultiPolygon in live local API probes.
  These are source coverage differences, not measured house accuracy.
- Implemented source adapter/common counting helper, bounded hash-verified static
  asset reads outside function traces, fallback count-only outline status,
  source/date/use inspection, shared actual-outline PNG and GeoJSON rendering,
  CSV provenance and rw/en/fr controls.41 TS tests pass before final review;
  all national immutable assets validation/build not yet completed. No commit yet.
- October source manifest/assets currently enabled locally. September importer
  running session53977, log/tmp/rwanda-overture-september.log, output
  /tmp/rwanda-data/overture-prototype/2026-09-23.1; last~5.5m scanned/~3.6m accepted.
  Once complete run scripts/package-overture.py into existing
  /tmp/rwanda-data/overture-packaged (hash reuse), copy only new objects into
  public/data/footprints/objects, add Septmanifest to src/lib/analysis/footprints,
  import in overture.ts beforeOctober and add region.overtureSnapshots entry.
  Then check date comparison/off/on and unique static bytes vs850MiB budget.
- October packager completed session53053. National validation running58800.
  Next: review API/export limitations, two-source date tests, lint/types/build,
  trace isolation, independent sample checks; document/reproduce pipeline and commit.
- Browser retry again returned host unavailable; actual map alignment/click/touch/
  screenshot/download QA still unavailable. No browser checks claimed.
- EO4Kigali historical dataset inspected:CC BY4,2008–09/2015 central Kigali,
  224657 unionfeatures. Primary paper says archetypes morphological, not use;
  many Basic footprints modelled/split at75.2m² steps(Model=1), not real delineations.
  Thus cannot be current/rural/house-use truth or assumed exact polygons.
  Article https://www.mdpi.com/2306-5729/4/3/105 and
  https://zenodo.org/records/3239271 accessed2026-11-15. ZIP MD5
  dcd1af66652c4589cd5f1a2af7b7fcbb. No measured current precision/recall yet.
- September completed: identical5,727,334 point AND geometry records.4,293 objects
  reused100%; both dated manifests enabled. Comparison returns0 dataset change,
  never zero-construction evidence.2-date and off/on API/export fixtures pass;
 4,005records/date dense polygon returns explicit count-only outline budget
  fallback2.74MB, larger dense query413 instead of incomplete export.
- Private local Esri/source inspection render created using actual drawMapCapture:
  /home/mbx_001/.codex/artifacts/rwanda-map/esri-overture-inspection-2026-11-15.png.
  Shared image with user; many outlines can be visually checked against roofs,
  no accuracy metric or browser screenshot claimed. Not committed Esri pixels.
- Public ODbL derivative indexes/README and WB2012 credits now accompany exports.
  Pinned offline packager fixture(1 vs2 workers, geometry-only edit/hash, invalid
  geometry refusal) passes.41 TS tests/lint/types and first production build pass;
  final rerun pending following CSV/PNG credits, source URL and two-date additions.
- Final data/source-date/export checks now pass:41 TS tests, offline packaging
  fixture, lint/types, public/runtime manifest equality and all active national
  point/outline hashes. Two-date build passes maximum51.35MiB function trace,
  468.30MiB static source objects (all reused between dates). No deploy/push.
  Final cache-LRU correction build rerun in70276; then commit this integrated
  source/outlines feature. Native Esri inspection zoom is a next candidate:
  provider allows19 but map hard-caps18, so investigate without claiming extra
  source accuracy or zoom-as-native-resolution. Still no current ground truth.

### 2026-11-15 — 79260d1 saved; closer Esri inspection/context
- Committed integrated Overture source/outlines feature79260d1. Working tree was
  clean.41TS tests+offline packaging fixture, lint/types/build and national/trace
  guards passed. Final51.35MiB largest function;468.30MiB immutable objects reused
  across both source dates. No push/deploy; local preview remains3000.
- New ADR0014 compares global vs provider-specific zoom and metadata alternatives.
  Found map hard-cap18 despite Esri registry display20/fetch19. Implemented
  per-provider map/prefetch/export limits; OSM background remains visible to20,
  fetchcap19. Other active map sources keep18. Boundary worker already overzooms
  bounded server tiles; source accuracy remains variable/unvalidated.
- Live z19 Esri user/rural probes200JPEG/CORS*. Metadata-only identify at current
  point reports2025-12-14,SRC_RES0.34,SAMP_RES0.3,SRC_ACC8.47,levels12–19;
  Amahoro2025-06-27,0.34/0.6/5,levels12–18. No confidence convention for SRC_ACC
  verified. Do not infer native/positional accuracy from zoom or pixel spacing.
- Next: finish zoom regression/build checks and small commit. Then implement
  bounded point-scoped Esri metadata in common imagery/result/export context
  (ADR0014 criteria), preserving unknown/mixed cases, date semantics and no-ML-
  extraction scope. Browser host unavailable; higher zoom actual UI QA pending.
- Coverage preflight caught a real zoom regression: Amahoro19returns200JPEG but
  contains a gray no-data placeholder; official tilemapdata0 vs currentKigali1.
  Higher-zoom code reverted before commit/enable; current working preview keeps
  cap18 while coverage guard is built. ADR0014 amended with view-wide tilemap
  guard vs per-tile adaptive-canvas alternative. Do not infer coverage from200.
- Guard now implemented and enabled: official tilemap level19<=64×64, split at
 128cache-bundle borders, exact complete-data parsing; fixed-source API with2
  workers/16queue/4sfetch/32KBbody/10mincache. Client cancels on pan and resets18,
  raises19onlyafter full current view+buffer confirmation, retains18on any failure.
  Closer display20allowed forEsri; OSMunderlay fetch19/display20; other map18.
  URL prefetch/map/PNG limits agree, PNG waits pending coverage before tiles.
- Live currentKigali5×5true and Amahoro5×5false;43 tests pass. Type/lint running
 43243/40957; final build next. Source-date context metadata UI not implemented
  yet; the researched source acquisition dates remain distinct from A/B dates.
- Coverage guard final checks passed:43 tests, lint, types and production build;
  new coverage route does not pull national assets into functions, max51.35MiB.
  Browser/client cancellation uses ordinary AbortController+timer for broader
  browser support; no requirement for client AbortSignal.any/timeout. Preview200.
  Metadata UI remains researched/pending, not claimed delivered. Save this small
  zoom/guard change next; public production and remote branch still unchanged.
- Final guard checkpoint: production build44578 passed after ordinary browser
  abort/timer change; lint/types,43 automated regressions, live positive/negative
  coverage probes and51.35MiB function guard pass. Guard/zoom implementation ready
  for review at local3000; browser interaction gate remains unverified. Next
  scoped work is point-scoped Esri acquisition-date/resolution metadata (ADR0014),
  plus independent current house/footprint validation. Do not mark accuracy or
  full original mission complete. Goal state read asusageLimited; no status reset.


### 2026-11-15 — selected-point Esri metadata and Git identity
- Read current AGENTS/PROGRESS/CHECKLIST/features and installed Next route guide.
  Implemented ADR0014 point metadata in shared Workstation/inspector/map PNG,
  details PNG, CSV/GeoJSON with rw/en/fr context. Separate provider acquisition,
  source resolution, sampling resolution and zoom range; omit SRC_ACC. Neither
  building A/B dates nor polygon-wide imagery dates are inferred.
- Fixed official endpoint only; Rwanda point bounds/5-decimal coordinates,
  2workers/16waiting/2squeue/4sfetch/64KBbody/32records/128cached points/10min.
  Deduplicate matching layers, preserve mixed records, null unknown fields,
  explicit loading/no-data/unavailable states. Client abort/deadline and key
  checks prevent stale point results; metadata changes invalidate PNG captures.
- All46 tests pass, including new parser/route/coalescing/budget/retry/three-locale
  export checks. Typecheck/lint and final production build pass, including all
  national hashes and51.35MiB maximum function trace.
  Live API200: Kigali(-1.946,30.06) date2025-12-14,0.34m source/0.3m sampling;
  eastern point(-2.15605,30.54348)2025-06-27,0.34m/0.6m;
  rural(-1.607,29.68)2024-08-04,0.5m/0.6m. Metadata is provider context,
  not independent building/house validation or a guarantee for each visible pixel.
- Restarted preview from canonical /srv/projects/rwanda-map after the symlink-era
  Turbopack process failed; moved old development cache to
  /tmp/rwanda-next-dev-before-canonical-20261115 and restarted with fresh cache.
  Home and metadata route respond200; preview log /tmp/rwanda-shared-preview.log.
  Browser inventory still empty
  with access-host-unavailable error. Mobile/pan/zoom/download QA remains pending.
- User explicitly approved replacing existing unpushed Codex authors. Updated all
  14feature commits' author AND committer to Sostene Munezero Bagira
  <munezerobagira@gmail.com>, preserving message/date/tree. Local recovery ref:
  refs/backup/before-author-update-2026-11-15. Old progress hashes above refer to
  that preserved history; former e1ce402 is now159f903;79260d1 is nowc5b451f.
  Local config uses this identity; current account had no global Git config or
  global Codex identity to remove. No other system account's settings changed.
- GitHub CLI has no signed-in account. User declined device authorization;
  cancelled login and keep work local. Do not restart sign-in or push unless the
  user asks again. No deployment performed.
- Metadata checkpoint verified and ready for local commit. Push only if user
  later authorizes sign-in/push. Independent ground truth for urban,
  peri-urban/rural precision/recall and browser QA remain separate open gates.
