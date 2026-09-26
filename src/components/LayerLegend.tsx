'use client';

import React from 'react';
import { ADMIN_LEVELS, AdminLevel } from '@/lib/adminLevels';

interface LayerLegendProps {
  activeLayerId: string;
  onSelectLevel: (zoom: number) => void;
}

// A real sample of each tier's line (color, weight, dash) so the key matches
// exactly what's drawn on the map.
function StrokeSample({ level }: { level: AdminLevel }) {
  const { color, weight, opacity, dashArray } = level.stroke;
  return (
    <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="5" x2="27" y2="5" stroke="#000" strokeOpacity={0.55} strokeWidth={weight + 1.5} strokeLinecap="round" />
      <line
        x1="1"
        y1="5"
        x2="27"
        y2="5"
        stroke={color}
        strokeOpacity={Math.min(1, opacity + 0.2)}
        strokeWidth={Math.max(weight, 1)}
        strokeDasharray={dashArray}
        strokeLinecap="round"
      />
    </svg>
  );
}

// Rwanda's five-tier hierarchy as a legend you can click: each row jumps to
// the zoom where that tier becomes the active, clickable layer. The tier
// shown at the current zoom is marked, with the tier above it drawn as context.
export default function LayerLegend({ activeLayerId, onSelectLevel }: LayerLegendProps) {
  const activeIdx = ADMIN_LEVELS.findIndex((l) => l.id === activeLayerId);

  return (
    <ul className="flex flex-col gap-0.5" role="list">
      {ADMIN_LEVELS.map((level, idx) => {
        const isActive = idx === activeIdx;
        const isContext = idx === activeIdx - 1;
        return (
          <li key={level.id}>
            <button
              onClick={() => onSelectLevel(level.zoom)}
              aria-current={isActive ? 'true' : undefined}
              title={`Zoom to ${level.label} level`}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                isActive ? 'bg-accent/10 ring-1 ring-accent/40' : 'hover:bg-surface-subtle/60'
              }`}
              style={{ paddingLeft: `${10 + idx * 8}px` }}
            >
              <StrokeSample level={level} />
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-semibold tracking-[-0.01em] ${isActive ? 'text-fg' : 'text-fg-secondary'}`}>
                  {level.label}
                </span>
                <span className="block text-[11px] text-fg-muted">{level.local}</span>
              </span>
              {isActive ? (
                <span className="eyebrow !text-accent">Active</span>
              ) : isContext ? (
                <span className="eyebrow">Context</span>
              ) : (
                <span className="text-[11px] font-mono tabular text-fg-muted">z{level.minZoom || 8}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
