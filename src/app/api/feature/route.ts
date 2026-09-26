import { NextRequest, NextResponse } from 'next/server';
import { spatialStore } from '@/lib/spatialStore';

const VALID_LAYERS = ['provinces', 'districts', 'sectors', 'cells', 'villages'];

// Returns the boundary feature of one administrative tier that contains a
// point, e.g. /api/feature?layer=districts&lat=-1.94&lng=30.06
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const layer = searchParams.get('layer') || '';
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (!VALID_LAYERS.includes(layer)) {
      return NextResponse.json(
        { error: `Invalid layer name. Must be one of: ${VALID_LAYERS.join(', ')}` },
        { status: 400 }
      );
    }
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Invalid coordinate parameters. Provide both lat and lng (numbers).' },
        { status: 400 }
      );
    }

    const feature = await spatialStore.findFeatureAt(layer, lng, lat);
    if (!feature) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json(
      { found: true, feature },
      { headers: { 'Cache-Control': 'public, max-age=120, s-maxage=120' } }
    );
  } catch (err: any) {
    console.error('API Error in /api/feature:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
