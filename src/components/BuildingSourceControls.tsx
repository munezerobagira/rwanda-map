'use client';
import { useI18n } from '@/lib/i18n';
import type { BuildingSource } from '@/lib/analysis/types';
export default function BuildingSourceControls({ source, onSource, visible, onVisible }: {
  source: BuildingSource; onSource: (source: BuildingSource) => void;
  visible: boolean; onVisible: (visible: boolean) => void;
}) {
  const { t } = useI18n();
  return <div className="mt-3 space-y-2 text-[12px] export-ignore">
    <label className="block space-y-1">
      <span>{t('Building data source')}</span>
      <select value={source} onChange={(e) => onSource(e.target.value as BuildingSource)} className="w-full bg-surface-elevated text-fg rounded px-2 min-h-10">
        <option value="osm">OpenStreetMap</option>
        <option value="overture">Overture · {t('Broader footprint coverage')}</option>
      </select>
    </label>
    <p className="text-fg-secondary">{t('Changing source selects its latest two available dates. Sources are never added together.')}</p>
    <label className="flex items-center gap-2 min-h-10">
      <input type="checkbox" checked={visible} onChange={(e) => onVisible(e.target.checked)} />
      {t('Show counted buildings on map')}
    </label>
    <p className="text-fg-secondary">{t('Overture shows source footprints. Hide the overlay to inspect the imagery underneath.')}</p>
    {source === 'overture' && <a href="/data/footprints/README.txt" target="_blank" rel="noopener noreferrer" className="block text-accent underline min-h-8">{t('Data and license')}</a>}
  </div>;
}
