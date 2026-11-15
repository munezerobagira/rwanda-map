# ADR 0008 — Explicit boundary reads before adding storage infrastructure

2026-11-15. Accepted for an experimentally measured implementation.

Current production traces: boundary batch87.19MiB, instrumentation85.65MiB,
analysis37.42MiB. Every boundary trace wrongly contains35.84MiB of building
assets because the filesystem path is assembled from a dynamic filename beneath
public/data. Six valid boundary files total49.76MiB. All asset/schema checks pass;
this is a trace over-inclusion, not evidence of needed boundary dependencies.

Alternatives:
1. More outputFileTracingExcludes globs. Small config edit, but prior measured
   route exclusions did not remove the standalone instrumentation trace. Fragile
   per-route lists would hide future missing-dependency errors.
2. Keep asset URLs/files and use six explicit literal file-read callbacks. No
   geometry/data/API/UI migration; static analysis can see the six real files.
   Catch missing files with the existing LFS/offline-preparation instructions.
3. Move building assets to a separate public directory. Likely bounds tracing,
   but changes direct asset URLs/ingestion paths and moves hundreds of files;
   still leaves dynamic boundary paths broader than their real requirements.
4. New object storage/PostGIS/PMTiles service. Better for many national versions,
   but adds hosting/operations without first fixing a local tracing mistake.

Choose2 first, measure with the actual installed Next16.2.6 tracer and retain
all existing APIs, selection/search/analysis/time/export behavior. If the tracer
still over-includes, try3 with a documented compatibility strategy before a new
backend. Never exclude required files merely to pass a size check.

Postbuild acceptance: all six required boundaries exist in boundary and startup
traces; neither includes any building index, raw boundary or archived file.
Analysis still includes every active building manifest/tile. Tests/lint/types/
build pass, live coordinate/name/tile/analysis routes pass. No time/UI change;
existing A/B selection/export regression tests must stay green. Browser-host
interaction acceptance remains separately pending.

Evidence: installed Next docs at
node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
read2026-11-15; official explanation of @vercel/nft filesystem analysis and narrow
tracing patterns: https://nextjs.org/docs/app/api-reference/config/next-config-js/output.

Measured result: literal callbacks reduced maximum87.19→51.35MiB (~41%).
Instrumentation49.81MiB contains all six boundaries and no building indexes;
analysis37.42MiB contains all active building inputs. Added structural postbuild
assertions, including required-file presence, so size reductions cannot pass by
silently dropping assets. All31 TS tests/types/lint/build pass; local coordinate/
name requests work. No active asset moves or provider changes were necessary.
