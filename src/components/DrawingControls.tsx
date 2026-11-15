'use client';
import { useI18n } from '@/lib/i18n';
import type { DrawingDraft } from '@/lib/drawnSelection';
export default function DrawingControls({ draft, onUndo, onCancel, onFinish, onAddCenter }: {
  draft: DrawingDraft;
  onUndo: () => void;
  onCancel: () => void;
  onFinish: () => void;
  onAddCenter: () => void;
}) {
  const { t } = useI18n();
  const enough = draft.shape === 'rectangle' ? draft.points.length === 2 : draft.points.length >= 3;
  const button = 'min-h-10 rounded border border-line px-3 text-[12px] disabled:opacity-40';
  return (
    <section aria-label={t('Draw an area')} className="glass-panel p-3 space-y-2 text-[12px]">
      <p className="font-semibold">{t(draft.shape === 'rectangle' ? 'Drawn rectangle' : 'Drawn polygon')} · {draft.points.length}</p>
      <p>{t(draft.shape === 'rectangle' ? 'Tap two opposite corners, then Done.' : 'Tap at least three corners, then Done. Up to 64 corners.')}</p>
      <p className="text-fg-secondary">{t('Pan and zoom between taps. Cancel keeps the previous selection.')}</p>
      <p className="text-fg-secondary">{t('Keyboard: focus the map, pan with arrow keys, then add its center.')}</p>
      <div className="flex gap-2 flex-wrap">
        <button className={button} onClick={onAddCenter} disabled={draft.shape === 'rectangle' ? draft.points.length >= 2 : draft.points.length >= 64}>{t('Add map center')}</button>
        <button className={button} onClick={onUndo} disabled={!draft.points.length}>{t('Undo corner')}</button>
        <button className={button} onClick={onCancel}>{t('Cancel')}</button>
        <button className={`${button} bg-accent text-white`} onClick={onFinish} disabled={!enough}>{t('Done')}</button>
      </div>
      {draft.error && <p role="alert" className="text-warning">{t('Use a non-crossing area inside Rwanda’s map bounds, up to 50 km². Undo a corner and retry.')}</p>}
      <p className="text-[11px] text-fg-secondary">{t('User-drawn approximation · not a cadastral boundary.')}</p>
    </section>
  );
}
