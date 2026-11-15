# Building tally validation record

Date: 2026-11-14. **Not a ground-truth accuracy report.**

## What was actually checked

- Source PBF headers and SHA-256 recorded in manifests/research/buildings.md.
- Offline area assembly tested on a hand-authored OSM fixture: multipolygon
  holes, relation outer-way dedup, unknown use, dropped personal tags, and hash
  mismatch rejection. This validates processing behavior, not house detection.
- Runtime polygon inclusion tested for holes, multipart geometry and boundaries.
- Independent Shapely spatial query reproduced the TypeScript source tally for
  Ishema village (Kiyovu, Nyarugenge), point -1.9441, 30.0619:

| Dataset snapshot | Selected mapped structures | Source-side method |
| --- | ---: | --- |
| 2025-01-01T21:21:00Z | 192 | Prepared Shapely polygon covers source representative points |
| 2026-01-01T21:21:30Z | 193 | Same selection, distinct immutable source snapshot |

The live Next analysis route returned the same values in ~0.3s locally. The
2026 snapshot includes 9 tagged-house structures, 6 other residential, 148 unknown
use and 30 non-residential. The experimental conditional classification range is
9–163 **mapped structures only**. It is not an estimate or bound on all actual
houses in Ishema. The snapshot is January, even when a user requests October.

Tests verify that retagging the same source IDs cannot become new construction,
that zero mapped objects does not imply zero actual houses, that unavailable
historical data stays unavailable, and that the same snapshot for both requested
dates yields no temporal-change metric.

## Accuracy validation still required

| Setting | Independent labels | Precision / recall / count error |
| --- | --- | --- |
| Kigali urban | Not yet hand-labelled on eligible high-res imagery | **Not available** |
| Peri-urban | Not yet hand-labelled | **Not available** |
| Rural hillside village | Not yet hand-labelled | **Not available** |

OpenAerialMap query yielded no eligible <=1m Rwanda imagery for unrestricted use;
see per-image rights audit. SPARC pilot data are explicitly confidential despite
public HTTP access and must not be used. EO4Kigali historical research polygons
are CC BY 4.0 but do not license source photographs or provide current rural
truth. Continue the search for lawful, temporally matched independent labels.
Keep confidence low and the experimental classification flag reversible.

## UI acceptance gap

Supplied browser host is unavailable. Backend/source/export-object tests pass,
but map point interaction, mobile panels and actual combined PNG/CSV/GeoJSON
file downloads have not been visually verified. Do not tick those checks yet.

## Recent-source audit extension
October2026 OSM (processing p2) yields254 Ishema,289 Nyakarambi and0 Nyakarekare
mapped structures. Independent Shapely queries and runtime tests use identical
selection geometries/representative points. Overture September/October gives
476/669/390 for those same polygons. Details and hashes are in the research
source-audit report. These correlated datasets are **not** ground truth, so the
three-setting accuracy table above remains unvalidated. Zero now has an explicit
"source may omit this area" warning in inspector, PNG and CSV/GeoJSON limitations.
