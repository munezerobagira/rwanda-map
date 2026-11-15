import { allCoverageAvailable, coverageChunks, validCoverageGrid, type CoverageGrid } from '@/lib/imagery/esriCoverage';
import { WorkCache } from '@/lib/imagery/workCache';
export const runtime = 'nodejs';
export const maxDuration = 15;
const work = new WorkCache<boolean>({ workers: 2, waiting: 16, waitMs: 2000, entries: 128, ttlMs: 600_000 });
async function check(grid: CoverageGrid): Promise<boolean> {
  const { x, y, width, height } = grid;
  return work.run(`${x}/${y}/${width}/${height}`, async () => {
    const response = await fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap/19/${y}/${x}/${width}/${height}?f=json`, {
      signal: AbortSignal.timeout(4000), cache: 'no-store', redirect: 'error'
    });
    if (response.status === 422) return false;
    if (!response.ok || !response.body) throw new Error('Coverage source unavailable');
    const reader = response.body.getReader(), parts: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > 32_000) throw new Error('Coverage response exceeds budget');
        parts.push(value);
      }
    } finally { await reader.cancel(); }
    return allCoverageAvailable(JSON.parse(Buffer.concat(parts).toString()), grid);
  });
}
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const grid = Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, Number(params.get(key) ?? NaN)])) as unknown as CoverageGrid;
  if (!validCoverageGrid(grid)) return Response.json({ error: 'Choose a compact Rwanda view.' }, { status: 400 });
  try {
    const chunks = coverageChunks(grid);
    const available = (await Promise.all(chunks.map(check))).every(Boolean);
    return Response.json({ ...grid, available, level: 19 }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600' } });
  } catch {
    return Response.json({ error: 'Finer imagery coverage unavailable; retain reference detail.' }, { status: 503 });
  }
}
