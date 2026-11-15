# External URL and source audit

Access date: 2026-11-14. Baseline audited with `rg -n 'https?://' src scripts`.
Native resolution refers to source observations, never screen pixels/overzoom.
Vector cartography has scale-dependent rendering, not sensor ground resolution.
Unverified sources cannot be added on the strength of a successful HTTP response.

| URL in baseline | Provides | Key? | Native resolution | License/terms | Update/archive | Attribution | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}` | Esri blended imagery | No for this endpoint | Variable; sub-metre not guaranteed Rwanda-wide; coarse sources at small scales | Proprietary service/mixed imagery, not open data | Variable, no exposed capture date in current integration | Esri and listed contributors | Remove: open data and resolution not established |
| `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{year}_3857/default/g/{z}/{y}/{x}.jpg` | Annual Sentinel mosaic | No | 10m RGB | 2018+ CC BY-NC-SA 4.0, commercial license paid; 2016 CC BY 4.0 | Annual, 2016 and 2018+ | EOxCloudless by EOX, modified Copernicus Sentinel data + vintage | Remove newer mosaics: intended government/commercial use excluded |
| `https://services.sentinel-hub.com/ogc/wmts/{instance}` | Daily Sentinel true-color | **Yes** instance ID/account | 10m RGB | Service account terms + Copernicus data license | Sentinel archive; cloud scenes | Sentinel Hub / Copernicus | Remove: hard no-credential rule |
| `https://tiles.maps.eox.at/wmts/1.0.0/blackmarble_3857/default/g/{z}/{y}/{x}.jpg` | NASA night-lights mosaic | No | ~500m class source; not <=10m | NASA source / EOX service terms require verification | Static vintage unknown in app | NASA / EOX | Remove as basemap; research analysis-only input later |
| `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | CARTO styled OSM streets | No in code | Vector-derived, no sensor resolution | OSM ODbL + CARTO service conditions not yet verified | Rolling, no archive in app | OSM contributors / CARTO | Pending; prefer fully documented OSM service |
| `https://tiles.maps.eox.at/wmts/1.0.0/osm_3857/default/g/{z}/{y}/{x}.jpg` | OSM styled streets | No | Vector-derived, no sensor resolution | OSM ODbL + EOX WMTS noncommercial restrictions | Rolling, no dates exposed | OSM contributors / EOX | Remove service restrictions |
| `https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg` | Terrain relief | No | Not documented in repo; <=10m unproven | EOX service conditions | Unknown | EOX | Remove: resolution/rights unverified |
| `https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml` | Mosaic layer/year discovery | No | Metadata, N/A | EOX metadata/service | Live capabilities, cached 24h | N/A | Replace with compliant source discovery |
| `https://s2maps.eu` | Credit link only | No | N/A | EOX website | N/A | EOX | Replace when source removed |
| `https://www.openstreetmap.org/copyright` | License/attribution link | No | N/A | ODbL explanation | Living policy | OSM contributors | Retain with OSM data |
| `https://carto.com/attributions` | Credit/terms link | No | N/A | CARTO website | Living policy | CARTO | Remove if provider removed |
| `http://localhost:3000` | Metadata/robots/sitemap fallback | No | N/A | Local app | Each deploy | N/A | Replace default with actual public domain |
| `http://www.w3.org/2000/svg` | SVG namespace, **not fetched** | No | N/A | Standard identifier | N/A | N/A | Keep |

Build-time `next/font/google` fetches Inter/JetBrains Mono (SIL Open Font License);
fonts are then served locally. No data API/key. Evaluate local/system fonts for
reproducible builds and reduced initial transfer. npm/pnpm dependency registries
are build infrastructure, not map-data APIs. README boilerplate URLs are docs,
not runtime sources. The Git LFS spec URL in pointer files is a format identifier;
GitHub LFS downloads are development inputs, not user runtime dependencies.

