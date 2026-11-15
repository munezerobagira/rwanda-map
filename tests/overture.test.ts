import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { overtureAnalysis, attachOutlines, overtureManifests } from '../src/lib/analysis/overture';
import { POST } from '../src/app/api/analysis/route';
import { spatialStore } from '../src/lib/spatialStore';
import { analysisMapFeatures, buildingInspectionLines } from '../src/lib/analysis/presentation';
import { selectionCsv, selectionGeoJson } from '../src/lib/selectionExport';
import { ADMIN_LEVELS } from '../src/lib/adminLevels';
import { buildingDatesFor, buildingDateAtOrBefore } from '../src/lib/analysis/timeControls';
import { translate } from '../src/lib/i18n';

test('national Overture records provide complete actual outlines for both user-reported selections and preserve exports', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.match(url.pathname, /^\/data\/footprints\/objects\/[a-f0-9]{64}\.json\.gz$/);
    return new Response(await readFile(`public${url.pathname}`));
  }) as typeof fetch;
  try {
    for (const [lat, lon, expected] of [[-1.94545, 30.01761, 957], [-2.15605, 30.54348, 973]]) {
      const selected = await spatialStore.findFeatureAt('villages', lon, lat);
      assert.ok(selected);
      const result = await overtureAnalysis.run({ geometry: selected.geometry, dates: ['2026-10-31'], featureTypes: ['buildings'] });
      const snapshot = result.snapshots[0];
      assert.equal(snapshot.metrics?.mappedBuildings, expected);
      assert.equal(snapshot.outlineStatus, 'available');
      assert.equal(snapshot.outlines?.features.length, expected);
      assert.equal(result.comparison, null);
      assert.equal(new Set(snapshot.features.features.map((f) => f.properties.sourceId)).size, expected);
      assert.ok(analysisMapFeatures(result).every(({ feature }) => feature.geometry.type !== 'Point'));
      assert.ok(snapshot.features.features.every((f) => f.properties.sourceDatasets?.length));
      const selection = { kind: 'feature' as const, geometry: selected.geometry, props: selected.properties, level: ADMIN_LEVELS[4], point: { lat, lng: lon } };
      for (const language of ['rw', 'en', 'fr'] as const) {
        const bundle = { selection, snapshots: [], language, analysis: result };
        const geo = selectionGeoJson(bundle), csv = selectionCsv(bundle);
        assert.equal(geo.features.length, expected + 1);
        assert.ok(geo.features.slice(1).every((f) => f.geometry.type !== 'Point'));
        assert.ok(!JSON.stringify(geo.features[0].properties).includes('"outlines":'));
        assert.ok(geo.attribution.includes('Google Open Buildings'));
        assert.ok(csv.includes(snapshot.sourceVersion!));
        const lines = buildingInspectionLines(snapshot.features.features[0].properties, (key) => translate(key, language), true);
        assert.ok(lines.includes(translate('Actual source footprint; alignment and completeness are unvalidated.', language)));
      }
      const pairResponse = await POST(new Request('http://localhost/api/analysis', { method: 'POST', body: JSON.stringify({ geometry: selected.geometry, dates: ['2026-10-31', '2026-09-30'], source: 'overture', featureTypes: ['buildings'] }) }));
      assert.equal(pairResponse.status, 200);
      const pair = await pairResponse.json();
      assert.deepEqual(pair.snapshots.map((s: { metrics: { mappedBuildings: number } }) => s.metrics.mappedBuildings), [expected, expected]);
      assert.deepEqual(pair.snapshots.map((s: { dataDate: string }) => s.dataDate), ['2026-10-21', '2026-09-23']);
      assert.equal(pair.comparison.absolute, 0, 'identical source records mean zero mapped dataset change, not construction proof');
      assert.deepEqual(pair.comparison.addedSourceIds, []);
      assert.deepEqual(pair.comparison.removedSourceIds, []);
      assert.equal(analysisMapFeatures(pair).length, expected, 'B never doubles identical map records');
      assert.equal(selectionCsv({ selection, snapshots: [], language: 'en', analysis: pair }).split('\r\n').length, 3);
      assert.equal(selectionGeoJson({ selection, snapshots: [], language: 'en', analysis: pair }).features.length, expected * 2 + 1);
      const singleAgain = await overtureAnalysis.run({ geometry: selected.geometry, dates: ['2026-10-31'], featureTypes: ['buildings'] });
      assert.equal(singleAgain.snapshots.length, 1);
      assert.equal(singleAgain.comparison, null);
      const broken = { ...overtureManifests.at(-1)!, outlineTiles: {} };
      const unavailable = await attachOutlines({ ...snapshot, outlines: undefined }, broken);
      assert.equal(unavailable.outlineStatus, 'unavailable');
      assert.equal(unavailable.metrics?.mappedBuildings, expected);
      assert.equal(unavailable.outlines, undefined);
    }
    const dense: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[30.04,-1.97],[30.05,-1.97],[30.05,-1.96],[30.04,-1.96],[30.04,-1.97]]] };
    const bounded = await overtureAnalysis.run({ geometry: dense, dates: ['2026-10-31', '2026-09-30'], featureTypes: ['buildings'] });
    for (const snapshot of bounded.snapshots) {
      assert.equal(snapshot.metrics?.mappedBuildings, 4005);
      assert.equal(snapshot.features.features.length, 4005);
      assert.equal(snapshot.outlineStatus, 'budget');
      assert.equal(snapshot.outlines, undefined);
    }
    assert.ok(Buffer.byteLength(JSON.stringify(bounded)) < 3_500_000);
    assert.equal(analysisMapFeatures(bounded).length, 4005);
    const selected = await spatialStore.findFeatureAt('villages', 30.54348, -2.15605);
    const missing = await overtureAnalysis.run({ geometry: selected!.geometry, dates: ['2025-10-31'], featureTypes: ['buildings'] });
    assert.equal(missing.snapshots[0].status, 'unavailable');
    assert.equal(missing.snapshots[0].source, 'Overture Maps Foundation / buildings');
    assert.equal(missing.snapshots[0].metrics, null);
  } finally { globalThis.fetch = original; }
});

test('source-specific dates never invent historical Overture coverage', () => {
  assert.ok(buildingDatesFor('overture').includes('2026-10-21'));
  assert.equal(buildingDateAtOrBefore('2025-10-31', 'overture'), undefined);
  assert.equal(buildingDateAtOrBefore('2025-10-31', 'osm'), '2025-01-01');
});
