'use client';

import React from 'react';
import { ChevronRight, Crosshair, Loader2 } from 'lucide-react';
import { ADMIN_LEVELS, AdminLevelKey } from '@/lib/adminLevels';

interface LocationBarProps {
  /** Names along the selected entity's hierarchy, keyed by tier. */
  hierarchy: Partial<Record<AdminLevelKey, string>> | null;
  point: { lat: number; lng: number } | null;
  isOutside: boolean;
  isDetectingLocation: boolean;
  onDetectLocation: () => void;
  /** Navigate up to an ancestor tier of the current selection. */
  onNavigate: (level: AdminLevelKey | 'country') => void;
  currentZoom: number;
}

// Bottom status bar. The breadcrumb is live navigation: each crumb flies to
// that ancestor's extent and makes it the selection, so moving up the
// hierarchy is one click instead of re-searching.
export function LocationBar({
  hierarchy,
  point,
  isOutside,
  isDetectingLocation,
  onDetectLocation,
  onNavigate,
  currentZoom
}: LocationBarProps) {
  const crumbs = hierarchy
    ? ADMIN_LEVELS.filter((l) => hierarchy[l.key]).map((l) => ({ key: l.key, label: l.label, name: hierarchy[l.key]! }))
    : [];

  return (
    <div className="glass-panel w-full flex items-center gap-3 px-2 py-1.5 select-none pointer-events-auto">
      <button
        onClick={onDetectLocation}
        disabled={isDetectingLocation}
        title="Detect my location"
        aria-label="Detect my location"
        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-accent hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isDetectingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
      </button>

      <div className="h-5 w-px bg-line shrink-0" />

      <nav aria-label="Administrative hierarchy" className="min-w-0 flex-1 overflow-x-auto">
        <ol className="flex items-center gap-0.5 text-[13px] whitespace-nowrap">
          <li>
            <button
              onClick={() => onNavigate('country')}
              className="px-1.5 py-1 rounded text-fg-secondary hover:text-fg hover:bg-surface-subtle/60 transition-colors"
            >
              Rwanda
            </button>
          </li>
          {crumbs.map((c, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <li key={c.key} className="flex items-center gap-0.5">
                <ChevronRight className="w-3.5 h-3.5 text-fg-muted shrink-0" aria-hidden="true" />
                {isLast ? (
                  <span aria-current="location" className="px-1.5 py-1 font-semibold text-fg">
                    {c.name}
                  </span>
                ) : (
                  <button
                    onClick={() => onNavigate(c.key)}
                    title={`Go to ${c.name} ${c.label}`}
                    className="px-1.5 py-1 rounded text-fg-secondary hover:text-fg hover:bg-surface-subtle/60 transition-colors"
                  >
                    {c.name}
                  </button>
                )}
              </li>
            );
          })}
          {crumbs.length === 0 && (
            <li className="flex items-center gap-0.5">
              <ChevronRight className="w-3.5 h-3.5 text-fg-muted shrink-0" aria-hidden="true" />
              <span className="px-1.5 text-fg-muted">
                {isOutside ? 'Point lies outside mapped boundaries' : 'Click the map or search to select a place'}
              </span>
            </li>
          )}
        </ol>
      </nav>

      <div className="hidden sm:flex items-center gap-3 shrink-0 pr-2 text-[12px] font-mono tabular text-fg-secondary">
        {point && (
          <span title="Selected point (lat, lng)">
            {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
          </span>
        )}
        <span className="h-4 w-px bg-line" />
        <span title="Zoom level">z {currentZoom.toFixed(1)}</span>
      </div>
    </div>
  );
}
