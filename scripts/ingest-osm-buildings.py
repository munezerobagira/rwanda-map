#!/usr/bin/env python3
"""Offline, reproducible PBF → dated point-in-footprint building index.

Requires osmium==4.3.2 shapely>=2 pyproj>=3; no production Python service.
Only explicit non-personal building tags survive. See ADR0004.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import tempfile
from urllib.parse import urlparse

import osmium
from pyproj import Geod
from shapely import from_wkb

REGION = json.loads((Path(__file__).resolve().parents[1] / 'src/lib/regions/rwanda.json').read_text())
ZOOM = 12
SCALE = 1_000_000
HOUSE = {'house', 'detached', 'semidetached_house', 'terrace', 'bungalow'}
RESIDENTIAL = {'residential', 'apartments', 'dormitory'}
NON_RESIDENTIAL = {'school', 'hospital', 'industrial', 'commercial', 'retail',
                   'office', 'church', 'mosque', 'temple', 'cathedral', 'chapel',
                   'warehouse', 'shed', 'garage', 'garages', 'farm_auxiliary',
                   'greenhouse', 'hangar', 'barn', 'stable', 'roof', 'kiosk',
                   'supermarket', 'hotel', 'public', 'service', 'toilets'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--source-url', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = urlparse(args.source_url)
    if source.scheme != 'https' or source.hostname != 'download.geofabrik.de':
        parser.error('Use an audited HTTPS Geofabrik source URL.')
    digest = hashlib.file_digest(args.input.open('rb'), 'sha256').hexdigest()
    if digest != args.sha256:
        raise ValueError('Source SHA-256 mismatch; refusing to generate an index.')
    with osmium.io.Reader(str(args.input)) as reader:
        timestamp = reader.header().get('osmosis_replication_timestamp')
    if not timestamp:
        raise ValueError('Missing source snapshot timestamp.')
    version = 'osm-' + timestamp[:10] + '-p2'
    destination = args.output / version
    if destination.exists():
        raise FileExistsError(f'{destination} already exists; use a new output path for a reproducible rebuild.')
    destination.mkdir(parents=True)
    geod = Geod(ellps='WGS84')
    stats = {'accepted': 0, 'invalid': 0, 'outsideRwandaBbox': 0, 'nonExisting': 0,
             'relationOuterWaysRemoved': 0}
    with tempfile.TemporaryDirectory(prefix='rwanda-building-ingest-') as tmp:
        connection = sqlite3.connect(str(Path(tmp) / 'points.sqlite'))
        connection.execute('PRAGMA journal_mode=OFF')
        connection.execute('PRAGMA synchronous=OFF')
        connection.execute('CREATE TABLE buildings (id INTEGER PRIMARY KEY, x INT, y INT, lon INT, lat INT, area INT, use INT)')

        class Handler(osmium.SimpleHandler):
            def __init__(self):
                super().__init__()
                self.factory = osmium.geom.WKBFactory()
                self.outers = {}
                self.suppressed = set()
                self.visited = 0

            def relation(self, relation):
                if (relation.tags.get('building') or relation.tags.get('disused:building')) not in (None, 'no') and relation.tags.get('type') == 'multipolygon':
                    self.outers[relation.id] = [m.ref for m in relation.members if m.type == 'w' and m.role in ('', 'outer')]

            def area(self, area):
                building = area.tags.get('building') or area.tags.get('disused:building')
                if not building:
                    return
                if building in ('no', 'construction', 'proposed', 'demolished', 'ruins'):
                    stats['nonExisting'] += 1
                    return
                original = area.orig_id()
                is_way = area.from_way()
                if is_way and original in self.suppressed:
                    return
                try:
                    geometry = from_wkb(bytes.fromhex(self.factory.create_multipolygon(area)))
                    if geometry.is_empty or not geometry.is_valid or geometry.area <= 0:
                        stats['invalid'] += 1
                        return
                    point = geometry.centroid
                    if not geometry.covers(point):
                        point = geometry.representative_point()
                    lon, lat = point.x, point.y
                    if not (REGION['bounds'][0] <= lon <= REGION['bounds'][2] and REGION['bounds'][1] <= lat <= REGION['bounds'][3]):
                        stats['outsideRwandaBbox'] += 1
                        return
                    square_metres = max(1, round(abs(geod.geometry_area_perimeter(geometry)[0])))
                    category = 1 if building in HOUSE else 2 if building in RESIDENTIAL else 3 if building in NON_RESIDENTIAL else 0
                    # An explicit service/shop tag is stronger evidence than an
                    # unqualified building=yes. Do not retain names/addresses.
                    if building == 'yes' and any(area.tags.get(k) for k in ('amenity', 'shop', 'industrial')):
                        category = 3
                    if area.tags.get('disused:building') or area.tags.get('disused') == 'yes':
                        category = 0  # Standing/disused is not absent, nor validated occupied housing.
                    x = math.floor((lon + 180) / 360 * 2**ZOOM)
                    y = math.floor((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**ZOOM)
                    object_id = original if is_way else -original
                    connection.execute('INSERT OR REPLACE INTO buildings VALUES (?,?,?,?,?,?,?)',
                                       (object_id, x, y, round(lon*SCALE), round(lat*SCALE), square_metres, category))
                    if not is_way:
                        for way in self.outers.get(original, []):
                            self.suppressed.add(way)
                            cursor = connection.execute('DELETE FROM buildings WHERE id=?', (way,))
                            stats['relationOuterWaysRemoved'] += cursor.rowcount
                    self.visited += 1
                    if self.visited % 100_000 == 0:
                        connection.commit()
                        print(f'{version}: processed {self.visited:,} building areas', flush=True)
                except (RuntimeError, ValueError) as error:
                    stats['invalid'] += 1
                    if stats['invalid'] <= 3:
                        print(f'Skipping invalid source geometry {object_id if "object_id" in locals() else original}: {error}', flush=True)

        handler = Handler()
        handler.apply_file(str(args.input), locations=True, idx='flex_mem')
        connection.commit()
        connection.execute('CREATE INDEX tile_index ON buildings(x,y)')
        tiles = {}
        total = 0
        categories = [0, 0, 0, 0]
        for x, y in connection.execute('SELECT DISTINCT x,y FROM buildings ORDER BY x,y'):
            rows = list(connection.execute('SELECT id,lon,lat,area,use FROM buildings WHERE x=? AND y=? ORDER BY id', (x, y)))
            name = f'{x}_{y}.json.gz'
            data = gzip.compress(json.dumps(rows, separators=(',', ':')).encode(), mtime=0)
            (destination / name).write_bytes(data)
            tiles[f'{x}_{y}'] = {'count': len(rows), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            total += len(rows)
            for row in rows:
                categories[row[4]] += 1
        stats['accepted'] = total
        manifest = {
            'schemaVersion': 1, 'processingVersion': 2, 'version': version, 'source': 'OpenStreetMap / Geofabrik Rwanda',
            'sourceUrl': args.source_url, 'sourceSha256': digest, 'dataDate': timestamp,
            'license': 'ODbL-1.0', 'attribution': '© OpenStreetMap contributors; extract by Geofabrik',
            'bbox': REGION['bounds'], 'tileZoom': ZOOM, 'coordinateScale': SCALE,
            'columns': ['osmIdSigned', 'longitudeE6', 'latitudeE6', 'footprintAreaM2', 'useClass'],
            'useClasses': {'0': 'unknown', '1': 'tagged-house', '2': 'other-residential', '3': 'non-residential'},
            'method': 'Valid OSM polygon areas; point-in-footprint count. Positive IDs are ways; negative IDs are multipolygon relations. Relation outer ways suppressed. Processing p2 retains standing disused buildings as unknown use.',
            'confidence': 'Unvalidated coverage and residential use; mapping snapshot is not acquisition or construction date.',
            'statistics': stats, 'classCounts': categories, 'tiles': tiles
        }
        (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        print(json.dumps({'version': version, 'records': total, 'tiles': len(tiles), 'compressedBytes': sum(t['bytes'] for t in tiles.values()), 'classes': categories, 'statistics': stats}), flush=True)


if __name__ == '__main__':
    main()
