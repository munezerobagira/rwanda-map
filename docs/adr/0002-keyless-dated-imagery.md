# ADR 0002 — Keyless dated imagery without a demo-renderer dependency

Date: 2026-11-14. Status: accepted for implementation; visual QA pending.

## Evidence and alternatives

[AWS Sentinel COG registry](https://registry.opendata.aws/sentinel-2-l2a-cogs/)
records free/full/open Copernicus data, 10m RGB, ~5-day repeat and global L2A
coverage from December 2018. Earth Search catalog and public COG range requests
need neither account nor token. Compare:

1. Earth Search + public TiTiler: both Kigali and rural RGB tiles returned 200
   (~1s warm). The public renderer is a shared demo, not infrastructure owned by
   this project. Production dependence and service capacity are uncontrolled.
2. Earth Search + in-app TypeScript COG renderer: GeoTIFF.js supports range reads,
   overviews and bounded windows; proj4 reprojects; sharp encodes PNG. Retains
   existing Next deployment, avoids a new Python service and demo endpoint.
3. Planetary Computer: catalog is open, blob reads require SAS tokens, even for
   anonymous users. Reject under explicit no-token constraint.
4. EOX 2018+: 10m but noncommercial. Reject; EOX 2016 remains CC BY 4.0 and is a
   clearly dated static fallback only. It must never impersonate a selected period.
5. Copernicus Data Space: free data does not make instance-ID Process/WMTS APIs
   credential-free. Do not wire those endpoints. Public mosaic entry point had a
   TLS certificate validation failure in this environment; did not bypass it.
6. OpenAerialMap: finer resolutions exist in regional bounding-box results, but
   intersects-bbox does not prove Rwanda footprint coverage; mixed per-image rights
   and sparse dates cannot substitute for national repeat imagery. Defer per-image
   validation rather than label regional Maxar/drone results as Rwanda-wide open data.

Choose 2, with 2016 EOX and OSM reference fallback/error states. Remove Esri,
night-lights, terrain and CARTO until each meets source/policy requirements.
RGB observations stay natively 10m. Overview/zoom rendering must not imply finer
sensor resolution. Do not use Sentinel RGB to identify individual houses.

## Time, truth and integration

Period requests select least-cloudy *scenes* in that interval; scene cloud cover
is not local cloud cover and no cloud-free pixel composite is claimed. Acquisition
metadata must list actual dates/scene cloud, alongside requested periods. Two
period layers share the same Leaflet viewport and selection and support a swipe;
exports draw those same layers with credits/periods. Single-scene failures must
produce visible status; historical fallback explicitly identifies 2016 and cannot
be used as evidence of current change. OSM has no archival tile service here.

Source-version/date/geometry are part of request/cache keys. Keep catalog cache
bounded (24 period entries, 1h), TIFF handle/range cache bounded (8 scenes), tile
cache bounded (64 PNGs); at most two raster jobs per process. No arbitrary remote
URL parameter: only allowlisted Earth Search assets. Query and raster deadlines
must return errors rather than unbounded Vercel jobs. Evaluate latency/memory
before claiming production readiness. Historical COGs stay upstream: local storage
cost zero; CDN tiles approximately 64KiB × views × two dates. At 10k views with
20 tiles per date this is ~25GiB uncached transfer; actual paid-host cost depends
on account allowance. No key/account is required from map users.

## Sources (accessed 2026-11-14)
- https://geotiffjs.github.io/geotiff.js/ — MIT parser, overview/window/range support.
- https://github.com/proj4js/proj4js — MIT projection library.
- https://sharp.pixelplumbing.com/ — Apache-2.0 image encoder.
- https://developmentseed.org/titiler/ — open renderer alternative.
- https://cloudless.eox.at/documentation/faq — 2016 license and service fair use.
- https://operations.osmfoundation.org/policies/tiles/ — reference fallback must
  use normal browser caching/referer, no bulk/offline prefetch.

Implementation notes: catalog response now carries a deterministic content
revision over scene IDs/date/cloud/asset path; tile URL+cache key includes it.
Changing source candidates for the same period cannot silently reuse an old
revision. The request queue is bounded to 24 with a 15s queue timeout, then a
20s raster timeout and a 10s catalog deadline; function maxDuration is 60s.
[Vercel duration docs](https://vercel.com/docs/functions/configuring-functions/duration)
(accessed 2026-11-14) permit this below both legacy Hobby 60s and Fluid 300s caps;
actual deployment settings/traffic are not validated here. Byte cache is 64 tiles,
TIFF range cache 8×16×64KiB before decode overhead; 2 concurrent raster jobs.
These are per-process bounds, not a global deployment concurrency guarantee.

A historical Kigali test initially returned no coverage: low-cloud partial scenes
had crowded full-coverage observations out of the first 100 results. The catalog
now excludes scenes with ≥50% nodata before scene-cloud ranking and preserves
three candidates per grid. This is not a pixel cloud mask. Requests are bounded
to 93 days and 100 country-level candidates; absence is visibly unavailable,
never a fabricated image. Larger annual composites/complete catalog paging remain
future work rather than being implied by the current period UI.
