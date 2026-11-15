import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { geometryAreaKm2, pointInGeometry, validateGeometry } from '../src/lib/analysis/geometry';
import { analyzeRows, buildingAnalysis, compareSnapshots } from '../src/lib/analysis/buildings';
import { buildingManifest, snapshotAt, type BuildingRow } from '../src/lib/analysis/buildingStore';
import { POST } from '../src/app/api/analysis/route';
import { selectionCsv, selectionGeoJson } from '../src/lib/selectionExport';
import { spatialStore } from '../src/lib/spatialStore';
import { ADMIN_LEVELS } from '../src/lib/adminLevels';
import type { AnalysisInput } from '../src/lib/analysis/types';
const outer = [
  [30, -2],
  [30.01, -2],
  [30.01, -1.99],
  [30, -1.99],
  [30, -2]
];
const hole = [
  [30.004, -1.996],
  [30.006, -1.996],
  [30.006, -1.994],
  [30.004, -1.994],
  [30.004, -1.996]
];
const geometry: GeoJSON.Polygon = { type: 'Polygon', coordinates: [outer, hole] };
const input: AnalysisInput = { geometry, dates: ['2026-10-31', '2025-10-31'], featureTypes: ['buildings'] };
const rows: BuildingRow[] = [
  [1, 30001000, -1999000, 100, 1],
  [2, 30002000, -1998000, 150, 0],
  [3, 30003000, -1997000, 600, 3],
  [4, 30005000, -1995000, 100, 1],
  [5, 30100000, -1900000, 100, 1]
];

test('geometry respects polygon holes, multipart pieces and bounded Rwanda requests', () => {
  assert.equal(pointInGeometry(30.001, -1.999, geometry), true);
  assert.equal(pointInGeometry(30.005, -1.995, geometry), false);
  assert.equal(pointInGeometry(30.004, -1.995, geometry), false);
  assert.equal(pointInGeometry(30.1, -1.9, geometry), false);
  assert.ok(geometryAreaKm2(geometry) > 1.18 && geometryAreaKm2(geometry) < 1.2);
  assert.ok(validateGeometry(geometry));
  assert.equal(validateGeometry({ type: 'Point', coordinates: [30, -2] }), false);
  assert.equal(
    validateGeometry({
      type: 'Polygon',
      coordinates: [
        [
          [30, -2],
          [99, -2],
          [30, -1.99],
          [30, -2]
        ]
      ]
    }),
    false
  );
  const multi: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      geometry.coordinates,
      [
        [
          [30.02, -2],
          [30.03, -2],
          [30.03, -1.99],
          [30.02, -1.99],
          [30.02, -2]
        ]
      ]
    ]
  };
  assert.ok(pointInGeometry(30.025, -1.995, multi));
  assert.ok(validateGeometry(multi));
});

test('mapped counts separate unknown use, conditional house range and unavailable history', async () => {
  const manifest = await buildingManifest('osm-2026-01-01-p2');
  const result = analyzeRows(input, input.dates[0], manifest, rows);
  assert.equal(result.metrics?.mappedBuildings, 3);
  assert.equal(result.metrics?.taggedHouseStructures, 1);
  assert.equal(result.metrics?.unknownUse, 1);
  assert.equal(result.metrics?.nonResidentialStructures, 1);
  assert.deepEqual(
    [result.metrics?.houseClassificationRange?.min, result.metrics?.houseClassificationRange?.max],
    [1, 2]
  );
  assert.equal(result.confidence, 'low');
  assert.match(result.metrics!.houseClassificationRange!.interpretation, /not a confidence interval/);
  const empty = analyzeRows(input, input.dates[0], manifest, []);
  assert.equal(empty.metrics?.houseClassificationRange, null);
  assert.ok(empty.limitations.some((message) => message.includes('does not establish zero houses')));
  const unavailable = analyzeRows(input, '2020-01-01', null, []);
  assert.equal(unavailable.metrics, null);
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(await snapshotAt('2024-12-31'), null);
});

test('retagging without changed source IDs cannot become mapped construction, same snapshot has no comparison', async () => {
  const a = await buildingManifest('osm-2026-01-01-p2'),
    b = await buildingManifest('osm-2025-01-01-p2');
  const latest = analyzeRows(
    input,
    input.dates[0],
    a,
    rows
      .map((r) => [...r] as BuildingRow)
      .map((r) => {
        if (r[4] === 1) r[4] = 2;
        return r;
      })
  );
  const old = analyzeRows(input, input.dates[1], b, rows);
  const delta = compareSnapshots([latest, old], geometryAreaKm2(geometry));
  assert.equal(delta?.absolute, 0);
  assert.equal(delta?.percent, 0);
  assert.deepEqual(delta?.addedSourceIds, []);
  assert.notEqual(latest.metrics?.taggedHouseStructures, old.metrics?.taggedHouseStructures);
  assert.match(delta!.interpretation, /not verified construction/);
  assert.equal(compareSnapshots([latest, latest], 1), null);
  assert.equal(compareSnapshots([latest, { ...old, processingVersion: 999 }], 1), null, 'mixed processing revisions must not become growth');
  assert.equal(compareSnapshots([latest, { ...old, source: 'Different source' }], 1), null, 'mixed source series must not become growth');
  const zero = analyzeRows(input, input.dates[0], b, []);
  assert.equal(compareSnapshots([latest, zero], 1)?.percent, null);
});

