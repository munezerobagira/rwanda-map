import { NextRequest, NextResponse } from 'next/server';
import { spatialStore } from '@/lib/spatialStore';
import { compressedJson } from '@/lib/compressJson';

const VALID_LAYERS = ['country', 'provinces', 'districts', 'sectors', 'cells', 'villages'];

// Boundary vector tile: /api/tiles/villages/14/9788/8480
//
// Returns the layer's features clipped to the tile and simplified for its
// zoom, as compact JSON: { features: [{ id, n, p, g }] } where `g` is a list
// of rings in 0..4096 tile coordinates (buffer included). Boundaries don't
// change between deploys, so tiles are cacheable for a day.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> }
) {
  try {
    const { layer, z, x, y } = await params;
    const [zi, xi, yi] = [Number(z), Number(x), Number(y)];

    if (!VALID_LAYERS.includes(layer)) {
      return NextResponse.json({ error: `Invalid layer name. Must be one of: ${VALID_LAYERS.join(', ')}` }, { status: 400 });
    }
    if (![zi, xi, yi].every(Number.isInteger) || zi < 0 || zi > 18 || xi < 0 || yi < 0 || xi >= 2 ** zi || yi >= 2 ** zi) {
      return NextResponse.json({ error: 'Invalid tile coordinates.' }, { status: 400 });
    }

    const index = await spatialStore.getTileIndex(layer);
    const tile = index.getTile(zi, xi, yi);
    const features = (tile?.features ?? []).map((f) => ({
      id: f.id,
      n: f.tags?.n,
      p: f.tags?.p,
      g: f.geometry
    }));

    return compressedJson(req, { features }, { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' });
  } catch (err: any) {
    console.error('API Error in /api/tiles:', err);
    return NextResponse.json({ error: 'Internal Server Error', details: err.message }, { status: 500 });
  }
}
