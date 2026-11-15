import RWANDA from '../regions/rwanda.json';
import { geometryAreaKm2, pointInGeometry } from './geometry';
import { FEATURE_FLAGS } from './registry';
import type { BuildingManifest } from './buildingStore';
import type { AnalysisInput, AnalysisResult, AnalysisSnapshot, BuildingUse } from './types';
export type CountRow = [number | string, number, number, number, number];
const USE: BuildingUse[] = ['unknown', 'tagged-house', 'other-residential', 'non-residential'];
export function analyzeRows(
  input: AnalysisInput,
  date: string,
  manifest: Omit<BuildingManifest, 'sourceSha256' | 'tiles'> | null,
  rows: CountRow[]
): AnalysisSnapshot {
  const base = {
    requestedDate: date,
    source: manifest?.source ?? 'OpenStreetMap / Geofabrik Rwanda',
    license: manifest?.license ?? 'ODbL-1.0',
    attribution: manifest?.attribution ?? '© OpenStreetMap contributors',
    processingVersion: manifest?.processingVersion ?? (manifest ? 1 : undefined),
    method: manifest?.method ??
      'Count one point in each valid mapped building footprint inside the selected polygon; relation outer ways deduplicated.',
    confidence: 'low' as const,
    limitations: [
      'Mapped buildings are not a census of all buildings or households.',
      'Snapshot date is mapping history, not construction or image acquisition date.',
      'Most building use is unknown; residential classification is unvalidated.'
    ]
  };
  if (!manifest)
    return {
      ...base,
      status: 'unavailable',
      metrics: null,
      features: { type: 'FeatureCollection', features: [] },
      limitations: [...base.limitations, 'No source snapshot exists at or before this date.']
    };
  const accepted = rows.filter((row) =>
    pointInGeometry(row[1] / manifest.coordinateScale, row[2] / manifest.coordinateScale, input.geometry)
  );
  if (accepted.length > RWANDA.analysisBudget.maxFeatures)
    throw new Error('More than 10,000 mapped structures. Select a smaller area for complete exports.');
  const counts = [0, 0, 0, 0];
  for (const row of accepted) counts[row[4]]++;
  const area = geometryAreaKm2(input.geometry);
  return {
    ...base,
    status: 'available',
    limitations: accepted.length ? base.limitations : [...base.limitations, 'Zero mapped structures does not establish zero houses; the source may omit this area.'],
    sourceVersion: manifest.version,
    dataDate: manifest.dataDate,
    metrics: {
      mappedBuildings: accepted.length,
      taggedHouseStructures: counts[1],
      otherResidentialStructures: counts[2],
      unknownUse: counts[0],
      nonResidentialStructures: counts[3],
      densityPerKm2: accepted.length / area,
      houseClassificationRange:
        FEATURE_FLAGS.experimentalHouseClassificationRange && accepted.length > 0
          ? {
              min: counts[1],
              max: counts[1] + counts[2] + counts[0],
              interpretation:
                'Experimental classification range among mapped structures only, not a confidence interval or bounds on all houses. Assumes unknown use may be residential; may include sheds or multi-unit buildings.'
            }
          : null
    },
    features: {
      type: 'FeatureCollection',
      features: accepted.map((row) => ({
        type: 'Feature',
        id: typeof row[0] === 'string' ? `overture:${row[0]}` : `osm:${row[0] > 0 ? 'w' : 'r'}${Math.abs(row[0])}`,
        geometry: {
          type: 'Point',
          coordinates: [row[1] / manifest.coordinateScale, row[2] / manifest.coordinateScale]
        },
        properties: {
          sourceId: typeof row[0] === 'string' ? `overture:${row[0]}` : `osm:${row[0] > 0 ? 'w' : 'r'}${Math.abs(row[0])}`,
          sourceVersion: manifest.version,
          dataDate: manifest.dataDate,
          use: USE[row[4]],
          areaM2: row[3]
        }
      }))
    }
  };
}
export function compareSnapshots(snapshots: AnalysisSnapshot[], area: number): AnalysisResult['comparison'] {
  const [a, b] = snapshots;
  if (!a?.metrics || !b?.metrics || (!a.metrics.mappedBuildings && !b.metrics.mappedBuildings) || a.sourceVersion === b.sourceVersion || a.source !== b.source ||
    (a.processingVersion ?? 1) !== (b.processingVersion ?? 1)) return null;
  const idsA = new Set(a.features.features.map((f) => f.properties.sourceId)),
    idsB = new Set(b.features.features.map((f) => f.properties.sourceId));
  const absolute = a.metrics.mappedBuildings - b.metrics.mappedBuildings;
  return {
    absolute,
    percent: b.metrics.mappedBuildings ? (absolute / b.metrics.mappedBuildings) * 100 : null,
    perKm2: absolute / area,
    addedSourceIds: [...idsA].filter((id) => !idsB.has(id)),
    removedSourceIds: [...idsB].filter((id) => !idsA.has(id)),
    interpretation:
      'A minus B: mapped dataset change, not verified construction or demolition. Mapping improvements, retagging and boundary-crossing geometry edits can change counts.'
  };
}
