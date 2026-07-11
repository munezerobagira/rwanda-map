import { NextRequest, NextResponse } from 'next/server';

let cachedYears: string[] = [];
let cacheTime = 0;

export async function GET(req: NextRequest) {
  try {
    const now = Date.now();
    
    // Cache capabilities result for 24 hours (86400000 ms) to avoid slow requests
    if (cachedYears.length > 0 && now - cacheTime < 86400000) {
      return NextResponse.json({ years: cachedYears });
    }

    console.log('SpatialStore: Fetching EOX WMTS Capabilities...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch('https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch capabilities: ${response.statusText}`);
    }

    const xmlText = await response.text();
    
    // Regex matching layers like s2cloudless-2020_3857
    const matches = xmlText.matchAll(/s2cloudless-(\d{4})_3857/g);
    const yearsSet = new Set<string>();
    
    for (const match of matches) {
      yearsSet.add(match[1]);
    }

    const years = Array.from(yearsSet).sort();

    if (years.length === 0) {
      // Fallback if no matching layers were parsed
      return NextResponse.json({ 
        years: ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'] 
      });
    }

    cachedYears = years;
    cacheTime = now;

    return NextResponse.json({ years });
  } catch (err: any) {
    console.error('SpatialStore: Failed to retrieve satellite capabilities, using fallback:', err);
    // Safe fallback to prevent breaking UI
    const fallbackYears = ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'];
    return NextResponse.json({ years: fallbackYears });
  }
}
