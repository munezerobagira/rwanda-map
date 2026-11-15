'use client';
import { useI18n } from '@/lib/i18n';
import { overlaps } from '@/lib/imagery/catalog';
import type { ImagerySnapshot } from '@/lib/imagery/useSnapshot';
interface Props {
  snapshots: (ImagerySnapshot | null)[];
  bbox?: number[];
}
export default function ImageryDetails({ snapshots, bbox }: Props) {
  const { t } = useI18n();
  return (
    <details className="text-[11px] text-fg-secondary border-t border-line pt-2">
      <summary className="cursor-pointer min-h-8">{t('Show acquisition details')}</summary>
      <p>Copernicus Sentinel-2 L2A / Earth Search · 10 m</p>
      <p>{t('10 m native imagery · least-cloudy scenes; clouds may remain.')}</p>
      <p>{t('Confidence: local cloud-free coverage unvalidated.')}</p>
      <p>{t('Candidate scenes in view; scene clouds are not local cloud cover.')}</p>
      {snapshots.map((snapshot, index) => {
        if (!snapshot) return <p key={index}>{t('Loading imagery metadata…')}</p>;
        const scenes = snapshot.scenes.filter((s) => !bbox || overlaps(s.bbox, bbox));
        return (
          <div key={index} className="py-1">
            <p className="font-semibold">
              {t(index === 0 ? 'Period A' : 'Period B')}: {snapshot.period.start} — {snapshot.period.end}
            </p>
            {snapshot.error ? (
              <p role="alert">{t('Imagery unavailable. The street reference remains visible.')}</p>
            ) : !scenes.length ? (
              <p>{t('No scenes found for this period.')}</p>
            ) : (
              scenes.map((s) => (
                <p key={s.id} title={s.id}>
                  {t('Acquired')}: {s.acquiredAt.slice(0, 10)} · {t('Scene cloud cover')}: {s.cloudCover.toFixed(1)}%
                </p>
              ))
            )}
          </div>
        );
      })}
    </details>
  );
}
