# Idea backlog

2026-11-14, initial discovery. Score = value (1–5) / effort (1–5); evidence gates
implementation. Every item uses shared selection/results/date-aware module/export.

| Idea / target user | Decision/problem | Data / license | Effort | Value | Score | Risks | Integration / time acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Service counts: district planners/NGOs | Compare schools/clinics with mapped buildings | OSM ODbL, verify tags and Rwanda completeness | 2 | 5 | 2.5 | Rural omissions; mapped count != all facilities | Feature registry, selection, highlights, inspector, rw/en/fr, combined exports; dated OSM snapshots and integration fixture |
| Coverage honesty: citizens/investors | Avoid treating an unmapped village as empty | OSM/Ouverture metadata + independently validated sample, licenses to verify | 2 | 5 | 2.5 | No defensible numerical completeness without ground truth | Confidence rules shared across results/map/exports; distinguish mapping history from construction |
| Road accessibility: surveyors/planners | Find places underserved by roads | OSM ODbL | 3 | 4 | 1.33 | Straight-line distance != walking route; missing paths | Consume buildings+roads from common geometry/version; show dated approximate distance and export; test selection/time sync |

## Iteration 1 — measured bandwidth and source integrity

| Idea / target user | Problem | Source/license | Effort | Value | Score | Risks | Integration / acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Smaller imagery tiles / low-bandwidth mobile users | Sample tiles cost ~200KB each | Existing Copernicus RGB/open data; sharp Apache-2.0 | 1 | 5 | 5.0 | Lossy display; never use compressed tiles as quantitative data | Same map, swipe, PNG flow and source dates; benchmark WebP90 vs PNG on dated tile and verify alpha/headers; ADR0003 |
| Licensed boundary provenance / planners and officials | Unknown source date/rights undermines planning | World Bank CC BY 4.0; official NISR license under investigation | 3 | 5 | 1.67 | Replacing 14,823 with 14,815 old shapes changes coverage | Same five-tier selection/search/URL/export; compare IDs/geometry and dates, do not silently relabel existing assets |
| Snapshot-aware mapped-building coverage / diaspora investors | Mapping additions can look like construction | Geofabrik OSM ODbL; two verified snapshots | 3 | 5 | 1.67 | Incomplete rural data and unknown residential use | Shared feature registry, selection, highlights, date comparison and exports; fixtures distinguish mapped growth and residential uncertainty |

## Iteration 2 — integration gaps first

| Idea / target user | Problem | Data/license | Effort | Value | Score | Risks | Integration / time acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Readable dated PNG reports / planners and diaspora | Narrow cutouts squeeze source/method/confidence text | Existing open imagery + ODbL point results | 1 | 5 | 5.0 | Async map changes can mismatch date captions | Preserve shared geometry/worker snapshots, localize/wrap common footer; A/B data dates and result metrics included; tests + pending browser download check |
| Coalesced raster jobs / mobile users | Version/metadata rerenders can queue duplicate work | Same audited Copernicus COGs | 1 | 4 | 4.0 | A failed shared promise must be evicted for retry | Same source/date/revision key; one pending job per tile; fault/retry test and bounded queue |
| Measured panel space / low-end phone users | Variable translated timeline/details can cover results/tools | No new data | 2 | 5 | 2.5 | Resize observer feedback loops | Reuse common insets for controls/inspector/dock; test layout calculations with both periods and metadata expanded; browser gate remains explicit |
| Shared drawn selection / surveyors and citizens | Administrative units are too broad for a specific project | User-owned geometry + existing licensed sources | 2 | 5 | 2.5 | Invalid/self-crossed/out-of-coverage shapes; URL precision/privacy | Extend common selection/inspector/URL/export rather than a separate tool; rectangle/polygon tested with A/B count results and rw/en/fr |

## Iteration 3 — fresher evidence and reproducible uncertainty

| Idea / target user | Problem | Data/license | Effort | Value | Score | Risks | Integration / time acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Recent OSM mapping snapshots / local planners | January data can miss ten months of mapping edits | Geofabrik Rwanda ODbL monthly PBFs | 1 | 4 | 4.0 | Fresh mapping is not fresh construction; additional storage | Same snapshot selector, dates, analysis/results/map/all exports; header/hash verified, current/historical tests and build-trace budgets pass |
| Cross-source coverage audit / citizens and surveyors | One open source can omit structures without a numerical warning | Overture ODbL, OSM ODbL, licensed EO4Kigali historical polygons | 2 | 5 | 2.5 | Correlated sources and unmatched acquisition dates are not ground truth | Reuse selected geometry and two dated samples; source-date/processing differences explicit; no accuracy percentage or additive duplicate totals |
| Physical-structure lifecycle audit / planners | Disused tags can be mistaken for absent roofs | OSM tagging documentation/ODbL source snapshots | 2 | 5 | 2.5 | Altering processing changes counts without construction | Pin processing revision in manifest/cache/export; regression fixture for standing disused structures and relation dedup; compare method versions transparently |
| Historical archive retention / analysts | Overture publishes only 60 days of data despite older release notes | Overture release calendar/ODbL | 3 | 4 | 1.33 | Personal-data removal/retention obligations, source history inaccessible | Separate source acquisition/mapping/release/processing dates; retain only minimized lawful geometry and versioned aggregate inputs; actual cost/rights review before storing history |
