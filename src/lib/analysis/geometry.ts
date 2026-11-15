import RWANDA from '../regions/rwanda.json';
import type { BoundaryGeometry } from '../selection';
const EARTH_RADIUS = 6371008.8;
export function geometryBounds(geometry: BoundaryGeometry): [number, number, number, number] {
  const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons)
    for (const ring of polygon)
      for (const [x, y] of ring) {
        bounds[0] = Math.min(bounds[0], x);
        bounds[1] = Math.min(bounds[1], y);
        bounds[2] = Math.max(bounds[2], x);
        bounds[3] = Math.max(bounds[3], y);
      }
  return bounds;
}
function ringArea(ring: GeoJSON.Position[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i],
      b = ring[i + 1];
    sum +=
      (((b[0] - a[0]) * Math.PI) / 180) * (2 + Math.sin((a[1] * Math.PI) / 180) + Math.sin((b[1] * Math.PI) / 180));
  }
  return Math.abs((sum * EARTH_RADIUS ** 2) / 2) / 1e6;
}
export function geometryAreaKm2(geometry: BoundaryGeometry): number {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce(
    (sum, rings) => sum + ringArea(rings[0]) - rings.slice(1).reduce((n, r) => n + ringArea(r), 0),
    0
  );
}
function inRing(x: number, y: number, ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    // A point exactly on a ring belongs to it (hole boundaries excluded below).
    const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < 1e-12 &&
      x >= Math.min(a[0], b[0]) &&
      x <= Math.max(a[0], b[0]) &&
      y >= Math.min(a[1], b[1]) &&
      y <= Math.max(a[1], b[1])
    )
      return true;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function pointInGeometry(lon: number, lat: number, geometry: BoundaryGeometry): boolean {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => inRing(lon, lat, rings[0]) && !rings.slice(1).some((r) => inRing(lon, lat, r)));
}
function crosses(a: GeoJSON.Position, b: GeoJSON.Position, c: GeoJSON.Position, d: GeoJSON.Position): boolean {
  const orient = (p: GeoJSON.Position, q: GeoJSON.Position, r: GeoJSON.Position) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const on = (p: GeoJSON.Position, q: GeoJSON.Position, r: GeoJSON.Position) =>
    Math.abs(orient(p, q, r)) < 1e-14 && r[0] >= Math.min(p[0], q[0]) && r[0] <= Math.max(p[0], q[0]) &&
      r[1] >= Math.min(p[1], q[1]) && r[1] <= Math.max(p[1], q[1]);
  return (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) ||
    on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}
function ringSelfCrosses(ring: GeoJSON.Position[]): boolean {
  for (let i = 0; i < ring.length - 1; i++)
    for (let j = i + 2; j < ring.length - 1; j++) {
      if (i === 0 && j === ring.length - 2) continue;
      if (crosses(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
    }
  return false;
}
export function validateGeometry(value: unknown): value is BoundaryGeometry {
  if (!value || typeof value !== 'object') return false;
  const g = value as { type?: unknown; coordinates?: unknown };
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') return false;
  if (!Array.isArray(g.coordinates) || g.coordinates.length === 0) return false;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let count = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) return false;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) return false;
      count += ring.length;
      if (count > RWANDA.analysisBudget.maxVertices) return false;
      for (const p of ring)
        if (
          !Array.isArray(p) ||
          p.length !== 2 ||
          !p.every((n) => typeof n === 'number' && Number.isFinite(n)) ||
          p[0] < RWANDA.bounds[0] ||
          p[0] > RWANDA.bounds[2] ||
          p[1] < RWANDA.bounds[1] ||
          p[1] > RWANDA.bounds[3]
        )
          return false;
      if (ringSelfCrosses(ring)) return false;
      const first = ring[0],
        last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) return false;
    }
  }
  const area = geometryAreaKm2(value as BoundaryGeometry);
  return Number.isFinite(area) && area > 0 && area <= RWANDA.analysisBudget.maxAreaKm2;
}
