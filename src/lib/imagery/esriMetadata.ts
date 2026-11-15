import RWANDA from '../regions/rwanda.json';
export const ESRI_METADATA_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/identify';
export interface MetadataPoint { lat: number; lng: number }
export interface EsriSourceRecord {
  acquiredAt: string | null;
  sourceResolutionM: number | null;
  samplingResolutionM: number | null;
  provider: string | null;
  product: string | null;
  minMapLevel: number | null;
  maxMapLevel: number | null;
}
export interface EsriPointMetadata {
  point: MetadataPoint;
  status: 'loading' | 'available' | 'mixed' | 'no-data' | 'unavailable';
  records: EsriSourceRecord[];
  source: typeof ESRI_METADATA_URL;
}
export function metadataPoint(lat: number, lng: number): MetadataPoint | null {
  const [w, s, e, n] = RWANDA.bounds;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < s || lat > n || lng < w || lng > e) return null;
  return { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
}
function date(value: unknown): string | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value);
  if (!/^(19|20)\d{6}$/.test(text)) return null;
  const iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === iso ? iso : null;
}
const number = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : null;
const level = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23 ? v : null;
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120) : null;
export function parseEsriMetadata(value: unknown, point: MetadataPoint): EsriPointMetadata {
  if (!value || typeof value !== 'object') throw new Error('Invalid metadata');
  const body = value as { results?: unknown; error?: unknown; exceededTransferLimit?: boolean };
  if (body.error || body.exceededTransferLimit || !Array.isArray(body.results) || body.results.length > 32) throw new Error('Incomplete metadata');
  const records = new Map<string, EsriSourceRecord>();
  for (const row of body.results) {
    if (!row || ![9, 10, 11].includes(row.layerId) || !row.attributes || typeof row.attributes !== 'object' || Array.isArray(row.attributes)) throw new Error('Invalid source record');
    const a = row.attributes;
    const record: EsriSourceRecord = {
      acquiredAt: date(a.SRC_DATE), sourceResolutionM: number(a.SRC_RES, 10000), samplingResolutionM: number(a.SAMP_RES, 10000),
      provider: text(a.NICE_DESC), product: text(a.NICE_NAME), minMapLevel: level(a.MinMapLevel), maxMapLevel: level(a.MaxMapLevel)
    };
    records.set(JSON.stringify(record), record);
  }
  return { point, source: ESRI_METADATA_URL, status: records.size > 1 ? 'mixed' : records.size ? 'available' : 'no-data', records: [...records.values()] };
}
export function esriIdentifyUrl(point: MetadataPoint): URL {
  const { lat, lng } = point;
  const url = new URL(ESRI_METADATA_URL);
  url.search = new URLSearchParams({ f: 'json', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', sr: '4326',
    layers: 'all:9,10,11', tolerance: '0', mapExtent: `${lng - .001},${lat - .001},${lng + .001},${lat + .001}`,
    imageDisplay: '1024,1024,96', returnGeometry: 'false', returnFieldName: 'true', returnUnformattedValues: 'true' }).toString();
  return url;
}
