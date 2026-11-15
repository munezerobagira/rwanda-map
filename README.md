# Rwanda Map

A Rwanda-first map workstation built with Next.js 16, TypeScript, React,
Tailwind and Leaflet. Select administrative units from Province (Intara) down
to Village (Umudugudu), search places/coordinates, inspect boundaries, share
views, and export a map or selected boundary as PNG.

Development work toward dated building estimates and land intelligence is
tracked in [the checklist](docs/plan/CHECKLIST.md). Planned capabilities are not
validated product claims. See [progress](docs/plan/PROGRESS.md) to resume work.

## Run

Use Node >=20.9 and pnpm. Boundary assets in `public/data` require Git LFS:
`git lfs install`, then `git lfs pull`. Enable Git LFS support in Vercel Git settings for deployment. Pointer text is not valid GeoJSON.
Run `pnpm install --frozen-lockfile`, then `pnpm dev`; open localhost:3000.
Validate with `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`.

## Architecture

`Workstation` owns the view, selection and imagery year. `InteractiveMap` renders
Leaflet; a web worker fetches and paints compressed batched boundary tiles.
Next route handlers use a process-local GeoJSON store and geojson-vt indexes.
The inspector, focus mask, breadcrumb, URL and exports reuse one selection.
There is no database, account requirement or production analysis backend.

Read [feature integration](docs/architecture/features.md) before adding features,
[data source audit](docs/data-sources.md) before using providers, and
[ADRs](docs/adr) for decisions. Unknown source rights/dates must stay explicit.

## Dated building analysis (experimental)

Select a village/small area to calculate **Mapped buildings** automatically.
Use the count switch in the inspector to turn it off or on. On Esri/reference
imagery, the bottom controls select available mapping dates; **Compare counts**
switches between one date and two dates, applying changes immediately.
The same selection drives counts, map points, A/B snapshot changes and combined
CSV/GeoJSON/PNG output. Data date, mapping method and low confidence stay visible.
The January 2025/2026 and October 2026 OSM snapshots are mapping history, not
current imagery or a complete house census. Processing revision p2 retains
standing disused structures as unknown use. Unknown use remains unknown; the optional experimental classification
range describes mapped structures only. See [validation limits](docs/validation/building-tallies.md).

Original boundary inputs are archived in `data/raw-boundaries` and excluded from
web runtime reads. To explicitly regenerate simplified boundaries after Git LFS
hydration, run `pnpm data:boundaries`; `--check` verifies originals without writes.
Production builds validate all required boundary and building index assets and
reject server traces over the 100MiB project budget (including startup code).

For optional offline building-index regeneration, use Python 3.12 with
`requirements-data.txt` and `scripts/ingest-osm-buildings.py --help`. Source URLs,
SHA-256, mapping timestamp, license and methods must remain in each immutable
manifest. This is an offline preparation utility; the web application remains
Next.js/TypeScript. Python fixtures: `python -m unittest discover -s tests/data -v`.
Never commit national PBF inputs or contributor/ownership/address fields.

### Select a project area
Use the rectangle or polygon buttons in the existing map toolbar. Tap two
opposite rectangle corners, or at least three polygon corners, then Done. Undo
removes a corner; Cancel/Escape keeps your previous selection. Keyboard users can
focus/pan the map and add the center point. Drawn areas use rounded coordinates
(5 decimal degrees), at most 64 corners and 50km², and are not cadastral surveys.
They share the same dated mapped-building result and image/CSV/GeoJSON exports
as village selections. Copying the address shares the drawn geometry through a
URL fragment. Browser touch/keyboard/download QA remains pending.

Esri World Imagery is also available by explicit user request. It is an
Esri-licensed reference mosaic with variable resolution/capture dates, rather
than an open or arbitrarily dated imagery source. Dated mapped-building counts
work independently of that basemap; absence of mapped data is not zero houses.
