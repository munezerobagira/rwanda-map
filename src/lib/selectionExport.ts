import type { EsriPointMetadata } from './imagery/esriMetadata';
import { esriMetadataLines } from './imagery/esriPresentation';
import { displayName, selectionArea, type SpatialSelection } from './selection';
import { translate } from './i18n';
import type { ImagerySnapshot } from './imagery/useSnapshot';
import type { Language } from './i18n';
import type { AnalysisResult } from './analysis/types';
export interface SelectionExport {
  selection: SpatialSelection;
  snapshots: (ImagerySnapshot | null)[];
  language: Language;
  analysis?: AnalysisResult | null;
  esriMetadata?: EsriPointMetadata | null;
}
export function selectionGeoJson({ selection, snapshots, language, analysis, esriMetadata }: SelectionExport) {
  const summary = analysis
    ? { ...analysis, snapshots: analysis.snapshots.map((snapshot) => ({ ...snapshot, features: undefined, outlines: undefined })) }
    : null;
  const selected = {
    type: 'Feature' as const,
    id: 'selection',
    geometry: selection.geometry,
    properties: {
      ...Object.fromEntries(
        Object.entries(selection.kind === 'feature' ? selection.props : { name: translate(displayName(selection), language), area_km2: selection.areaKm2 }).filter(([key]) => !['connection_rate', 'peak_load_mw', 'status'].includes(key))
      ),
      language,
      boundary_source_date: null,
      boundary_confidence: selection.kind === 'feature' ? 'Unvalidated reference boundary; source/date unknown' : 'User-drawn approximation; not cadastral',
      selection_kind: selection.kind,
      selection_shape: selection.kind === 'area' ? selection.shape : null,
      geometry_created_at: selection.kind === 'area' ? selection.createdAt : null,
      imagery: snapshots,
      esri_point_metadata: esriMetadata ? { ...esriMetadata, context: esriMetadataLines(esriMetadata, language) } : null,
      analysis: summary,
      estimated_houses: null
    }
  };
  const points = new Map(
    (analysis?.snapshots.flatMap((snapshot) => {
      const outlines = new Map(snapshot.outlines?.features.map((f) => [f.properties.sourceId, f]) ?? []);
      return snapshot.features.features.map((feature) => outlines.get(feature.properties.sourceId) ?? feature);
    }) ?? []).map((feature) => {
      const id = `${feature.properties.sourceVersion}:${feature.properties.sourceId}`;
      return [id, { ...feature, id }] as const;
    })
  );
  return {
    type: 'FeatureCollection' as const,
    features: [selected, ...points.values()] as const,
    attribution:
      (analysis?.snapshots.map((snapshot) => `${snapshot.attribution} (${snapshot.license})`).filter((v, i, a) => a.indexOf(v) === i).join('; ') ?? '') + (esriMetadata ? '. Esri World Imagery point metadata. ' : '. Copernicus Sentinel-2 / Earth Search for imagery metadata. ') + (selection.kind === 'feature' ? 'Boundary source/date unknown.' : 'User-drawn approximation; not cadastral.')
  };
}
const cell = (value: unknown) => {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return '"' + safe.replaceAll('"', '""') + '"';
};
export function selectionCsv({ selection, snapshots, language, analysis, esriMetadata }: SelectionExport): string {
  const header = [
    'record_type',
    'metadata_lat', 'metadata_lng', 'metadata_status', 'source_resolution_m', 'sampling_resolution_m', 'source_min_zoom', 'source_max_zoom',
    'selection',
    'level',
    'area_km2',
    'language',
    'period_start',
    'period_end',
    'requested_date',
    'source_date',
    'source_version',
    'source',
    'license',
    'attribution',
    'outline_status',
    'source_data_url',
    'processing_revision',
    'method',
    'confidence',
    'mapped_buildings',
    'density_per_km2',
    'tagged_house_structures',
    'other_residential',
    'unknown_use',
    'non_residential',
    'possible_house_min',
    'possible_house_max',
    'scene_id',
    'scene_cloud_percent',
    'native_resolution_m',
    'boundary_date',
    'geometry_created_at',
    'geometry_method'
  ];
  const rows: Record<string, unknown>[] = [];
  const base = {
    selection: translate(displayName(selection), language),
    level: selection.kind === 'feature' ? selection.level.key : 'drawn_area',
    area_km2: analysis?.areaKm2 ?? selectionArea(selection),
    geometry_created_at: selection.kind === 'area' ? selection.createdAt : '',
    geometry_method: selection.kind === 'area' ? `User-drawn ${selection.shape}; coordinates rounded to 5 decimal degrees; not cadastral` : 'Unvalidated reference boundary',
    language,
    boundary_date: selection.kind === 'feature' ? 'Unknown' : 'Not applicable'
  };
  if (esriMetadata) {
    const records = esriMetadata.records.length ? esriMetadata.records : [null];
    for (const record of records) rows.push({ ...base, record_type: 'esri_point_metadata',
      metadata_lat: esriMetadata.point.lat, metadata_lng: esriMetadata.point.lng, metadata_status: esriMetadata.status,
      source: 'Esri World Imagery', attribution: [record?.provider, record?.product].filter(Boolean).join(' / '),
      source_date: record?.acquiredAt, source_resolution_m: record?.sourceResolutionM, sampling_resolution_m: record?.samplingResolutionM,
      source_min_zoom: record?.minMapLevel, source_max_zoom: record?.maxMapLevel, source_data_url: esriMetadata.source,
      method: esriMetadataLines(esriMetadata, language).join(' | '), confidence: 'Provider metadata; positional accuracy unvalidated'
    });
  }
  for (const snapshot of snapshots) {
    if (snapshot)
      for (const scene of snapshot.scenes)
        rows.push({
          ...base,
          record_type: 'imagery_candidate',
          period_start: snapshot.period.start,
          period_end: snapshot.period.end,
          source_date: scene.acquiredAt,
          source_version: snapshot.version,
          source: snapshot.source,
          license: 'Copernicus Sentinel data terms',
          attribution: 'Contains modified Copernicus Sentinel data / Earth Search',
          method: snapshot.method,
          confidence: snapshot.confidence,
          scene_id: scene.id,
          scene_cloud_percent: scene.cloudCover,
          native_resolution_m: snapshot.nativeResolutionM
        });
  }
  for (const snapshot of analysis?.snapshots ?? []) {
    const m = snapshot.metrics;
    rows.push({
      ...base,
      record_type: 'mapped_building_estimate',
      requested_date: snapshot.requestedDate,
      source_date: snapshot.dataDate,
      source_version: snapshot.sourceVersion,
      source: snapshot.source,
      license: snapshot.license,
      attribution: snapshot.attribution,
      outline_status: snapshot.outlineStatus,
      source_data_url: snapshot.sourceDataUrl,
      processing_revision: snapshot.processingVersion,
      method: snapshot.method,
      confidence: `${snapshot.confidence}; ${snapshot.limitations.join(' ')}`,
      mapped_buildings: m?.mappedBuildings,
      density_per_km2: m?.densityPerKm2,
      tagged_house_structures: m?.taggedHouseStructures,
      other_residential: m?.otherResidentialStructures,
      unknown_use: m?.unknownUse,
      non_residential: m?.nonResidentialStructures,
      possible_house_min: m?.houseClassificationRange?.min,
      possible_house_max: m?.houseClassificationRange?.max
    });
  }
  if (!rows.length)
    rows.push({ ...base, record_type: 'selection', method: 'No dated metadata available', confidence: 'Unvalidated' });
  return [header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadFile(content: string, type: string, filename: string) {
  downloadBlob(new Blob([content], { type }), filename);
}
