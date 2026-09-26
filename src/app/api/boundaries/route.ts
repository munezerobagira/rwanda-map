import { NextRequest, NextResponse } from 'next/server';
import { spatialStore } from '@/lib/spatialStore';
import { compressedJson } from '@/lib/compressJson';

const VALID_LAYERS = ['provinces', 'districts', 'sectors', 'cells', 'villages'];

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const layer = searchParams.get('layer') || 'provinces';
    const minLng = parseFloat(searchParams.get('minLng') || '');
    const minLat = parseFloat(searchParams.get('minLat') || '');
    const maxLng = parseFloat(searchParams.get('maxLng') || '');
    const maxLat = parseFloat(searchParams.get('maxLat') || '');

    // Validate layer parameter
    if (!VALID_LAYERS.includes(layer)) {
      return NextResponse.json(
        { error: `Invalid layer name. Must be one of: ${VALID_LAYERS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate bbox parameters
    if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) {
      return NextResponse.json(
        { error: 'Invalid bounding box coordinates. Provide minLng, minLat, maxLng, maxLat.' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const matchingFeatures = await spatialStore.queryViewport(layer, minLng, minLat, maxLng, maxLat);
    const queryTime = Date.now() - startTime;

    return compressedJson(
      req,
      {
        type: 'FeatureCollection',
        layer,
        queryTimeMs: queryTime,
        featuresCount: matchingFeatures.length,
        features: matchingFeatures
      },
      { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
    );
  } catch (err: any) {
    console.error(`API Error in /api/boundaries:`, err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
