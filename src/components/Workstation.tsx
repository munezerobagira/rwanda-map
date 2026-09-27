'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, X, PanelLeftOpen, Layers } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import SearchBar, { LocationSearchResult } from '@/components/SearchBar';
import { LocationBar } from '@/components/OverlayCards';
import InspectorPanel from '@/components/InspectorPanel';
import TimelineScrubber from '@/components/TimelineScrubber';
// Static import: this whole module is already client-only (see page.tsx), and
// a nested dynamic import only added another round trip before the map loads
import InteractiveMap, { ViewportInsets } from '@/components/InteractiveMap';
import { BASEMAPS, isBasemapAvailable } from '@/lib/basemaps';
import { AdminLevelKey, levelById, levelForZoom, levelOfProperties } from '@/lib/adminLevels';
import { Selection, displayName, hierarchyOf } from '@/lib/selection';
import { readUrlState, writeUrlState } from '@/lib/urlState';

const DOCK_WIDTH = 340;
const INSPECTOR_WIDTH = 360;
const RWANDA_BOUNDS: [number, number, number, number] = [28.86, -2.84, 30.9, -1.05];

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia('(min-width: 768px)');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia('(min-width: 768px)').matches,
    () => true
  );
}

interface Viewport {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  zoom: number;
  centerLat: number;
  centerLng: number;
}

// Fetches the entity at a point: at the given tier, or (without one) the finest
// tier containing it. No React state here, so callers decide what to apply.
async function resolveSelection(
  lat: number,
  lng: number,
  levelKey?: AdminLevelKey
): Promise<{ selection: Selection; bbox?: [number, number, number, number] }> {
  const outside: Selection = { kind: 'outside', point: { lat, lng } };
  let level = levelKey ? levelById(levelKey) : undefined;
  if (!level) {
    const data = await fetch(`/api/search-coordinate?lat=${lat}&lng=${lng}`).then((r) => r.json());
    if (!data.found || !data.data) return { selection: outside };
    level = levelOfProperties(data.data);
  }

  const data = await fetch(`/api/feature?layer=${level.id}&lat=${lat}&lng=${lng}`).then((r) => r.json());
  if (!data.found) return { selection: outside };
  return {
    selection: {
      kind: 'feature',
      level,
      props: data.feature.properties,
      point: { lat, lng },
      geometry: data.feature.geometry
    },
    bbox: data.feature.bbox
  };
}

type FlyTarget = { lat: number; lng: number; zoom?: number; bounds?: [number, number, number, number]; nonce: number };

