"""Package the minimized offline SQLite probe into immutable project-owned assets.

No network/runtime dependency. Full GERS IDs are retained; coordinates are
quantized to 1e-6 degrees, not surveyed to that accuracy. Run after ingestion:
python scripts/package-overture.py INPUT_DIRECTORY OUTPUT_DIRECTORY [WORKERS=4]
"""
import gzip
import hashlib
import json
import math
import sqlite3
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path


def encoded(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()


def tile(lon, lat, zoom):
    return (math.floor((lon / 1e6 + 180) / 360 * 2**zoom),
            math.floor((1 - math.asinh(math.tan(math.radians(lat / 1e6))) / math.pi) / 2 * 2**zoom))


def save(rows, objects):
    data = gzip.compress(encoded(rows), compresslevel=9, mtime=0)
    digest = hashlib.sha256(data).hexdigest()
    file = objects / f'{digest}.json.gz'
    if not file.exists():
        file.write_bytes(data)
    return {'hash': digest, 'count': len(rows), 'bytes': len(data)}


def package_tile(arguments):
    root, objects, x, y = arguments
    connection = sqlite3.connect(f'file:{root / "minimized.sqlite"}?mode=ro', uri=True)
    rows = list(connection.execute('SELECT id,lon,lat,area,use,source,confidence,geometry FROM buildings WHERE x=? AND y=? ORDER BY id', (x, y)))
    connection.close()
    point_entry = save([row[:7] for row in rows], objects)
    chunks = {}
    for row in rows:
        key = '_'.join(map(str, tile(row[1], row[2], 14)))
        kind, coordinates = json.loads(row[7])
        if kind not in ('Polygon', 'MultiPolygon'):
            raise ValueError(f'Unexpected building geometry {kind}')
        chunks.setdefault(key, []).append([row[0], kind, coordinates])
    return f'{x}_{y}', point_entry, {key: save(records, objects) for key, records in sorted(chunks.items())}


def package(root, output, workers=4):
    if workers < 1 or workers > 4:
        raise ValueError('Use one to four bounded offline workers')
    source = json.loads((root / 'manifest.json').read_text())
    connection = sqlite3.connect(f'file:{root / "minimized.sqlite"}?mode=ro', uri=True)
    objects = output / 'objects'
    objects.mkdir(parents=True, exist_ok=True)
    jobs = [(root, objects, x, y) for x, y in connection.execute('SELECT DISTINCT x,y FROM buildings ORDER BY x,y')]
    connection.close()
    points, outlines = {}, {}
    with ProcessPoolExecutor(max_workers=workers) as executor:
        for key, point_entry, outline_entries in executor.map(package_tile, jobs):
            points[key] = point_entry
            for outline_key, entry in outline_entries.items():
                if outline_key in outlines:
                    raise ValueError('Unexpected overlapping tile ownership')
                outlines[outline_key] = entry
            print(f'{source["release"]} {key}: {point_entry["count"]} records', flush=True)
    manifest = {
        'schemaVersion': 1, 'processingVersion': 1,
        'version': f'overture-{source["release"]}-p1',
        'source': 'Overture Maps Foundation / buildings',
        'dataDate': source['release'][:10], 'release': source['release'],
        'license': source['license'], 'attribution': source['attribution'] + '; country coverage: World Bank Rwanda Admin Boundaries and Villages (2012), CC BY 4.0',
        'sourceUrl': 'https://docs.overturemaps.org/guides/buildings/',
        'coordinateScale': 1000000, 'tileZoom': 12, 'outlineZoom': 14,
        'method': 'Count one centroid (or interior point for concave footprints) per Overture building object inside selection; source-conflated GERS IDs, building parts excluded. Country clip: World Bank 2012 district coverage. Coordinates quantized to 1e-6 degrees, not positional accuracy.',
        'confidence': 'low', 'statistics': source['statistics'],
        'countryMask': source['countryMask'], 'countryMaskSha256': source['countryMaskSha256'],
        'queryFiles': source['queryFiles'], 'sourceCounts': source['sourceCounts'],
        'useClasses': source['useClasses'], 'tiles': points, 'outlineTiles': outlines,
        'pointCompressedBytes': sum(t['bytes'] for t in points.values()),
        'outlineCompressedBytes': sum(t['bytes'] for t in outlines.values())
    }
    (output / f'{manifest["version"]}.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print({k: manifest[k] for k in ('version', 'pointCompressedBytes', 'outlineCompressedBytes')}, flush=True)


if __name__ == '__main__':
    package(Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3]) if len(sys.argv) > 3 else 4)
