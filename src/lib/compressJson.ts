import zlib from 'zlib';
import { NextRequest, NextResponse } from 'next/server';

// Next's own response compression doesn't reliably kick in for large Route
// Handler JSON bodies - verified empirically: a `next start` production
// server served an uncompressed ~38MB boundary payload even with
// `Accept-Encoding: gzip, br` sent. Compressing explicitly here is the
// difference between a multi-megabyte transfer and a few hundred kilobytes
// for any response past a handful of features, which is most of what makes
// panning/zooming the map feel slow.
export interface EncodedJson {
  body: Buffer;
  encoding: 'br' | 'gzip' | null;
}

// Serialises and compresses a payload for the encodings the client accepts -
// split out so callers can cache the compressed bytes and skip both steps on
// repeat requests.
export function encodeJson(acceptEncoding: string, payload: unknown): EncodedJson {
  const buf = Buffer.from(JSON.stringify(payload), 'utf-8');

  // Brotli compresses this kind of repetitive coordinate data noticeably
  // better than gzip, but quality 6 on a many-megabyte payload can itself
  // take over a second - drop to a faster quality once the payload is
  // unusually large (normal viewport-sized responses stay on quality 6).
  if (acceptEncoding.includes('br')) {
    const quality = buf.length > 5_000_000 ? 4 : 6;
    const body = zlib.brotliCompressSync(buf, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length
      }
    });
    return { body, encoding: 'br' };
  }
  if (acceptEncoding.includes('gzip')) {
    return { body: zlib.gzipSync(buf, { level: 6 }), encoding: 'gzip' };
  }
  return { body: buf, encoding: null };
}

export function encodedResponse({ body, encoding }: EncodedJson, extraHeaders: Record<string, string> = {}) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': 'application/json',
      ...(encoding ? { 'Content-Encoding': encoding } : {}),
      ...extraHeaders
    }
  });
}

export function compressedJson(req: NextRequest, payload: unknown, extraHeaders: Record<string, string> = {}) {
  return encodedResponse(encodeJson(req.headers.get('accept-encoding') || '', payload), extraHeaders);
}
