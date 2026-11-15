import type { AnalysisResult, AnalysisPointProperties } from './types';
export function analysisMapPoints(
  result: AnalysisResult | null
): { feature: GeoJSON.Feature<GeoJSON.Point, AnalysisPointProperties>; color: string }[] {
  if (!result?.snapshots[0]) return [];
  const added = new Set(result.comparison?.addedSourceIds ?? []),
    removed = new Set(result.comparison?.removedSourceIds ?? []);
  return [
    ...result.snapshots[0].features.features.map((feature) => ({
      feature,
      color: added.has(feature.properties.sourceId) ? '#34D399' : '#38BDF8'
    })),
    ...(result.snapshots[1]?.features.features ?? [])
      .filter((feature) => removed.has(feature.properties.sourceId))
      .map((feature) => ({ feature, color: '#FB7185' }))
  ];
}

/** Plain text only: the popup never interprets public source values as HTML. */
export function buildingInspectionLines(properties: AnalysisPointProperties, t: (key: string) => string, outline = false): string[] {
  const labels = { unknown: 'Unknown use', 'tagged-house': 'Tagged houses', 'other-residential': 'Other residential', 'non-residential': 'Non-residential' };
  return [
    `${t('Mapped building record')}: ${properties.sourceId}`,
    `${t('Data date')}: ${properties.dataDate.slice(0, 10)}`,
    `${t('Source version')}: ${properties.sourceVersion}`,
    ...(properties.sourceDatasets?.length ? [properties.sourceDatasets.join(', ')] : []),
    `${t('Building use')}: ${t(labels[properties.use])}`,
    `${t('Footprint area')}: ${properties.areaM2} m²`,
    t(outline ? 'Actual source footprint; alignment and completeness are unvalidated.' : 'This marker is a point within the source footprint, not its roof outline.'),
    t('Low confidence · coverage and residential use unvalidated.')
  ];
}

/** Match actual source polygons to authoritative selected points, never infer boxes. */
export function analysisMapFeatures(result: AnalysisResult | null) {
  const outlines = new Map((result?.snapshots.flatMap((snapshot) => snapshot.outlines?.features ?? []) ?? [])
    .map((feature) => [`${feature.properties.sourceVersion}:${feature.properties.sourceId}`, feature]));
  return analysisMapPoints(result).map(({ feature, color }) => ({
    feature: outlines.get(`${feature.properties.sourceVersion}:${feature.properties.sourceId}`) ?? feature,
    color
  }));
}
