'use client';
import ImageryDetails from './ImageryDetails';
import type { ImagerySnapshot } from '@/lib/imagery/useSnapshot';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { validPeriod, type Period } from '@/lib/imagery/catalog';
import { buildingDatesFor, buildingDateAtOrBefore, snapshotPeriod } from '@/lib/analysis/timeControls';
import type { BuildingSource } from '@/lib/analysis/types';
import { sameSeasonLastYear } from '@/lib/imagery/periods';
interface Props {
  buildingSource?: BuildingSource;
  showImagery: boolean;
  snapshots: (ImagerySnapshot | null)[];
  period: Period;
  comparison: Period;
  compare: boolean;
  swipe: number;
  onApply: (period: Period, comparison: Period) => void;
  onCompare: (compare: boolean) => void;
  onSwipe: (swipe: number) => void;
}
// The existing shared timeline now selects bounded periods; comparison layers
// share one Leaflet map, so pans, zooms and the selected geometry stay synced.
export default function TimelineScrubber({
  period,
  comparison,
  compare,
  swipe,
  onApply,
  onCompare,
  onSwipe,
  snapshots,
  showImagery,
  buildingSource = 'osm'
}: Props) {
  const { t } = useI18n();
  const [a, setA] = useState(period),
    [b, setB] = useState(comparison);
  const [error, setError] = useState(false);
  const dates = (p: Period, set: (p: Period) => void, label: string) => (
    <fieldset className="flex items-center gap-1 min-w-0 flex-wrap">
      <legend className="text-[11px] text-fg-secondary">{t(label)}</legend>
      {(['start', 'end'] as const).map((key) => (
        <label key={key} className="min-w-0 flex-1">
          <span className="sr-only">
            {t(label)} {t(key === 'start' ? 'Start' : 'End')}
          </span>
          <input
            type="date"
            aria-label={`${t(label)} ${t(key === 'start' ? 'Start' : 'End')}`}
            min="2019-01-01"
            max={new Date().toISOString().slice(0, 10)}
            value={p[key]}
            onChange={(e) => set({ ...p, [key]: e.target.value })}
            className="bg-surface-elevated text-fg rounded px-1 py-1.5 w-full text-[11px] [color-scheme:dark]"
          />
        </label>
      ))}
    </fieldset>
  );
  if (!showImagery) {
    const dateSelect = (p: Period, side: 'A' | 'B') => (
      <label className="block text-[12px] space-y-1 min-w-0">
        <span>{t(side === 'A' ? 'Date A' : 'Date B')}</span>
        <select
          aria-label={t(side === 'A' ? 'Date A' : 'Date B')}
          className="w-full bg-surface-elevated rounded px-2 min-h-10 text-fg"
          value={buildingDateAtOrBefore(p.end, buildingSource) ?? ''}
          onChange={(event) => {
            const next = snapshotPeriod(event.target.value, buildingSource);
            onApply(side === 'A' ? next : period, side === 'B' ? next : comparison);
          }}
        >
          {!buildingDateAtOrBefore(p.end, buildingSource) && <option value="">{t('No source data for this date')}</option>}
          {buildingDatesFor(buildingSource).map((date) => <option key={date} value={date}>{date}</option>)}
        </select>
      </label>
    );
    return (
      <section className="glass-panel p-3 pointer-events-auto space-y-2 w-full max-h-[40dvh] overflow-y-auto" aria-label={t('Building counts over time')}>
        <div className="flex items-center justify-between gap-2 text-[12px]">
          <span className="font-semibold">{t('Building counts over time')}</span>
          <label className="flex gap-2 items-center min-h-10">
            <input type="checkbox" checked={compare} onChange={(event) => onCompare(event.target.checked)} />
            {t('Compare counts')}
          </label>
        </div>
        <div className={`grid gap-2 ${compare ? 'grid-cols-2' : ''}`}>
          {dateSelect(period, 'A')}
          {compare && dateSelect(comparison, 'B')}
        </div>
        <p className="text-[11px] text-fg-secondary">{t('Choose one mapping date, or enable comparison for two dates. Updates apply immediately.')}</p>
        <p className="text-[11px] text-fg-secondary">{t('Counts use mapped building data, independently of the displayed imagery.')}</p>
      </section>
    );
  }
  return (
    <form
      className="glass-panel p-3 pointer-events-auto space-y-2 w-full max-h-[40dvh] overflow-y-auto"
      onSubmit={(e) => {
        e.preventDefault();
        if (!validPeriod(a) || (compare && !validPeriod(b))) {
          setError(true);
          return;
        }
        setError(false);
        onApply(a, b);
      }}
    >
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="font-semibold">{showImagery ? 'Sentinel-2 · 10 m' : t('Analysis periods')}</span>
        <label className="flex gap-2 items-center min-h-8">
          <input type="checkbox" checked={compare} onChange={(e) => onCompare(e.target.checked)} />
          {t('Compare periods')}
        </label>
      </div>
      <div className={`grid gap-2 ${compare ? 'sm:grid-cols-2' : ''}`}>
        {dates(a, setA, 'Period A')}
        {compare && dates(b, setB, 'Period B')}
      </div>
      {compare && (
        <>
          <button type="button" className="text-accent text-[11px] min-h-8" onClick={() => setB(sameSeasonLastYear(a))}>
            {t('Same season last year')}
          </button>
          {showImagery && (
            <input
              type="range"
              min={0}
              max={100}
              value={swipe}
              aria-label={t('Swipe comparison')}
              onChange={(e) => onSwipe(Number(e.target.value))}
              className="timeline-range"
            />
          )}
        </>
      )}
      <div className="flex gap-2 items-center">
        <button type="submit" className="bg-accent rounded px-3 py-2 text-[12px] text-white">
          {t('Apply periods')}
        </button>
        <span className="text-[10px] text-fg-secondary">
          {showImagery
            ? t('10 m native imagery · least-cloudy scenes; clouds may remain.')
            : t('Mapped snapshots at or before the requested dates.')}
        </span>
      </div>
      {showImagery && <ImageryDetails snapshots={snapshots} />}
      {error && (
        <p role="alert" className="text-warning text-[12px]">
          {t('Check dates: 2019–today, up to 93 days per period.')}
        </p>
      )}
    </form>
  );
}