## Primary evidence
- [EOX licensing FAQ](https://cloudless.eox.at/documentation/faq): 2018+ mosaics
  require commercial license for agency/B2B use; 2016 CC BY 4.0.
- [EOX 2024 release](https://eox.at/2025/03/sentinel-2-cloudless-2024/): 10m,
  annual mosaic and license split; public WMTS is noncommercial.
- [Copernicus Sentinel-2](https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2): free scientific/commercial data.
- [Microsoft SAS access](https://planetarycomputer.microsoft.com/docs/concepts/sas/):
  token required for blob access even without an account; strict-token-rule rejection.
- [OpenAerialMap API](https://docs.openaerialmap.org/api/api/): open imagery discovery;
  coverage, image license/date/resolution must be verified per image.

## Boundary inputs
`public/data/*.geojson` are computed repository LFS assets; originals now archived
in `data/raw-boundaries/*.geojson`. These are not external runtime
requests. Source, license and effective boundary date are **unknown**. They are
administrative reference shapes, not parcel/ownership data. Simplification ranges
~11–110m; these are vector boundaries, never imagery/basemaps. No inferred
license, official endorsement or historical boundary validity.

## Active registry after Phase 1 implementation

| URL | Provides | Key? | Native resolution | License | Update / history | Attribution |
| --- | --- | --- | --- | --- | --- | --- |
| `https://earth-search.aws.element84.com/v1/search` | Scene metadata and open COG URLs | No | Metadata; RGB assets 10m | Metadata via Earth Search; underlying Copernicus free/full/open data | Regular new scenes, global L2A Dec 2018 onward; UI from 2019 | Copernicus Sentinel-2 L2A / Earth Search |
| `https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/.../TCI.tif` | True-color COG HTTP ranges rendered in app | No | **10m**, checked from actual GeoTIFF before render | Copernicus Sentinel data legal notice | ~5-day repeat, usually published within hours of availability; versioned scene IDs | Contains modified Copernicus Sentinel data; Earth Search |
| `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg` | Static 2016 reference imagery | No | **10m** | CC BY 4.0, fair-use service, no SLA | 2016 only; cannot compare arbitrary periods | Sentinel-2 cloudless by EOX (Contains modified Copernicus Sentinel data 2016), CC BY 4.0 |
| `https://cloudless.eox.at` | Attribution/license link | No | N/A | Website | N/A | EOX |
| `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | OSM reference cartography | No | Vector-derived: **no sensor GSD**; source generalization varies. No raster terrain/imagery | ODbL database + OSMF standard tile usage policy | Rolling tiles, source freshness varies; no historical tile dates | © OpenStreetMap contributors (ODbL) |
| `https://registry.opendata.aws/sentinel-2-l2a-cogs/` | License/source attribution link | No | N/A | AWS registry metadata | Living docs | Earth Search |

At the Phase1 checkpoint, all seven original baseline providers were removed
or replaced and three audited registry entries remained. Esri has since been
restored on explicit user request (see the restoration section below); tests prevent adding coarse/keyed entries
through the normal registry. RGB uses source COG overviews for distant views;
10m is the native finest sensor spacing, **not** a claim that a whole-country
screenshot resolves 10m. Overzoom above z14 cannot create extra detail. Vector
reference streets are not raster observations and have no native sensor pixel
size. No coarse raster is displayed beneath them.

External domain/IP exposure: the server requests public imagery for a broad Rwanda
bbox; OSM/EOX tiles are fetched directly by the browser (IP/referer subject to
provider policies). No user identity or personal land ownership is requested.

## Dated building snapshots (added 2026-11-14)

| URL / asset | Provides | Key? | Native resolution | License | Update / history | Attribution |
| --- | --- | --- | --- | --- | --- | --- |
| `https://download.geofabrik.de/africa/rwanda-250101.osm.pbf` | Jan 2025 community OSM extract, offline ingestion only | No | Vector geometry; survey/tracing accuracy varies, unknown; not imagery | ODbL 1.0 | Fixed snapshot 2025-01-01T21:21:00Z; provider offers dated yearly/monthly/daily extracts | © OpenStreetMap contributors; extract by Geofabrik |
| `https://download.geofabrik.de/africa/rwanda-260101.osm.pbf` | Jan 2026 OSM extract, offline ingestion only | No | Vector geometry, unknown positional accuracy; not sensor pixels | ODbL 1.0 | Fixed snapshot 2026-01-01T21:21:30Z | Same |
| `/data/buildings/{version}/{tile}.json.gz` | Project-owned representative points, areas and broad use categories | No | Points quantized to ~0.11m, **not** accuracy; original footprint accuracy unknown | OSM-derived ODbL 1.0 | Two immutable versions; future updates generated offline and versioned | Same |

The web runtime makes no external building-data request. It loads bounded,
build-verified local gzip tiles; source hashes, mapping date and methods remain in
each manifest. Names, addresses, contributor identities and ownership fields are
not retained. Representative points are not cadastral/survey coordinates.
Dataset comparison is mapping change, not verified construction/demolition.
A source older than the requested period is identified by its actual data date;
no historical source is replaced by a future snapshot or zero.

Production metadata/robots/sitemap default to `https://rwanda-map.vercel.app`
(the deployment specified by the user), with an optional non-secret custom-domain
environment override. No credential environment variables remain in map sources.

Additional immutable source (2026-11-14):
`https://download.geofabrik.de/africa/rwanda-261001.osm.pbf`, no key; vector
geometry (accuracy varies; not imagery), ODbL1.0, monthly snapshot header
2026-10-01T20:22:06Z. Attribution © OpenStreetMap contributors, Geofabrik.
Active derived identifiers now include processing p2; original p1 indexes remain
archived outside runtime. Source hashes/dates are in manifests. Overture
GeoParquet probes are research-only: ODbL, anonymous, monthly releases but only
60 days of publicly retained geometry, native vector precision/source age varies;
© OpenStreetMap contributors, Overture Maps Foundation and source credits.
No Overture runtime endpoint or imagery layer added.

## Explicit user-requested Esri restoration (2026-11-15)
The user requested Esri be retained for its higher-resolution imagery. This is a
specific exception to the earlier open-data/blanket-resolution exclusion, not
an open-data classification. Original anonymous endpoint restored:
`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`.
No token/account used in live Kigali/rural tile requests (HTTP200, JPEG, CORS*).
Resolution is source/scale dependent, including lower-resolution overview data;
no universal sub-metre or Rwanda-wide pixel-size guarantee. Rolling mosaic,
capture date varies; arbitrary A/B imagery dates are not supported.
License: Esri Master License Agreement / World Imagery item terms, not CC/open
data. Attribution: Tiles © Esri; Source: Esri, Vantor, Earthstar Geographics,
and the GIS User Community, as observed in live service metadata. Esri and
underlying OSM credits appear in map PNGs. No offline tile-package harvesting,
source imagery redistribution or ML/ground-truth derivation rights are claimed.
Open dated building analysis/one-date-or-comparison mode works independently of
this reference basemap. See ADR0010/0011 for the current user instruction.
