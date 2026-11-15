'use client';

import EsriMetadataDetails from './EsriMetadataDetails';
import type { EsriPointMetadata } from '@/lib/imagery/esriMetadata';
import { useI18n } from '@/lib/i18n';

import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, Copy, Check, MapPinOff, Sparkles } from 'lucide-react';
import { downloadFile, downloadBlob, selectionCsv, selectionGeoJson } from '@/lib/selectionExport';
import { canvasPngBlob } from '@/lib/imageExport';
import { FEATURE_FLAGS } from '@/lib/analysis/registry';
import AnalysisResults from './AnalysisResults';
import type { AnalysisResult } from '@/lib/analysis/types';
import type { ImagerySnapshot } from '@/lib/imagery/useSnapshot';
import { ADMIN_LEVELS } from '@/lib/adminLevels';
import { Selection, codeOf, displayName } from '@/lib/selection';

interface InspectorPanelProps {
  esriMetadata: EsriPointMetadata | null;
  analysisControls?: React.ReactNode;
  analysisEnabled: boolean;
  canAnalyze: boolean;
  onToggleAnalysis: (enabled: boolean) => void;
  selection: Selection;
  onClose: () => void;
  children?: React.ReactNode;
  snapshots: (ImagerySnapshot | null)[];
  analysis: AnalysisResult | null;
  analysisPending: boolean;
  analysisError: string | null;
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
async function exportElementAsPng(el: HTMLElement, filename: string, isCurrent: () => boolean) {
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
    const blob = await canvasPngBlob(canvas);
    if (!isCurrent()) throw new Error('Selection or source changed during card export.');
    downloadBlob(blob, filename);
  } finally {
    window.getComputedStyle = nativeGetComputedStyle;
  }
}

