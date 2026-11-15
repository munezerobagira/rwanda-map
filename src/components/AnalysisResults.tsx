'use client';
import { useI18n } from '@/lib/i18n';
import type { AnalysisResult } from '@/lib/analysis/types';
export default function AnalysisResults({
  result,
  pending,
  error
}: {
  result: AnalysisResult | null;
  pending: boolean;
  error: string | null;
}) {
  const { t, language } = useI18n();
  const number = (n: number) =>
    n.toLocaleString(language === 'rw' ? 'en-RW' : language === 'fr' ? 'fr-RW' : 'en-RW', { maximumFractionDigits: 1 });
  if (pending)
    return (
      <p role="status" className="mt-4 text-[12px] text-fg-secondary">
        {t('Counting mapped buildings…')}
      </p>
    );
  if (error)
    return (
      <p role="alert" className="mt-4 text-[12px] text-warning">
        {t('Building analysis unavailable. No count has been estimated.')}{' '}
        <span>{t('Select a smaller area or try another date.')}</span>
      </p>
    );
  if (!result) return null;
  return (
    <section className="mt-4 border-t border-line pt-3 space-y-3" aria-label={t('Mapped buildings')}>
      <h3 className="text-[14px] font-semibold">
        {t('Mapped buildings')} · {t('Experimental')}
      </h3>
      <p className="text-[11px] text-warning">{t('Low confidence · coverage and residential use unvalidated.')}</p>
      {result.snapshots.map((snapshot, index) => (
        <div
          key={`${snapshot.requestedDate}:${index}`}
          className="rounded-lg bg-surface-elevated/60 border border-line p-3 text-[12px] space-y-1"
        >
          <h4 className="font-semibold">
            {t(index === 0 ? 'Period A' : 'Period B')} · {snapshot.requestedDate}
          </h4>
          {snapshot.metrics ? (
            <>
              <p className="text-[22px] font-mono">{snapshot.metrics.mappedBuildings ? `≈ ${number(snapshot.metrics.mappedBuildings)}` : '—'}</p>
              <p>{t('Mapped structures, not a complete house census.')}</p>
              {snapshot.metrics.mappedBuildings === 0 && <p className="text-warning">{t('No mapped structures in this source. A house estimate is unavailable.')} {t('Zero mapped structures does not establish zero houses; the source may omit this area.')}</p>}
              <p>
                {t('Density')}: {number(snapshot.metrics.densityPerKm2)} / km² · {t('Area')}: {number(result.areaKm2)}{' '}
                km²
              </p>
              <dl className="grid grid-cols-2 gap-1 mt-2">
                <dt>{t('Tagged houses')}</dt>
                <dd>{number(snapshot.metrics.taggedHouseStructures)}</dd>
                <dt>{t('Other residential')}</dt>
                <dd>{number(snapshot.metrics.otherResidentialStructures)}</dd>
                <dt>{t('Unknown use')}</dt>
                <dd>{number(snapshot.metrics.unknownUse)}</dd>
                <dt>{t('Non-residential')}</dt>
                <dd>{number(snapshot.metrics.nonResidentialStructures)}</dd>
              </dl>
              {snapshot.metrics.houseClassificationRange && (
                <div className="mt-2 border-t border-line pt-2">
                  <p className="font-semibold">
                    {t('Possible house structures')}: {number(snapshot.metrics.houseClassificationRange.min)}–
                    {number(snapshot.metrics.houseClassificationRange.max)}
                  </p>
                  <p className="text-[11px] text-fg-secondary">
                    {t(
                      'Experimental range among mapped structures only. Unknown use may include sheds or apartments; not a confidence interval or a total-house estimate.'
                    )}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p>{t('No building snapshot at or before this date. No estimate available.')}</p>
          )}
          {snapshot.outlineStatus && <p className="text-[11px] text-fg-secondary">{t(snapshot.outlineStatus === 'available' ? 'Actual source outlines available for all counted records.' : 'Outlines unavailable for this selection. Points and counts remain complete; try a smaller area.')}</p>}
          <p className="text-[11px] text-fg-secondary">
            {t('Data date')}: {snapshot.dataDate?.slice(0, 10) ?? '—'} · {snapshot.sourceVersion ?? '—'}
          </p>
          <p className="text-[11px] text-fg-secondary">
            {snapshot.source} · {snapshot.license}
            {snapshot.processingVersion && <> · {t('Processing revision')}: {snapshot.processingVersion}</>}
          </p>
          <p className="text-[11px] text-fg-secondary">
            {t(
              'Method: count points in mapped building footprints inside the selected polygon; no residential model validated.'
            )}
          </p>
        </div>
      ))}
      {result.comparison ? (
        <div className="text-[12px] space-y-1">
          <h4 className="font-semibold">{t('Mapped dataset change · A minus B')}</h4>
          <p>
            {result.comparison.absolute >= 0 ? '+' : ''}
            {number(result.comparison.absolute)} ·{' '}
            {result.comparison.percent === null ? '—' : `${number(result.comparison.percent)}%`} ·{' '}
            {number(result.comparison.perKm2)} / km²
          </p>
          <p>
            {t('Added to selection')}: {number(result.comparison.addedSourceIds.length)} · {t('Removed from selection')}
            : {number(result.comparison.removedSourceIds.length)}
          </p>
          <p className="text-warning text-[11px]">
            {t(
              'Mapping edits and improved coverage can change counts. This is not verified construction or demolition.'
            )}
          </p>
        </div>
      ) : (
        result.snapshots.length > 1 && (
          <p className="text-[11px] text-fg-secondary">
            {t('Comparison unavailable: same snapshot, incompatible processing/source, or insufficient mapped coverage.')}
          </p>
        )
      )}
      <p className="text-[11px] text-fg-secondary">{t('Blue: mapped in A · green: added · red: removed.')}</p>
      <p className="text-[11px] text-fg-secondary">{t('Tap a colored building to inspect its source, date and use.')}</p>
      <p className="text-[10px] text-fg-secondary">
        {[...new Set(result.snapshots.map((snapshot) => snapshot.attribution))].join('; ')}.{' '}
        {result.snapshots.some((snapshot) => !snapshot.outlines) && t('Dots are points within footprints, not surveyed locations.')}
      </p>
    </section>
  );
}
