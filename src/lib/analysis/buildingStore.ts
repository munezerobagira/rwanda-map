import RWANDA from '../regions/rwanda.json';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { geometryBounds } from './geometry';
import type { BoundaryGeometry } from '../selection';
export type BuildingRow = [number, number, number, number, number];
export interface BuildingManifest {
  processingVersion?: number;
  version: string;
  source: string;
  dataDate: string;
  license: string;
  attribution: string;
  method: string;
  confidence: string;
  sourceUrl: string;
  sourceSha256: string;
  coordinateScale: number;
  tileZoom: number;
  statistics: { accepted: number };
  tiles: Record<string, { count: number; bytes: number; sha256: string }>;
}
const ROOT = path.join(process.cwd(), 'public', 'data', 'buildings');
const VERSIONS = RWANDA.buildingSnapshots;
const manifests = new Map<string, Promise<BuildingManifest>>();
const cache = new Map<string, Promise<BuildingRow[]>>();
export function buildingManifest(version: string): Promise<BuildingManifest> {
  if (!VERSIONS.includes(version as (typeof VERSIONS)[number])) throw new Error('Unknown building snapshot.');
  let result = manifests.get(version);
  if (!result) {
    result = readFile(path.join(ROOT, version, 'manifest.json'), 'utf8')
      .then(JSON.parse)
      .catch((error) => {
        manifests.delete(version);
        throw error;
      });
    manifests.set(version, result);
  }
  return result;
}
export async function snapshotAt(date: string): Promise<BuildingManifest | null> {
  // Choose the latest published snapshot at or before the requested day's end;
  // never substitute a future snapshot for an earlier date.
  const available = (await Promise.all(VERSIONS.map(buildingManifest)))
    .filter((manifest) => manifest.dataDate.slice(0, 10) <= date)
    .sort((a, b) => a.dataDate.localeCompare(b.dataDate) || (a.processingVersion ?? 1) - (b.processingVersion ?? 1));
  return available.at(-1) ?? null;
}
export async function rowsForGeometry(manifest: BuildingManifest, geometry: BoundaryGeometry): Promise<BuildingRow[]> {
  const [west, south, east, north] = geometryBounds(geometry),
    z = manifest.tileZoom;
  const tileX = (lon: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const tileY = (lat: number) => Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z);
  const keys: string[] = [];
  for (let x = tileX(west); x <= tileX(east); x++)
    for (let y = tileY(north); y <= tileY(south); y++) keys.push(`${x}_${y}`);
  if (keys.length > RWANDA.analysisBudget.maxTiles)
    throw new Error('Choose a more compact area (at most 16 source tiles).');
  const rows = await Promise.all(
    keys.map((key) => {
      if (!manifest.tiles[key]) return Promise.resolve([] as BuildingRow[]);
      const cacheKey = `${manifest.version}/${key}`;
      let value = cache.get(cacheKey);
      if (!value) {
        value = readFile(path.join(ROOT, manifest.version, `${key}.json.gz`))
          .then((bytes) => JSON.parse(gunzipSync(bytes).toString()) as BuildingRow[])
          .catch((e) => {
            cache.delete(cacheKey);
            throw e;
          });
        cache.set(cacheKey, value);
        if (cache.size > 24) cache.delete(cache.keys().next().value!);
      }
      return value;
    })
  );
  return rows.flat();
}