// Floating right-hand inspector for the selected entity. Opens only when
// something is selected and overlays the map rather than narrowing it.
export default function InspectorPanel({
  selection,
  analysisEnabled,
  analysisControls,
  canAnalyze,
  onToggleAnalysis,
  onClose,
  children,
  snapshots,
  esriMetadata,
  analysis,
  analysisPending,
  analysisError
}: InspectorPanelProps) {
  const { t, language } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const captureRevision = useRef(0);
  useEffect(() => {
    captureRevision.current++;
  }, [selection, snapshots, language, analysis, esriMetadata]);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExport = async () => {
    if (!cardRef.current || isExporting || selection.kind === 'outside') return;
    const expectedRevision = captureRevision.current;
    setIsExporting(true);
    try {
      const slug = displayName(selection).trim().replace(/\s+/g, '-').toLowerCase() || 'location';
      await exportElementAsPng(
        cardRef.current,
        `${slug}-details-${Date.now()}.png`,
        () => captureRevision.current === expectedRevision
      );
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
              <h2 className="text-[16px] font-semibold text-fg tracking-[-0.01em]">{t('Outside mapped area')}</h2>
              <p className="text-[12px] text-fg-secondary">{t('No administrative boundary at this point.')}</p>
            </div>
          </div>
          <button onClick={onClose} className={iconButton} aria-label={t('Close inspector')}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-4 text-[12px] font-mono tabular text-fg-secondary">
          {selection.point.lat.toFixed(5)}, {selection.point.lng.toFixed(5)}
        </p>
        <EsriMetadataDetails metadata={esriMetadata} />
      </div>
    );
  }

  const { point } = selection;
  const level = selection.kind === 'feature' ? selection.level : null;
  const props = selection.kind === 'feature' ? selection.props : { area_km2: Number(selection.areaKm2.toFixed(4)) };
  const color = level?.stroke.color ?? '#38BDF8';
  const code = codeOf(selection);
  const levelIdx = level ? ADMIN_LEVELS.indexOf(level) : -1;
  const parents = ADMIN_LEVELS.slice(0, levelIdx)
    .reverse()
    // Province names already read as places ("Southern Province", "City of Kigali")
    .map((l) => props[l.key] && (l.key === 'province' ? props[l.key] : `${props[l.key]} ${l.label}`))
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  const isVillage = level?.key === 'village' && FEATURE_FLAGS.legacyGridDemo;
  const connection = typeof props.connection_rate === 'number' ? props.connection_rate : null;

  return (
    <div ref={cardRef} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className="inline-flex items-center gap-1.5 eyebrow !text-[10px] px-2 py-0.5 rounded-full border"
            style={{ borderColor: `${color}55`, color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
            {level ? `${t(level.label)} · ${level.local}` : t('Drawn area')}
          </span>
          <h2 className="mt-2 text-[20px] leading-tight font-semibold text-fg tracking-[-0.01em] break-words">
            {t(displayName(selection))}
          </h2>
          {parents && <p className="mt-0.5 text-[12px] text-fg-secondary">{parents}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 export-ignore">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={iconButton}
            title={t('Export card as PNG')}
            aria-label={t('Export card as PNG')}
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className={iconButton} title="Close (Esc)" aria-label={t('Close inspector')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {code && level && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-elevated/60 border border-line pl-3 pr-1.5 py-1.5">
          <span className="text-[12px] text-fg-secondary">
            {t(level.label)} code <span className="ml-1.5 font-mono tabular text-[13px] text-fg">{code}</span>
          </span>
          <button
            onClick={() => handleCopy(code)}
            className={`${iconButton} export-ignore flex items-center gap-1 text-[12px]`}
            aria-label={`Copy ${level.label.toLowerCase()} code`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? t('Copied') : t('Copy')}
          </button>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Kpi label={t('Area')}>
          {typeof props.area_km2 === 'number' ? (
            <>
              {props.area_km2}
              <span className="text-[12px] text-fg-secondary ml-1">km²</span>
            </>
          ) : (
            '—'
          )}
        </Kpi>
        {level ? (
          <Kpi label={t('Tier')}>
            {levelIdx + 1}
            <span className="text-[12px] text-fg-secondary ml-1">{t('of 5')}</span>
          </Kpi>
        ) : selection.kind === 'area' ? <Kpi label={t('Selection created')}>{selection.createdAt}</Kpi> : null}
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
          <div
            className="relative h-2 rounded-full bg-surface-subtle overflow-hidden"
            role="meter"
            aria-valuenow={connection}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Grid connection rate"
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${connection}%`,
                background:
                  connection >= 80
                    ? 'var(--status-success)'
                    : connection >= 70
                      ? 'var(--status-warning)'
                      : 'var(--status-danger)'
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
      ) : null}

      <p className="mt-3 text-[11px] text-fg-secondary">
        {t(selection.kind === 'area' ? 'User-drawn approximation · not a cadastral boundary.' : 'Source date unknown · reference boundaries, not cadastral data.')}
        {selection.kind === 'area' && <span className="block mt-1">{t('Copying this link shares the drawn geometry.')}</span>}
      </p>
      <div className="mt-4 border-t border-line pt-3 export-ignore">
        <label className="flex items-center gap-2 min-h-10 text-[13px] font-semibold">
          <input type="checkbox" checked={analysisEnabled} disabled={!canAnalyze} onChange={(event) => onToggleAnalysis(event.target.checked)} />
          {t('Count mapped buildings')}
        </label>
        {!canAnalyze && <p className="text-[12px] text-warning">{t('Select a village or draw an area up to 50 km² to count buildings.')}</p>}
        {canAnalyze && !analysisEnabled && <p className="text-[12px] text-fg-secondary">{t('Enable counting, then choose one date or compare two dates below the map.')}</p>}
      </div>
      {analysisControls}
      <AnalysisResults result={analysis} pending={analysisPending} error={analysisError} />
      <EsriMetadataDetails metadata={esriMetadata} />
      {children}
      <div className="flex gap-2 mt-3 export-ignore">
        <button
          className="border border-line rounded px-3 py-2 text-[12px]"
          onClick={() =>
            downloadFile(
              selectionCsv({ selection, snapshots, language, analysis, esriMetadata }),
              'text/csv;charset=utf-8',
              'rwanda-selection.csv'
            )
          }
        >
          CSV
        </button>
        <button
          className="border border-line rounded px-3 py-2 text-[12px]"
          onClick={() =>
            downloadFile(
              JSON.stringify(selectionGeoJson({ selection, snapshots, language, analysis, esriMetadata })),
              'application/geo+json',
              'rwanda-selection.geojson'
            )
          }
        >
          GeoJSON
        </button>
      </div>
      <div className="mt-4 pt-4 border-t border-line">
        <span className="eyebrow !text-[10px]">{t('Selected point')}</span>
        <p className="mt-1 text-[12px] font-mono tabular text-fg-secondary">
          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </p>
      </div>

      {!analysis && !analysisPending && (
        <div className="mt-4 rounded-lg border border-dashed border-line p-3 flex items-center gap-2.5 text-[12px] text-fg-muted export-ignore">
          <Sparkles className="w-4 h-4 shrink-0" />
          {t('Use the count switch above and the date controls below the map.')}
        </div>
      )}
    </div>
  );
}
