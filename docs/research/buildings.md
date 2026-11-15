# Building sources and Rwanda counting feasibility

Accessed 2026-11-14. Building footprints are not household counts or guaranteed
residential use. No accuracy percentages are claimed without Rwanda validation.
Sentinel-2 RGB at 10m cannot directly resolve individual small houses reliably.

| Source | Rights / keyless route | Rwanda / date | Strength | Limitations and integration |
| --- | --- | --- | --- | --- |
| Overture buildings | ODbL, public GeoParquet via S3/Azure; no account/key | Global; current catalog release verified 2026-10-21.0; monthly versions | Conflates OSM + ML with source priority and stable identifiers | ML Global South precision caveat; release date is not roof acquisition date. Best national dataset candidate; ingest Rwanda only, retain source/version, do not count building parts twice. |
| Google Open Buildings v3 | Dual CC BY 4.0 / ODbL; public sharded CSV downloads | Rwanda in covered Africa; multi-date mosaic | High-res-derived footprints, per-building detection confidence | No residential type; score is building-existence confidence, not house probability; acquisition age varies. Large shards need offline clipping. |
| Google 2.5D Temporal | Verify download license from asset/data catalog; public GCS alternative to account-gated Earth Engine | Rwanda explicitly listed; annual 2016–2023 | Fractional building counts as historical corroboration | Effective 4m derived from Sentinel-2, not observed 4m imagery; do not treat as high-res ground truth, roof polygons or houses. Only analysis input until license/COGs validated. |
| Microsoft Global ML footprints | CDLA Permissive 2.0; public country/quadkey links | Country coverage must be checked in current manifest; global refresh 2026-08-13 | Source confidence/imagery-period fields where supplied | Imagery spans years; dataset refresh != new construction. Do not add as independent totals on top of Overture (duplicates). |
| OpenStreetMap / Geofabrik | ODbL; keyless PBF snapshot downloads | Rwanda 2025-01-01 and 2026-01-01 public extracts; latest live page reports data through 2026-11-13T21:22:20Z | Community correction path, explicit residential/service tags, history | Rural omissions, untagged use, mapping date != construction. Local extract is a transparent complementary source, not complete ground truth. |
| New ML on open sub-metre imagery | Per-image license required; no national eligible imagery verified yet | Sparse regional OAM candidates, Rwanda coverage not yet established | Can fill footprint gaps if rights/quality verified | Requires labelled Rwanda samples, model validation and lawful high-res imagery. Do not build pretend house detection on Sentinel RGB. |

## Service and storage decision evidence

The public Overpass manual explicitly discourages using its shared instances as a
backend for an app serving users beyond OSM mappers. Three small sequential probes
(current/historical Kigali and rural) each timed out at ~22s in this environment.
Use offline public extracts or project-owned infrastructure, not public Overpass as
production fallback. Do not defeat rate limiting by cycling shared endpoints.

Overture's published PMTiles are documented as inspection-only and explicitly not
for production. Read source GeoParquet and generate project-owned tiles/indexes.
A fast demo map is not evidence that its tile service is suitable for this app.

Compare before coding: (A) national offline indexed snapshots, larger ingest but
reliable keyless runtime; (B) live Overpass, simpler but shared-service policy and
latency unsuitable. Choose A. Keep application runtime Next/TS. An offline
Python/Osmium tool is reasonable for streaming PBF because it correctly assembles
relations without loading a national node graph into browser/Next memory; it is
an ingestion utility, not a new production backend. Need measure output size and
Vercel file-tracing before deciding whether to store compact indexes or PMTiles.

## Boundary provenance finding

NISR publishes a 2022 village FeatureServer layer explicitly titled “Open Data”,
with names/codes but no dwelling counts. Need check full item license before
redistribution. The World Bank catalog explicitly licenses a 2012 boundary/village
dataset under CC BY 4.0. Download verified: 14,815 village shapes in TM_Rwanda,
different from the repo's 14,823. Do **not** relabel the repo data as World Bank or
NISR based on similar names. A licensed replacement requires schema/CRS conversion,
shared hierarchy/selection regression checks, source date disclosure and an ADR.

## Sources

- https://docs.overturemaps.org/guides/buildings/ — source priority, ODbL, monthly cadence and quality caveats.
- https://docs.overturemaps.org/attribution/ — contributor attribution.
- https://docs.overturemaps.org/getting-data/cloud-sources/ — GeoParquet/public paths, archive, inspection-only PMTiles warning.
- https://sites.research.google/gr/open-buildings/ — polygon schema, confidence, no building type, dual-license FAQ.
- https://sites.research.google/gr/open-buildings/temporal/ — years, effective resolution, Rwanda coverage, GCS option.
- https://github.com/microsoft/GlobalMLBuildingFootprints — CDLA Permissive 2.0, dates/manifests.
- https://download.geofabrik.de/africa/rwanda.html — Rwanda snapshots and contributor metadata removal.
- https://dev.overpass-api.de/overpass-doc/en/preface/commons.html — shared-service policy.
- https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL — historical as-of semantics.
- https://gis-server.statistics.gov.rw/server/rest/services/Hosted/Village_Boundary_2022/FeatureServer/layers — official 2022 schema.
- https://datacatalog.worldbank.org/search/dataset/0041453/rwanda-admin-boundaries-and-villages — CC BY 4.0, 2012 vintage.

