# ADR 0007 — Recent mapping snapshots and explicit processing versions

2026-11-14. Research/implementation in progress.

Two ways to improve stale January input: (1) append a recent immutable Geofabrik
OSM extract to the existing dated pipeline, retaining type/history semantics;
(2) replace counts with Overture's conflated OSM/Google/Microsoft data. Choose1
first. Overture has worked anonymously and can improve coverage, but most use
classes remain unknown, timestamps differ, historical geometry is only publicly
retained60 days, and adding Overture totals to OSM would duplicate structures.
Continue a common-geometry source audit before any production source switch.

Monthly input alternatives: live latest PBF is reproducible only by stored hash
and can move between requests; immutable rwanda-261001.osm.pbf identifies the
published Oct1 snapshot. Choose the latter, verify SHA256 and internal timestamp,
store no raw national PBF in web assets. The same source-at-or-before-date rule
must preserve earlier snapshots. Additional national compressed tile size and
all Vercel function/startup traces must fit the existing100MiB project budget.

A processing audit found that `building=*` plus `disused:building=*` was excluded.
OSM lifecycle guidance says disused features may still be physically present.
Unused housing must not automatically become a missing roof. Need preserve
standing structures as unknown residential use, while explicit proposed,
construction, demolished and ruined tags stay excluded. Sources with only a
lifecycle-prefixed building key need a deliberate geometry/use rule and fixture.

Processing alternatives: silently replace files at the same version/cache key,
or make processing revision part of immutable derived identifiers and manifest.
Choose explicit revision. Existing p1 snapshot assets/results remain valid as
historical implementation records. New p2 outputs must use distinct identifiers;
actual mapping date remains independent of that suffix. Reprocess dates needed
for comparison consistently before presenting p2 change. Export/source details
must identify the revision. Do not call processing deltas construction.

Sources accessed2026-11-14:
- https://download.geofabrik.de/africa/rwanda.html — anonymous dated extracts,
  contributor metadata removed, update dates (page observations may differ by cache).
- https://wiki.openstreetmap.org/wiki/Lifecycle_prefix — lifecycle vs physical state.
- https://wiki.openstreetmap.org/wiki/Key:disused: — disused objects remain in
  reasonable repair; not evidence of demolition.
- https://docs.overturemaps.org/guides/buildings/ — roof/structure scope, source
  priority/conflation and unknown residential use.
- https://docs.overturemaps.org/release-calendar/ — public geometry retention60 days.

Packaging refinement: keeping old p1 files in public/data alongside all p2 dates
would duplicate ~22MB in broad Next file traces, likely violating100MiB when the
recent source is added. Archive the original p1 files outside runtime under
`data/archived-building-indexes`; preserve their immutable manifests/hashes and
Git history for offline reproduction. Runtime/prebuild explicitly allow only the
three p2 dates. No deployed API accepted a source-version selector; old admin/view
URLs remain compatible, and old exported reports already contain their source
versions/results. This avoids silently rewriting original p1 assets while keeping
one consistent processing generation in active comparisons. Add no runtime path
back into the archive. All route/startup traces must still be measured.
