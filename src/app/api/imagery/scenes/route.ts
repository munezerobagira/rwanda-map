import { scenesForPeriod, sceneVersion, validPeriod } from '@/lib/imagery/catalog';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = { start: params.get('start') ?? '', end: params.get('end') ?? '' };
  if (!validPeriod(period))
    return Response.json({ error: 'Invalid imagery period (2019–today, at most 93 days).' }, { status: 400 });
  try {
    const scenes = await scenesForPeriod(period);
    return Response.json(
      {
        period,
        version: sceneVersion(scenes),
        source: 'Copernicus Sentinel-2 L2A / Earth Search',
        nativeResolutionM: 10,
        method:
          'Least scene-cloud candidates per grid square; fill missing pixels from additional candidates. Clouds may remain. Scene cloud cover is not local cloud cover.',
        confidence: 'Scene metadata verified; local cloud-free coverage unvalidated.',
        scenes: scenes.map((s) => ({
          id: s.id,
          acquiredAt: s.acquiredAt,
          cloudCover: s.cloudCover,
          bbox: s.bbox,
          nativeResolutionM: s.nativeResolutionM
        }))
      },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } }
    );
  } catch {
    return Response.json({ error: 'Imagery catalog unavailable. Choose the reference map or retry.' }, { status: 503 });
  }
}
