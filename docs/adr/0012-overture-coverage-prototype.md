# ADR 0012 — Prototype national open footprint coverage, not live ad-hoc totals

2026-11-15. Research prototype authorized within the ongoing mission; runtime
integration waits for measurements, dated fixtures and all existing checks.

User's selected Amahoro village has0 OSM structures but973 Overture footprint
representatives(849 Google/124 Microsoft), all unknown residential subtype.
Other same-selection audits show0 vs390 in Nyakarekare and254 vs476 in Ishema.
Sources are correlated and capture dates unknown; these are not house accuracy
or omission percentages. Esri restoration does not authorize ML/ground-truth
extraction from its imagery.

Compare(1) live GeoParquet queries per selected polygon, using DuckDB/native or
Python service, with(2) offline projected-column ingestion of national Overture
GeoParquet into project-owned bounded query tiles. Choose2 for a prototype: no
runtime account/key, deterministic minimized rows, no large native server query
engine or extra service, existing selection/query/export contracts retained.
Never use Overture's inspection-only public PMTiles as production backend.

Compare full independent snapshot tile copies with content-addressed immutable
tile reuse across releases. Measure both before choosing. National counts may
exceed the100MiB function budget even after boundary trace isolation. Do not
raise budgets or drop features/precision silently; use static-range storage if
necessary. Preserve full stable source IDs (no lossy identifier hashing/collisions).

Prototype two actually accessible releases(2026-09-23.1/2026-10-21.0), not old
release notes whose geometry is gone after60 days. Release date is not building
capture/construction date. Future UI must have explicit source series; never
silently replace OSM with Overture across the same A/B comparison. Missing source
history stays unavailable. Count building objects, never building_part objects.
No additive source totals or residential assumptions for untyped footprints.

Keep only public source ID, representative point, footprint area, broad use and
source/existence-confidence information if validated; drop names/addresses/all
other attributes. Source-existence confidence is not residential confidence.
Clip to a verified licensed Rwanda boundary, disclose its date/uncertainty; bbox
queries alone include neighboring-country records. Country mask alternatives:
World Bank2012 CC BY4 districts union vs geoBoundaries ADM0(CC BY4 but unusual
Sentinel-LULC source). Prefer documented World Bank district coverage for research
until actual boundary/coverage checks. No relabeling of existing unknown assets.

Sources/access2026-11-15: official Overture guides/attribution/cloud-sources/
release-calendar documented in ADR0009 and research/buildings.md. Official Python
client2.1.1's query preparation inspected; any private helper used in the offline
prototype is pinned/version-checked and must fail clearly after incompatible
updates. World Bank dataset0041453 explicitly CC BY4.0 and2012 boundary vintage.

User further requests the highest possible accuracy and a way to see what is
counted, especially on Esri. Prioritize inspectable open footprint outlines over
more opaque count heuristics. Preserve authoritative query points for counting;
render actual source polygons for inspection (not circles scaled to area and not
fabricated roof boxes). Prototype a separate content-addressed z14 geometry tile
store so immutable identical tiles can be reused between releases and geometry
is loaded only for the visible map area. Keep bulky display geometry outside
server query traces. Compare individual compact geometry tiles vs PMTiles after
national size/transfer measurements. User toggles/language/A-B/map PNG and combined
exports must consume the same selected source IDs/geometry versions. No silent
truncation or accuracy/house-probability claims from footprint confidence alone.

Storage/query alternatives for actual outlines: bundle all national geometry in
analysis functions (likely over100MiB) versus keep geometry as project-owned
static content-addressed chunks and load only the selected chunks from a trusted
same-origin asset base. Measure the second option. Query points remain local and
complete; outline failure must not erase counts. Return an explicit outline
availability/status, and never silently draw a partial set as complete. Shared
AnalysisSnapshot may carry optional actual Polygon/MultiPolygon outlines with
stable IDs/representative points, used by map/PNG and combined GeoJSON; CSV keeps
per-date metrics and provenance. Response budget still applies. Trusted origin
must be from an explicit deployment/localhost allowlist, never arbitrary caller
URLs/Host header. No untraced filesystem dependency or external keyed backend.


