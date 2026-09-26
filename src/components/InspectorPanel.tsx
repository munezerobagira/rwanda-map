'use client';

import React, { useRef, useState } from 'react';
import { X, Download, Loader2, Copy, Check, MapPinOff, Sparkles } from 'lucide-react';
import { ADMIN_LEVELS } from '@/lib/adminLevels';
import { Selection, codeOf, displayName } from '@/lib/selection';

interface InspectorPanelProps {
  selection: Selection;
  onClose: () => void;
}

function Kpi({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-lg bg-surface-elevated/60 border border-line p-3 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className="eyebrow !text-[10px]">{label}</span>
        {note && <span className="text-[10px] text-fg-muted">{note}</span>}
      </div>
      <div className="mt-1 text-[17px] font-semibold text-fg font-mono tabular truncate">{children}</div>
    </div>
  );
}

// Tailwind v4 compiles opacity-modified colors to color-mix(in oklab, ...),
// which the browser reports back from getComputedStyle as lab()/oklab() - a
// syntax html2canvas's own CSS parser rejects ("unsupported color function").
// For the duration of the export, wrap getComputedStyle so every value is
// normalized to plain rgb()/rgba() by round-tripping it through a canvas.
async function exportElementAsPng(el: HTMLElement, filename: string) {
  const nativeGetComputedStyle = window.getComputedStyle.bind(window);
  const probe = document.createElement('canvas').getContext('2d');
  const unsafeColorFn = /(?:^|[^a-z-])(lab|lch|oklab|oklch|color)\(/i;
  const toSafeColor = (value: string): string => {
    if (!probe || typeof value !== 'string' || !unsafeColorFn.test(value)) return value;
    try {
      probe.fillStyle = '#000';
      probe.fillStyle = value;
      return probe.fillStyle;
    } catch {
      return value;
    }
  };

  window.getComputedStyle = ((elt: Element, pseudo?: string | null) => {
    const original = nativeGetComputedStyle(elt, pseudo ?? undefined);
    return new Proxy(original, {
      get(target, prop, receiver) {
        if (prop === 'getPropertyValue') {
          return (name: string) => toSafeColor(target.getPropertyValue(name));
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') return value.bind(target);
        return typeof value === 'string' ? toSafeColor(value) : value;
      }
    });
  }) as typeof window.getComputedStyle;

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, {
      backgroundColor: '#0F172A',
      useCORS: true,
      scale: Math.min(window.devicePixelRatio || 1, 2) * 1.5,
      ignoreElements: (node) => node.classList.contains('export-ignore')
    });
    await new Promise<void>((resolve) =>
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
        resolve();
      }, 'image/png')
    );
  } finally {
    window.getComputedStyle = nativeGetComputedStyle;
  }
}

