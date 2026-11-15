'use client';

import { useI18n } from '@/lib/i18n';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Download, Crop, Plus, Minus, Maximize, RectangleHorizontal, Pentagon } from 'lucide-react';
import { drawMapCapture, attachExportFooter, canvasPngBlob, captureMatches, type CaptureView } from '@/lib/imageExport';
import { maskLatLngs, type BoundaryGeometry, type DrawnShape } from '@/lib/selection';
import DrawingControls from './DrawingControls';
import { FEATURE_FLAGS } from '@/lib/analysis/registry';
import type { DrawingDraft } from '@/lib/drawnSelection';
import { downloadBlob } from '@/lib/selectionExport';
import RWANDA from '@/lib/regions/rwanda.json';
import { analysisMapFeatures, buildingInspectionLines } from '@/lib/analysis/presentation';
import type { EsriPointMetadata } from '@/lib/imagery/esriMetadata';
import { esriMetadataLines } from '@/lib/imagery/esriPresentation';
import { coverageGrid } from '@/lib/imagery/esriCoverage';
import type { AnalysisResult } from '@/lib/analysis/types';
import { imageryTileUrl } from '@/lib/imagery/periods';
import type { ImagerySnapshot } from '@/lib/imagery/useSnapshot';
import type { Period } from '@/lib/imagery/catalog';
import { BASEMAPS, basemapMaxZoom, MAX_DISPLAY_ZOOM, isBasemapAvailable, basemapReferenceNote } from '@/lib/basemaps';
import { CASING, COUNTRY_TIER, HIGHLIGHT_COLOR, levelForZoom, parentLevel } from '@/lib/adminLevels';
import { BoundaryTiles } from '@/lib/boundaryTiles';

// Screen-space padding the floating panels occupy, so fitting a boundary
// centers it in the part of the map that's actually visible instead of
// tucking half of it under the dock or inspector.
export interface ViewportInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface InteractiveMapProps {
  drawing: DrawingDraft | null;
  onStartDrawing: (shape: DrawnShape) => void;
  onCancelDrawing: () => void;
  onUndoDrawing: () => void;
  onFinishDrawing: () => void;
  selectionNote?: string;
  initialView?: { lat: number; lng: number; zoom: number };
  /** Map clicked - `zoom` tells the caller which tier was active. */
  onMapClick: (lat: number, lng: number, zoom: number) => void;
  /** Boundary tiles started/finished loading. */
  onBoundaryLoading: (loading: boolean) => void;
  /** Active tier's features in view and mean tile fetch time, after each load. */
  onBoundaryStats: (stats: { count: number; ms: number | null }) => void;
  onViewportChange: (viewport: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    zoom: number;
    centerLat: number;
    centerLng: number;
  }) => void;
  activeBasemap: string;
  sentinelYear: string;
  snapshots: (ImagerySnapshot | null)[];
  esriMetadata: EsriPointMetadata | null;
  analysis: AnalysisResult | null;
  period: Period;
  comparison: Period;
  compare: boolean;
  swipe: number;
  // `nonce` must change on every request so re-selecting the same spot still
  // triggers the effect below. `bounds` (a matched feature's real extent)
  // takes priority over `zoom` when both are present.
  flyTo?: {
    lat: number;
    lng: number;
    zoom?: number;
    bounds?: [number, number, number, number];
    nonce: number;
  } | null;
  zoomOverride?: { zoom: number; nonce: number } | null;
  /** Geometry of the selected entity - everything outside it is dimmed. */
  focusGeometry?: BoundaryGeometry | null;
  insets: ViewportInsets;
}

const RWANDA_CENTER: L.LatLngTuple = [RWANDA.initialView.lat, RWANDA.initialView.lng];
const RWANDA_ZOOM = RWANDA.initialView.zoom;

