import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allCoverageAvailable, coverageChunks, coverageGrid, validCoverageGrid } from '../src/lib/imagery/esriCoverage';
import { GET } from '../src/app/api/imagery/esri-coverage/route';
import { basemapMaxZoom } from '../src/lib/basemaps';

test('finer imagery coverage requires every real source tile, including bundle-boundary chunks', () => {
  const grid = { x: 305790, y: 264958, width: 8, height: 8 };
  const chunks = coverageChunks(grid);
  assert.equal(chunks.length, 4);
  const cells = new Set<string>();
  for (const chunk of chunks) {
    assert.equal(Math.floor(chunk.x / 128), Math.floor((chunk.x + chunk.width - 1) / 128));
    assert.equal(Math.floor(chunk.y / 128), Math.floor((chunk.y + chunk.height - 1) / 128));
    for (let x = chunk.x; x < chunk.x + chunk.width; x++) for (let y = chunk.y; y < chunk.y + chunk.height; y++) cells.add(`${x}/${y}`);
    const value = { location: { left: chunk.x, top: chunk.y, width: chunk.width, height: chunk.height }, data: Array(chunk.width * chunk.height).fill(1) };
    assert.equal(allCoverageAvailable(value, chunk), true);
    value.data[0] = 0;
    assert.equal(allCoverageAvailable(value, chunk), false, 'one missing tile retains the parent detail for the whole view');
    assert.throws(() => allCoverageAvailable({ ...value, data: [1] }, chunk), /Incomplete/);
  }
  assert.equal(cells.size, 64);
  assert.equal(allCoverageAvailable({ error: { code: 422 } }, grid), false);
  assert.ok(coverageGrid([30.018, -1.947, 30.019, -1.946]));
  assert.equal(coverageGrid([28.86, -2.84, 30.9, -1.05]), null, 'national view never causes a huge metadata query');
  assert.equal(validCoverageGrid({ ...grid, width: 65 }), false);
  assert.equal(basemapMaxZoom('esri'), 20);
  assert.equal(basemapMaxZoom('sentinel2'), 18);
});

test('coverage API distinguishes real image coverage from successful no-data responses and rejects malformed extents', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, 'https://server.arcgisonline.com');
    const [level, top, left, width, height] = url.pathname.split('/').slice(-5).map(Number);
    assert.equal(level, 19);
    const data = Array(width * height).fill(left === 305861 ? 1 : 0);
    return Response.json({ valid: true, location: { left, top, width, height }, data });
  }) as typeof fetch;
  try {
    const request = (x: number, y: number) => new Request(`http://localhost/api/imagery/esri-coverage?x=${x}&y=${y}&width=1&height=1`);
    assert.equal((await (await GET(request(305861, 264979))).json()).available, true);
    assert.equal((await (await GET(request(306626, 265284))).json()).available, false, 'actual rural regression fixture: JPEG200 does not establish availability');
    assert.equal(calls, 2);
    const rectangular = await GET(new Request('http://localhost/api/imagery/esri-coverage?x=305862&y=264979&width=2&height=3'));
    assert.equal(rectangular.status, 200, 'upstream path preserves width/height order');
    assert.equal((await rectangular.json()).available, false);
    assert.equal((await GET(new Request('http://localhost/api/imagery/esri-coverage?x=0&y=0&width=999&height=999'))).status, 400);
    assert.equal((await GET(new Request('http://localhost/api/imagery/esri-coverage'))).status, 400);
    assert.equal(calls, 3);
  } finally { globalThis.fetch = original; }
});
