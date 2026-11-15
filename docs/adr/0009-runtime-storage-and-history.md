# ADR 0009 — Small bounded runtime; measured path to larger coverage/history

2026-11-15. Current choices accepted; larger-source storage prototype pending.

## Evidence and current limits

Installed stack: Next16.2.6/TS, Leaflet1.9.4, canvas boundary worker, common dated
geometry→result interface. Local31 TS tests+2 ingest fixtures pass. Three OSM
p2 dates total3,615,441 points/35.84MiB of active tile+manifest assets. Boundary
files49.76MiB; with explicit tracing readers, largest function51.35MiB, analysis
37.42MiB, startup49.81MiB. Small selected-area queries locally0.04–0.85s;
no low-end-device/browser or production latency claims. Raster cold probe~8.7s,
2 workers,24 queue slots,15s queue/20s render limits, maxDuration60s,64 tiles cached.

Our100MiB function trace budget is a project choice. Official Vercel June29,2026
changelog introduces opt-in5GB Fluid large-function beta; older cached limit
pages still cite250MB standard bundles. Actual deployment settings are unknown.
Do not assume beta eligibility or raise the project budget to hide over-inclusion.
Function memory/CPU/duration,4.5MB ordinary request/response constraints, and
provider account settings still matter. The API caps uncompressed analysis JSON
at3.5MB,10,000 features/date,50km² and16 source tiles; it refuses incomplete exports.

## Runtime alternatives

| Decision | Existing/small option | Larger alternative | Current choice and trigger |
| --- | --- | --- | --- |
| App/API language | Next/TS bounded local-index queries and RGB COG reads | Python/FastAPI persistent raster/ML worker | Keep Next/TS. Python remains offline ingest only. Add worker only for measured time/memory overruns or validated ML jobs, keeping the common analysis contract. |
| Map engine | Existing Leaflet canvas worker, SVG focus, tested PNG capture | MapLibre GL JS WebGL vector tiles, GPU styling/3D | Keep Leaflet. A rewrite would risk selection/swipe/export/mobile behavior without a measured rendering failure. Prototype GPU rendering only when a real feature density exceeds budget; preserve shared geometry/results and PNG parity before switch. |
| Small-area query storage | Minimized gzip point tiles+dated manifest, bounded local fs cache | GeoParquet/DuckDB or PostGIS | Current files require no runtime account/credential/service. DuckDB useful offline for national GeoParquet, but native/WASM bundle+scan/memory must be benchmarked. PostGIS is appropriate for larger concurrent/complex queries or submissions, adds a service/account/backups; not needed for current bounded reads. |
| Delivery/archive format | Existing compact z12 files (query points, not rendered geometry) | Project-owned PMTiles with range reads | PMTiles suits rendering/HTTP-range delivery of national geometry; must retain complete authoritative query points/IDs separately and never count clipped tile fragments/overzoom representations. Current dataset remains in simple tiles until national source benchmarks prove a need. |
| Retained versions | Distinct source+processing IDs, actual source date, minimized attributes | Content-addressed identical tile reuse/delta snapshots | Prototype dedup before multiplying national files. A per-version manifest may point to identical immutable bytes; source/date/method still stay per snapshot. No runtime source replacement or mixed-source growth. |
| Caching | Process caches+public imagery CDN headers, versioned keys, shared pending renders | Persistent CDN/object cache / own tile worker | Keep existing bounded caches now. Actual CDN cache-hit/memory/egress must be measured after deployment; in-process cache is not globally shared/durable. |

MapLibre/PMTiles do not supply compliant basemaps by themselves. Their example
keyed/commercial sources must not enter this app. Existing audited10m RGB/2016 reference and OSM cartography remain active;
ADR0010 records the later explicit user exception restoring Esri reference imagery. Overture inspection PMTiles
must not be used as production tiles; derive project-owned assets instead.

## Time/storage and rough costs

Current static payload~37.6MB decimal for three building dates, plus~52.2MB
boundaries (separate function dependencies). A naive monthly recent OSM snapshot
at15.1MB adds~181MB/year, or~0.91GB/five years, before changing national coverage,
replication, LFS history, geometry layers or compression/dedup. This is a planning
extrapolation, not a measured future dataset size. Keeping every version in one
function cannot scale within100MiB; content reuse or static-range/object delivery
must precede that growth. No claimed long-term archive from a provider whose
public geometry retention is only60 days (Overture).

No additional hosted service is required by the accepted changes. Existing
Vercel published base prices observed2026-11-15: Hobby$0/month for personal,
non-commercial use; Pro$20/month with$20 usage credit, usage/taxes extra. This
is not a quotation for this deployment or a guarantee of free government/
commercial hosting. No service plan purchased/changed. Paid/keyed data APIs
remain prohibited. Any new storage/backend must preserve anonymous/keyless
read access and have documented operating costs and a credential-free user flow.

For illustration only,100,000 raster misses at4 CPU-seconds consume~111 active
CPU-hours, whereas100,000 cached hits avoid most render work; no dollar total
without measured CPU/memory, region and actual plan rates. Our wall-clock probes
are not CPU measurements. Prioritize byte/cache improvements before inferring
hosting cost from request counts. Add a provider-independent self-host/container
route if existing hosting terms cannot serve the intended operator.

## Migration sequence without a broken app

1. Keep current source/version APIs and validated local files; add candidate
   source behind a flag, prototype offline and measure national bytes/query cost.
2. Add version+processing manifests with source-specific storage adapters. Stable
   result fields/selection/export/i18n stay unchanged; never combine correlated
   source counts or compare incompatible processing as construction.
3. If file budgets fail, move only the adapter to project-owned static-range/
   object files or query service; retain current adapter as reversible fallback.
4. Benchmark urban/outskirts/hillside selections, two dates, missing history,
   output-size refusal, mobile rendering and all export modes before enabling.
5. Retain minimized lawful historical inputs with a documented correction/removal
   process. Public availability is not permission to retain personal submissions.

## Primary sources accessed2026-11-15
- https://nextjs.org/docs/app/api-reference/config/next-config-js/output — fs tracing.
- https://vercel.com/changelog/vercel-functions-can-now-be-up-to-5-gb-in-package-size — June2026 beta; do not rely only on older cached limits.
- https://vercel.com/docs/functions/limitations — body/duration/memory/standard limits; deployment-specific settings still required.
- https://vercel.com/pricing — published base prices and Hobby use scope.
- https://vercel.com/docs/functions/usage-and-pricing — active CPU/memory billing model.
- https://maplibre.org/maplibre-gl-js/docs/ — WebGL/TS vector rendering; examples may require keys and are not approved data sources.
- https://docs.protomaps.com/pmtiles/ — archive/range architecture.
- https://docs.protomaps.com/pmtiles/leaflet — Leaflet integration options.
- https://duckdb.org/docs/stable/core_extensions/spatial/functions.html — spatial/GeoParquet functions.
- https://postgis.net/docs/using_postgis_dbmanagement.html — persistent indexed spatial database alternative.
- https://docs.overturemaps.org/release-calendar/ —60-day public geometry retention.
