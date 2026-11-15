import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildingInspectionLines } from '../src/lib/analysis/presentation';
import { translate } from '../src/lib/i18n';

test('counted-record inspection preserves provenance and limitations across all locales', () => {
  for (const language of ['rw','en','fr'] as const) {
    const lines = buildingInspectionLines({ sourceId:'osm:w123', sourceVersion:'osm-2026-10-01-p2', dataDate:'2026-10-01T20:22:06Z', use:'unknown', areaM2:94 }, (key) => translate(key,language));
    assert.ok(lines.some((line) => line.includes('osm:w123')));
    assert.ok(lines.some((line) => line.includes('2026-10-01')));
    assert.ok(lines.some((line) => line.includes('94 m²')));
    assert.ok(lines.some((line) => line.includes(translate('Unknown use',language))));
    assert.ok(lines.includes(translate('This marker is a point within the source footprint, not its roof outline.',language)));
    assert.ok(lines.includes(translate('Low confidence · coverage and residential use unvalidated.',language)));
  }
});
