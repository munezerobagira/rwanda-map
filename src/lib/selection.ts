import { ADMIN_LEVELS, AdminLevel, AdminLevelKey } from './adminLevels';

export type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

// What the inspector, breadcrumb, focus mask and URL all describe. `point` is
// a location known to be inside the entity - it's what lets us re-resolve any
// ancestor (breadcrumb) or restore the selection from a shared link.
export type Selection =
  | {
      kind: 'feature';
      level: AdminLevel;
      props: Record<string, any>;
      point: { lat: number; lng: number };
      geometry: BoundaryGeometry;
    }
  | { kind: 'outside'; point: { lat: number; lng: number } };

export function hierarchyOf(props: Record<string, any>, upTo: AdminLevel): Partial<Record<AdminLevelKey, string>> {
  const out: Partial<Record<AdminLevelKey, string>> = {};
  for (const level of ADMIN_LEVELS) {
    if (props[level.key]) out[level.key] = props[level.key];
    if (level === upTo) break;
  }
  return out;
}

export function displayName(sel: Extract<Selection, { kind: 'feature' }>): string {
  return String(sel.props[sel.level.key] ?? '');
}

/** Official hierarchical code (e.g. 8-digit village code) where the data carries one. */
export function codeOf(sel: Extract<Selection, { kind: 'feature' }>): string | undefined {
  const code = sel.props[sel.level.codeField];
  return code ? String(code) : undefined;
}