export default function InteractiveMap({
  drawing,
  onStartDrawing,
  onCancelDrawing,
  onUndoDrawing,
  onFinishDrawing,
  selectionNote,
  initialView,
  onMapClick,
  onBoundaryLoading,
  onBoundaryStats,
  onViewportChange,
  activeBasemap,
  sentinelYear,
  period,
  comparison,
  compare,
  swipe,
  snapshots,
  esriMetadata,
  analysis,
  flyTo,
  zoomOverride,
  focusGeometry,
  insets
}: InteractiveMapProps) {
  const { t, language } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Latest callbacks/insets, read from long-lived Leaflet handlers registered
  // once at mount - without this they'd call the first render's closures.
  const drawingRef = useRef(drawing);
  const onMapClickRef = useRef(onMapClick);
  const onBoundaryLoadingRef = useRef(onBoundaryLoading);
  const onBoundaryStatsRef = useRef(onBoundaryStats);
  const onViewportChangeRef = useRef(onViewportChange);
  const insetsRef = useRef(insets);
  useEffect(() => {
    drawingRef.current = drawing;
    onMapClickRef.current = onMapClick;
    onBoundaryLoadingRef.current = onBoundaryLoading;
    onBoundaryStatsRef.current = onBoundaryStats;
    onViewportChangeRef.current = onViewportChange;
    insetsRef.current = insets;
  });

  const tileLayersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const esriCoveragePendingRef = useRef<Promise<void> | null>(null);
  const comparisonLayerRef = useRef<L.TileLayer | null>(null);
  const [imageryError, setImageryError] = useState(false);
  const [exportError, setExportError] = useState(false);

  // Vector renderers for the hover highlight and focus mask/outline; tier
  // boundaries and the national border are canvas tiles (BoundaryTiles).
  // SVG, not canvas: these are a handful of paths, and an SVG layer is simply
  // moved by the compositor on pan/zoom, whereas a viewport-sized canvas
  // (2880x1800 with padding) must be repainted and re-uploaded on every move.
  const renderersRef = useRef<{ hover: L.SVG; mask: L.SVG; focus: L.SVG } | null>(null);
  const focusLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryTilesRef = useRef<BoundaryTiles | null>(null);

  // Draft paths are noninteractive: map taps still reach the shared selection handler.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !drawing) return;
    const doubleClickZoom = map.doubleClickZoom.enabled();
    map.doubleClickZoom.disable();
    map.getContainer().style.cursor = 'crosshair';
    const group = L.layerGroup().addTo(map);
    const latlngs = drawing.points.map(([lng, lat]): L.LatLngTuple => [lat, lng]);
    const style = { color: '#38BDF8', weight: 2, fillOpacity: 0.12, interactive: false };
    if (drawing.shape === 'rectangle' && latlngs.length === 2) L.rectangle(L.latLngBounds(latlngs), style).addTo(group);
    else if (latlngs.length >= 3) L.polygon(latlngs, style).addTo(group);
    else if (latlngs.length === 2) L.polyline(latlngs, style).addTo(group);
    latlngs.forEach((point) => L.circleMarker(point, { ...style, radius: 4, fillOpacity: 1 }).addTo(group));
    return () => {
      group.remove();
      if (doubleClickZoom) map.doubleClickZoom.enable();
      map.getContainer().style.cursor = '';
    };
  }, [drawing, isMapReady]);

  const captureRevisionRef = useRef(0);
  useEffect(() => {
    captureRevisionRef.current++;
  }, [
    activeBasemap,
    period,
    comparison,
    compare,
    swipe,
    focusGeometry,
    snapshots,
    esriMetadata,
    analysis,
    language,
    imageryError,
    flyTo,
    zoomOverride,
    drawing,
    selectionNote
  ]);
  const analysisPoints = useMemo(() => analysisMapFeatures(analysis), [analysis]);
  const [isExporting, setIsExporting] = useState(false);

  const fitPadding = () => {
    const i = insetsRef.current;
    return {
      paddingTopLeft: L.point(i.left + 24, i.top + 24),
      paddingBottomRight: L.point(i.right + 24, i.bottom + 24)
    };
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: initialView ? [initialView.lat, initialView.lng] : RWANDA_CENTER,
      zoom: initialView?.zoom ?? RWANDA_ZOOM,
      minZoom: 8,
      maxZoom: basemapMaxZoom(activeBasemap),
      zoomControl: false,
      zoomSnap: 0.1,
      zoomDelta: 0.5, // Smaller wheel/keyboard zoom steps feel smoother than a full level at a time
      wheelDebounceTime: 100, // Coalesce fast scroll-wheel ticks so intermediate frames don't each trigger a boundary refetch/rebuild
      wheelPxPerZoomLevel: 100,
      inertia: true,
      preferCanvas: true,
      // Tile fade-in gives every tile `will-change: opacity`, promoting each of
      // the ~100 basemap + boundary tiles to its own compositor layer - the
      // single biggest main-thread cost while panning/zooming (layer commit).
      fadeAnimation: false
    });

    mapRef.current = map;
    map.attributionControl.setPrefix(false);

    const makePane = (name: string, zIndex: number, interactive: boolean) => {
      const pane = map.createPane(name);
      pane.style.zIndex = String(zIndex);
      if (!interactive) pane.style.pointerEvents = 'none';
      return name;
    };
    // Tier tiles sit under the hover highlight and the focus mask/outline.
    // Nothing here takes pointer events - hover and click are handled on the
    // map itself against the loaded tile data.
    makePane('boundaries', 400, false);
    makePane('analysis', 470, true);
    renderersRef.current = {
      hover: L.svg({ pane: makePane('hoverHighlight', 420, false), padding: 0.5 }),
      mask: L.svg({ pane: makePane('focusMask', 440, false), padding: 0.5 }),
      focus: L.svg({ pane: makePane('focusOutline', 450, false), padding: 0.5 })
    };

    // Shared tuning applied to every tile layer: avoids fetching/painting new tiles
    // mid zoom-animation (the main source of visible stutter) and keeps a wider
    // buffer of pre-rendered offscreen tiles so panning/zooming doesn't reveal blanks.
    const tileTuning: L.TileLayerOptions = {
      maxZoom: 18,
      updateWhenZooming: false,
      keepBuffer: 1,
      updateWhenIdle: true,
      updateInterval: 150,
      // Every provider in BASEMAPS serves tiles with Access-Control-Allow-Origin: *,
      // so requesting them in CORS mode keeps the tile <img>s readable by <canvas> -
      // required for the PNG export below, which otherwise gets a tainted-canvas
      // SecurityError on save.
      crossOrigin: true
    };

    for (const bm of BASEMAPS) {
      if (!isBasemapAvailable(bm)) continue;
      const layer = L.tileLayer(bm.buildUrl({ year: sentinelYear, date: '', start: period.start, end: period.end }), {
        ...tileTuning,
        maxZoom: bm.id === 'osm' ? MAX_DISPLAY_ZOOM : bm.maxZoom ?? tileTuning.maxZoom,
        // Finer Esri tiles require an explicit positive coverage check.
        maxNativeZoom: bm.id === 'esri' ? 18 : bm.maxNativeZoom,
        ...(bm.supportsPeriod
          ? {
              bounds: [
                [-2.84, 28.86],
                [-1.05, 30.9]
              ] as L.LatLngBoundsExpression
            }
          : {}),
        ...(bm.subdomains ? { subdomains: bm.subdomains } : {}),
        attribution: bm.attribution
      });
      layer.on('tileerror', () => setImageryError(true));
      tileLayersRef.current.set(bm.id, layer);
    }

    if (activeBasemap !== 'osm') tileLayersRef.current.get('osm')?.setZIndex(100).addTo(map);
    tileLayersRef.current.get(activeBasemap)?.setZIndex(200).addTo(map);

    const updateViewport = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();
      onViewportChangeRef.current({
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
        zoom: map.getZoom(),
        centerLat: center.lat,
        centerLng: center.lng
      });
    };

    map.on('moveend', updateViewport);

    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClickRef.current(e.latlng.lat, e.latlng.lng, map.getZoom());
    };
    map.on('click', handleClick);

    // ---- Boundary tiles: the tier for the current zoom plus its parent ----
    const tiles = new BoundaryTiles({ pane: 'boundaries', outline: COUNTRY_TIER });
    boundaryTilesRef.current = tiles;
    let wasLoading = false;
    const reportLoading = () => {
      const loading = tiles.isBusy();
      if (loading !== wasLoading) {
        wasLoading = loading;
        onBoundaryLoadingRef.current(loading);
      }
    };
    const reportStats = () => {
      tiles.visibleFeatureCount().then((count) => onBoundaryStatsRef.current({ count, ms: tiles.averageFetchMs() }));
    };
    tiles.on('loading', reportLoading);
    tiles.on('load redrawprogress', () => {
      reportLoading();
      if (!tiles.isBusy()) reportStats();
    });

    const syncTiers = () => {
      const active = levelForZoom(map.getZoom());
      const parent = parentLevel(active);
      tiles.setTiers(parent ? [parent, active] : [active]);
      reportLoading();
    };
    syncTiers();
    tiles.addTo(map);
    map.on('zoomend', syncTiers);
    map.on('moveend', reportStats);

    // ---- Hover: hit-test loaded tile data once per frame; draw the hovered
    // shape into its own small SVG overlay instead of redrawing tiles ----
    const hoverTooltip = L.tooltip({ direction: 'top', offset: [0, -12], className: 'leaflet-tooltip' });
    let hoverFrame = 0;
    let hoverSeq = 0; // hit-tests are async (worker) - only the latest may apply
    let lastHoverEvent: L.LeafletMouseEvent | null = null;
    let hoveredId: number | null = null;
    let hoverLayer: L.LayerGroup | null = null;
    const clearHover = () => {
      hoverSeq++;
      hoveredId = null;
      hoverLayer?.remove();
      hoverLayer = null;
      map.closeTooltip(hoverTooltip);
      map.getContainer().style.cursor = drawingRef.current ? 'crosshair' : '';
    };
    const updateHover = async () => {
      hoverFrame = 0;
      const e = lastHoverEvent;
      const level = tiles.activeTier;
      if (!e || !level || !renderersRef.current || drawingRef.current) return;
      const seq = ++hoverSeq;
      const feature = await tiles.featureAt(e.latlng);
      if (seq !== hoverSeq || drawingRef.current) return;
      if (!feature) {
        if (hoveredId !== null) clearHover();
        return;
      }
      if (feature.id !== hoveredId) {
        hoveredId = feature.id;
        hoverLayer?.remove();
        hoverLayer = null;
        hoverTooltip.setContent(
          `<div class="font-sans text-left"><div class="text-[12px] font-semibold text-fg">${feature.n ?? ''}</div><div class="text-[11px] text-fg-secondary">${level.label} · ${feature.p ?? 'Rwanda'}</div></div>`
        );
        map.getContainer().style.cursor = 'pointer';
        const shape = await tiles.shapeOf(feature.id);
        if (drawingRef.current || (seq !== hoverSeq && hoveredId !== feature.id)) return;
        const renderer = renderersRef.current?.hover;
        if (shape && renderer && hoveredId === feature.id && !hoverLayer) {
          hoverLayer = L.layerGroup([
            L.polygon(shape.fill, {
              renderer,
              stroke: false,
              fillColor: HIGHLIGHT_COLOR,
              fillOpacity: level.highlightFill,
              interactive: false
            }),
            L.polyline(shape.outline, {
              renderer,
              color: HIGHLIGHT_COLOR,
              weight: 2,
              opacity: 1,
              lineJoin: 'round',
              interactive: false
            })
          ]).addTo(map);
        }
      }
      hoverTooltip.setLatLng(e.latlng);
      if (!map.hasLayer(hoverTooltip)) hoverTooltip.openOn(map);
    };
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (drawingRef.current) { clearHover(); return; }
      lastHoverEvent = e;
      if (!hoverFrame) hoverFrame = requestAnimationFrame(updateHover);
    };
    const handleMouseOut = () => {
      lastHoverEvent = null;
      clearHover();
    };
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);
    map.on('zoomstart', clearHover);

    // Guarded by `cancelled` because React Strict Mode double-invokes this
    // effect in dev, and the timer could otherwise fire after map.remove().
    let cancelled = false;
    const initialFetchTimer = setTimeout(() => {
      if (cancelled) return;
      updateViewport();
      setIsMapReady(true);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(initialFetchTimer);
      cancelAnimationFrame(hoverFrame);
      map.off('moveend', updateViewport);
      map.off('click', handleClick);
      map.off('zoomend', syncTiers);
      map.off('moveend', reportStats);
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      map.off('zoomstart', clearHover);
      if (wasLoading) onBoundaryLoadingRef.current(false);
      map.remove();
      tiles.dispose();
      mapRef.current = null;
      renderersRef.current = null;
    };
    // Mount-only: later basemap/year/view changes are applied by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------
  // DYNAMIC BASEMAP CONTROLLER
  // -------------------------------------------------------------
  const versionA = snapshots[0]?.version;
  const versionB = snapshots[1]?.version;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;
    comparisonLayerRef.current?.remove();
    comparisonLayerRef.current = null;
    for (const layer of tileLayersRef.current.values()) if (map.hasLayer(layer)) map.removeLayer(layer);
    const source = BASEMAPS.find((b) => b.id === activeBasemap);
    if (!source) return;
    map.setMaxZoom(basemapMaxZoom(activeBasemap));
    const reference = tileLayersRef.current.get('osm');
    if (activeBasemap !== 'osm') reference?.setZIndex(100).addTo(map);
    const layer = tileLayersRef.current.get(activeBasemap);
    layer?.setUrl(
      source.buildUrl({ year: sentinelYear, date: '', start: period.start, end: period.end, version: versionA })
    );
    layer?.setZIndex(200).addTo(map);
    const reset = () => setImageryError(false);
    layer?.on('loading', reset);
    if (compare && source.supportsPeriod) {
      const second = L.tileLayer(imageryTileUrl(comparison, versionB), {
        crossOrigin: true,
        maxZoom: 18,
        maxNativeZoom: 14,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 1,
        zIndex: 220,
        bounds: [
          [-2.84, 28.86],
          [-1.05, 30.9]
        ],
        attribution: source.attribution
      });
      second.on('tileerror', () => setImageryError(true));
      second.addTo(map);
      const container = second.getContainer();
      if (container) container.dataset.periodSide = 'b';
      comparisonLayerRef.current = second;
    }
    return () => {
      layer?.off('loading', reset);
      comparisonLayerRef.current?.remove();
      comparisonLayerRef.current = null;
    };
  }, [activeBasemap, sentinelYear, period, comparison, compare, isMapReady, versionA, versionB]);

  useEffect(() => {
    const map = mapRef.current;
    const second = comparisonLayerRef.current;
    if (!map || !second || !compare) return;
    const clip = () => {
      const container = second.getContainer();
      if (!container) return;
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      const size = map.getSize();
      const x = topLeft.x + (size.x * swipe) / 100;
      container.style.clipPath = `polygon(${x}px ${topLeft.y}px, ${topLeft.x + size.x}px ${topLeft.y}px, ${topLeft.x + size.x}px ${topLeft.y + size.y}px, ${x}px ${topLeft.y + size.y}px)`;
    };
    clip();
    map.on('move zoom resize', clip);
    return () => {
      map.off('move zoom resize', clip);
    };
  }, [compare, swipe, period, comparison, activeBasemap, isMapReady, versionA, versionB]);

  // -------------------------------------------------------------
  // FOCUS MODE - dim everything outside the selection, glow its outline
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const renderers = renderersRef.current;
    if (!map || !renderers || !isMapReady) return;

    focusLayerRef.current?.remove();
    focusLayerRef.current = null;
    if (!focusGeometry) return;

    const group = L.layerGroup();
    L.polygon(maskLatLngs(focusGeometry), {
      renderer: renderers.mask,
      interactive: false,
      stroke: false,
      fillColor: '#090D16',
      fillOpacity: 0.55,
      fillRule: 'evenodd'
    }).addTo(group);
    L.geoJSON(focusGeometry, {
      style: { color: CASING.color, weight: 6, opacity: 0.6, fill: false },
      interactive: false,
      renderer: renderers.focus
    } as L.GeoJSONOptions).addTo(group);
    L.geoJSON(focusGeometry, {
      style: { color: HIGHLIGHT_COLOR, weight: 2.5, opacity: 1, fill: false, lineJoin: 'round' },
      interactive: false,
      renderer: renderers.focus
    } as L.GeoJSONOptions).addTo(group);

    group.addTo(map);
    focusLayerRef.current = group;
  }, [focusGeometry, isMapReady]);

  // -------------------------------------------------------------
  // Mapped-building overlays use the same source points and styles as exports.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !analysisPoints.length) return;
    const renderer = L.canvas({ pane: 'analysis', padding: 0.2 });
    const group = L.layerGroup();
    for (const { feature, color } of analysisPoints) {
      const content = document.createElement('div');
      content.className = 'whitespace-pre-line text-[12px]';
      content.textContent = buildingInspectionLines(feature.properties, t, feature.geometry.type !== 'Point').join('\n');
      const style = {
        renderer,
        radius: 3,
        color,
        fillColor: color,
        weight: 0.5,
        fillOpacity: 0.8,
        interactive: true,
        bubblingMouseEvents: false
      };
      const layer = feature.geometry.type === 'Point'
        ? L.circleMarker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], style)
        : L.geoJSON(feature, { style: { ...style, weight: 1.2, fillOpacity: 0.12 }, bubblingMouseEvents: false });
      layer.bindPopup(content, { maxWidth: 320, autoPanPaddingTopLeft: L.point(insetsRef.current.left + 24, insetsRef.current.top + 24), autoPanPaddingBottomRight: L.point(insetsRef.current.right + 24, insetsRef.current.bottom + 24) }).addTo(group);
    }
    group.addTo(map);
    return () => {
      group.remove();
      renderer.remove();
    };
  // Recreate translated popup text without changing the selected geometry.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- t changes identity each render; locale is the dependency.
  }, [analysisPoints, isMapReady, language]);

  // A successful JPEG can be Esri's gray "no data" placeholder. Fetch level19
  // only after every visible/buffer tile is confirmed by the provider tilemap.
  useEffect(() => {
    const map = mapRef.current, layer = tileLayersRef.current.get('esri');
    if (!map || !layer || !isMapReady || activeBasemap !== 'esri') return;
    let controller: AbortController | null = null;
    const setLevel = (level: number) => {
      if (layer.options.maxNativeZoom === level) return;
      layer.options.maxNativeZoom = level;
      if (map.hasLayer(layer)) layer.redraw();
    };
    const reset = () => {
      controller?.abort();
      esriCoveragePendingRef.current = null;
      setLevel(18);
    };
    const check = () => {
      reset();
      if (map.getZoom() < 18) return;
      const bounds = map.getBounds();
      const grid = coverageGrid([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]);
      if (!grid) return;
      const current = new AbortController(); controller = current;
      const deadline = setTimeout(() => current.abort(), 8000);
      const query = new URLSearchParams(Object.entries(grid).map(([key, value]) => [key, String(value)]));
      esriCoveragePendingRef.current = fetch(`/api/imagery/esri-coverage?${query}`, {
        signal: current.signal
      }).then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (!current.signal.aborted && map.hasLayer(layer) && data.available === true && data.level === 19 &&
          Object.entries(grid).every(([key, value]) => data[key] === value)) setLevel(19);
      }).catch(() => { /* Retain the existing imagery detail on any failed check. */ })
        .finally(() => clearTimeout(deadline));
    };
    map.on('movestart', reset);
    map.on('moveend', check);
    check();
    return () => { map.off('movestart', reset); map.off('moveend', check); reset(); };
  }, [activeBasemap, isMapReady]);

  // -------------------------------------------------------------
  // FLY TO A SEARCHED / DETECTED / BREADCRUMB LOCATION
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !flyTo) return;

    if (flyTo.bounds) {
      const [minLng, minLat, maxLng, maxLat] = flyTo.bounds;
      map.flyToBounds(
        [
          [minLat, minLng],
          [maxLat, maxLng]
        ],
        { ...fitPadding(), maxZoom: 16, duration: 1.2 }
      );
    } else {
      map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom ?? 14, { duration: 1.2 });
    }
  }, [flyTo, isMapReady]);

  // -------------------------------------------------------------
  // MANUAL ADMINISTRATIVE-LEVEL PICKER (zoom only, keep current center)
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady || !zoomOverride) return;
    map.setZoom(zoomOverride.zoom, { animate: true });
  }, [zoomOverride, isMapReady]);

  // -------------------------------------------------------------
  // EXPORT MAP TO PNG
  // -------------------------------------------------------------
  // Right-click -> "Save image as" only ever grabs ONE dom element under the
  // cursor - a single tile <img> or one transparent boundary layer - never
  // both. This flattens every visible tile plus every vector layer (in pane
  // stacking order) into one offscreen canvas and downloads it as a PNG.
  //
  // mode: 'view' exports the full current viewport as seen (focus mask included).
  // mode: 'selected' crops and clips to the selected entity's geometry so only
  // that shape - outline plus the imagery inside it - is visible. It first
  // flies in to the tightest zoom that fits the shape (capped at the basemap's
  // maxZoom) so the export isn't built from blurry zoomed-out tiles, waits for
  // those tiles, captures, then flies back.
  // Resolves once the map has settled after a move and both the basemap and
  // the boundary tiles (drawn asynchronously by the worker) are in, with a
  // bounded wait in case a service never finishes
  const waitForMapIdle = (map: L.Map, tileLayer?: L.TileLayer): Promise<void> =>
    new Promise((resolve, reject) => {
      let settled = false;
      let pollTimer: ReturnType<typeof setTimeout>;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(pollTimer);
        clearTimeout(deadline);
        map.off('moveend', afterMove);
        if (error) reject(error);
        else resolve();
      };
      const poll = () => {
        if (settled) return;
        const busy =
          tileLayer?.isLoading() ||
          tileLayersRef.current.get('osm')?.isLoading() ||
          comparisonLayerRef.current?.isLoading() ||
          boundaryTilesRef.current?.isBusy();
        if (busy) pollTimer = setTimeout(poll, 50);
        else finish();
      };
      const afterMove = () => {
        clearTimeout(pollTimer);
        pollTimer = setTimeout(poll, 50);
      };
      const deadline = setTimeout(() => finish(new Error('Map tiles did not finish loading.')), 20000);
      map.once('moveend', afterMove);
      pollTimer = setTimeout(poll, 50);
    });

  const exportMapImage = async (mode: 'view' | 'selected') => {
    const map = mapRef.current,
      container = mapContainerRef.current;
    if (!map || !container || isExporting) return;
    const geometry = mode === 'selected' ? focusGeometry : null;
    if (mode === 'selected' && !geometry) return;
    const bounds = geometry ? L.geoJSON(geometry).getBounds() : null;
    const expectedRevision = captureRevisionRef.current;
    let restoreView: (() => void) | null = null,
      capturedView: CaptureView | null = null,
      userInteracted = false;
    const markInteraction = () => {
      userInteracted = true;
    };
    const interactionSurface = container.parentElement ?? container;
    interactionSurface.addEventListener('pointerdown', markInteraction, { passive: true });
    interactionSurface.addEventListener('wheel', markInteraction, { passive: true });
    interactionSurface.addEventListener('keydown', markInteraction);
    const currentView = (): CaptureView => ({
      revision: captureRevisionRef.current,
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom(),
      width: container.getBoundingClientRect().width,
      height: container.getBoundingClientRect().height
    });
    const assertCurrent = () => {
      if (
        userInteracted ||
        captureRevisionRef.current !== expectedRevision ||
        (capturedView && !captureMatches(capturedView, currentView()))
      ) {
        restoreView = null;
        throw new Error('The map or source changed during export. Retry the capture.');
      }
    };
    setExportError(false);
    setIsExporting(true);
    try {
      if (bounds) {
        const tile = tileLayersRef.current.get(activeBasemap),
          maxZoom = Math.min(map.getMaxZoom(), tile?.options.maxZoom ?? RWANDA.mapZoom.max);
        const idealZoom = Math.min(map.getBoundsZoom(bounds), maxZoom);
        if (!(map.getZoom() >= idealZoom && map.getBounds().contains(bounds))) {
          const center = map.getCenter(),
            zoom = map.getZoom();
          restoreView = () => map.setView(center, zoom, { animate: false });
          const idle = waitForMapIdle(map, tile);
          map.fitBounds(bounds, { maxZoom, animate: false, padding: [60, 60] });
          await idle;
        }
      }
      if (activeBasemap === 'esri') await esriCoveragePendingRef.current;
      await waitForMapIdle(map, tileLayersRef.current.get(activeBasemap));
      assertCurrent();
      capturedView = currentView();
      const containerRect = container.getBoundingClientRect();
      let offsetX = 0,
        offsetY = 0,
        outW = containerRect.width,
        outH = containerRect.height;
      if (bounds) {
        const nw = map.latLngToContainerPoint(bounds.getNorthWest()),
          se = map.latLngToContainerPoint(bounds.getSouthEast()),
          pad = 24;
        offsetX = Math.max(0, nw.x - pad);
        offsetY = Math.max(0, nw.y - pad);
        outW = Math.min(containerRect.width, se.x + pad) - offsetX;
        outH = Math.min(containerRect.height, se.y + pad) - offsetY;
      }
      if (outW <= 0 || outH <= 0) throw new Error('Selected area does not fit in the export.');
      const scale = Math.min(window.devicePixelRatio || 1, 2),
        body = document.createElement('canvas');
      body.width = Math.max(1, Math.round(outW * scale));
      body.height = Math.max(1, Math.round(outH * scale));
      const ctx = body.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable.');
      const snapshot = await new Promise<Map<HTMLCanvasElement, ImageBitmap>>((resolve, reject) => {
        let expired = false;
        const deadline = setTimeout(() => {
          expired = true;
          reject(new Error('Boundary capture timed out.'));
        }, 10000);
        (boundaryTilesRef.current?.snapshot() ?? Promise.resolve(new Map<HTMLCanvasElement, ImageBitmap>())).then(
          (result) => {
            clearTimeout(deadline);
            if (expired) {
              for (const bitmap of result.values()) bitmap.close();
              return;
            }
            resolve(result);
          },
          (error) => {
            clearTimeout(deadline);
            reject(error);
          }
        );
      });
      try {
        assertCurrent();
        const rectOf = (element: Element) => {
          const r = element.getBoundingClientRect();
          return { x: r.left - containerRect.left, y: r.top - containerRect.top, width: r.width, height: r.height };
        };
        const images = Array.from(container.querySelectorAll<HTMLImageElement>('img.leaflet-tile-loaded')).filter(
          (img) => img.complete && img.naturalWidth > 0
        );
        drawMapCapture(ctx, {
          viewport: { x: 0, y: 0, width: containerRect.width, height: containerRect.height },
          crop: { x: offsetX, y: offsetY, width: outW, height: outH },
          scale,
          geometry: focusGeometry,
          cutout: mode === 'selected',
          project: ([lon, lat]) => map.latLngToContainerPoint([lat, lon]),
          swipe: compare ? swipe : undefined,
          basemapTiles: images.map((image) => ({
            image,
            rect: rectOf(image),
            sideB: image.closest<HTMLElement>('.leaflet-layer')?.dataset.periodSide === 'b'
          })),
          boundaryTiles: [...snapshot].map(([element, image]) => ({ image, rect: rectOf(element) })),
          points: analysisPoints.flatMap(({ feature, color }) => feature.geometry.type === 'Point' ? [{ position: feature.geometry.coordinates, color }] : []),
          footprints: analysisPoints.flatMap(({ feature, color }) => feature.geometry.type !== 'Point' ? [{ geometry: feature.geometry, color }] : [])
        });
      } finally {
        for (const bitmap of snapshot.values()) bitmap.close();
      }
      const source = BASEMAPS.find((b) => b.id === activeBasemap);
      const lines = source?.supportsPeriod
        ? [
            'Contains modified Copernicus Sentinel data / Earth Search | 10 m',
            `A: ${period.start} — ${period.end}`,
            ...(compare ? [`B: ${comparison.start} — ${comparison.end} | ${t('Swipe comparison')}: ${swipe}%`] : []),
            t('10 m native imagery · least-cloudy scenes; clouds may remain.'),
            t('Confidence: local cloud-free coverage unvalidated.'),
            '© OpenStreetMap contributors (ODbL) | Rwanda Map'
          ]
        : [
            source?.id === 'sentinel2-2016'
              ? 'EOX Sentinel-2 cloudless | Contains modified Copernicus Sentinel data 2016 | CC BY 4.0'
              : (source?.exportAttribution ?? '© OpenStreetMap contributors (ODbL)'),
            t(basemapReferenceNote(source))
          ];
      if (source?.id === 'esri' && esriMetadata) lines.push(...esriMetadataLines(esriMetadata, language), esriMetadata.source);
      if (source?.id === 'esri') lines.push('© OpenStreetMap contributors (ODbL) · underlying reference map');
      lines.push(selectionNote ?? t('Source date unknown · reference boundaries, not cadastral data.'));
      if (source?.supportsPeriod)
        snapshots.forEach((snapshot, index) => {
          const candidates =
            snapshot?.scenes.filter(
              (s) =>
                s.bbox[0] < map.getBounds().getEast() &&
                s.bbox[2] > map.getBounds().getWest() &&
                s.bbox[1] < map.getBounds().getNorth() &&
                s.bbox[3] > map.getBounds().getSouth()
            ) ?? [];
          const summary = candidates
            .map(
              (scene) => `${scene.acquiredAt.slice(0, 10)} (${scene.cloudCover.toFixed(1)}% ${t('Scene cloud cover')})`
            )
            .join('; ');
          lines.push(
            `${index === 0 ? 'A' : 'B'} ${t('Candidate acquisitions')}: ${summary || t('No scenes found for this period.')}`
          );
        });
      if (imageryError) lines.push(t('Imagery unavailable. The street reference remains visible.'));
      if (analysis) {
        for (const [index, snapshot] of analysis.snapshots.entries()) {
          const m = snapshot.metrics;
          lines.push(
            `${index === 0 ? 'A' : 'B'} ${t('Mapped buildings')}: ${m ? `≈ ${m.mappedBuildings}` : '—'} | ${t('Density')}: ${m?.densityPerKm2.toFixed(1) ?? '—'}/km² | ${t('Data date')}: ${snapshot.dataDate?.slice(0, 10) ?? '—'} | ${snapshot.sourceVersion ?? '—'}`
          );
          if (snapshot.outlineStatus) lines.push(`${index === 0 ? 'A' : 'B'}: ${t(snapshot.outlineStatus === 'available' ? 'Actual source outlines available for all counted records.' : 'Outlines unavailable for this selection. Points and counts remain complete; try a smaller area.')}`);
          if (m?.mappedBuildings === 0) lines.push(t('Zero mapped structures does not establish zero houses; the source may omit this area.'));
          if (m?.houseClassificationRange)
            lines.push(
              `${t('Possible house structures')}: ${m.houseClassificationRange.min}–${m.houseClassificationRange.max}. ${t('Range applies only to mapped structures; not a total-house estimate.')}`
            );
        }
        lines.push(
          t(
            'Method: count points in mapped building footprints inside the selected polygon; no residential model validated.'
          ),
          t('Low confidence · coverage and residential use unvalidated.'),
          t('Blue: mapped in A · green: added · red: removed.'),
          t('Mapping edits and improved coverage can change counts. This is not verified construction or demolition.'),
          [...new Set(analysis.snapshots.map((snapshot) => `${snapshot.attribution} (${snapshot.license})`))].join('; ')
        );
      }
      assertCurrent();
      const report = attachExportFooter(body, scale, lines);
      const blob = await canvasPngBlob(report.canvas);
      assertCurrent();
      downloadBlob(blob, `${mode === 'selected' ? 'boundary-export' : 'map-view'}-${Date.now()}.png`);
    } catch (error) {
      setExportError(true);
      console.error('Map export failed', error);
    } finally {
      interactionSurface.removeEventListener('pointerdown', markInteraction);
      interactionSurface.removeEventListener('wheel', markInteraction);
      interactionSurface.removeEventListener('keydown', markInteraction);
      if (
        !userInteracted &&
        captureRevisionRef.current === expectedRevision &&
        (!capturedView || captureMatches(capturedView, currentView()))
      )
        restoreView?.();
      setIsExporting(false);
    }
  };

  const toolButton =
    'w-9 h-9 flex items-center justify-center text-fg-secondary hover:text-accent hover:bg-surface-elevated disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-fg-secondary transition-colors';

  return (
    <div className="w-full h-full relative z-0">
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        role="application"
        aria-label="Rwanda administrative boundaries map. Arrow keys pan, plus and minus zoom."
      />

      {drawing && <div aria-hidden="true" className="absolute z-[800] pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-accent"><Plus className="w-5 h-5" /></div>}
      {drawing && (
        <div className="absolute z-[1050] top-[76px] max-w-[420px]" style={{ left: insets.left + 16, right: insets.right + 16 }}>
          <DrawingControls draft={drawing} onUndo={onUndoDrawing} onCancel={onCancelDrawing} onFinish={onFinishDrawing} onAddCenter={() => {
            const map = mapRef.current;
            if (!map) return;
            const center = map.getCenter();
            onMapClickRef.current(center.lat, center.lng, map.getZoom());
          }} />
        </div>
      )}
      {compare && (
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-white/70 z-[500]"
          style={{ left: `${swipe}%` }}
        >
          <span className="absolute top-[70px] -translate-x-1/2 bg-surface-base text-fg px-2 py-1 rounded text-[11px]">
            A | B
          </span>
        </div>
      )}
      {(imageryError || exportError) && (
        <div
          role="alert"
          className="absolute left-4 right-4 bottom-2 z-[900] bg-surface-panel text-warning rounded p-2 text-[12px]"
        >
          {exportError
            ? t('Image export failed. Please retry.')
            : t('Imagery unavailable. The street reference remains visible.')}
        </div>
      )}
      {activeBasemap !== 'sentinel2' && (
        <p className="absolute top-[70px] left-1/2 -translate-x-1/2 z-[500] bg-surface-panel text-fg-secondary text-[11px] px-2 py-1 rounded">
          {t(basemapReferenceNote(BASEMAPS.find((b) => b.id === activeBasemap)))}
        </p>
      )}
      {/* Floating map toolbar - slides left to clear the inspector when it's open */}
      <div
        className="absolute z-[1000] flex flex-col gap-2 pointer-events-auto transition-[right] duration-300"
        style={{ right: insets.right + 16, bottom: insets.bottom + 16 }}
      >
        <div className="glass-panel flex flex-col overflow-hidden divide-y divide-line">
          <button
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom in (+)"
            aria-label={t('Zoom in')}
            className={toolButton}
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom out (-)"
            aria-label={t('Zoom out')}
            className={toolButton}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.flyTo(RWANDA_CENTER, RWANDA_ZOOM, { duration: 1 })}
            title="Reset to all of Rwanda"
            aria-label={t('Reset view to all of Rwanda')}
            className={toolButton}
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
        {FEATURE_FLAGS.drawnSelection && !drawing && (
          <div className="glass-panel flex flex-col overflow-hidden divide-y divide-line">
            <button onClick={() => onStartDrawing('rectangle')} className={toolButton} title={t('Draw a rectangle')} aria-label={t('Draw a rectangle')} disabled={isExporting || Boolean(drawing)}>
              <RectangleHorizontal className="w-4 h-4" />
            </button>
            <button onClick={() => onStartDrawing('polygon')} className={toolButton} title={t('Draw a polygon')} aria-label={t('Draw a polygon')} disabled={isExporting || Boolean(drawing)}>
              <Pentagon className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="glass-panel flex flex-col overflow-hidden divide-y divide-line">
          <button
            onClick={() => exportMapImage('view')}
            disabled={isExporting || Boolean(drawing)}
            title={t('Export current view as PNG')}
            aria-label={t('Export current view as PNG')}
            className={toolButton}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => exportMapImage('selected')}
            disabled={isExporting || Boolean(drawing) || !focusGeometry}
            title={
              focusGeometry
                ? t('Export the selected area, clipped to its shape, as PNG')
                : t('Select an area to export it')
            }
            aria-label={t('Export selected area as PNG')}
            className={toolButton}
          >
            <Crop className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
