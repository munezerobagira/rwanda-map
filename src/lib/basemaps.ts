// Open/keyless providers by default; Esri is the specific user-requested exception (ADR0010).
import RWANDA from './regions/rwanda.json';
import { imageryTileUrl, latestCompleteMonth } from './imagery/periods';
export interface BasemapTimeParams {
  version?: string;
  year: string;
  date: string;
  start?: string;
  end?: string;
}
export interface BasemapDefinition {
  id: string;
  name: string;
  group: string;
  attribution: string;
  maxZoom?: number;
  maxNativeZoom?: number;
  subdomains?: string;
  buildUrl: (params: BasemapTimeParams) => string;
  supportsYear?: boolean;
  supportsDate?: boolean;
  supportsPeriod?: boolean;
  badge?: string;
  nativeResolutionM: number | null;
  dateNote: string;
  userRequestedException?: 'esri';
  exportAttribution?: string;
}
export const BASEMAPS: BasemapDefinition[] = [
  {
    id: 'esri',
    name: 'Esri World Imagery',
    group: 'Satellite',
    badge: 'High-res',
    nativeResolutionM: null,
    userRequestedException: 'esri',
    maxNativeZoom: 19,
    maxZoom: 20,
    attribution: 'Tiles &copy; <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">Esri</a> · Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    exportAttribution: 'Tiles © Esri | Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community',
    dateNote: 'Esri reference imagery · resolution and capture dates vary; no selected-period comparison.',
    buildUrl: () => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  },
  {
    id: 'sentinel2',
    name: 'Sentinel-2 · dated scenes',
    group: 'Satellite',
    badge: '10 m',
    nativeResolutionM: 10,
    supportsPeriod: true,
    supportsYear: true,
    maxNativeZoom: 14,
    attribution:
      'Contains modified Copernicus Sentinel data · <a href="https://registry.opendata.aws/sentinel-2-l2a-cogs/">Earth Search</a>',
    dateNote: 'Least-cloudy scenes in selected period; clouds may remain.',
    buildUrl: ({ start, end, version }) =>
      imageryTileUrl(start && end ? { start, end } : latestCompleteMonth(), version)
  },
  {
    id: 'sentinel2-2016',
    name: 'Sentinel-2 · 2016 reference',
    group: 'Satellite',
    badge: '10 m · 2016',
    nativeResolutionM: 10,
    maxNativeZoom: 14,
    attribution:
      'Sentinel-2 cloudless · <a href="https://cloudless.eox.at">EOX</a> (Contains modified Copernicus Sentinel data 2016) · CC BY 4.0',
    dateNote: 'Static 2016 mosaic. Not current imagery; no period comparison.',
    buildUrl: () => 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    group: 'Reference',
    badge: 'Streets',
    nativeResolutionM: null,
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ODbL',
    dateNote: 'Rolling vector cartography; acquisition date and historical tile comparison unavailable.',
    buildUrl: () => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  }
];
const PREVIEW_TILE = { z: 11, x: 1195, y: 1035 };
export function basemapPreviewUrl(basemap: BasemapDefinition, params: BasemapTimeParams): string {
  // Do not run expensive analysis tiles just to decorate a layer card.
  if (basemap.supportsPeriod) return '/brand/logo-mark.svg';
  return basemap
    .buildUrl(params)
    .replace('{z}', String(PREVIEW_TILE.z))
    .replace('{x}', String(PREVIEW_TILE.x))
    .replace('{y}', String(PREVIEW_TILE.y))
    .replace('{s}', 'a')
    .replace('{r}', '');
}
export function isBasemapAvailable(basemap: BasemapDefinition): boolean {
  if (basemap.id === 'esri') return basemap.userRequestedException === 'esri';
  return basemap.nativeResolutionM === null ? basemap.id === 'osm' : basemap.nativeResolutionM > 0 && basemap.nativeResolutionM <= 10;
}

export function basemapReferenceNote(basemap?: BasemapDefinition): string {
  if (basemap?.id === 'esri') return basemap.dateNote;
  return basemap?.id === 'sentinel2-2016' ? 'Reference only · 2016 imagery' : 'Rolling reference · no historical tile dates';
}

// Display zoom is magnification, independent of source pixel size/accuracy.
export const MAX_DISPLAY_ZOOM = Math.max(RWANDA.mapZoom.max, ...BASEMAPS.filter(isBasemapAvailable).map((source) => source.maxZoom ?? RWANDA.mapZoom.max));
export function basemapMaxZoom(id?: string): number {
  const source = BASEMAPS.find((candidate) => candidate.id === id && isBasemapAvailable(candidate));
  return source?.maxZoom ?? RWANDA.mapZoom.max;
}
