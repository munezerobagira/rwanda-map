Rwanda building source records and actual source outlines

This minimized derivative database is available under ODbL 1.0:
https://opendatacommons.org/licenses/odbl/1-0/

Attribution: © OpenStreetMap contributors, Overture Maps Foundation;
Google Open Buildings; Microsoft ML Buildings.
Country coverage: World Bank, Rwanda Admin Boundaries and Villages (2012),
CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

No warranty of accuracy, completeness, residential use or fitness for purpose.
Buildings are not households. Release dates are not image/construction dates.
Esri imagery shown separately in the application is not part of this open database.

Source release and immutable machine-readable index:
/data/footprints/manifests/overture-2026-09-23.1-p1.json
/data/footprints/manifests/overture-2026-10-21.0-p1.json

Each tiles/outlineTiles entry references a project-owned gzip object at:
/data/footprints/objects/{hash}.json.gz
The SHA-256 hash applies to compressed bytes. Count is complete records per object.
No API key/account required. Objects are content-addressed and immutable.

Query point rows, tileZoom12:
[full GERS id, longitude * 1e6, latitude * 1e6, footprint area m²,
 use class, source bitset, maximum source-reported confidence percent or -1]
Use class:0 unknown,1 source house tag,2 other residential,3 nonresidential.
Sources:1 OpenStreetMap,2 Google Open Buildings,4 Microsoft ML Buildings,8 other.
Source confidence is uncalibrated here and is not used to change the counts.
It is not house probability or validated Rwanda accuracy.

Actual source outline rows, outlineZoom14:
[full GERS id, Polygon|MultiPolygon, GeoJSON coordinates]
Objects own outlines by representative point, not clipped tile fragments.
Coordinates quantized to 1e-6 degrees; that is not positional accuracy.

Source methodology: https://docs.overturemaps.org/guides/buildings/
Source licensing: https://docs.overturemaps.org/attribution/
Country clip source:
https://datacatalog.worldbank.org/search/dataset/0041453/rwanda-admin-boundaries-and-villages
Offline source processing is documented in the repository's scripts and ADR0012.
