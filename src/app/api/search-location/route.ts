import { NextRequest, NextResponse } from 'next/server';
import { spatialStore } from '@/lib/spatialStore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';

    if (q.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await spatialStore.searchByName(q, 12);
    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('API Error in /api/search-location:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
