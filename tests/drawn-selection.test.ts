import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAreaSelection, areaFragment, parseAreaFragment, type DrawPoint } from '../src/lib/drawnSelection';
import { displayName, codeOf, selectionArea } from '../src/lib/selection';
import { readUrlState, writeUrlState } from '../src/lib/urlState';
import { buildingAnalysis } from '../src/lib/analysis/buildings';
import { selectionCsv, selectionGeoJson } from '../src/lib/selectionExport';
import { translate } from '../src/lib/i18n';
const corners: DrawPoint[] = [[30.0600012, -1.9450034], [30.0630012, -1.9420034]];
const date = '2026-11-14';

test('rectangle and polygon use the same canonical geometry, area and versioned analysis', async () => {
  const rectangle = createAreaSelection('rectangle', corners, date);
  assert.equal(rectangle.geometry.coordinates[0].length, 5);
  assert.deepEqual(rectangle.geometry.coordinates[0][0], [30.06, -1.945]);
  const polygon = createAreaSelection('polygon', rectangle.geometry.coordinates[0].slice(0, -1) as DrawPoint[], date);
  assert.deepEqual(polygon.geometry, rectangle.geometry);
  assert.equal(selectionArea(rectangle), selectionArea(polygon));
  assert.ok(rectangle.areaKm2 > 0 && rectangle.areaKm2 < 1);
  assert.equal(displayName(rectangle), 'Drawn rectangle');
  assert.equal(codeOf(rectangle), undefined, 'never invent an administrative code');
  const result = await buildingAnalysis.run({ geometry: rectangle.geometry, dates: ['2026-01-31', '2025-01-31'], featureTypes: ['buildings'] });
  assert.equal(result.snapshots.length, 2);
  assert.deepEqual(result.snapshots.map((s) => s.metrics?.mappedBuildings), [37, 41]);
  assert.equal(result.comparison?.absolute, -4);
  assert.ok(result.snapshots.every((s) => s.metrics && s.confidence === 'low'));
  for (const language of ['rw', 'en', 'fr'] as const) {
    const args = { selection: rectangle, snapshots: [], language, analysis: result };
    const json = selectionGeoJson(args);
    assert.deepEqual(json.features[0].geometry, rectangle.geometry);
    assert.equal(json.features[0].properties.geometry_created_at, date);
    assert.equal(json.features[0].properties.selection_kind, 'area');
    assert.equal(json.features[0].properties.boundary_source_date, null);
    const csv = selectionCsv(args);
    assert.match(csv, /osm-2026-01-01-p2/);
    assert.match(csv, /osm-2025-01-01-p2/);
    assert.ok(csv.includes(translate('Drawn rectangle', language)));
    assert.match(csv, /User-drawn rectangle/);
    assert.notEqual(translate('Copying this link shares the drawn geometry.', language), '');
  }
});

test('drawn areas reject collapsed/duplicate/crossing/oversized/outside shapes and malformed fragments', () => {
  const invalid: DrawPoint[][] = [
    [[30, -2], [30, -2], [30.01, -1.99]],
    [[30, -2], [30.01, -1.99], [30, -1.99], [30.01, -2]],
    [[0, 0], [0.01, 0], [0, 0.01]],
    [[29, -2.8], [30, -2.8], [30, -1.5]],
    [[30, -2], [30.01, -2], [30.005, -2], [30.005, -1.99], [30, -1.99]],
    Array(65).fill([30, -2])
  ];
  for (const points of invalid) assert.throws(() => createAreaSelection('polygon', points, date));
  assert.throws(() => createAreaSelection('rectangle', [[30, -2], [30, -1.99]], date));
  for (const fragment of [null, '', 'x'.repeat(4097), 'polygon|2026-02-30|30,-2;30.01,-2;30,-1.99', 'polygon|2026-11-14|NaN,-2;30,-2;30,-1', 'rectangle|2026-11-14|30,-2;30.01,-1.99|extra'])
    assert.equal(parseAreaFragment(fragment), undefined);
});

test('bounded geometry links roundtrip in fragment, preserve dates/language and keep legacy query support', () => {
  const area = createAreaSelection('rectangle', corners, date);
  assert.deepEqual(parseAreaFragment(areaFragment(area)), area);
  let replaced = '';
  const location = { search: '?sel=-1.94,30.06,village', pathname: '/', hash: '#note=kept' };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history: { state: null, replaceState: (_: unknown, __: string, next: string) => { replaced = next; } } } });
  try {
    assert.equal(readUrlState().selection?.level, 'village');
    writeUrlState({ area, compare: true, language: 'fr', period: { start: '2026-10-01', end: '2026-10-31' }, comparison: { start: '2025-10-01', end: '2025-10-31' } });
    const url = new URL(replaced, 'https://example.test');
    assert.equal(url.searchParams.has('area'), false);
    assert.equal(url.searchParams.has('sel'), false);
    assert.ok(url.hash.includes('area='));
    location.search = url.search;
    location.hash = url.hash;
    const restored = readUrlState();
    assert.deepEqual(restored.area, area);
    assert.equal(restored.language, 'fr');
    assert.equal(restored.compare, true);
    assert.equal(restored.comparison?.start, '2025-10-01');
    writeUrlState({ selection: { lat: -1.94, lng: 30.06, level: 'village' } });
    assert.ok(!replaced.includes('area='));
    assert.ok(replaced.includes('note=kept'));
  } finally { Reflect.deleteProperty(globalThis, 'window'); }
});