## Local validation sources and exclusions

- **SPARC Kigali rejected.** ArcGIS service `Kigali_Building_Use__Parcels_Zoning`
  looks public and describes prediction/ground-confirmation fields, but item
  `99dbc86aa5a94e32885fea80b2374649` explicitly says confidential, pilot-purpose
  only, and no redistribution/commercial use without World Bank consent. Queried
  metadata/schema only, not records. Do not ingest or expose its parcel identifier.
  Public HTTP accessibility is not an open-data license.
  Source: https://www.arcgis.com/sharing/rest/content/items/99dbc86aa5a94e32885fea80b2374649?f=pjson
- **EO4Kigali research polygons eligible for investigation.** Zenodo record
  https://zenodo.org/records/3239271 (API verified CC BY 4.0) contains building
  archetypes for central Kigali in 2008–2009/2015, published 2019. Reusable
  derived polygons do not license the underlying Pléiades/aerial images or
  validate current rural counts. Examine the codebook/attributes before use.
- **OAM Rwanda coverage checked.** A 100-result-limit bbox query returned 14
  records. Intersected per-image footprints against the existing country polygon:
  3 CC BY 4.0 drone images are outside Rwanda; 10 sub-metre images intersect Rwanda
  but are CC BY-NC 4.0; remaining Sentinel-1 raster is ~14.68m and disallowed as
  imagery. No eligible Rwanda high-resolution ground truth from this query.
  Sanitized metadata in oam-rwanda-rights-2026-11-14.json excludes contributor
  contacts. New OAM FAQ says check each image license; do not rely on blanket
  old OIN CC-BY descriptions. https://docs.imagery.hotosm.org/about/faq/

## Measured OSM snapshot facts

Streamed Geofabrik PBFs without exposing contributor metadata:

| Snapshot header timestamp | SHA-256 | Ways with building tag | house | residential | yes |
| --- | --- | ---: | ---: | ---: | ---: |
| 2025-01-01T21:21:00Z | cf06464cfbe150a70ee1da3dc8bc3dd04f9649b4f360b8a01cc555a37cdbd57f | 988,638 | 22,035 | 4,661 | 959,410 |
| 2026-01-01T21:21:30Z | 0e5daee1cf01b26dc6d3e3553cf5c2bf6c4501faf6ec968e25e442b10d5828b1 | 1,167,553 | 324 | 24,018 | 1,140,288 |

These are **tag audit totals**, not Rwanda house/building estimates: include
unclosed ways, unfiltered border spillovers and potentially relation-member parts.
The sharp house→residential tag shift demonstrates that tag-specific change is
not construction change. Most records say only `building=yes`; house inference
needs independent Rwanda validation, and unknown use must stay visible.

## Overture real-data and archive probe (2026-11-14)

Anonymous official Python client2.1.1 downloaded release2026-10-21.0 building
GeoJSON for bbox30.06,-1.945,30.063,-1.942. 96 bbox-intersecting records/56,908
output bytes in ~1.4s reported download time (not total scanned network bytes).
82 point-on-surface representatives are inside the box; 66 source records are
OpenStreetMap, 13 Google Open Buildings and 3 Microsoft ML Buildings. 79 lack
subtype; 2 civic and1 commercial. Not houses or independent ground truth.
OSM January2026 has37 mapped representatives here; different source dates and
representative-point rules prevent treating this as an omission/error rate.
The same selected geometry will be rechecked with a recent OSM snapshot and
centroid-inside/point-on-surface fallback matching the production pipeline.

**Archive correction:** official release policy now retains public data for a
maximum60 days/two monthly releases, though historical release notes remain.
Do not promise that older Overture releases can still be downloaded, or treat
release history as publicly retained geometry history. Current Sept/Oct2026
probes are separate from old OSM Jan2025/Jan2026 inputs. Need minimized lawful
project-owned version retention before promising multi-year Overture comparisons.

Sources accessed2026-11-14:
- https://docs.overturemaps.org/getting-data/overturemaps-py/ — anonymous bounded
  GeoParquet client, streamed data and STAC spatial pruning.
- https://docs.overturemaps.org/release-calendar/ —2026-10-21.0 current,
  monthly cadence, explicit60-day public-data retention (updatedNov9,2026).
- https://docs.overturemaps.org/guides/buildings/ — ODbL, source priority,
  building vs building_part, ML/Global South caveats, IoU conflation.

