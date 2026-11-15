import { esriIdentifyUrl, metadataPoint, parseEsriMetadata, type EsriPointMetadata } from '@/lib/imagery/esriMetadata';
import { WorkCache } from '@/lib/imagery/workCache';
export const runtime = 'nodejs';
export const maxDuration = 15;
const work = new WorkCache<EsriPointMetadata>({ workers: 2, waiting: 16, waitMs: 2000, entries: 128, ttlMs: 600_000 });
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const point = metadataPoint(Number(params.get('lat') || NaN), Number(params.get('lng') || NaN));
  if (!point) return Response.json({ error: 'Choose a point in Rwanda.' }, { status: 400 });
  try {
    const result = await work.run(`${point.lat}/${point.lng}`, async () => {
      const response = await fetch(esriIdentifyUrl(point), { signal: AbortSignal.timeout(4000), cache: 'no-store', redirect: 'error' });
      if (!response.ok || !response.body) throw new Error('Metadata unavailable');
      const reader = response.body.getReader(), parts: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 64_000) throw new Error('Metadata response exceeds budget');
          parts.push(value);
        }
      } finally { await reader.cancel(); }
      return parseEsriMetadata(JSON.parse(Buffer.concat(parts).toString()), point);
    });
    return Response.json(result, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600' } });
  } catch {
    return Response.json({ error: 'Point imagery metadata unavailable.' }, { status: 503 });
  }
}
