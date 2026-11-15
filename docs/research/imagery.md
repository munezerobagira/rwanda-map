# Rwanda imagery evaluation

Accessed/tested 2026-11-14. Candidates coarser than 10m were rejected before
imagery testing: Landsat RGB (30m), MODIS and VIIRS/Black Marble. Those may later
be supporting analysis inputs with displayed native resolution, never basemaps.

| Candidate | Native RGB | Rwanda tests | Latency | Repeat / archive | Cloud handling | Rights/access | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Earth Search / Sentinel COGs | 10m | Kigali bbox and rural bbox 200; correct z12 RGB tiles 200 for both | Catalog 0.46/0.49s; shared TiTiler warm tile 1.0/1.09s; app renderer also 200 | ~5-day constellation; global L2A from Dec 2018, application begins 2019 | Scene-cloud ranking; preserve up to three candidates per grid because lowest-cloud slivers may miss selection; no pixel cloud-mask claim | Copernicus free/full/open; no token, account or requester-pays on tested COGs | Primary, render bounded COG windows in Next/TS |
| EOX 2016 | 10m | Kigali and rural z11 JPEG 200 | 0.89s Kigali / 0.665s rural | Static 2016 mosaic only | Annual cloudless processing; no recent comparison | CC BY 4.0; public endpoint fair use/no SLA | Explicit historical reference fallback; never label it as requested date |
| EOX 2018+ | 10m | Not needed after rights rejection | N/A | Annual, 2018–2025 listed | Cloudless mosaic | CC BY-NC-SA; intended agency/commercial use requires paid license | Removed |
| Planetary Computer Sentinel-2 | 10m | Not tested after strict-token rejection | N/A | Historical catalog; archive per collection | Scenes/cloud metadata | Catalog open; data needs SAS token even for anonymous user | Rejected under hard no-token rule |
| Copernicus Data Space | 10m | Mosaic landing page TLS validation failed; no bypass | 0.24s failure | Sentinel archive, quarterly mosaics | Various processing | Data open; Process/WMTS requires configured instance/account | Investigate other access later; not wired |
| OpenAerialMap | Per image; regional results ~0.025–0.53m | Metadata bbox request 200, 10 returned regional footprints | 0.17s | Sporadic per-image dates 2020–2023 in tested response | Per-image, no repeat/cloud SLA | API CC BY metadata is not proof each imagery footprint is reusable; contains Maxar titles | Not national fallback; verify actual Rwanda intersection and each image license first |
| OSM standard tiles | Vector-derived, sensor GSD not applicable | Kigali z11 PNG 200 | 0.08s | Rolling updates; no historical tile API here | N/A | ODbL data, OSMF usage policy; no account/key | Reference beneath imagery; visible error on missing imagery |

## Real-request details

Raw initial probe metadata is in imagery-probes-2026-11-14.json. Raster probes
requested only individual sample tiles, not bulk imagery. Rural point is
29.57°E, 2.08°S; Kigali 30.0619°E, 1.9441°S. An initial rural tile request used the
Kigali coordinates and returned 404; corrected rural z12 x2384 y2071 returned
200. This was a probe-coordinate error, not proof of missing rural data.

In-app renderer live endpoints returning PNG:
- `/api/imagery/tiles/12/2390/2070?start=2026-10-02&end=2026-10-31`
- `/api/imagery/tiles/12/2384/2071?start=2026-10-02&end=2026-10-31`

Inspected the rendered Kigali PNG: true-color urban fabric/vegetation and river,
not a blank image. This confirms a usable raster response, not detection accuracy
or visually verified map UI. The supplied browser host is unavailable; swipe,
mobile layout and actual PNG download remain unverified acceptance items.

## Evidence

- https://registry.opendata.aws/sentinel-2-l2a-cogs/ — RGB source, open access,
  update frequency, global archive start and citation.
- https://geotiffjs.github.io/geotiff.js/ — remote ranges, overviews/windows,
  no need for whole-scene downloads.
- https://cloudless.eox.at/documentation/faq — EOX 2016 CC BY vs newer restrictions.
- https://planetarycomputer.microsoft.com/docs/concepts/sas/ — token requirement.
- https://docs.openaerialmap.org/api/api/ — metadata discovery.
- https://operations.osmfoundation.org/policies/tiles/ — caching/attribution,
  no bulk offline fetching. Only on-screen OSM requests, browser caching retained.

A historical Kigali test initially returned no coverage: low-cloud partial scenes
had crowded full-coverage observations out of the first 100 results. The catalog
now excludes scenes with ≥50% nodata before scene-cloud ranking and preserves
three candidates per grid. This is not a pixel cloud mask. Requests are bounded
to 93 days and 100 country-level candidates; absence is visibly unavailable,
never a fabricated image. Larger annual composites/complete catalog paging remain
future work rather than being implied by the current period UI.

After the nodata filter, historical Kigali (October 2025) returns 200 PNG in
4.4s cold (3.9s application time). Dev server required restart after repeated
production builds; do not mistake stale dev module caches for current source.
