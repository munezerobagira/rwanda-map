import type { AreaSelection, DrawnShape } from './selection';
import { geometryAreaKm2, validateGeometry } from './analysis/geometry';
export const MAX_DRAW_VERTICES = 64;
export type DrawPoint = [number, number];
export interface DrawingDraft {
  shape: DrawnShape;
  points: DrawPoint[];
  error?: boolean;
}

/** Canonical ~1m coordinates are used identically by analysis, exports and links. */
export function createAreaSelection(shape: DrawnShape, points: DrawPoint[], createdAt = new Date().toISOString().slice(0, 10)): AreaSelection {
  if (!['rectangle', 'polygon'].includes(shape) || points.length > MAX_DRAW_VERTICES ||
    (shape === 'rectangle' ? points.length !== 2 : points.length < 3) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) ||
    new Date(createdAt).toISOString().slice(0, 10) !== createdAt || createdAt > new Date().toISOString().slice(0, 10))
    throw new Error('Invalid drawn area.');
  const rounded = points.map(([x, y]): DrawPoint => [Number(x.toFixed(5)), Number(y.toFixed(5))]);
  const ring = shape === 'rectangle'
    ? [[rounded[0][0], rounded[0][1]], [rounded[1][0], rounded[0][1]], [rounded[1][0], rounded[1][1]], [rounded[0][0], rounded[1][1]]]
    : rounded;
  if (new Set(ring.map((p) => p.join(','))).size !== ring.length) throw new Error('Repeated drawn corner.');
  const geometry: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[...ring, [...ring[0]]]] };
  if (!validateGeometry(geometry)) throw new Error('Invalid drawn area.');
  return {
    kind: 'area', shape, createdAt, geometry,
    point: { lng: rounded[0][0], lat: rounded[0][1] },
    areaKm2: geometryAreaKm2(geometry)
  };
}

export function areaFragment(selection: AreaSelection): string {
  const ring = selection.geometry.coordinates[0];
  const points = selection.shape === 'rectangle' ? [ring[0], ring[2]] : ring.slice(0, -1);
  return `${selection.shape}|${selection.createdAt}|${points.map((p) => p.join(',')).join(';')}`;
}
export function parseAreaFragment(value: string | null): AreaSelection | undefined {
  if (!value || value.length > 4096) return;
  const [shape, createdAt, raw, extra] = value.split('|');
  if (extra !== undefined || (shape !== 'rectangle' && shape !== 'polygon') || !raw) return;
  const values = raw.split(';');
  if (values.length > MAX_DRAW_VERTICES || values.some((s) => !/^-?\d+(?:\.\d{1,5})?,-?\d+(?:\.\d{1,5})?$/.test(s))) return;
  try {
    return createAreaSelection(shape, values.map((s) => s.split(',').map(Number) as DrawPoint), createdAt);
  } catch { return; }
}
