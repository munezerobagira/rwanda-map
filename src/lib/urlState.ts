// The address bar is the shareable record of a view: map position, basemap,
// imagery year and the selected entity. Read once on load and rewritten with
// replaceState (no history entry per pan) as the view changes.
//
//   ?c=-1.94410,30.06190,14.50&basemap=sentinel2&year=2024&sel=-1.9441,30.0619,village

import type { AdminLevelKey } from './adminLevels';

export interface UrlViewState {
  center?: { lat: number; lng: number; zoom: number };
  basemap?: string;
  year?: string;
  selection?: { lat: number; lng: number; level: AdminLevelKey };
}

const LEVEL_KEYS: AdminLevelKey[] = ['province', 'district', 'sector', 'cell', 'village'];

function parseNumbers(value: string | null, count: number): number[] | null {
  if (!value) return null;
  const parts = value.split(',').slice(0, count).map(Number);
  return parts.length === count && parts.every(Number.isFinite) ? parts : null;
}

export function readUrlState(): UrlViewState {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const state: UrlViewState = {};

  const c = parseNumbers(params.get('c'), 3);
  if (c) state.center = { lat: c[0], lng: c[1], zoom: c[2] };

  const basemap = params.get('basemap');
  if (basemap) state.basemap = basemap;

  const year = params.get('year');
  if (year && /^\d{4}$/.test(year)) state.year = year;

  const sel = params.get('sel');
  if (sel) {
    const [lat, lng, level] = sel.split(',');
    const nums = parseNumbers(`${lat},${lng}`, 2);
    if (nums && LEVEL_KEYS.includes(level as AdminLevelKey)) {
      state.selection = { lat: nums[0], lng: nums[1], level: level as AdminLevelKey };
    }
  }

  return state;
}

export function writeUrlState(state: UrlViewState) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (state.center) {
    const { lat, lng, zoom } = state.center;
    params.set('c', `${lat.toFixed(5)},${lng.toFixed(5)},${zoom.toFixed(2)}`);
  }
  if (state.basemap) params.set('basemap', state.basemap);
  if (state.year) params.set('year', state.year);
  if (state.selection) {
    const { lat, lng, level } = state.selection;
    params.set('sel', `${lat.toFixed(5)},${lng.toFixed(5)},${level}`);
  }

  // Commas are legal in a query string - keep them readable instead of %2C
  const query = params.toString().replace(/%2C/gi, ',');
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, '', next);
  }
}
