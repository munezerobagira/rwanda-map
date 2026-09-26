// Single source of truth for Rwanda's five administrative tiers: the zoom band
// each one renders at, its local (Kinyarwanda) name, how its boundaries are
// drawn, and which feature property carries its name/code. The map, the
// legend, the header telemetry and the breadcrumb all read from here so they
// can never disagree about which tier is active or what it looks like.

export type AdminLevelId = 'provinces' | 'districts' | 'sectors' | 'cells' | 'villages';
export type AdminLevelKey = 'province' | 'district' | 'sector' | 'cell' | 'village';

export interface BoundaryStroke {
  color: string;
  weight: number;
  opacity: number;
  dashArray?: string;
}

export interface AdminLevel {
  id: AdminLevelId;
  key: AdminLevelKey;
  label: string;
  local: string;
  /** Zoom the level picker jumps to. */
  zoom: number;
  /** Lowest zoom at which this tier becomes the active (interactive) layer. */
  minZoom: number;
  /** Feature property holding this tier's official code. */
  codeField: string;
  stroke: BoundaryStroke;
  /** Fill applied on hover / selection - the resting fill is always 0. */
  highlightFill: number;
}

// Strokes get lighter, thinner and more transparent as the tier gets finer, so
// thousands of village lines read as texture over the imagery instead of a
// neon mesh, while the few province lines stay the strongest structure.
export const ADMIN_LEVELS: AdminLevel[] = [
  {
    id: 'provinces', key: 'province', label: 'Province', local: 'Intara',
    zoom: 8.5, minZoom: 0, codeField: 'province_i',
    stroke: { color: '#F8FAFC', weight: 2.5, opacity: 0.85 },
    highlightFill: 0.08
  },
  {
    id: 'districts', key: 'district', label: 'District', local: 'Akarere',
    zoom: 9.7, minZoom: 9.0, codeField: 'district_i',
    stroke: { color: '#94A3B8', weight: 1.8, opacity: 0.7 },
    highlightFill: 0.1
  },
  {
    id: 'sectors', key: 'sector', label: 'Sector', local: 'Umurenge',
    zoom: 11.2, minZoom: 10.5, codeField: 'sector_id',
    stroke: { color: '#38BDF8', weight: 1.2, opacity: 0.55, dashArray: '4 2' },
    highlightFill: 0.1
  },
  {
    id: 'cells', key: 'cell', label: 'Cell', local: 'Akagari',
    zoom: 12.7, minZoom: 12.0, codeField: 'cell_id',
    stroke: { color: '#818CF8', weight: 1.0, opacity: 0.5 },
    highlightFill: 0.15
  },
  {
    id: 'villages', key: 'village', label: 'Village', local: 'Umudugudu',
    zoom: 14, minZoom: 13.5, codeField: 'village_id',
    stroke: { color: '#FCD34D', weight: 0.9, opacity: 0.55, dashArray: '2 2' },
    highlightFill: 0.25
  }
];

// Dark outline drawn under every boundary line so it stays legible whether it
// crosses pale soil, green canopy or dark roofs.
export const CASING = { color: '#000000', opacity: 0.55, extraWeight: 1.5 };

// Accent used for hover/selection outlines - one color regardless of tier, so
// "this is what you're pointing at" never gets confused with a tier color.
export const HIGHLIGHT_COLOR = '#0EA5E9';

export function levelForZoom(zoom: number): AdminLevel {
  let match = ADMIN_LEVELS[0];
  for (const level of ADMIN_LEVELS) {
    if (zoom >= level.minZoom) match = level;
  }
  return match;
}

export function parentLevel(level: AdminLevel): AdminLevel | null {
  const idx = ADMIN_LEVELS.indexOf(level);
  return idx > 0 ? ADMIN_LEVELS[idx - 1] : null;
}

export function levelById(id: string): AdminLevel | undefined {
  return ADMIN_LEVELS.find((l) => l.id === id || l.key === id);
}

// Infers a feature's tier from which properties it carries - every feature
// also carries its ancestors' names, so the finest one present wins.
export function levelOfProperties(props: Record<string, unknown>): AdminLevel {
  for (let i = ADMIN_LEVELS.length - 1; i >= 0; i--) {
    if (props[ADMIN_LEVELS[i].key]) return ADMIN_LEVELS[i];
  }
  return ADMIN_LEVELS[0];
}
