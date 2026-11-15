'use client';

import { useI18n } from '@/lib/i18n';

import React from 'react';
import { Lock, Check, Home, Sparkles, PanelLeftClose } from 'lucide-react';
import { BASEMAPS, isBasemapAvailable, basemapPreviewUrl } from '@/lib/basemaps';
import { FEATURE_TYPES } from '@/lib/analysis/registry';
import LayerLegend from '@/components/LayerLegend';

interface SidebarProps {
  bottomInset: number;
  onAnalyze: () => void;
  canAnalyze: boolean;
  analysisPending: boolean;
  analysisEnabled: boolean;
  onToggleAnalysis: (enabled: boolean) => void;
  activeBasemap: string;
  setActiveBasemap: (basemap: string) => void;
  sentinelYear: string;
  activeLayerId: string;
  onSelectLevel: (zoom: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

function SectionHeader({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">{children}</h2>
      {hint && <span className="text-[11px] text-fg-muted">{hint}</span>}
    </div>
  );
}

// Floating left dock. It overlays the map instead of reserving a column, so
// the canvas stays full-screen and collapsing the dock hands the space back.
export default function Sidebar({
  bottomInset,
  activeBasemap,
  setActiveBasemap,
  sentinelYear,
  activeLayerId,
  onSelectLevel,
  isOpen,
  onClose,
  onAnalyze,
  canAnalyze,
  analysisPending,
  analysisEnabled,
  onToggleAnalysis
}: SidebarProps) {
  const { t } = useI18n();
  return (
    <aside
      style={{ bottom: bottomInset }}
      aria-label="Map layers and tools"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`glass-panel absolute z-[1100] left-4 top-[76px] w-[calc(100%-2rem)] max-w-[340px] flex flex-col select-none
        transition-[transform,opacity] duration-300 ease-out
        ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+2rem)] opacity-0'}`}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
        <span className="eyebrow">{t('Layers & tools')}</span>
        <button
          onClick={onClose}
          className="p-1.5 -mr-1.5 text-fg-secondary hover:text-fg hover:bg-surface-subtle/60 rounded-md transition-colors"
          aria-label="Collapse panel"
          title="Collapse panel"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section className="px-5 py-4 border-b border-line">
          <SectionHeader hint={t('Click to zoom')}>{t('Administrative levels')}</SectionHeader>
          <LayerLegend activeLayerId={activeLayerId} onSelectLevel={onSelectLevel} />
        </section>

        <section className="px-5 py-4 border-b border-line">
          <SectionHeader>{t('Basemap')}</SectionHeader>
          <div className="grid grid-cols-2 gap-2">
            {BASEMAPS.map((bm) => {
              const available = isBasemapAvailable(bm);
              const isActive = activeBasemap === bm.id;
              return (
                <button
                  key={bm.id}
                  disabled={!available}
                  onClick={() => setActiveBasemap(bm.id)}
                  aria-pressed={isActive}
                  title={`${bm.name} · ${t(bm.dateNote)}`}
                  className={`group relative rounded-lg overflow-hidden text-left border transition-all ${
                    isActive
                      ? 'border-accent ring-2 ring-accent/30'
                      : available
                        ? 'border-line hover:border-fg-muted'
                        : 'border-line opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="relative h-16 bg-surface-elevated">
                    {available ? (
                      // eslint-disable-next-line @next/next/no-img-element -- third-party tile, not an optimizable asset
                      <img
                        src={basemapPreviewUrl(bm, { year: sentinelYear, date: '' })}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Lock className="w-4 h-4 text-fg-muted" />
                      </div>
                    )}
                    {bm.badge && (
                      <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/65 text-white backdrop-blur-sm">
                        {bm.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <div className="px-2 py-1.5 bg-surface-elevated/80">
                    <span
                      className={`block text-[12px] font-medium truncate ${isActive ? 'text-fg' : 'text-fg-secondary'}`}
                    >
                      {t(bm.name)}
                    </span>
                    <span className="block text-[10px] text-fg-muted">{t(bm.group)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {activeBasemap === 'esri' && <p className="mt-2 text-[11px] text-fg-secondary">{t(BASEMAPS.find((b) => b.id === 'esri')!.dateNote)}</p>}
        </section>

        {/* Placeholder slot for the planned building-detection model, kept so
            the tool card pattern exists when the model is wired in */}
        <section className="px-5 py-4">
          <SectionHeader>{t('Analysis tools')}</SectionHeader>
          <div className="rounded-lg border border-line bg-surface-elevated/50 p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
              <Home className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-fg">{t('Mapped buildings')}</span>
                <span className="eyebrow !text-warning !text-[10px]">{t('Experimental')}</span>
              </div>
              <p className="text-[12px] text-fg-secondary mt-1 leading-relaxed">
                {t(
                  'Select a village or an area up to 50 km². Counts use dated open mapping snapshots, with low confidence.'
                )}
              </p>
              {FEATURE_TYPES.map((feature) => (
                <label key={feature.id} className="flex items-center gap-2 text-[12px] text-fg-secondary mt-2">
                  <input
                    type="checkbox"
                    checked={analysisEnabled}
                    disabled={!canAnalyze}
                    onChange={(e) => onToggleAnalysis(e.target.checked)}
                  />
                  {t(feature.name)}
                </label>
              ))}
              <button
                onClick={onAnalyze}
                disabled={!canAnalyze || analysisPending}
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium border border-line text-fg-secondary hover:text-fg hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {t('Run analysis')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
