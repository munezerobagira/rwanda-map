import type { FeatureTypeId } from './types';
export const FEATURE_FLAGS = {
  buildingAnalysis: true,
  drawnSelection: true,
  legacyGridDemo: false,
  experimentalHouseClassificationRange: true
} as const;
export interface FeatureTypeDefinition {
  id: FeatureTypeId;
  name: string;
  source: string;
  detectionMethod: string;
  validation: string;
  confidenceRule: string;
  color: string;
  derivedMetrics: string[];
}
export const FEATURE_TYPES: FeatureTypeDefinition[] = [
  {
    id: 'buildings',
    name: 'Mapped buildings',
    source: 'OpenStreetMap / Geofabrik Rwanda or Overture Maps Foundation (explicit source selection)',
    detectionMethod:
      'Point in footprint inside selection; valid OSM polygons with relation deduplication, or source-conflated Overture building objects (no building parts).',
    validation: 'Rwanda completeness and residential classification not yet independently validated.',
    confidenceRule: 'Low until urban, peri-urban and rural samples have independent ground truth.',
    color: '#38BDF8',
    derivedMetrics: ['densityPerKm2', 'taggedHouseStructures', 'houseClassificationRange', 'mappedDatasetChange']
  }
];
