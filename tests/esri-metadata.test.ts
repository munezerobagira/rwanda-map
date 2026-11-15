import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESRI_METADATA_URL, esriIdentifyUrl, metadataPoint, parseEsriMetadata } from '../src/lib/imagery/esriMetadata';
import { esriMetadataLines } from '../src/lib/imagery/esriPresentation';
import { GET } from '../src/app/api/imagery/esri-metadata/route';
import { selectionCsv, selectionGeoJson } from '../src/lib/selectionExport';
import { createAreaSelection } from '../src/lib/drawnSelection';
const point = { lat: -2.15605, lng: 30.54348 };
const attributes = { SRC_DATE: 20251214, SRC_RES: .34, SAMP_RES: .3, SRC_ACC: 8.47, NICE_DESC: 'Vantor', NICE_NAME: 'Vivid Advanced', MinMapLevel: 12, MaxMapLevel: 19 };
const response = { results: [9, 10, 11].map((layerId) => ({ layerId, attributes })) };
test('Esri point metadata deduplicates sources without turning sampling or SRC_ACC into accuracy', () => {
  const result = parseEsriMetadata(response, point);
  assert.equal(result.status, 'available');
  assert.equal(result.records.length, 1);
  assert.deepEqual(result.records[0], { acquiredAt: '2025-12-14', sourceResolutionM: .34, samplingResolutionM: .3, provider: 'Vantor', product: 'Vivid Advanced', minMapLevel: 12, maxMapLevel: 19 });
  assert.ok(!JSON.stringify(result).includes('8.47'));
  const mixed = parseEsriMetadata({ results: [...response.results, { layerId: 9, attributes: { ...attributes, SRC_DATE: 20250627, SAMP_RES: .6 } }] }, point);
  assert.equal(mixed.status, 'mixed');
  assert.equal(mixed.records.length, 2);
  assert.equal(parseEsriMetadata({ results: [] }, point).status, 'no-data');
  for (const value of [{}, { error: {} }, { results: [], exceededTransferLimit: true }, { results: [{ layerId: 8, attributes }] }, { results: Array(33).fill(response.results[0]) }]) assert.throws(() => parseEsriMetadata(value, point));
  for (const badDate of [0, 20250229, 20251301, '12/14/2025', '', null]) {
    const unknown = parseEsriMetadata({ results: [{ layerId: 9, attributes: { SRC_DATE: badDate, SRC_RES: -1, SAMP_RES: '0.3', MinMapLevel: 25 } }] }, point);
    assert.equal(unknown.records[0].acquiredAt, null);
    assert.equal(unknown.records[0].sourceResolutionM, null);
    assert.equal(unknown.records[0].samplingResolutionM, null);
    assert.equal(unknown.records[0].minMapLevel, null);
  }
  assert.equal(parseEsriMetadata({ results: [{ layerId: 9, attributes: { SRC_DATE: 20240229 } }] }, point).records[0].acquiredAt, '2024-02-29');
});
test('point metadata shares localized inspector/PNG context and CSV/GeoJSON without assigning A/B dates', () => {
  const metadata = parseEsriMetadata(response, point);
  const selection = createAreaSelection('rectangle', [[30.54, -2.16], [30.55, -2.15]], '2026-11-15');
  for (const language of ['rw', 'en', 'fr'] as const) {
    const args = { selection, language, snapshots: [], esriMetadata: metadata };
    const exported = selectionGeoJson(args).features[0].properties.esri_point_metadata!;
    assert.deepEqual(exported.point, point);
    assert.deepEqual(exported.context, esriMetadataLines(metadata, language));
    assert.equal(exported.records[0].acquiredAt, '2025-12-14');
    if (language !== 'en') assert.notEqual(exported.context[0], 'Esri imagery at selected point');
    const csv = selectionCsv(args);
    const [header, row] = csv.split('\r\n').map((line) => line.slice(1, -1).split('","'));
    const fields = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    assert.equal(fields.record_type, 'esri_point_metadata');
    assert.equal(fields.source_date, '2025-12-14');
    assert.equal(fields.source_resolution_m, '0.34');
    assert.equal(fields.sampling_resolution_m, '0.3');
    assert.equal(fields.period_start, '');
    assert.equal(fields.requested_date, '');
    assert.equal(fields.mapped_buildings, '');
    for (const status of ['loading', 'unavailable', 'no-data'] as const) {
      const missing = { ...args, esriMetadata: { ...metadata, status, records: [] } };
      assert.match(selectionCsv(missing), new RegExp(`"${status}"`));
      assert.equal(selectionGeoJson(missing).features[0].properties.esri_point_metadata!.records.length, 0);
    }
  }
});
test('metadata API bounds requests, coalesces points, limits response size and allows retry after failure', async () => {
  assert.equal(metadataPoint(-2, 30.1234567)?.lng, 30.12346);
  assert.equal(metadataPoint(0, 0), null);
  assert.equal(metadataPoint(NaN, 30), null);
  const url = esriIdentifyUrl(point);
  assert.equal(url.origin + url.pathname, ESRI_METADATA_URL);
  assert.equal(url.searchParams.get('tolerance'), '0');
  assert.equal(url.searchParams.get('returnGeometry'), 'false');
  assert.equal(url.searchParams.has('time'), false);
  const original = globalThis.fetch;
  let calls = 0;
  let mode = 'ok';
  globalThis.fetch = (async (input: URL | string | Request, init?: RequestInit) => {
    calls++;
    assert.ok(String(input).startsWith(ESRI_METADATA_URL + '?'));
    assert.equal(init?.redirect, 'error');
    if (mode === 'large') return new Response('x'.repeat(64_001));
    if (mode === 'error') return Response.json({ error: { code: 500 } });
    return Response.json(response);
  }) as typeof fetch;
  try {
    for (const query of ['', '?lat=&lng=', '?lat=Infinity&lng=30', '?lat=0&lng=0']) assert.equal((await GET(new Request(`http://localhost/api${query}`))).status, 400);
    assert.equal(calls, 0);
    const requests = await Promise.all(Array.from({ length: 12 }, () => GET(new Request(`http://localhost/api?lat=${point.lat}&lng=${point.lng}`))));
    assert.equal(calls, 1);
    assert.ok(requests.every((r) => r.status === 200));
    assert.deepEqual((await requests[0].json()).point, point);
    mode = 'large';
    assert.equal((await GET(new Request('http://localhost/api?lat=-2.1&lng=30.1'))).status, 503);
    mode = 'error';
    assert.equal((await GET(new Request('http://localhost/api?lat=-2.1&lng=30.1'))).status, 503);
    mode = 'ok';
    assert.equal((await GET(new Request('http://localhost/api?lat=-2.1&lng=30.1'))).status, 200);
  } finally { globalThis.fetch = original; }
});