test('analysis route rejects malformed selections and never converts missing source history to zero', async () => {
  for (const body of ['null', '{}', 'not json']) {
    assert.equal((await POST(new Request('http://localhost/api/analysis', { method: 'POST', body }))).status, 400);
  }
  const response = await POST(
    new Request('http://localhost/api/analysis', {
      method: 'POST',
      body: JSON.stringify({ ...input, dates: ['2020-01-01'] })
    })
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).snapshots[0].metrics, null);
  const compressed = await POST(
    new Request('http://localhost/api/analysis', {
      method: 'POST',
      headers: { 'Accept-Encoding': 'gzip' },
      body: JSON.stringify({ ...input, dates: ['2020-01-01'] })
    })
  );
  assert.equal(compressed.headers.get('Content-Encoding'), 'gzip');
  assert.equal(compressed.headers.get('Vary'), 'Accept-Encoding');
  assert.equal(
    JSON.parse(gunzipSync(Buffer.from(await compressed.arrayBuffer())).toString()).snapshots[0].metrics,
    null
  );
});

test('real Ishema selection shares two dated counts, map features and combined exports across all locales', async () => {
  const selected = await spatialStore.findFeatureAt('villages', 30.0619, -1.9441);
  assert.ok(selected);
  const result = await buildingAnalysis.run({ ...input, dates: ['2026-01-31', '2025-01-31'], geometry: selected.geometry });
  assert.deepEqual(
    result.snapshots.map((s) => s.metrics?.mappedBuildings),
    [193, 192]
  );
  assert.equal(result.comparison?.absolute, 1);
  assert.equal(result.snapshots[0].features.features.length, 193);
  const repeat = {
    ...result,
    snapshots: [result.snapshots[0], { ...result.snapshots[0], requestedDate: '2026-05-31' }],
    comparison: null
  };
  const repeated = selectionGeoJson({
    selection: {
      kind: 'feature',
      geometry: selected.geometry,
      level: ADMIN_LEVELS[4],
      props: selected.properties,
      point: { lat: -1.9441, lng: 30.0619 }
    },
    snapshots: [],
    language: 'en',
    analysis: repeat
  });
  assert.equal(repeated.features.length, 194, 'same source snapshot should not duplicate exported building points');
  for (const language of ['rw', 'en', 'fr'] as const) {
    const bundle = {
      selection: {
        kind: 'feature' as const,
        geometry: selected.geometry,
        level: ADMIN_LEVELS[4],
        props: selected.properties,
        point: { lat: -1.9441, lng: 30.0619 }
      },
      snapshots: [],
      language,
      analysis: result
    };
    const geo = selectionGeoJson(bundle),
      csv = selectionCsv(bundle);
    assert.deepEqual(geo.features[0].geometry, selected.geometry);
    assert.equal(geo.features.length, 386);
    assert.equal(new Set(geo.features.slice(1).map((f) => f.id)).size, 385);
    assert.match(csv, /osm-2026-01-01-p2/);
    assert.match(csv, /osm-2025-01-01-p2/);
    assert.match(csv, /low/);
    assert.ok(csv.includes(`"${language}"`));
  }
});

// Processing suffixes must never be interpreted as part of the mapping date.
test('dated source selection uses actual source timestamps and preserves older snapshots', async () => {
  assert.equal((await snapshotAt('2026-09-30'))?.version, 'osm-2026-01-01-p2');
  assert.equal((await snapshotAt('2026-10-01'))?.version, 'osm-2026-10-01-p2');
  assert.equal((await snapshotAt('2025-12-31'))?.version, 'osm-2025-01-01-p2');
  assert.equal((await snapshotAt('2026-10-31'))?.processingVersion, 2);
});

test('recent urban, outskirts and hillside mapping tallies remain source-qualified, including zero coverage', async () => {
  for (const [lat, lng, expected] of [[-1.9441, 30.0619, 254], [-2, 30.19, 289], [-1.65, 30.03, 0]]) {
    const selected = await spatialStore.findFeatureAt('villages', lng, lat);
    assert.ok(selected);
    const result = await buildingAnalysis.run({ geometry: selected.geometry, dates: ['2026-10-31'], featureTypes: ['buildings'] });
    const snapshot = result.snapshots[0];
    assert.equal(snapshot.sourceVersion, 'osm-2026-10-01-p2');
    assert.equal(snapshot.processingVersion, 2);
    assert.equal(snapshot.metrics?.mappedBuildings, expected);
    assert.equal(snapshot.confidence, 'low');
    if (expected === 0) assert.ok(snapshot.limitations.some((s) => s.includes('does not establish zero houses')));
  }
});
