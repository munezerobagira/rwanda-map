# ADR 0001 — Preserve the stack and establish a verified baseline

Date: 2026-11-14. Status: accepted.

Alternatives: (A) suppress existing lint rules to allow the initial documentation
commit; (B) replace explicit `any` with GeoJSON types and narrow error values,
adding regression coverage first. Choose B: three integration tests passed against
the old behavior before type changes (the initial z0 tile assertion was corrected
to a Rwanda village-scale tile because geojson-vt drops tiny polygons at z0).
No lint rules weakened. `pnpm test`, `pnpm typecheck` now expose explicit checks.

Keep Next/TS/Leaflet rather than migrating to MapLibre or Python before profiling.
Current worker-backed boundary selection/export already meets the immediate
integration need. Existing boundary LFS hashes were recovered and verified, then
Git LFS installed locally so raw assets cannot accidentally enter a commit.

Baseline evidence: 3 regression tests; lint and typecheck clean; production build
passes. Real dev-server `/api/feature` resolves Kigali point to Ishema village,
Kiyovu cell, Nyarugenge sector/district. Browser visual QA attempted through the
provided browser tool but its host is unavailable. This is a recorded validation
gap, not a visual-pass claim. PNG and mobile interactions still need browser QA.

The existing global-any GeoJSON helpers are now Polygon/MultiPolygon typed.
Runtime semantics were kept unchanged; data validation at ingestion is later work.
