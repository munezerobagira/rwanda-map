// Central registry of every basemap the map can show.
//
// Adding a new provider (a new satellite/imagery source, a different tile
// server, a time-aware provider like Sentinel Hub, etc.) should only ever
// require adding one entry here - Sidebar.tsx and InteractiveMap.tsx both
// read from this list generically instead of hardcoding per-provider logic.

export interface BasemapTimeParams {
  /** Currently selected year, for providers that expose an annual mosaic (e.g. EOX s2cloudless). */
  year: string;
  /** Currently selected ISO date (YYYY-MM-DD), for providers that expose per-scene imagery. */
  date: string;
}

export interface BasemapDefinition {
  id: string;
  name: string;
  group: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string;
  /** Builds the tile URL template. Most providers ignore `params` entirely. */
  buildUrl: (params: BasemapTimeParams) => string;
  /** Show the year selector for this basemap (e.g. annual cloud-free mosaics). */
  supportsYear?: boolean;
  /** Show a full date picker for this basemap (e.g. real per-scene imagery, which can show clouds). */
  supportsDate?: boolean;
  /**
   * Name of a NEXT_PUBLIC_* env var that must be set for this basemap to work
   * (API key / instance id for paid or registration-gated providers). If set
   * but the env var is missing, the basemap is shown disabled in the sidebar
   * with a hint instead of being wired up with a broken URL.
   */
  requiresEnvVar?: string;
  /** Short note shown in the sidebar under a disabled/unavailable basemap. */
  unavailableHint?: string;
  /** Resolution / character chip shown on the basemap card (e.g. "10 m"). */
  badge?: string;
}

export const BASEMAPS: BasemapDefinition[] = [
  {
    id: 'esri',
    badge: 'Sub-metre',
    name: 'Esri World Imagery',
    group: 'Satellite',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    buildUrl: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  },
  {
    id: 'sentinel2',
    badge: '10 m',
    name: 'Sentinel-2 Cloudless',
    group: 'Satellite',
    attribution: 'Sentinel-2 cloudless &copy; <a href="https://s2maps.eu">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data)',
    supportsYear: true,
    buildUrl: ({ year }) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`
  },
  {
    id: 'sentinelhub-truecolor',
    badge: '10 m · daily',
    name: 'Sentinel-2 True Color (with clouds)',
    group: 'Satellite',
    attribution: 'Sentinel Hub / Copernicus Data Space Ecosystem',
    supportsDate: true,
    requiresEnvVar: 'NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID',
    unavailableHint: 'Needs a Sentinel Hub instance ID - set NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID in .env.local',
    // Sentinel Hub's WMTS endpoint takes a TIME=<ISO date> param per request,
    // giving real single-date scenes (clouds included) instead of an annual
    // cloud-free composite - this is the "more timelines, with clouds" option.
    buildUrl: ({ date }) =>
      `https://services.sentinel-hub.com/ogc/wmts/${process.env.NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID}?SERVICE=WMTS&REQUEST=GetTile&LAYER=TRUE-COLOR&TILEMATRIXSET=PopularWebMercator256&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/jpeg&TIME=${date}`
  },
  {
    id: 'blackmarble',
    badge: 'Night lights',
    name: 'NASA Earth at Night',
    group: 'Night',
    attribution: 'NASA Earth at Night &copy; NASA &copy; EOX',
    buildUrl: () => 'https://tiles.maps.eox.at/wmts/1.0.0/blackmarble_3857/default/g/{z}/{y}/{x}.jpg'
  },
  {
    id: 'dark',
    badge: 'Minimal',
    name: 'CartoDB Dark Matter',
    group: 'Vector',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    buildUrl: () => 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  },
  {
    id: 'osm',
    badge: 'Streets',
    name: 'EOX Street Map',
    group: 'Vector',
    attribution: 'Street Map &copy; OpenStreetMap contributors &copy; EOX',
    buildUrl: () => 'https://tiles.maps.eox.at/wmts/1.0.0/osm_3857/default/g/{z}/{y}/{x}.jpg'
  },
  {
    id: 'terrain',
    badge: 'Relief',
    name: 'EOX Terrain Light',
    group: 'Physical',
    attribution: 'Terrain &copy; EOX IT Services GmbH',
    buildUrl: () => 'https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg'
  }
];

// One real tile over central Kigali (z11) used as each basemap card's preview,
// so the picker shows what the imagery actually looks like here rather than
// asking people to remember what a provider name means.
const PREVIEW_TILE = { z: 11, x: 1195, y: 1035 };

export function basemapPreviewUrl(basemap: BasemapDefinition, params: BasemapTimeParams): string {
  return basemap
    .buildUrl(params)
    .replace('{z}', String(PREVIEW_TILE.z))
    .replace('{x}', String(PREVIEW_TILE.x))
    .replace('{y}', String(PREVIEW_TILE.y))
    .replace('{s}', basemap.subdomains?.[0] ?? 'a')
    .replace('{r}', '');
}

export function isBasemapAvailable(basemap: BasemapDefinition): boolean {
  if (!basemap.requiresEnvVar) return true;
  return Boolean(process.env[basemap.requiresEnvVar]);
}