## Same-selection three-setting audit

Aggregate/hash report: [source-audits/rwanda-building-samples-2026-11-14.json](source-audits/rwanda-building-samples-2026-11-14.json).
Settings are location-based candidates, not independently ground-surveyed labels.
Each row uses the same existing village polygon, representative-point convention
(centroid if inside footprint, otherwise point-on-surface), and 1e-6-degree point
quantization. Overture downloads include bbox-intersecting features which are
then filtered against that polygon; raw bbox totals are not selected counts.

| Candidate setting / village | OSM Jan2025 p2 | OSM Jan2026 p2 | OSM Oct2026 p2 | Overture Sep2026 | Overture Oct2026 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Kigali core / Ishema, Kiyovu, Nyarugenge |192|193|254|476|476|
| Masaka outskirts / Nyakarambi, Gitaraga, Kicukiro |0|289|289|669|669|
| Kisaro hillside / Nyakarekare, Mubuga, Rulindo |0|0|0|390|390|

All are mapped-dataset tallies, not houses, households, completeness percentages,
or precision/recall. Overture uses OSM itself plus Google/Microsoft detections,
so sources are correlated. Published source update dates are not roof acquisition
or construction dates; source geometry/parts/conflation also differ. No precision,
recall or actual-building change follows from this table. Most Overture subtypes
are unknown. Repeated Sep/Oct totals do not prove zero real construction.

Recent OSM input: immutable rwanda-261001.osm.pbf, header2026-10-01T20:22:06Z,
SHA2566fd28e3d15fdf3a2ec4a98cdad458212cb106b942f157ae84368c6a560cccd06.
P2 index1,461,775 accepted records/15,145,287 compressed bytes;3 invalid source
geometries skipped,1,193 outside country bbox,348 excluded lifecycle forms.
P2 retains standing disused structures as unknown use. Jan2025/Jan2026 p2 point
rows match their original p1 rows exactly; new immutable manifests identify p2.
Original p1 files are archived outside runtime, never silently overwritten.

This evidence prioritizes a carefully versioned Overture coverage option, with
project-owned tiles/retention and no additive OSM+Overture totals. It does not
remove the independent high-resolution house-validation blocker.

## National Overture inspection adapter (2026-11-15)
October release country-covered records5,727,334 (5,700,914 unknown-use), versus
1,461,775 in the existing October OSM index. Count records are deduplicated by
Overture's source conflation/GERS, never summed with OSM. No independent accuracy
increase or total-house claim follows from these larger numbers. The user's
latest selected village yields66OSM/957OVT; Amahoro0/973. Both OVT selections
return one actual source outline per counted ID. The app lets users choose source,
inspect its polygon/date/use/supplier and hide the overlay over Esri.

Project-owned immutable assets:183,747,914 compressed point bytes and307,302,577
outline bytes;4,293 objects/468.30MiB. National geometry never enters a function
bundle. Full hashes/row counts checked before builds. Query and outline budgets,
source-series dates, fallback and costs in ADR0012. Next production build passed
51.35MiB maximum function trace. Local API checks are not device/visual accuracy QA.

Reproduce while public release geometry is available (60-day provider retention):
`python scripts/ingest-overture-buildings.py 2026-10-21.0 data/reference/rwanda-district-coverage-wb2012.geojson OUTPUT_ROOT`,
then `python scripts/package-overture.py OUTPUT_ROOT/2026-10-21.0 PACKAGED_ROOT 4`.
Use pinned requirements-overture.txt, isolated offline environment. Never commit
national raw attributes, names or addresses. Review and bump processing version
for semantic pipeline changes; do not overwrite old release IDs. Package manifests
include source file paths and country clip/license/hash. Copy only immutable
hash objects into public/data/footprints/objects and reviewed release manifests
into src/lib/analysis/footprints; validate before adding source-date registry entries.

Country clip is a dissolved World Bank2012 CC BY4 district coverage mask,
sourcezipSHA25655ae1f095d69941fa0b563bf0050948fd6e1debc7d86da97aef75eefe43e47f6.
It defines this dataset's coverage and can omit border/water/island areas; it is
not a current surveyed national/cadastral boundary or replacement for admin
selection data. Country metadata/attribution travels in the dated manifest and
source credits. Existing selected admin-boundary provenance remains unresolved.

Historical independent candidate: EO4Kigali (Zenodo3239271,CC BY4),2008–09/2015
central Kigali only. Primary paper states building archetypes are morphological,
not functional use; numerous Basic shapes are modelled/split area units(Model=1),
not real delineations. It cannot validate current rural counts, residential use,
or modern actual-outline alignment without exclusions and time-matched reference.
Sources https://www.mdpi.com/2306-5729/4/3/105 and
https://zenodo.org/records/3239271 accessed2026-11-15. No independent current
precision/recall/count error claimed; confidence remains low.