export default function Workstation() {
  // Rendered client-only (see page.tsx), so the URL can seed initial state directly
  const [initialUrl] = useState(readUrlState);
  const isDesktop = useIsDesktop();

  const [isDockOpen, setIsDockOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);

  // Boundary tiles are fetched and drawn by the map itself; it reports back
  // loading state and what's in view for the telemetry pill
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [telemetry, setTelemetry] = useState<{ count: number; ms: number | null } | null>(null);

  // Selection
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isResolving, setIsResolving] = useState(() => Boolean(initialUrl.selection));
  const selectRequestRef = useRef(0);

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [flyToTarget, setFlyToTarget] = useState<FlyTarget | null>(null);
  const [zoomOverride, setZoomOverride] = useState<{ zoom: number; nonce: number } | null>(null);

  // Basemap & imagery year
  const [activeBasemap, setActiveBasemap] = useState<string>(() => {
    const fromUrl = BASEMAPS.find((b) => b.id === initialUrl.basemap);
    return fromUrl && isBasemapAvailable(fromUrl) ? fromUrl.id : 'esri';
  });
  const [sentinelYear, setSentinelYear] = useState<string>(initialUrl.year ?? '2023');
  const [availableYears, setAvailableYears] = useState<string[]>(['2018', '2019', '2020', '2021', '2022', '2023']);
  const activeBasemapDef = BASEMAPS.find((bm) => bm.id === activeBasemap);
  const showTimeline = Boolean(activeBasemapDef?.supportsYear && availableYears.length > 0);

  const currentZoom = viewport?.zoom ?? initialUrl.center?.zoom ?? 9.3;
  const activeLevel = levelForZoom(currentZoom);

  useEffect(() => {
    fetch('/api/satellite-capabilities')
      .then((res) => res.json())
      .then((data) => {
        if (!data.years?.length) return;
        setAvailableYears(data.years);
        // Keep a year from a shared link if it exists; otherwise show the newest
        setSentinelYear(
          initialUrl.year && data.years.includes(initialUrl.year) ? initialUrl.year : data.years[data.years.length - 1]
        );
      })
      .catch((err) => console.error('Failed to load satellite capabilities', err));
  }, [initialUrl.year]);

  useEffect(() => {
    if (!locationError) return;
    const timer = setTimeout(() => setLocationError(null), 5000);
    return () => clearTimeout(timer);
  }, [locationError]);

  // -------------------------------------------------------------
  // Selection resolution
  // -------------------------------------------------------------
  // Resolves the entity at a point - at a given tier, or the finest tier that
  // contains it - with its full geometry for the focus mask.
  const selectAt = useCallback(async (lat: number, lng: number, levelKey?: AdminLevelKey, fly = false) => {
    // Later calls win over slower earlier ones
    const requestId = ++selectRequestRef.current;
    setIsResolving(true);
    try {
      const resolved = await resolveSelection(lat, lng, levelKey);
      if (requestId !== selectRequestRef.current) return;
      setSelection(resolved.selection);
      if (fly && resolved.bbox) setFlyToTarget({ lat, lng, bounds: resolved.bbox, nonce: Date.now() });
    } catch (err) {
      console.error('Failed to resolve selection', err);
    } finally {
      if (requestId === selectRequestRef.current) setIsResolving(false);
    }
  }, []);

  // Restore a selection from a shared link. Only fly to it when the link
  // didn't also pin a map position.
  useEffect(() => {
    const sel = initialUrl.selection;
    if (!sel) return;
    const requestId = ++selectRequestRef.current;
    resolveSelection(sel.lat, sel.lng, sel.level)
      .then((resolved) => {
        if (requestId !== selectRequestRef.current) return;
        setSelection(resolved.selection);
        if (!initialUrl.center && resolved.bbox) {
          setFlyToTarget({ lat: sel.lat, lng: sel.lng, bounds: resolved.bbox, nonce: Date.now() });
        }
      })
      .catch((err) => console.error('Failed to restore selection from URL', err))
      .finally(() => {
        if (requestId === selectRequestRef.current) setIsResolving(false);
      });
  }, [initialUrl]);

  // A click selects the feature of whichever tier is active at that zoom
  const handleMapClick = useCallback(
    (lat: number, lng: number, zoom: number) => {
      selectAt(lat, lng, levelForZoom(zoom).key);
    },
    [selectAt]
  );

  const handleSelectSearchResult = (result: LocationSearchResult) => {
    setLocationError(null);
    setFlyToTarget({ lat: result.lat, lng: result.lng, bounds: result.bounds, nonce: Date.now() });
    selectAt(result.lat, result.lng, result.level as AdminLevelKey);
  };

  const handleSelectCoordinate = (lat: number, lng: number) => {
    setFlyToTarget({ lat, lng, zoom: 15, nonce: Date.now() });
    selectAt(lat, lng);
  };

  const handleNavigate = (level: AdminLevelKey | 'country') => {
    if (level === 'country') {
      selectRequestRef.current++;
      setSelection(null);
      const [minLng, minLat, maxLng, maxLat] = RWANDA_BOUNDS;
      setFlyToTarget({ lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2, bounds: RWANDA_BOUNDS, nonce: Date.now() });
      return;
    }
    if (selection?.kind === 'feature') {
      selectAt(selection.point.lat, selection.point.lng, level, true);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }
    setIsDetectingLocation(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFlyToTarget({ lat: latitude, lng: longitude, zoom: 15, nonce: Date.now() });
        selectAt(latitude, longitude).finally(() => setIsDetectingLocation(false));
      },
      (err) => {
        console.error('Failed to detect location', err);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable it in your browser settings to use this.'
            : 'Could not detect your location. Please try again.'
        );
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearSelection = useCallback(() => {
    selectRequestRef.current++;
    setIsResolving(false);
    setSelection(null);
  }, []);

  // Escape clears the selection (search handles its own Escape first)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== 'Escape' || target?.tagName === 'INPUT') return;
      clearSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection]);

  // -------------------------------------------------------------
  // Keep the address bar in sync so any view can be shared/bookmarked
  // -------------------------------------------------------------
  useEffect(() => {
    writeUrlState({
      center: viewport ? { lat: viewport.centerLat, lng: viewport.centerLng, zoom: viewport.zoom } : initialUrl.center,
      basemap: activeBasemap,
      year: activeBasemapDef?.supportsYear ? sentinelYear : undefined,
      selection:
        selection?.kind === 'feature'
          ? { lat: selection.point.lat, lng: selection.point.lng, level: selection.level.key }
          : undefined
    });
  }, [viewport, activeBasemap, activeBasemapDef, sentinelYear, selection, initialUrl.center]);

  // Screen reader announcement of the current selection
  const announcement = useMemo(() => {
    if (!selection) return '';
    if (selection.kind === 'outside') return 'Selected point is outside mapped boundaries.';
    const parents = Object.values(hierarchyOf(selection.props, selection.level)).slice(0, -1).reverse().join(', ');
    const area = typeof selection.props.area_km2 === 'number' ? ` Area ${selection.props.area_km2} square kilometres.` : '';
    return `${displayName(selection)} ${selection.level.label} selected${parents ? `, in ${parents}` : ''}.${area}`;
  }, [selection]);

  const bottomBarHeight = 60;
  const timelineHeight = showTimeline ? 76 : 0;
  const insets: ViewportInsets = {
    top: 64,
    left: isDesktop && isDockOpen ? DOCK_WIDTH + 16 : 0,
    // Reserved while a selection is still resolving too, so a fly-to that
    // starts before the inspector opens already leaves room for it
    right: isDesktop && (selection || isResolving) ? INSPECTOR_WIDTH + 16 : 0,
    bottom: bottomBarHeight + timelineHeight
  };

  const toggleDock = () => setIsDockOpen((o) => !o);
  const focusGeometry = selection?.kind === 'feature' ? selection.geometry : null;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface-base text-fg">
      {/* Full-bleed map canvas - every panel floats over it */}
      <div className="absolute inset-0">
        <InteractiveMap
          initialView={initialUrl.center}
          onMapClick={handleMapClick}
          onBoundaryLoading={setIsLoadingBoundaries}
          onBoundaryStats={setTelemetry}
          onViewportChange={setViewport}
          activeBasemap={activeBasemap}
          sentinelYear={sentinelYear}
          flyTo={flyToTarget}
          zoomOverride={zoomOverride}
          focusGeometry={focusGeometry}
          insets={insets}
        />
      </div>

      {/* Indeterminate progress along the top edge while data is in flight */}
      <div className="absolute top-0 inset-x-0 h-0.5 z-[1300] overflow-hidden pointer-events-none" aria-hidden="true">
        {(isLoadingBoundaries || isResolving) && <div className="progress-sliver" />}
      </div>

      {/* Top bar */}
      <header className="glass-panel absolute z-[1200] top-4 inset-x-4 h-12 flex items-center gap-3 px-2 sm:px-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={toggleDock}
            aria-label={isDockOpen ? 'Collapse layers panel' : 'Open layers panel'}
            aria-expanded={isDockOpen}
            title="Layers & tools"
            className="p-1.5 text-fg-secondary hover:text-fg hover:bg-surface-subtle/60 rounded-md transition-colors"
          >
            <PanelLeftOpen className={`w-4 h-4 transition-transform ${isDockOpen ? 'rotate-180' : ''}`} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, nothing to optimize */}
          <img src="/brand/logo-mark.svg" alt="" width={28} height={28} className="w-7 h-7 shrink-0" />
          <div className="hidden lg:block leading-tight">
            <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Rwanda Map</h1>
            <p className="text-[11px] text-fg-secondary">GIS Workstation</p>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex justify-center">
          <SearchBar onSelectResult={handleSelectSearchResult} onSelectCoordinate={handleSelectCoordinate} />
        </div>

        {/* Live telemetry: what's actually rendered, not a decorative clock */}
        <div
          className="hidden sm:flex items-center gap-2 shrink-0 h-8 px-3 rounded-lg bg-surface-elevated/60 border border-line text-[12px]"
          title="Active layer · features in view · zoom · tile fetch time"
        >
          <Layers className="w-3.5 h-3.5 shrink-0" style={{ color: activeLevel.stroke.color }} />
          <span className="font-medium text-fg">{activeLevel.label}s</span>
          {telemetry && (
            <span className="hidden md:inline font-mono tabular text-fg-secondary">{telemetry.count.toLocaleString()} in view</span>
          )}
          <span className="hidden xl:inline font-mono tabular text-fg-muted">z{currentZoom.toFixed(1)}</span>
          {telemetry?.ms != null && (
            <span className="hidden xl:inline font-mono tabular text-fg-muted" title="Mean tile fetch time">
              {Math.round(telemetry.ms)} ms
            </span>
          )}
        </div>
      </header>

      <Sidebar
        activeBasemap={activeBasemap}
        setActiveBasemap={setActiveBasemap}
        sentinelYear={sentinelYear}
        activeLayerId={activeLevel.id}
        onSelectLevel={(zoom) => setZoomOverride({ zoom, nonce: Date.now() })}
        isOpen={isDockOpen}
        onClose={() => setIsDockOpen(false)}
      />

      {/* Right inspector - only while something is selected */}
      {selection && (
        <aside
          aria-label="Selection details"
          className="glass-panel absolute z-[1150] right-4 top-[76px] w-[calc(100%-2rem)] max-w-[360px] max-h-[calc(100%-152px)] overflow-y-auto animate-fade-in"
        >
          <InspectorPanel selection={selection} onClose={clearSelection} />
        </aside>
      )}

      {/* Bottom stack: error toast, imagery timeline, breadcrumb bar */}
      <div
        className="absolute z-[1100] bottom-4 flex flex-col items-center gap-2 pointer-events-none transition-[left,right] duration-300"
        style={{ left: 16 + insets.left, right: 16 + insets.right }}
      >
        {locationError && (
          <div role="alert" className="glass-panel flex items-center gap-2 px-4 py-2.5 pointer-events-auto !bg-[#2a1414]/95 !border-danger/30 text-[13px] text-red-200 max-w-md">
            <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
            <span>{locationError}</span>
            <button onClick={() => setLocationError(null)} className="ml-2 text-red-300/70 hover:text-red-200 shrink-0" aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {showTimeline && (
          <div className="w-full max-w-[560px]">
            <TimelineScrubber
              years={availableYears}
              value={sentinelYear}
              onChange={setSentinelYear}
              label={activeBasemapDef?.name ?? 'Imagery'}
            />
          </div>
        )}
        <LocationBar
          hierarchy={selection?.kind === 'feature' ? hierarchyOf(selection.props, selection.level) : null}
          point={selection?.point ?? null}
          isOutside={selection?.kind === 'outside'}
          isDetectingLocation={isDetectingLocation}
          onDetectLocation={handleDetectLocation}
          onNavigate={handleNavigate}
          currentZoom={currentZoom}
        />
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
