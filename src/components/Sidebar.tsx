'use client';

import React from 'react';
import { Lock, Check, Home, Sparkles, PanelLeftClose } from 'lucide-react';
import { BASEMAPS, isBasemapAvailable, basemapPreviewUrl } from '@/lib/basemaps';
import LayerLegend from '@/components/LayerLegend';

interface SidebarProps {
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
  activeBasemap,
  setActiveBasemap,
  sentinelYear,
  activeLayerId,
  onSelectLevel,
  isOpen,
  onClose
}: SidebarProps) {
  return (
    <aside
      aria-label="Map layers and tools"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={`glass-panel absolute z-[1100] left-4 top-[76px] bottom-[76px] w-[calc(100%-2rem)] max-w-[340px] flex flex-col select-none
        transition-[transform,opacity] duration-300 ease-out
        ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+2rem)] opacity-0'}`}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
        <span className="eyebrow">Layers &amp; tools</span>
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
          <SectionHeader hint="Click to zoom">Administrative levels</SectionHeader>
          <LayerLegend activeLayerId={activeLayerId} onSelectLevel={onSelectLevel} />
        </section>

        <section className="px-5 py-4 border-b border-line">
          <SectionHeader>Basemap</SectionHeader>
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
                  title={available ? bm.name : bm.unavailableHint}
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
                    <span className={`block text-[12px] font-medium truncate ${isActive ? 'text-fg' : 'text-fg-secondary'}`}>
                      {bm.name}
                    </span>
                    <span className="block text-[10px] text-fg-muted">{bm.group}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Placeholder slot for the planned building-detection model, kept so
            the tool card pattern exists when the model is wired in */}
        <section className="px-5 py-4">
          <SectionHeader>Analysis tools</SectionHeader>
          <div className="rounded-lg border border-line bg-surface-elevated/50 p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
              <Home className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-fg">Building detection</span>
                <span className="eyebrow !text-warning !text-[10px]">Soon</span>
              </div>
              <p className="text-[12px] text-fg-secondary mt-1 leading-relaxed">
                Count structures in the current view and plot them on the map.
              </p>
              <button
                disabled
                className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium border border-line text-fg-muted cursor-not-allowed"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run analysis
              </button>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
