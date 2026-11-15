# Delivery checklist

Source of truth. Each task must pass lint, typecheck, build and appropriate tests
before its commit. Never tick research or validation based on guesses.

## Foundation
- [x] Read AGENTS.md, CLAUDE.md, package.json and all src text before edits; clone develop and create feature branch. Integration: entire app. Done when audit maps every existing feature; time gaps explicitly recorded.
- [x] Write architecture/features.md, this checklist and PROGRESS.md. Integration: selection/layers/results/export/i18n/state. Done when baseline and required contracts are documented, including date dimension.
- [x] Audit every external code URL and native imagery resolution. Integration: layers/export. Done when data-sources.md has license, key, resolution, update/archive/credits and dispositions; manual check every registered layer against audit.
- [x] Restore a clean verification baseline without weakening lint. Integration: existing selection/search/tiles/export. Done when regression fixtures, lint, typecheck, production build pass; time: preserve URL/year behavior in tests.
- [ ] Recover LFS data and document boundary provenance/license. Integration: selection/search/analysis/export. Done when running server resolves real villages and source rights/date are recorded or visibly marked unknown; time: do not imply historical boundary snapshots.

## Phase 1 — reliable open imagery
- [x] Research two or more compliant alternatives; test real Kigali and rural requests and document latency/resolution/cloud/license. Integration: basemap registry/timeline/export. Done when primary/fallback decision has evidence and archive coverage; reject >10m before testing.
- [x] Remove keyed, coarse and non-open providers. Integration: layer cards/URL restore/map/PNG. Done when no forbidden source remains active and regression tests cover old links; time: do not manufacture dates for timeless layers.
- [ ] Wire dated imagery with honest acquisition/cloud metadata, fallback/error and comparison. Integration: shared timeline/selection/map/layers/i18n/PNG. Done when two periods swipe or compare at synced view, failures display clearly, and map/selected/comparison exports manually pass desktop/mobile.

## Phase 2 — selected-area house estimates
- [ ] Compare OSM, Google Open Buildings, Microsoft, Overture and openly licensed high-res ML. Integration: shared analysis registry/results/layers. Done when Rwanda coverage/license/version/history and serving costs are verified; time: distinguish dataset changes from construction.
- [ ] Introduce shared i18n (rw/en/fr), region configuration, date-aware analysis contract and feature flags. Integration: every existing panel/control/export. Done when switching languages preserves selection/dates/results and exports use the same result model; tests cover this integration.
- [ ] Add polygon/rectangle selection beside existing admin selection. Integration: focus/results/export/URL. Implemented behind drawnSelection flag with canonical geometry, shared time/results/exports and fragment links; automated tests pass. Still pending actual touch/keyboard/PNG checks. Done when holes/multipart boundaries and mobile drawing are verified; time: selection remains fixed across periods.
- [ ] Implement bounded building and estimated-house analysis with two source snapshots. Integration: current selection/inspector/highlights/CSV/GeoJSON/PNG. Done when no unsupported exact-house claim, area/density/method/date/confidence visible and per-date exports/tests pass.
- [ ] Validate urban, peri-urban and rural Rwanda samples. Integration: confidence rules/imagery/selection. Done when licensed high-res ground truth supports independently hand-labelled precision, recall and count errors; document blocked samples rather than fabricate labels. Time: verify changes against imagery.

## Phase 3 — architecture
- [ ] ADRs compare Next/TS vs worker/backend; Leaflet vs MapLibre; static PMTiles vs DuckDB/PostGIS; date-version storage/cache/costs and migration. Integration: all current contracts/export. Done when Vercel limits and measured memory/transfer inform smallest deployable option; historical costs included.

## Phase 4 — planning and suitability
- [ ] Research and score official Rwanda and global sources (terrain, land cover, population, roads/services, night lights, vegetation, risks, wetlands, protected areas, plans and lawful prices). Integration: feature registry/results. Done when docs/research/data-layers.md records source/license/resolution/history and >10m inputs cannot become imagery; review time support per row.
- [ ] Research Rwanda privacy/land rules and document aggregate-only handling. Integration: data ingestion/exports/corrections. Done when primary legal sources support handling; time: retention/version policy addressed. No personal ownership data.
- [ ] Explainable suitability indicator consuming module outputs. Integration: shared selection/results/weights/exports/i18n. Done when factors/weights/missing data and “indicative, not a formal valuation” appear, dated comparisons and tests pass; defer factors without trustworthy inputs.