// Floating right-hand inspector for the selected entity. Opens only when
// something is selected and overlays the map rather than narrowing it.
export default function InspectorPanel({ selection, onClose }: InspectorPanelProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    if (!cardRef.current || isExporting || selection.kind !== 'feature') return;
    setIsExporting(true);
    try {
      const slug = displayName(selection).trim().replace(/\s+/g, '-').toLowerCase() || 'location';
      await exportElementAsPng(cardRef.current, `${slug}-details-${Date.now()}.png`);
    } catch (err) {
      console.error('Failed to export details card', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard write failed', err);
    }
  };

  const iconButton =
    'p-1.5 text-fg-secondary hover:text-fg hover:bg-surface-subtle/60 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  if (selection.kind === 'outside') {
    return (
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center">
              <MapPinOff className="w-4 h-4 text-warning" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-fg tracking-[-0.01em]">Outside mapped area</h2>
              <p className="text-[12px] text-fg-secondary">No administrative boundary at this point.</p>
            </div>
          </div>
          <button onClick={onClose} className={iconButton} aria-label="Close inspector">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-4 text-[12px] font-mono tabular text-fg-secondary">
          {selection.point.lat.toFixed(5)}, {selection.point.lng.toFixed(5)}
        </p>
      </div>
    );
  }

  const { level, props, point } = selection;
  const code = codeOf(selection);
  const levelIdx = ADMIN_LEVELS.indexOf(level);
  const parents = ADMIN_LEVELS.slice(0, levelIdx)
    .reverse()
    // Province names already read as places ("Southern Province", "City of Kigali")
    .map((l) => props[l.key] && (l.key === 'province' ? props[l.key] : `${props[l.key]} ${l.label}`))
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  const isVillage = level.key === 'village';
  const connection = typeof props.connection_rate === 'number' ? props.connection_rate : null;

  return (
    <div ref={cardRef} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 eyebrow !text-[10px] px-2 py-0.5 rounded-full border"
            style={{ borderColor: `${level.stroke.color}55`, color: level.stroke.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: level.stroke.color }} />
            {level.label} · {level.local}
          </span>
          <h2 className="mt-2 text-[20px] leading-tight font-semibold text-fg tracking-[-0.01em] break-words">
            {displayName(selection)}
          </h2>
          {parents && <p className="mt-0.5 text-[12px] text-fg-secondary">{parents}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 export-ignore">
          <button onClick={handleExport} disabled={isExporting} className={iconButton} title="Export card as PNG" aria-label="Export card as PNG">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className={iconButton} title="Close (Esc)" aria-label="Close inspector">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {code && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-elevated/60 border border-line pl-3 pr-1.5 py-1.5">
          <span className="text-[12px] text-fg-secondary">
            {level.label} code <span className="ml-1.5 font-mono tabular text-[13px] text-fg">{code}</span>
          </span>
          <button
            onClick={() => handleCopy(code)}
            className={`${iconButton} export-ignore flex items-center gap-1 text-[12px]`}
            aria-label={`Copy ${level.label.toLowerCase()} code`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Kpi label="Area">
          {typeof props.area_km2 === 'number' ? (
            <>
              {props.area_km2}
              <span className="text-[12px] text-fg-secondary ml-1">km²</span>
            </>
          ) : (
            '—'
          )}
        </Kpi>
        <Kpi label="Tier">
          {levelIdx + 1}
          <span className="text-[12px] text-fg-secondary ml-1">of 5</span>
        </Kpi>
        {isVillage && typeof props.peak_load_mw === 'number' && (
          <Kpi label="Peak load" note="Simulated">
            {props.peak_load_mw}
            <span className="text-[12px] text-fg-secondary ml-1">MW</span>
          </Kpi>
        )}
        {isVillage && connection !== null && (
          <Kpi label="Grid access" note="Simulated">
            {connection}
            <span className="text-[12px] text-fg-secondary ml-0.5">%</span>
          </Kpi>
        )}
      </div>

      {isVillage && connection !== null ? (
        <div className="mt-3">
          <div className="relative h-2 rounded-full bg-surface-subtle overflow-hidden" role="meter" aria-valuenow={connection} aria-valuemin={0} aria-valuemax={100} aria-label="Grid connection rate">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${connection}%`,
                background: connection >= 80 ? 'var(--status-success)' : connection >= 70 ? 'var(--status-warning)' : 'var(--status-danger)'
              }}
            />
            {[25, 50, 75].map((m) => (
              <span key={m} className="absolute top-0 bottom-0 w-px bg-surface-base/60" style={{ left: `${m}%` }} />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-fg-muted">
            Grid metrics are generated placeholders until a real grid dataset is connected.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-fg-secondary">Select a village to see grid connection metrics.</p>
      )}

      <div className="mt-4 pt-4 border-t border-line">
        <span className="eyebrow !text-[10px]">Selected point</span>
        <p className="mt-1 text-[12px] font-mono tabular text-fg-secondary">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-line p-3 flex items-center gap-2.5 text-[12px] text-fg-muted export-ignore">
        <Sparkles className="w-4 h-4 shrink-0" />
        Building detection results will appear here.
      </div>
    </div>
  );
}
