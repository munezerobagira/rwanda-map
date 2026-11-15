import RWANDA from '../regions/rwanda.json';
// Server-only catalog adapter. No signed URLs or caller-supplied asset URLs.
export const CATALOG = 'https://earth-search.aws.element84.com/v1';
export const COLLECTION = 'sentinel-2-l2a';
export const RWANDA_BBOX = RWANDA.bounds;
export interface Period {
  start: string;
  end: string;
}
export interface Scene {
  id: string;
  acquiredAt: string;
  cloudCover: number;
  bbox: [number, number, number, number];
  visual: string;
  epsg: number;
  nativeResolutionM: 10;
}
interface CatalogFeature {
  id: string;
  bbox: number[];
  properties: { datetime: string; 'eo:cloud_cover': number; 'proj:epsg': number };
  assets: { visual?: { href: string } };
}
export function validPeriod(period: Period): boolean {
  const parse = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  return Boolean(
    parse(period.start) &&
      parse(period.end) &&
      period.start >= '2019-01-01' &&
      period.start <= period.end &&
      Date.parse(period.end) - Date.parse(period.start) <= 93 * 86400000 &&
      period.end <= new Date().toISOString().slice(0, 10)
  );
}
export function allowedVisual(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname === 'sentinel-cogs.s3.us-west-2.amazonaws.com' &&
      /^\/sentinel-s2-l2a-cogs\/\d{2}\/[A-Z]\/[A-Z]{2}\/\d{4}\/\d{1,2}\/S2[ABC]_\d{2}[A-Z]{3}_\d{8}_\d+_L2A\/TCI\.tif$/.test(
        u.pathname
      ) &&
      !u.search &&
      !u.username &&
      !u.password
    );
  } catch {
    return false;
  }
}
export function normalizeScene(f: CatalogFeature): Scene | null {
  const visual = f.assets.visual?.href;
  if (
    !visual ||
    !allowedVisual(visual) ||
    ![32735, 32736].includes(f.properties['proj:epsg']) ||
    !f.bbox ||
    f.bbox.length !== 4 ||
    !f.bbox.every(Number.isFinite) ||
    !Number.isFinite(f.properties['eo:cloud_cover']) ||
    !Number.isFinite(Date.parse(f.properties.datetime))
  )
    return null;
  return {
    id: f.id,
    acquiredAt: f.properties.datetime,
    cloudCover: f.properties['eo:cloud_cover'],
    bbox: f.bbox as Scene['bbox'],
    visual,
    epsg: f.properties['proj:epsg'],
    nativeResolutionM: 10
  };
}
const cache = new Map<string, { expires: number; promise: Promise<Scene[]> }>();
export async function scenesForPeriod(period: Period): Promise<Scene[]> {
  if (!validPeriod(period)) throw new Error('Choose a valid period of up to 93 days, from 2019 through today.');
  const key = `catalog-v2:${COLLECTION}:${period.start}:${period.end}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = (async () => {
    const params = new URLSearchParams({
      collections: COLLECTION,
      bbox: RWANDA_BBOX.join(','),
      datetime: `${period.start}T00:00:00Z/${period.end}T23:59:59Z`,
      limit: '100',
      sortby: '+properties.eo:cloud_cover',
      query: JSON.stringify({ 's2:nodata_pixel_percentage': { lt: 50 } })
    });
    const response = await fetch(`${CATALOG}/search?${params}`, {
      signal: AbortSignal.timeout(10000),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Imagery catalog unavailable (${response.status}).`);
    const data = (await response.json()) as { features?: CatalogFeature[] };
    if (!Array.isArray(data.features)) throw new Error('Invalid imagery catalog response.');
    const scenes = data.features.map(normalizeScene).filter((s): s is Scene => s !== null);
    // Keep up to three candidates per grid square: a low-cloud scene can cover
    // only a sliver of a grid, so retaining just one creates false gaps.
    const grids = new Map<string, number>();
    return scenes
      .sort((a, b) => a.cloudCover - b.cloudCover)
      .filter((s) => {
        const grid = s.id.split('_')[1];
        const count = grids.get(grid) ?? 0;
        if (count >= 3) return false;
        grids.set(grid, count + 1);
        return true;
      })
      .slice(0, 48);
  })().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expires: Date.now() + 3600000, promise });
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
  return promise;
}
export function overlaps(a: readonly number[], b: readonly number[]): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}
export function tileBbox(z: number, x: number, y: number): [number, number, number, number] {
  const lon = (x: number) => (x / 2 ** z) * 360 - 180;
  const lat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;
  return [lon(x), lat(y + 1), lon(x + 1), lat(y)];
}

// Deterministic content revision (not a security digest). A new catalog candidate
// set creates a distinct tile cache key even when requested periods are unchanged.
export function sceneVersion(scenes: Scene[]): string {
  const text = scenes.map((s) => `${s.id}:${s.acquiredAt}:${s.cloudCover}:${s.visual}`).join('|');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return `s2-l2a-v2-${hash.toString(16)}`;
}
