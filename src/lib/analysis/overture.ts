import { WorkCache } from '../imagery/workCache';
import type { AnalysisResult } from './types';
import september from './footprints/overture-2026-09-23.1-p1.json';
import october from './footprints/overture-2026-10-21.0-p1.json';
import RWANDA from '../regions/rwanda.json';
import type { BoundaryGeometry } from '../selection';
import { geometryAreaKm2, geometryBounds } from './geometry';
import { analyzeRows, compareSnapshots, type CountRow } from './countBuildings';
import { readFootprintAssets, footprintAssetOrigin, type AssetEntry } from './footprintAssets';
import type { AnalysisModule, AnalysisSnapshot } from './types';
import type { BuildingManifest } from './buildingStore';

export interface FootprintManifest extends Omit<BuildingManifest, 'sourceSha256' | 'tiles'> {
  tiles: Record<string, AssetEntry>;
  outlineTiles: Record<string, AssetEntry>;
  outlineZoom: number;
}
export const overtureManifests: FootprintManifest[] = [september, october];
export function footprintTile(lon: number, lat: number, zoom: number): string {
  return `${Math.floor((lon + 180) / 360 * 2 ** zoom)}_${Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** zoom)}`;
}
export function footprintKeys(geometry: BoundaryGeometry, zoom: number): string[] {
  const [w, s, e, n] = geometryBounds(geometry);
  const [minX, minY] = footprintTile(w, n, zoom).split('_').map(Number);
  const [maxX, maxY] = footprintTile(e, s, zoom).split('_').map(Number);
  if ((maxX - minX + 1) * (maxY - minY + 1) > RWANDA.analysisBudget.maxTiles)
    throw new Error('Choose a more compact area (at most 16 source tiles).');
  const keys: string[] = [];
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) keys.push(`${x}_${y}`);
  return keys;
}
export async function attachOutlines(snapshot: AnalysisSnapshot, manifest: FootprintManifest): Promise<AnalysisSnapshot> {
  snapshot = { ...snapshot };
  delete snapshot.outlines;
  if (!snapshot.features.features.length) return { ...snapshot, outlines: { type: 'FeatureCollection', features: [] }, outlineStatus: 'available' };
  const selected = new Map(snapshot.features.features.map((f) => [f.properties.sourceId, f]));
  const keys = [...new Set(snapshot.features.features.map((f) => footprintTile(f.geometry.coordinates[0], f.geometry.coordinates[1], manifest.outlineZoom)))];
  if (keys.length > 64) return { ...snapshot, outlineStatus: 'budget' };
  try {
    if (keys.some((key) => !manifest.outlineTiles[key])) throw new Error('Missing outline tile');
    const rows = await readFootprintAssets(keys.map((key) => manifest.outlineTiles[key]), 4_000);
    const features: NonNullable<AnalysisSnapshot['outlines']>['features'] = [];
    const seen = new Set<string>();
    for (const value of rows) {
      if (!Array.isArray(value) || value.length !== 3 || typeof value[0] !== 'string' || !['Polygon', 'MultiPolygon'].includes(value[1])) throw new Error('Invalid outline record');
      const id = `overture:${value[0]}`, point = selected.get(id);
      if (!point) continue;
      if (seen.has(id)) throw new Error('Duplicate footprint ID');
      seen.add(id);
      features.push({ ...point, properties: { ...point.properties, representativePoint: point.geometry.coordinates.slice(0, 2) as [number, number] }, geometry: { type: value[1], coordinates: value[2] } as GeoJSON.Polygon | GeoJSON.MultiPolygon });
    }
    if (seen.size !== selected.size) throw new Error('Incomplete source outlines');
    // Stable selected-record ordering, independent of transfer/tile order.
    features.sort((a, b) => a.properties.sourceId.localeCompare(b.properties.sourceId));
    return { ...snapshot, outlines: { type: 'FeatureCollection', features }, outlineStatus: 'available' };
  } catch {
    return { ...snapshot, outlineStatus: 'unavailable' };
  }
}
const analysisWork = new WorkCache<AnalysisResult>({ workers: 2, waiting: 4, waitMs: 1500, entries: 2, ttlMs: 60_000 });
const uncachedAnalysis: AnalysisModule = {
  id: 'buildings',
  async run(input) {
    const snapshots: AnalysisSnapshot[] = [];
    for (const date of input.dates) {
      const manifest = overtureManifests.filter((item) => item.dataDate <= date).at(-1);
      if (!manifest) {
        snapshots.push({ ...analyzeRows(input, date, null, []), source: october.source, method: october.method, license: october.license, attribution: october.attribution });
        continue;
      }
      const entries = footprintKeys(input.geometry, manifest.tileZoom).flatMap((key) => manifest.tiles[key] ? [manifest.tiles[key]] : []);
      const rows = await readFootprintAssets(entries);
      if (rows.some((row) => !Array.isArray(row) || row.length !== 7 || typeof row[0] !== 'string' || !row.slice(1).every(Number.isInteger) || row[4] < 0 || row[4] > 3))
        throw new Error('Invalid source footprint records');
      const snapshot = analyzeRows(input, date, manifest, rows as CountRow[]);
      snapshot.sourceDataUrl = `${footprintAssetOrigin()}/data/footprints/manifests/${manifest.version}.json`;
      const byId = new Map((rows as (CountRow & { 5: number })[]).map((row) => [`overture:${row[0]}`, row[5]]));
      for (const feature of snapshot.features.features) {
        const bits = byId.get(feature.properties.sourceId) ?? 0;
        feature.properties.sourceDatasets = [[1, 'OpenStreetMap'], [2, 'Google Open Buildings'], [4, 'Microsoft ML Buildings'], [8, 'Other open source']]
          .filter(([bit]) => (bits & Number(bit)) !== 0).map(([, name]) => String(name));
      }
      snapshot.limitations.push('Release date is not imagery acquisition or construction date. ML footprints can omit buildings or include non-building objects. Country coverage follows World Bank 2012 district boundaries.');
      snapshots.push(await attachOutlines(snapshot, manifest));
    }
    const areaKm2 = geometryAreaKm2(input.geometry);
    const result = { moduleId: 'buildings' as const, areaKm2, snapshots, comparison: compareSnapshots(snapshots, areaKm2) };
    if (Buffer.byteLength(JSON.stringify(result)) > 3_500_000) {
      for (const snapshot of snapshots) if (snapshot.outlines) { delete snapshot.outlines; snapshot.outlineStatus = 'budget'; }
    }
    return result;
  }
};

export const overtureAnalysis: AnalysisModule = {
  id: 'buildings',
  run: (input) => analysisWork.run(JSON.stringify(input), () => uncachedAnalysis.run(input))
};
