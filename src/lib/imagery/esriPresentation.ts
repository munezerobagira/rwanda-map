import { translate, type Language } from '../i18n';
import type { EsriPointMetadata } from './esriMetadata';
export function esriMetadataLines(metadata: EsriPointMetadata, language: Language): string[] {
  const t = (s: string) => translate(s, language);
  const unknown = t('Unknown');
  const lines = [t('Esri imagery at selected point'), `${metadata.point.lat.toFixed(5)}, ${metadata.point.lng.toFixed(5)}`, t('Point metadata only; imagery may vary across the area and by zoom. Independent of building dates.')];
  if (metadata.status === 'loading') lines.push(t('Loading imagery metadata…'));
  else if (metadata.status === 'unavailable' || metadata.status === 'no-data') lines.push(t('Point imagery metadata unavailable.'));
  else {
    if (metadata.status === 'mixed') lines.push(t('Multiple source records at this point; all are listed below.'));
    for (const r of metadata.records) lines.push(
      `${r.provider ?? unknown} · ${r.product ?? unknown} | ${t('Acquisition date')}: ${r.acquiredAt ?? unknown}`,
      `${t('Source resolution')}: ${r.sourceResolutionM ?? unknown} m | ${t('Sampling resolution')}: ${r.samplingResolutionM ?? unknown} m`,
      `${t('Source zoom levels')}: ${r.minMapLevel ?? unknown}–${r.maxMapLevel ?? unknown}`
    );
  }
  lines.push(t('Resolution and sampling are not positional accuracy.'));
  return lines;
}
