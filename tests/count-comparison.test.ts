import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TimelineScrubber from '../src/components/TimelineScrubber';
import AnalysisResults from '../src/components/AnalysisResults';
import { analysisDates, snapshotPeriod } from '../src/lib/analysis/timeControls';
import { translate } from '../src/lib/i18n';
import { readUrlState, writeUrlState } from '../src/lib/urlState';
import { spatialStore } from '../src/lib/spatialStore';
import { POST } from '../src/app/api/analysis/route';
import { selectionCsv, selectionGeoJson } from '../src/lib/selectionExport';
import { ADMIN_LEVELS } from '../src/lib/adminLevels';
import type { AnalysisResult } from '../src/lib/analysis/types';
const period = { start: '2026-10-01', end: '2026-10-31' };
const comparison = { start: '2025-10-01', end: '2025-10-31' };
const noop = () => {};

test('Esri count timeline exposes immediately applied source dates with comparison both on and off', () => {
  const markup = (compare: boolean) => renderToStaticMarkup(React.createElement(TimelineScrubber, {
    showImagery: false, snapshots: [], period, comparison, compare, swipe: 50, onApply: noop, onCompare: noop, onSwipe: noop
  }));
  const single = markup(false), pair = markup(true);
  assert.ok(single.includes(translate('Compare counts', 'rw')));
  assert.ok(single.includes('2026-10-01'));
  assert.equal((single.match(/<select/g) ?? []).length, 1);
  assert.equal((pair.match(/<select/g) ?? []).length, 2);
  assert.ok(!pair.includes('type="range"'), 'reference imagery never pretends to swipe historical Esri dates');
  assert.deepEqual(snapshotPeriod('2026-10-01'), { start: '2026-10-01', end: '2026-10-01' });
  assert.throws(() => snapshotPeriod('2024-01-01'));
});

test('actual selected cell compares 300 vs 285 and switching off removes the second result from every data export', async () => {
  const selected = await spatialStore.findFeatureAt('cells', 30.10657, -2.07736);
  assert.ok(selected);
  const selection = { kind: 'feature' as const, geometry: selected.geometry, props: selected.properties, level: ADMIN_LEVELS[3], point: { lat: -2.07736, lng: 30.10657 } };
  for (const compare of [true, false, true]) {
    const response = await POST(new Request('http://localhost/api/analysis', { method: 'POST', body: JSON.stringify({ geometry: selected.geometry, dates: analysisDates(period, comparison, compare), featureTypes: ['buildings'] }) }));
    assert.equal(response.status, 200);
    const result = await response.json() as AnalysisResult;
    assert.deepEqual(result.snapshots.map((s) => s.metrics?.mappedBuildings), compare ? [300, 285] : [300]);
    assert.equal(result.comparison?.absolute ?? null, compare ? 15 : null);
    const view = renderToStaticMarkup(React.createElement(AnalysisResults, { result, pending: false, error: null }));
    assert.equal(view.includes(translate('Mapped dataset change · A minus B', 'rw')), compare);
    for (const language of ['rw','en','fr'] as const) {
      const bundle = { selection, snapshots: [], language, analysis: result };
      const csv = selectionCsv(bundle), geo = selectionGeoJson(bundle);
      assert.equal(csv.includes('osm-2025-01-01-p2'), compare);
      assert.equal(JSON.stringify(geo).includes('osm-2025-01-01-p2'), compare);
      assert.equal(csv.split('\r\n').length, compare ? 3 : 2);
    }
  }
});

test('the selected village missing from OSM does not display a fabricated zero-house estimate or change', async () => {
  const selected = await spatialStore.findFeatureAt('villages', 30.54348, -2.15605);
  assert.ok(selected);
  const response = await POST(new Request('http://localhost/api/analysis', { method: 'POST', body: JSON.stringify({ geometry: selected.geometry, dates: analysisDates(period, comparison, true), featureTypes: ['buildings'] }) }));
  const result = await response.json() as AnalysisResult;
  assert.deepEqual(result.snapshots.map((s) => s.metrics?.mappedBuildings), [0,0]);
  assert.equal(result.comparison, null);
  const view = renderToStaticMarkup(React.createElement(AnalysisResults, { result, pending: false, error: null }));
  assert.ok(view.includes(translate('No mapped structures in this source. A house estimate is unavailable.', 'rw')));
});

test('Esri links preserve comparison and an explicit count-off preference across reload', () => {
  let replaced = '';
  const location = { search: '?basemap=esri&analysis=off&compare=1&buildingSource=overture&buildingsVisible=0', pathname: '/', hash: '' };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, history: { state: null, replaceState: (_: unknown, __: string, next: string) => { replaced = next; } } } });
  try {
    const state = readUrlState();
    assert.equal(state.analysis, false);
    assert.equal(state.buildingSource, 'overture');
    assert.equal(state.buildingsVisible, false);
    assert.equal(state.compare, true);
    writeUrlState({ ...state, compare: false });
    assert.ok(replaced.includes('analysis=off'));
    assert.ok(replaced.includes('buildingSource=overture'));
    assert.ok(replaced.includes('buildingsVisible=0'));
    assert.ok(!replaced.includes('compare=1'));
    writeUrlState({ ...state, compare: true, analysis: true });
    assert.ok(replaced.includes('analysis=buildings'));
    assert.ok(replaced.includes('compare=1'));
  } finally { Reflect.deleteProperty(globalThis, 'window'); }
});