## Phase 5 — discovery and continuous improvement
- [ ] Competitor feature-gap matrix with access dates and ≥3 differentiators. Integration: roadmap/common contracts. Done when primary product evidence supports coverage claims, including time/export/language gaps.
- [ ] Performance budget and slow-mobile/accessibility audit. Integration: selection/map/panels/export. Done when measured against documented thresholds and regressions fixed; time: comparison is included.
- [ ] Rank ≥3 ideas per improvement loop; implement highest trustworthy one. Integration and time: required individually in each backlog/promoted item; done when acceptance checks and evidence are linked.

### Current verification gate
Phase 1 dated imagery, swipe, shared rw/en/fr context and per-date export code are
implemented; 8 automated tests, lint/typecheck/build and live metadata/RGB requests
pass. **Do not tick the full Phase 1 interaction item** until browser checks cover
swipe panning, mobile panel collisions, both PNG modes and CSV/GeoJSON downloads.
The supplied browser host is unavailable. Continue independent Phase 2 research
and regression work while that external validation path is blocked.

## Promoted improvement — mobile imagery transfer
- [x] Replace heavy display PNG tiles with benchmarked WebP90. Integration: same
  basemap layers, synced A/B swipe, selected/full-view PNG canvas exports and
  source revision. Done when actual live tile content-type is WebP, sample size
  drops ≥60%, missing-data alpha remains intact, and lint/typecheck/build pass;
  compare dated A/B requests and record browser-download QA gap explicitly.

- [x] Exclude only redundant raw boundary inputs from server traces and validate
  required precomputed assets before build. Integration: boundary selection,
  search, tiles, inspector and PNG snapshot path. Done when existing regressions
  pass and production trace retains the six needed files, reduced from 238.1MiB
  to 51.35MiB; time: same immutable boundary snapshot retained and date caveat shown.

## Counting implementation checkpoint
- [x] Add two immutable, licensed building snapshot indexes and common dated
  feature-registry/module interfaces. Integration: one admin selection, inspector,
  highlighted representative points, language state, URL and combined exports.
  Done when 13 automated tests, independent spatial tally and source/hash/privacy
  ingestion fixture pass; same-snapshot/missing-history comparisons are explicit.
- [x] Keep counting and archive assets within measured deployable bounds.
  Integration: boundary/analysis routes and shared startup. Done when prebuild
  validates local LFS data and postbuild verifies every trace <100MiB with no raw
  archive leakage; dates/versions live in immutable manifests.
- [ ] Complete visual QA of building dots, time controls on all basemaps, selected
  PNG/inspector PNG/CSV/GeoJSON downloads and mobile panels. Current blocker:
  supplied browser host unavailable. Do not confuse API/object tests with this gate.

## Promoted integration fixes after counting checkpoint
- [x] Make full/selected PNG provenance readable and consistent. Integration:
  existing image/worker/selection/analysis/i18n flow. Done when map pixels stay
  intact, wrapped method/date/confidence/credits and per-date metrics are readable,
  and a changing source/view aborts instead of mislabelling a capture; wrapping
  tests pass and actual browser downloads remain a separately recorded gate.
- [ ] Reserve actual timeline height on mobile/mid-width screens. Integration:
  layer dock, shared timeline/metadata, inspector and map controls. Done when
  shared measured insets prevent panel collisions for both date states/languages;
  layout calculation tests pass; browser manual check is a separate pending gate
  (currently unavailable). Implemented measured reservations; keep unticked until
  actual mobile interactions can be checked.
- [x] Collapse identical pending raster jobs. Integration: versioned A/B tile
  requests and fallback/error states. Done when simultaneous duplicate keys run
  one job, failures allow retry, and date/revision changes remain separate.

