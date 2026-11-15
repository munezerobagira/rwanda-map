import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allowedVisual,
  normalizeScene,
  overlaps,
  scenesForPeriod,
  tileBbox,
  validPeriod
} from '../src/lib/imagery/catalog';
import { latestCompleteMonth, sameSeasonLastYear, imageryTileUrl } from '../src/lib/imagery/periods';
import { BASEMAPS, isBasemapAvailable } from '../src/lib/basemaps';
import { GET as tileRoute } from '../src/app/api/imagery/tiles/[z]/[x]/[y]/route';
import { GET as scenesRoute } from '../src/app/api/imagery/scenes/route';
import { selectionCsv, selectionGeoJson } from '../src/lib/selectionExport';
import { ADMIN_LEVELS } from '../src/lib/adminLevels';
import { translate } from '../src/lib/i18n';
import type { SelectionExport } from '../src/lib/selectionExport';
const visual =
  'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/35/M/RT/2025/10/S2B_35MRT_20251023_0_L2A/TCI.tif';
function feature(index: number, bbox = [29.69, -2.8, 30.68, -1.8]) {
  return {
    id: `S2B_35MRT_202510${String(index + 1).padStart(2, '0')}_0_L2A`,
    bbox,
    properties: {
      datetime: `2025-10-${String(index + 1).padStart(2, '0')}T08:30:00Z`,
      'eo:cloud_cover': index + 1,
      'proj:epsg': 32735
    },
    assets: { visual: { href: visual } }
  };
}

test('only valid bounded dates, leap years and keyless allowlisted visual assets', () => {
  assert.ok(validPeriod({ start: '2025-02-01', end: '2025-02-28' }));
  for (const p of [
    { start: '2025-02-29', end: '2025-03-01' },
    { start: '2018-01-01', end: '2018-02-01' },
    { start: '2025-01-01', end: '2025-12-31' },
    { start: '2025-02-01', end: '2025-01-01' },
    { start: '9999-01-01', end: '9999-01-02' }
  ])
    assert.equal(validPeriod(p), false);
  assert.ok(allowedVisual(visual));
  for (const u of [
    'http://127.0.0.1/TCI.tif',
    visual + '?token=abc',
    visual.replace('sentinel-cogs.s3.us-west-2.amazonaws.com', 'example.com'),
    visual.replace('/TCI.tif', '/../secrets')
  ])
    assert.equal(allowedVisual(u), false);
  assert.equal(normalizeScene({ ...feature(0), properties: { ...feature(0).properties, 'proj:epsg': 4326 } }), null);
  assert.deepEqual(sameSeasonLastYear({ start: '2024-02-01', end: '2024-02-29' }), {
    start: '2023-02-01',
    end: '2023-02-28'
  });
  assert.deepEqual(latestCompleteMonth(new Date('2026-01-01T00:00:00Z')), { start: '2025-12-01', end: '2025-12-31' });
});

test('catalog preserves full-coverage alternatives to a very cloudy-grid sliver, with versioned caching', async () => {
  const native = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (input) => {
    requests++;
    assert.match(String(input), /sortby=%2Bproperties/);
    return Response.json({ features: [feature(0, [30.51, -2.79, 30.68, -2.02]), feature(1), feature(2), feature(3)] });
  };
  try {
    const p = { start: '2025-10-01', end: '2025-10-31' };
    const scenes = await scenesForPeriod(p);
    assert.equal(scenes.length, 3);
    assert.ok(scenes.some((s) => overlaps(s.bbox, tileBbox(12, 2390, 2070))));
    await scenesForPeriod(p);
    assert.equal(requests, 1);
    await scenesForPeriod({ start: '2025-10-02', end: '2025-10-31' });
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = native;
  }
});

test('tile and metadata routes reject invalid dates/coordinates without external requests', async () => {
  const bad = await tileRoute(new Request('http://localhost/api?start=2025-01-01&end=2025-01-31'), {
    params: Promise.resolve({ z: '99', x: '0', y: '0' })
  });
  assert.equal(bad.status, 400);
  const outside = await tileRoute(new Request('http://localhost/api?start=2025-01-01&end=2025-01-31'), {
    params: Promise.resolve({ z: '12', x: '0', y: '0' })
  });
  assert.equal(outside.status, 404);
  assert.equal((await scenesRoute(new Request('http://localhost/api?start=bad&end=bad'))).status, 400);
});

test('open imagery stays bounded and the requested Esri exception remains keyless and undated', () => {
  assert.deepEqual(
    BASEMAPS.map((b) => b.id),
    ['esri', 'sentinel2', 'sentinel2-2016', 'osm']
  );
  assert.ok(BASEMAPS.every(isBasemapAvailable));
  assert.ok(BASEMAPS.every((b) => b.nativeResolutionM === null || b.nativeResolutionM <= 10));
  assert.match(BASEMAPS.find((b) => b.id === 'sentinel2-2016')!.dateNote, /2016/);
  const esri = BASEMAPS[0];
  assert.equal(esri.userRequestedException, 'esri');
  assert.equal(isBasemapAvailable({ ...esri, userRequestedException: undefined }), false);
  assert.equal(isBasemapAvailable({ ...esri, id: 'unknown-imagery', userRequestedException: undefined }), false);
  assert.equal(esri.supportsPeriod, undefined);
  assert.equal(esri.supportsYear, undefined);
  assert.equal(esri.buildUrl({ year: '2026', date: '' }), esri.buildUrl({ year: '2025', date: '' }));
  assert.match(esri.exportAttribution!, /Esri.*Vantor.*Earthstar/);
  assert.ok(!esri.buildUrl({ year: '', date: '' }).includes('token'));
  assert.ok(BASEMAPS.filter((b) => b.userRequestedException).every((b) => b.id === 'esri'));
  assert.equal(
    imageryTileUrl({ start: '2025-10-01', end: '2025-10-31' }),
    '/api/imagery/tiles/{z}/{x}/{y}?start=2025-10-01&end=2025-10-31'
  );
});

test('one selected geometry and per-date provenance survive language switching and CSV/GeoJSON exports', () => {
  const scene = normalizeScene(feature(0))!;
  const bundle: SelectionExport = {
    language: 'rw',
    selection: {
      kind: 'feature',
      level: ADMIN_LEVELS[4],
      props: { village: 'Ishema', area_km2: 0.57 },
      point: { lat: -1.9441, lng: 30.0619 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [30, -2],
            [30.1, -2],
            [30.1, -1.9],
            [30, -2]
          ]
        ]
      }
    },
    snapshots: [
      {
        period: { start: '2025-10-01', end: '2025-10-31' },
        source: 'Copernicus Sentinel-2',
        method: 'Scene-cloud ranking',
        confidence: 'Unvalidated',
        nativeResolutionM: 10,
        scenes: [scene]
      }
    ]
  };
  for (const language of ['rw', 'en', 'fr'] as const) {
    const data = { ...bundle, language };
    const geo = selectionGeoJson(data);
    assert.deepEqual(geo.features[0].geometry, bundle.selection.geometry);
    assert.equal(geo.features[0].properties.imagery[0]?.period.start, '2025-10-01');
    assert.equal(geo.features[0].properties.estimated_houses, null);
    const csv = selectionCsv(data);
    assert.match(csv, /2025-10-01/);
    assert.match(csv, /Unvalidated/);
    assert.ok(csv.includes(`"${language}"`));
  }
  assert.notEqual(translate('Compare periods', 'rw'), translate('Compare periods', 'en'));
  assert.notEqual(translate('Compare periods', 'fr'), translate('Compare periods', 'en'));
});
