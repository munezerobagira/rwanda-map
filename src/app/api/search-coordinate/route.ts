import { NextRequest, NextResponse } from 'next/server';
import { spatialStore } from '@/lib/spatialStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Invalid coordinate parameters. Provide both lat and lng (numbers).' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const result = await spatialStore.queryCoordinate(lng, lat);
    const executionTimeMs = Date.now() - startTime;

    if (!result) {
      return NextResponse.json({
        found: false,
        executionTimeMs,
        message: 'Coordinates lie outside Rwanda boundaries.'
      });
    }

    return NextResponse.json({
      found: true,
      executionTimeMs,
      data: result
    }, {
      headers: {
        'Cache-Control': 'public, max-age=120, s-maxage=120'
      }
    });
  } catch (err: any) {
    console.error('API Error in /api/search-coordinate:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
