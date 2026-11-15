import { compressedJson } from '@/lib/compressJson';
import { overtureAnalysis } from '@/lib/analysis/overture';
import { buildingAnalysis } from '@/lib/analysis/buildings';
import { validateGeometry } from '@/lib/analysis/geometry';
import { FEATURE_FLAGS } from '@/lib/analysis/registry';
export const runtime = 'nodejs';
export const maxDuration = 30;
export async function POST(request: Request) {
  if (!FEATURE_FLAGS.buildingAnalysis)
    return Response.json({ error: 'Building analysis is disabled.' }, { status: 503 });
  const text = await request.text();
  if (text.length > 150000) return Response.json({ error: 'Selection is too detailed.' }, { status: 413 });
  let input;
  try {
    input = JSON.parse(text) as { geometry?: unknown; dates?: unknown; featureTypes?: unknown; source?: unknown };
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (
    !input ||
    typeof input !== 'object' ||
    (input.source !== undefined && input.source !== 'osm' && input.source !== 'overture') ||
    !validateGeometry(input.geometry) ||
    !Array.isArray(input.dates) ||
    input.dates.length < 1 ||
    input.dates.length > 2 ||
    !input.dates.every(
      (d: unknown) =>
        typeof d === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        Number.isFinite(Date.parse(d)) &&
        new Date(d).toISOString().slice(0, 10) === d &&
        d <= new Date().toISOString().slice(0, 10)
    ) ||
    !Array.isArray(input.featureTypes) ||
    input.featureTypes.length !== 1 ||
    input.featureTypes[0] !== 'buildings'
  )
    return Response.json(
      {
        error:
          'Choose a valid Rwanda polygon up to 50 km² and one or two dates; only mapped-building analysis is currently available.'
      },
      { status: 400 }
    );
  try {
    const result = await (input.source === 'overture' ? overtureAnalysis : buildingAnalysis).run({
      geometry: input.geometry,
      dates: input.dates,
      featureTypes: ['buildings']
    });
    if (Buffer.byteLength(JSON.stringify(result)) > 3_500_000)
      return Response.json({ error: 'Select a smaller area for complete feature exports.' }, { status: 413 });
    return compressedJson(request, result, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('Building analysis unavailable', error instanceof Error ? error.message : error);
    return Response.json(
      {
        error:
          error instanceof Error && /Choose|Select/.test(error.message)
            ? error.message
            : 'Building snapshot unavailable. No count has been estimated.'
      },
      { status: 503 }
    );
  }
}
