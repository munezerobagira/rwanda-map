import { overlaps, RWANDA_BBOX, scenesForPeriod, sceneVersion, tileBbox, validPeriod } from '@/lib/imagery/catalog';
import { renderTile } from '@/lib/imagery/render';
import { imageryWorkKey, WorkCache, WorkQueueBusyError } from '@/lib/imagery/workCache';
export const runtime = 'nodejs';
export const maxDuration = 60;
const rasterJobs = new WorkCache<Buffer>({ workers: 2, waiting: 24, waitMs: 15000, entries: 64, ttlMs: 3600000 });
export async function GET(request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const raw = await params;
  const [z, x, y] = [Number(raw.z), Number(raw.x), Number(raw.y)];
  const query = new URL(request.url).searchParams;
  const period = { start: query.get('start') ?? '', end: query.get('end') ?? '' };
  if (
    ![z, x, y].every(Number.isInteger) ||
    z < 8 ||
    z > 18 ||
    x < 0 ||
    y < 0 ||
    x >= 2 ** z ||
    y >= 2 ** z ||
    !validPeriod(period)
  )
    return Response.json({ error: 'Invalid imagery tile or period.' }, { status: 400 });
  if (!overlaps(tileBbox(z, x, y), RWANDA_BBOX))
    return Response.json({ error: 'Outside Rwanda imagery coverage.' }, { status: 404 });
  let scenes;
  try {
    scenes = await scenesForPeriod(period);
  } catch {
    return Response.json({ error: 'Imagery catalog unavailable.' }, { status: 503 });
  }
  const version = sceneVersion(scenes);
  if (query.has('v') && query.get('v') !== version)
    return Response.json({ error: 'Imagery catalog changed. Refresh acquisition metadata.' }, { status: 409 });
  const key = imageryWorkKey(version, z, x, y, period.start, period.end);
  const headers = {
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'X-Imagery-Native-Resolution': '10m'
  };
  try {
    const bytes = await rasterJobs.run(key, () => renderTile(z, x, y, scenes, AbortSignal.timeout(20000)));
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    if (error instanceof WorkQueueBusyError)
      return Response.json(
        { error: 'Imagery renderer busy. Retry shortly.' },
        { status: 503, headers: { 'Retry-After': '2' } }
      );
    console.error('Imagery tile unavailable', error instanceof Error ? error.message : error);
    return Response.json(
      { error: 'Imagery unavailable for this period. Reference map remains available.' },
      { status: 503 }
    );
  }
}
