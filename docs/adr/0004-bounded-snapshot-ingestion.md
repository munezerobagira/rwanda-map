# ADR 0004 — Local dated building snapshots and deployable boundary traces

Date: 2026-11-14. Status: accepted for implementation; measured data gates below.

## Counting source / serving alternatives

1. Live public Overpass: rejected due explicit upstream policy against serving
   non-mapper apps from shared backend and three 22s timeouts. History query
   semantics alone do not make the service a sustainable dependency.
2. Overture Rwanda GeoParquet + generated PMTiles/PostGIS: broad coverage and
   conflation, good national target. Needs ingestion/hosting/index measurements;
   published Overture PMTiles explicitly inspection-only, not production.
3. Geofabrik Rwanda dated PBF + project-owned compact point indexes: verified
   two 52/58MiB source downloads, ~1m building-tagged ways each. Smallest initial
   transparent mapping-count service; no runtime external dependency or token.

Choose 3 for an explicitly experimental mapped-building module, while continuing
Overture/Google evaluation. Node/TS remains the sole web backend. An offline
Python/Osmium utility correctly assembles OSM relations with streaming location
indexes; a handwritten TS PBF/relations implementation is unnecessary risk.
Store point-in-footprint, source area, broad use category and stable source ID,
partitioned by z12 tile and source date. Quantize point coordinates to 1e-6°
(~0.11m), not a source-accuracy claim. GeoJSON export must identify these as
representative **points**, never fabricated footprint polygons. Count by the
same point-in-selected-polygon rule, including holes and multipart geometries.
Retain raw source hashes/timestamps/URL/ODbL and source IDs in the manifest.
Do not expose source contributor identity, ownership or individual addresses.

Multipolygon outer ways must not double-count their relation. Normalize tags
without pretending `building=yes` is residential. Jan 2025→2026 tag audit found
house tags falling from 22,035 to 324 while residential tags rose from 4,661 to
24,018. Any change is **mapped dataset change**, not verified construction.
House classification uncertainty and coverage uncertainty must be separate.
No calibrated Rwanda total-house estimate or precision/recall is available yet;
keep house inference behind a feature flag and do not report fake confidence.

## Existing deployment problem discovered

Production trace for `/api/feature` includes all 12 boundary assets (~248.0MB),
even though the six simplified/current files suffice at runtime. Total traced
files are ~238.1MiB before new building data, already near Vercel's 250MB cap.
Compare (A) exclude only unused raw inputs from function tracing, validating all
precomputed files at build time; (B) migrate all boundaries to PMTiles/object
storage now. Choose A as the smallest safe change; preserve local generation
fallback, but deployment cannot depend on it. Never broadly exclude all data.
Measure new trace size and source-index compressed size before bundling them.
If project-owned indexes exceed the budget, stop that serving approach and use
static client tiles or source storage; do not force a too-large function bundle.

Sources: docs/research/buildings.md; installed Next16 output tracing guide.
Performance/cost estimates will be updated after ingestion, not guessed from
national object counts. Historical versions are immutable and date-keyed.

The 250MB threshold is a conservative default bundle budget; Vercel's July 2026
large-function support can opt into 5GB, but this project must not assume that
flag or pay/plan changes. Excluding redundant inputs is preferable regardless.
Git LFS support must be enabled in Vercel Git settings. The build now fails
clearly on pointer assets rather than silently shipping invalid GeoJSON.
Sources accessed 2026-11-14:
https://vercel.com/docs/project-configuration/git-settings
https://vercel.com/changelog/vercel-functions-can-now-be-up-to-5-gb-in-package-size
https://vercel.com/docs/functions/limitations

Legacy grid demo is hidden by a reversible flag: synthetic electricity fields
are not useful planning evidence, have no observation dates and cannot be mixed
with the dated building module. The legacy stats API keeps its existing fields
for compatibility but now explicitly labels synthetic status, method, absent
observation date and no confidence. New selection exports omit those synthetic
fields. Product metadata now describes the real map instead of claiming an
unimplemented national electrical-grid/NSDI service.

Counting responses reuse the existing compressed JSON service and advertise
`Vary: Accept-Encoding`. A 3.5MB uncompressed result budget rejects oversized
complete exports before Vercel's payload limit; no silently truncated feature set.

Follow-up full-trace audit found startup instrumentation was **not matched** by
`'/*'` (its entry has no leading slash): its trace still carried all raw inputs,
and rose to 257.96MiB after adding dated point indexes. Added explicit
`instrumentation` and `next-server` matchers, and a postbuild guard over **every**
server trace. The guard rejects raw-input leakage and enforces a conservative
100MiB project budget, including common startup code. Boundary asset names/counts
now live in the same Rwanda region pack used by build validation and config.
Route-only size checks are not enough to establish a deployable function bundle.

The explicit matchers also failed to trim the standalone instrumentation trace
in the installed Next16 build; the new postbuild guard correctly rejected it.
Final structural fix: archive original boundary inputs outside `public/`, remove
raw-input fallback reads/writes from the web runtime, and provide an explicit
offline regeneration command using the same extracted simplification helpers.
Build-time asset validation guarantees the precomputed inputs exist. This avoids
both oversized startup bundles and attempts to write a read-only deployment.
Alternative of rewriting `.nft` manifests after build was rejected: fixing the
runtime dependency is safer than hiding what the tracer reports. Existing
selection/search/tiles tests precede this refactor and must stay green.
