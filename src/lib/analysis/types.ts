import type { BoundaryGeometry } from '../selection';
export type BuildingSource = 'osm' | 'overture';
export type FeatureTypeId = 'buildings';
export type Confidence = 'low' | 'medium' | 'high';
export type BuildingUse = 'unknown' | 'tagged-house' | 'other-residential' | 'non-residential';
export interface AnalysisInput {
  geometry: BoundaryGeometry;
  dates: string[];
  featureTypes: FeatureTypeId[];
}
export interface AnalysisPointProperties {
  sourceId: string;
  sourceDatasets?: string[];
  representativePoint?: [number, number];
  sourceVersion: string;
  dataDate: string;
  use: BuildingUse;
  areaM2: number;
}
export interface BuildingMetrics {
  mappedBuildings: number;
  taggedHouseStructures: number;
  otherResidentialStructures: number;
  unknownUse: number;
  nonResidentialStructures: number;
  densityPerKm2: number;
  houseClassificationRange: { min: number; max: number; interpretation: string } | null;
}
export interface AnalysisSnapshot {
  processingVersion?: number;
  requestedDate: string;
  status: 'available' | 'unavailable';
  sourceVersion?: string;
  dataDate?: string;
  source: string;
  sourceDataUrl?: string;
  license: string;
  attribution: string;
  method: string;
  confidence: Confidence;
  limitations: string[];
  metrics: BuildingMetrics | null;
  features: GeoJSON.FeatureCollection<GeoJSON.Point, AnalysisPointProperties>;
  outlines?: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AnalysisPointProperties>;
  outlineStatus?: 'available' | 'unavailable' | 'budget';
}
export interface AnalysisResult {
  moduleId: FeatureTypeId;
  areaKm2: number;
  snapshots: AnalysisSnapshot[];
  comparison: {
    absolute: number;
    percent: number | null;
    perKm2: number;
    addedSourceIds: string[];
    removedSourceIds: string[];
    interpretation: string;
  } | null;
}
export interface AnalysisModule {
  id: FeatureTypeId;
  run: (input: AnalysisInput) => Promise<AnalysisResult>;
}