## Measured implementation, 2026-11-15

October national probe completed in624s:8,282,418 bbox objects;5,727,334
country-covered representatives,2,555,084 neighbors excluded,0 invalid geometries.
Use:5,700,914 unknown;24,100 other residential;1,224 nonresidential;1,096
house-tag class. Source occurrences1,406,609OSM/3,694,363Google/626,362Microsoft.
These are coverage/use tallies, not precision/recall or surveyed houses.

Point tiles183,747,914 compressed bytes exceed100MiB function budget. Actual
outlines307,302,577 bytes. Choose project-owned static content-addressed gzip
objects with tiny bundled dated manifests; bounded same-origin server fetch
(no caller-supplied URL/Host, redirects rejected), hash/byte verification,16MiB
compressed LRU, two concurrent transfers,10s fetch timeout,32MB inflate cap.
Query remains complete<=10,000 selected structures/date,16z12tiles,50km²,
16MB selected compressed source transfer; oversized selection refused.
Outline ownershipz14 by the same representative point (not clipped fragments),
<=64selected chunks, exact selected-ID matching, all-or-none status. Full actual
polygons/MultiPolygons preserve holes. Geometry delivery failure preserves counts
and explicitly returns unavailable status.3.5MB response cap strips all outlines
with budget status before count-only size refusal. Never fake a roof shape.

Source is explicit in inspector/URL; OSM default preserved. Switching source
selects available source dates; no additive totals or mixed-source comparisons.
Map, inspection, PNG and combined GeoJSON share selected IDs and actual polygons;
CSV retains dated metrics/method/limitations. Overlay may be hidden to inspect
underlying Esri without disabling the analysis. October local API checks:
user-current village66OSM vs957OVT +957outlines; Amahoro0OSM vs973OVT+973outlines.
Local API~0.15–0.26s warm, not production/mobile performance or accuracy.
Browser control host remains unavailable; actual visual alignment/touch QA pending.

Static footprint budget850MiB/10,000unique objects;100MiB function budget unchanged.
This is a measured Rwanda-only starting cap with room for a deduplicated second
release, not an unlimited/free hosting promise. The initial full source geometry
is about491MB decimal; selected transfers only in the user flow. LFS stores assets;
no deployment or storage plan purchase. Sept23 national import/immutable object
reuse measurement is ongoing. Pinned offline importer and packager are in scripts;
source files disappear after60days, so keep minimized immutable lawful artifacts.

Concurrency review: per-request two transfers alone can multiply across many
simultaneous selections. Compare a shared per-asset queue with a shared complete
analysis queue. Choose the existing tested WorkCache for complete Overture
analyses(2running,4waiting,1.5squeue,2completed/60s), keyed by exact sanitized
selection+dates. This bounds concurrent decode/transfer jobs and coalesces
identical analyses without binding shared fetch cancellation to one browser.
Per-date point transfer8s aggregate and optional outline4s aggregate keep two
dates within30s route budget; failures are unavailable rather than partial counts.

Second release validation completed: September2026-09-23.1 has the same5,727,334
minimized point records AND byte-identical geometry tile content as October.
All4,293 immutable objects reused; two manifests, still468.30MiB compressed
objects. Genuine two-date comparison is0 mapped dataset change, never evidence
of zero construction. Offline packager uses<=4processes, deterministic gzip/
full IDs; fixture proves changing geometry with unchanged point/area changes
outline hash and never incorrectly reuses geometry based on points alone.

Public derivative-database manifests and README with ODbL offer/attribution and
format are under/data/footprints; public/runtime manifest byte equality checked.
Both CSV and GeoJSON include the immutable source-index URL; PNG credits actual
suppliers/country clip. Esri pixels are excluded from open source-data objects.
A private local inspection render using the real export renderer over Esri
shows the selected source outlines, but is not browser/mobile QA or quantified
accuracy; not committed into the open dataset. Browser host unavailable.

Dense drawn1.24km² probe returns4,005 complete records/date and an explicit
count-only outline budget fallback(2.74MB/two dates);2.78km² dense probe refuses
oversized complete export(413), without truncation or zero substitution.
