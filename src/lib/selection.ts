import { ADMIN_LEVELS, AdminLevel, AdminLevelKey } from './adminLevels';

export type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

// What the inspector, breadcrumb, focus mask and URL all describe. `point` is
// an interior reference for an admin unit (ancestor resolution/shared links),
// or the first drawn corner. Drawn areas carry their own bounded geometry.
export type DrawnShape = 'rectangle' | 'polygon';
export interface AreaSelection {
  kind: 'area';
  shape: DrawnShape;
  geometry: GeoJSON.Polygon;
  point: { lat: number; lng: number };
  areaKm2: number;
  createdAt: string;
}
export type Selection =
  | AreaSelection
  | {
      kind: 'feature';
      level: AdminLevel;
      props: Record<string, string | number | undefined>;
      point: { lat: number; lng: number };
      geometry: BoundaryGeometry;
    }
  | { kind: 'outside'; point: { lat: number; lng: number } };

export function hierarchyOf(
  props: Record<string, string | number | undefined>,
  upTo: AdminLevel
): Partial<Record<AdminLevelKey, string>> {
  const out: Partial<Record<AdminLevelKey, string>> = {};
  for (const level of ADMIN_LEVELS) {
    if (props[level.key]) out[level.key] = String(props[level.key]);
    if (level === upTo) break;
  }
  return out;
}

export type SpatialSelection = Exclude<Selection, { kind: 'outside' }>;

export function selectionArea(sel: SpatialSelection): number | undefined {
  return sel.kind === 'area' ? sel.areaKm2 : typeof sel.props.area_km2 === 'number' ? sel.props.area_km2 : undefined;
}

export function displayName(sel: SpatialSelection): string {
  if (sel.kind === 'area') return sel.shape === 'rectangle' ? 'Drawn rectangle' : 'Drawn polygon';
  return String(sel.props[sel.level.key] ?? '');
}

/** Official hierarchical code (e.g. 8-digit village code) where the data carries one. */
export function codeOf(sel: SpatialSelection): string | undefined {
  if (sel.kind === 'area') return;
  const code = sel.props[sel.level.codeField];
  return code ? String(code) : undefined;
}

/** Even-odd inverted mask: every selection ring, including holes, must toggle fill. */
export function maskLatLngs(geometry: BoundaryGeometry): [number, number][][] {
  const world: [number, number][] = [
    [-89, -179.9],
    [-89, 179.9],
    [89, 179.9],
    [89, -179.9]
  ];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return [
    world,
    ...polygons.flatMap((rings) => rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])))
  ];
}
