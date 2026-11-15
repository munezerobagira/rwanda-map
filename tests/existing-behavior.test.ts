import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_LEVELS, levelForZoom, levelOfProperties, parentLevel } from '../src/lib/adminLevels';
import { codeOf, displayName, hierarchyOf, type Selection } from '../src/lib/selection';
import { readUrlState, writeUrlState } from '../src/lib/urlState';
import { spatialStore } from '../src/lib/spatialStore';

test('five Rwanda tiers and selection metadata stay consistent across navigation', () => {
  assert.deepEqual(ADMIN_LEVELS.map(l => l.local), ['Intara', 'Akarere', 'Umurenge', 'Akagari', 'Umudugudu']);
  assert.equal(levelForZoom(14).key, 'village');
  assert.equal(parentLevel(ADMIN_LEVELS[4])?.key, 'cell');
  const props = { province: 'City of Kigali', district: 'Gasabo', sector: 'Kacyiru', cell: 'Kamutwa', village: 'Test', village_id: '12345678' };
  const selection: Extract<Selection, { kind: 'feature' }> = {
    kind: 'feature', level: ADMIN_LEVELS[4], props, point: { lat: -1.94, lng: 30.06 },
    geometry: { type: 'Polygon', coordinates: [[[30,-2],[30.01,-2],[30.01,-1.99],[30,-2]]] }
  };
  assert.equal(levelOfProperties(props), selection.level);
  assert.equal(displayName(selection), 'Test');
  assert.equal(codeOf(selection), '12345678');
  assert.deepEqual(hierarchyOf(props, ADMIN_LEVELS[1]), { province: 'City of Kigali', district: 'Gasabo' });
});

test('shared URL preserves view, source/year and village selection', () => {
  let replaced = '';
  const location = { search: '?c=-1.94410,30.06190,14.50&basemap=sentinel2&year=2023&sel=-1.9441,30.0619,village', pathname: '/', hash: '' };
  Object.defineProperty(globalThis, 'window', { value: { location, history: { state: null, replaceState: (_: unknown, __: string, next: string) => { replaced = next; } } }, configurable: true });
  try {
    const view = readUrlState();
    assert.equal(view.year, '2023');
    assert.equal(view.selection?.level, 'village');
    writeUrlState({ ...view, year: '2022' });
    assert.match(replaced, /year=2022/);
    assert.match(replaced, /sel=-1.94410,30.06190,village/);
    location.search = '?c=bad&year=oops&sel=0,0,invalid';
    assert.deepEqual(readUrlState(), {});
  } finally { Reflect.deleteProperty(globalThis, 'window'); }
});

test('real Kigali selection, geometry, search and boundary tile share the same administrative data', async () => {
  const feature = await spatialStore.findFeatureAt('villages', 30.0619, -1.9441);
  assert.ok(feature);
  assert.ok(feature.properties.village);
  assert.ok((feature.properties.area_km2 ?? 0) > 0);
  assert.ok(feature.geometry.coordinates.length);
  const results = await spatialStore.searchByName(String(feature.properties.village), 12);
  assert.ok(results.some(r => r.level === 'village'));
  const tier = await spatialStore.findFeatureAt('districts', 30.0619, -1.9441);
  assert.equal(tier?.properties.district, feature.properties.district);
  assert.equal(await spatialStore.findFeatureAt('villages', 0, 0), null);
  const index = await spatialStore.getTileIndex('villages');
  const tile = index.getTile(14, 9559, 8280);
  assert.ok(tile?.features.length);
});
