import { NextRequest, NextResponse } from 'next/server';
import { spatialStore } from '@/lib/spatialStore';
import { EncodedJson, encodeJson, encodedResponse } from '@/lib/compressJson';

const VALID_LAYERS = ['country', 'provinces', 'districts', 'sectors', 'cells', 'villages'];
const MAX_TILES = 64;

// Compressed responses for recently requested batches. Views repeat a lot -
// every visitor's first screen is the same national view - and a hit skips
// tile cutting, JSON serialisation and brotli entirely.
const MAX_CACHED = 300;
const responseCache = new Map<string, EncodedJson>();
const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' };

// Many boundary tiles in one round trip: /api/tiles/cells/batch?z=12&t=2438_2119,2439_2119
//
// A map view needs ~10-20 tiles per tier; fetched one by one they queue
// behind the browser's per-host connection limit and each pays the server's
// per-request overhead. The client batches every tile a view asks for into a
// single request per tier and still caches the tiles individually.
// Response: { tiles: { "x_y": [{ id, n, p, g }] } } - same feature shape as
// the single-tile route.
export async function GET(req: NextRequest, { params }: { params: Promise<{ layer: string }> }) {
  try {
    const { layer } = await params;
    const { searchParams } = new URL(req.url);
    const z = Number(searchParams.get('z'));
    const coords = (searchParams.get('t') || '')
      .split(',')
      .filter(Boolean)
      .map((pair) => pair.split('_').map(Number) as [number, number]);

    if (!VALID_LAYERS.includes(layer)) {
      return NextResponse.json({ error: `Invalid layer name. Must be one of: ${VALID_LAYERS.join(', ')}` }, { status: 400 });
    }
    const n = 2 ** z;
    if (
      !Number.isInteger(z) || z < 0 || z > 18 ||
      coords.length === 0 || coords.length > MAX_TILES ||
      !coords.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < n && y < n)
    ) {
      return NextResponse.json({ error: `Provide z (0-18) and 1-${MAX_TILES} tiles as t=x_y,x_y.` }, { status: 400 });
    }

    const acceptEncoding = req.headers.get('accept-encoding') || '';
    const encodingKey = acceptEncoding.includes('br') ? 'br' : acceptEncoding.includes('gzip') ? 'gzip' : 'id';
    const cacheKey = `${layer}|${z}|${searchParams.get('t')}|${encodingKey}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      responseCache.delete(cacheKey); // refresh LRU position
      responseCache.set(cacheKey, cached);
      return encodedResponse(cached, CACHE_HEADERS);
    }

    const index = await spatialStore.getTileIndex(layer);
    const tiles: Record<string, unknown[]> = {};
    for (const [x, y] of coords) {
      const tile = index.getTile(z, x, y);
      tiles[`${x}_${y}`] = (tile?.features ?? []).map((f) => ({ id: f.id, n: f.tags?.n, p: f.tags?.p, g: f.geometry }));
    }

    const encoded = encodeJson(acceptEncoding, { tiles });
    responseCache.set(cacheKey, encoded);
    if (responseCache.size > MAX_CACHED) responseCache.delete(responseCache.keys().next().value!);
    return encodedResponse(encoded, CACHE_HEADERS);
  } catch (err: any) {
    console.error('API Error in /api/tiles/batch:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
