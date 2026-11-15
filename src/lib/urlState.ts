// The address bar is the shareable record of a view: map position, basemap,
// imagery periods and the selected entity (drawn geometry stays in the fragment). Read once on load and rewritten with
// replaceState (no history entry per pan) as the view changes.
//
//   ?c=-1.94410,30.06190,14.50&basemap=sentinel2&year=2024&sel=-1.9441,30.0619,village

import type { BuildingSource } from './analysis/types';
import { areaFragment, parseAreaFragment } from './drawnSelection';
import type { AreaSelection } from './selection';
import { validPeriod, type Period } from './imagery/catalog';
import type { Language } from './i18n';
import type { AdminLevelKey } from './adminLevels';

export interface UrlViewState {
  area?: AreaSelection;
  center?: { lat: number; lng: number; zoom: number };
  basemap?: string;
  year?: string;
  period?: Period;
  comparison?: Period;
  compare?: boolean;
  language?: Language;
  analysis?: boolean;
  buildingSource?: BuildingSource;
  buildingsVisible?: boolean;
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

  for (const [key, from, to] of [
    ['period', 'from', 'to'],
    ['comparison', 'compareFrom', 'compareTo']
  ] as const) {
    const period = { start: params.get(from) ?? '', end: params.get(to) ?? '' };
    if (validPeriod(period)) state[key] = period;
  }
  if (params.get('compare') === '1') state.compare = true;
  if (params.get('analysis') === 'buildings') state.analysis = true;
  if (params.get('analysis') === 'off') state.analysis = false;
  if (params.get('buildingSource') === 'overture') state.buildingSource = 'overture';
  if (params.get('buildingsVisible') === '0') state.buildingsVisible = false;
  const language = params.get('lang');
  if (language === 'rw' || language === 'en' || language === 'fr') state.language = language;

  const sel = params.get('sel');
  if (sel) {
    const [lat, lng, level] = sel.split(',');
    const nums = parseNumbers(`${lat},${lng}`, 2);
    if (nums && LEVEL_KEYS.includes(level as AdminLevelKey)) {
      state.selection = { lat: nums[0], lng: nums[1], level: level as AdminLevelKey };
    }
  }

  const area = parseAreaFragment(new URLSearchParams(window.location.hash.slice(1)).get('area'));
  if (area) { state.area = area; delete state.selection; }
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
  if (state.period) {
    params.set('from', state.period.start);
    params.set('to', state.period.end);
  }
  if (state.comparison) {
    params.set('compareFrom', state.comparison.start);
    params.set('compareTo', state.comparison.end);
  }
  if (state.compare) params.set('compare', '1');
  if (state.language) params.set('lang', state.language);
  if (state.analysis === true) params.set('analysis', 'buildings');
  if (state.buildingSource === 'overture') params.set('buildingSource', 'overture');
  if (state.buildingsVisible === false) params.set('buildingsVisible', '0');
  if (state.analysis === false) params.set('analysis', 'off');
  if (state.selection && !state.area) {
    const { lat, lng, level } = state.selection;
    params.set('sel', `${lat.toFixed(5)},${lng.toFixed(5)},${level}`);
  }

  // Commas are legal in a query string - keep them readable instead of %2C
  const query = params.toString().replace(/%2C/gi, ',');
  const hash = new URLSearchParams(window.location.hash.slice(1));
  hash.delete('area');
  if (state.area) hash.set('area', areaFragment(state.area));
  const fragment = hash.toString();
  const next = `${window.location.pathname}${query ? `?${query}` : ''}${fragment ? `#${fragment}` : ''}`;
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(window.history.state, '', next);
  }
}