## Promoted source-freshness iteration
- [x] Add a verified recent OSM monthly snapshot to reduce the January lag.
  Integration: same date selector, count/classification/map/PNG/CSV/GeoJSON/URL.
  Done when immutable source header/SHA-256 and pipeline revision are recorded,
  request-before-source never uses future data, older-date fixtures still pass,
  current-date results use the actual source date and whole-build budgets pass.
- [x] Audit cross-source coverage and physical lifecycle filtering before claiming
  an improved house estimate. Integration: shared geometry/confidence/time/export.
  Done when >=3 named Rwanda samples have transparent OSM/Overture comparisons,
  dates/source overlap and processing differences disclosed, and no ground-truth
  accuracy is inferred from correlated footprint counts. Separate physical-house
  precision/recall validation remains required.

## Packaging follow-up
- [x] Isolate boundary/startup traces from unrelated building inputs without
  changing public asset URLs. Integration: boundary selection/search/map tiles,
  startup, analysis/time/export. Done when six required assets remain in traces,
  building files stay out of boundary/startup, analysis retains all inputs and
  existing integration tests/live APIs pass. Measured87.19→51.35MiB (ADR0008).

## User-requested Esri and count comparison fix (2026-11-15)
- [x] Restore Esri as an additional explicitly requested reference option with
  current attribution and truthful varying-resolution/date notes. Integration:
  same layers/selection/fallback/PNG; dated open counts work independently.
  Acceptance: real tokenless JPEG/CORS probes and registry/date/export checks.
  Actual pointer/download QA remains a separate browser-host blocker.
- [x] Make one-date/two-date count modes visible and functional on Esri. Integration:
  eligible automatic selection analysis, inspector toggle, shared A/B state,
  map/result/CSV/GeoJSON/PNG, rw/en/fr, explicit off URL preference. Acceptance:
  same selected cell300/285 for2 dates and300 for1 date, no B/delta in single-mode
  data exports; real user village missing coverage shows unavailable house
  estimate, not invented zero houses.35 tests cover APIs/controls/exports.

## Promoted improvement — inspect broader open building coverage over Esri
- [x] Integrate a national Overture source with actual source polygons beside OSM.
  Integration: same selection/dates/results, rw/en/fr, URL, visible/hideable overlay,
  source inspection, PNG/CSV/GeoJSON. Done when both user villages have complete
  matching-ID outlines, source history unavailable before supported dates, one/
  two-date toggles/export parity pass, public ODbL provenance/index offer exists,
  hash-verified immutable objects stay<850MiB/10k files outside100MiB functions,
  failure retains full points/counts with explicit status and final checks pass.
  This automated/data checkpoint does not establish house accuracy or browser QA.
- [ ] Independently validate current house counts/footprints in urban, outskirts
  and hillside settings. Same original ground-truth gate; larger coverage and a
  private inspection image are not precision/recall or independent labels.

## Promoted improvement — closer source inspection without rural no-data tiles
- [x] Add provider-specific zoom limits with an Esri coverage guard. Integration:
  view/URL/prefetch, background reference, actual source polygons and PNG fitting.
  Done when live Kigali/rural tilemap probes distinguish coverage from JPEG200
  placeholders, complete bundle-split/invalid response fixtures pass, stale checks
  cannot enable finer detail after panning, source limits stay distinct and all
  build/trace checks pass. Time: still reference imagery, never A/B-dated Esri.
  Actual browser/mobile zoom, pan and capture interaction remains the existing
  separate unchecked gate because browser host is unavailable.

## Promoted improvement — point-specific Esri source context
- [x] Expose point-scoped Esri acquisition date, source/sampling resolution and
  source zoom range under ADR0014. Integration: shared selected point, inspector,
  PNG/CSV/GeoJSON and rw/en/fr. Verified:46tests, lint/types/build and national
  asset/trace guards; maximum51.35MiB function.
  Acceptance: bounded fixed-source requests/cache, strict dates/numeric fields,
  deduplicated/mixed/empty/error responses, stale point guards and shared export
  context. Never relabel building A/B dates or imply survey accuracy. Actual
  browser interaction remains a separate pending gate.
