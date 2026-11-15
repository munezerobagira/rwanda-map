import { useI18n } from '@/lib/i18n';
import type { EsriPointMetadata } from '@/lib/imagery/esriMetadata';
import { esriMetadataLines } from '@/lib/imagery/esriPresentation';
export default function EsriMetadataDetails({ metadata }: { metadata: EsriPointMetadata | null }) {
  const { t, language } = useI18n();
  if (!metadata) return null;
  return <section className="mt-3 border-t border-line pt-3 text-[11px] text-fg-secondary" aria-live="polite">
    {esriMetadataLines(metadata, language).map((line, index) => <p className="mt-1" key={index}>{line}</p>)}
    <a href={metadata.source.replace('/identify', '?f=pjson')} target="_blank" rel="noreferrer" className="underline">{t('Source metadata')} · Esri World Imagery</a>
  </section>;
}
