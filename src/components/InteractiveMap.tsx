'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Download, Crop, Plus, Minus, Maximize } from 'lucide-react';
import { BASEMAPS, isBasemapAvailable } from '@/lib/basemaps';
import { CASING, COUNTRY_TIER, HIGHLIGHT_COLOR, levelForZoom, parentLevel } from '@/lib/adminLevels';
import { BoundaryTiles } from '@/lib/boundaryTiles';

type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

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

const RWANDA_CENTER: L.LatLngTuple = [-1.9403, 29.8739];
const RWANDA_ZOOM = 9.3;

// Outer rings of the selected geometry as holes cut out of a world-covering
// polygon - the classic inverted mask.
function maskLatLngs(geometry: BoundaryGeometry): L.LatLngExpression[][] {
  const world: L.LatLngExpression[] = [[-89, -179.9], [-89, 179.9], [89, 179.9], [89, -179.9]];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const holes = polygons.map((rings) => rings[0].map(([lng, lat]) => [lat, lng] as L.LatLngTuple));
  return [world, ...holes];
}

export default function InteractiveMap({
  initialView,
  onMapClick,
  onBoundaryLoading,
  onBoundaryStats,
  onViewportChange,
  activeBasemap,
  sentinelYear,
  flyTo,
  zoomOverride,
  focusGeometry,
  insets
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Latest callbacks/insets, read from long-lived Leaflet handlers registered
  // once at mount - without this they'd call the first render's closures.
  const onMapClickRef = useRef(onMapClick);
  const onBoundaryLoadingRef = useRef(onBoundaryLoading);
  const onBoundaryStatsRef = useRef(onBoundaryStats);
  const onViewportChangeRef = useRef(onViewportChange);
  const insetsRef = useRef(insets);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
    onBoundaryLoadingRef.current = onBoundaryLoading;
    onBoundaryStatsRef.current = onBoundaryStats;
    onViewportChangeRef.current = onViewportChange;
    insetsRef.current = insets;
  });

  const tileLayersRef = useRef<Map<string, L.TileLayer>>(new Map());

  // Vector renderers for the hover highlight and focus mask/outline; tier
  // boundaries and the national border are canvas tiles (BoundaryTiles).
  // SVG, not canvas: these are a handful of paths, and an SVG layer is simply
  // moved by the compositor on pan/zoom, whereas a viewport-sized canvas
  // (2880x1800 with padding) must be repainted and re-uploaded on every move.
  const renderersRef = useRef<{ hover: L.SVG; mask: L.SVG; focus: L.SVG } | null>(null);
  const focusLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryTilesRef = useRef<BoundaryTiles | null>(null);

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
      maxZoom: 18,
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
      keepBuffer: 4,
      updateInterval: 150,
      // Every provider in BASEMAPS serves tiles with Access-Control-Allow-Origin: *,
      // so requesting them in CORS mode keeps the tile <img>s readable by <canvas> -
      // required for the PNG export below, which otherwise gets a tainted-canvas
      // SecurityError on save.
      crossOrigin: true
    };

    for (const bm of BASEMAPS) {
      if (!isBasemapAvailable(bm)) continue;
      const layer = L.tileLayer(bm.buildUrl({ year: sentinelYear, date: '' }), {
        ...tileTuning,
        maxZoom: bm.maxZoom ?? tileTuning.maxZoom,
        ...(bm.subdomains ? { subdomains: bm.subdomains } : {}),
        attribution: bm.attribution
      });
      tileLayersRef.current.set(bm.id, layer);
    }

    tileLayersRef.current.get(activeBasemap)?.addTo(map);

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
      map.getContainer().style.cursor = '';
    };
    const updateHover = async () => {
      hoverFrame = 0;
      const e = lastHoverEvent;
      const level = tiles.activeTier;
      if (!e || !level || !renderersRef.current) return;
      const seq = ++hoverSeq;
      const feature = await tiles.featureAt(e.latlng);
      if (seq !== hoverSeq) return;
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
        if (seq !== hoverSeq && hoveredId !== feature.id) return;
        const renderer = renderersRef.current?.hover;
        if (shape && renderer && hoveredId === feature.id && !hoverLayer) {
          hoverLayer = L.layerGroup([
            L.polygon(shape.fill, { renderer, stroke: false, fillColor: HIGHLIGHT_COLOR, fillOpacity: level.highlightFill, interactive: false }),
            L.polyline(shape.outline, { renderer, color: HIGHLIGHT_COLOR, weight: 2, opacity: 1, lineJoin: 'round', interactive: false })
          ]).addTo(map);
        }
      }
      hoverTooltip.setLatLng(e.latlng);
      if (!map.hasLayer(hoverTooltip)) hoverTooltip.openOn(map);
    };
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
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
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layer of tileLayersRef.current.values()) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }

    // Refresh the URL of every time-aware layer (e.g. Sentinel-2's yearly mosaic)
    for (const bm of BASEMAPS) {
      if (!bm.supportsYear && !bm.supportsDate) continue;
      const layer = tileLayersRef.current.get(bm.id);
      layer?.setUrl(bm.buildUrl({ year: sentinelYear, date: '' }));
    }

    tileLayersRef.current.get(activeBasemap)?.addTo(map);
  }, [activeBasemap, sentinelYear]);

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
      fillOpacity: 0.55
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
  // 6s fallback in case something never finishes
  const waitForMapIdle = (map: L.Map, tileLayer?: L.TileLayer): Promise<void> => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const poll = () => {
        if (settled) return;
        const busy = tileLayer?.isLoading() || boundaryTilesRef.current?.isBusy();
        if (busy) setTimeout(poll, 50);
        else finish();
      };
      // Leaflet only starts loading the new tiles on moveend
      map.once('moveend', () => setTimeout(poll, 50));
      setTimeout(finish, 6000);
    });
  };

  const exportMapImage = async (mode: 'view' | 'selected') => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;

    const geometry = mode === 'selected' ? focusGeometry : null;
    if (mode === 'selected' && !geometry) return;
    const bounds = geometry ? L.geoJSON(geometry).getBounds() : null;

    setIsExporting(true);

    let restoreView: (() => void) | null = null;
    if (bounds) {
      const activeTileLayer = tileLayersRef.current.get(activeBasemap);
      const maxZoom = activeTileLayer?.options.maxZoom ?? 18;
      const idealZoom = Math.min(map.getBoundsZoom(bounds), maxZoom);
      const alreadyGoodView = map.getZoom() >= idealZoom && map.getBounds().contains(bounds);

      if (!alreadyGoodView) {
        const originalCenter = map.getCenter();
        const originalZoom = map.getZoom();
        restoreView = () => map.setView(originalCenter, originalZoom, { animate: false });

        const idle = waitForMapIdle(map, activeTileLayer);
        map.fitBounds(bounds, { maxZoom, animate: false, padding: [60, 60] });
        await idle;
      }
    }

    const finish = () => {
      restoreView?.();
      setIsExporting(false);
    };

    const containerRect = container.getBoundingClientRect();

    let offsetX = 0;
    let offsetY = 0;
    let outW = containerRect.width;
    let outH = containerRect.height;
    // The selection's exact polygon (holes included) in current screen-pixel
    // space: clips a cutout export, and draws the focus mask/outline in both modes
    const toScreenPath = (geom: BoundaryGeometry) => {
      const path = new Path2D();
      const addRing = (ring: GeoJSON.Position[]) => {
        ring.forEach((coord, i) => {
          const pt = map.latLngToContainerPoint([coord[1], coord[0]]);
          if (i === 0) path.moveTo(pt.x, pt.y);
          else path.lineTo(pt.x, pt.y);
        });
        path.closePath();
      };
      if (geom.type === 'Polygon') geom.coordinates.forEach(addRing);
      else geom.coordinates.forEach((poly) => poly.forEach(addRing));
      return path;
    };
    const focusPath = focusGeometry ? toScreenPath(focusGeometry) : null;
    let clipPath: Path2D | null = null;

    if (geometry && bounds) {
      const nw = map.latLngToContainerPoint(bounds.getNorthWest());
      const se = map.latLngToContainerPoint(bounds.getSouthEast());
      const pad = 24;
      offsetX = Math.max(0, nw.x - pad);
      offsetY = Math.max(0, nw.y - pad);
      outW = Math.min(containerRect.width, se.x + pad) - offsetX;
      outH = Math.min(containerRect.height, se.y + pad) - offsetY;

      if (outW <= 0 || outH <= 0) {
        console.error('Selected boundary could not be fit on screen for export');
        finish();
        return;
      }
      clipPath = focusPath;
    }

    try {
      const scale = window.devicePixelRatio || 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(outW * scale));
      canvas.height = Math.max(1, Math.round(outH * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        finish();
        return;
      }

      ctx.scale(scale, scale);
      ctx.translate(-offsetX, -offsetY);

      if (clipPath) {
        ctx.save();
        ctx.clip(clipPath, 'evenodd');
      }

      // 1. Every loaded basemap tile at its real on-screen position
      const tileImgs = Array.from(container.querySelectorAll('img.leaflet-tile-loaded')) as HTMLImageElement[];
      for (const img of tileImgs) {
        if (!img.complete || img.naturalWidth === 0) continue;
        const r = img.getBoundingClientRect();
        try {
          ctx.drawImage(img, r.left - containerRect.left, r.top - containerRect.top, r.width, r.height);
        } catch {
          // A tile without CORS headers would taint the canvas - skip it
        }
      }

      if (clipPath) ctx.restore();

      // 2. Boundary tiles (tiers + national border) on top - fresh bitmaps
      // from the worker, placed where each tile canvas sits on screen
      const snapshot = (await boundaryTilesRef.current?.snapshot()) ?? new Map<HTMLCanvasElement, ImageBitmap>();
      for (const [el, bitmap] of snapshot) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) {
          bitmap.close();
          continue;
        }
        // In a cutout the lines are clipped to the shape too, so the
        // surroundings stay genuinely transparent
        if (clipPath) {
          ctx.save();
          ctx.clip(clipPath, 'evenodd');
        }
        ctx.drawImage(bitmap, r.left - containerRect.left, r.top - containerRect.top, r.width, r.height);
        bitmap.close();
        if (clipPath) ctx.restore();
      }

      // 3. Focus mask + selection outline, drawn straight from the selection
      // geometry rather than rasterising the on-screen SVG overlays. The hover
      // highlight is transient and never exported.
      if (focusPath) {
        if (!clipPath) {
          const dim = new Path2D();
          dim.rect(offsetX, offsetY, outW, outH);
          dim.addPath(focusPath);
          ctx.fillStyle = 'rgba(9, 13, 22, 0.55)';
          ctx.fill(dim, 'evenodd');
        }
        ctx.lineJoin = 'round';
        ctx.strokeStyle = CASING.color;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 6;
        ctx.stroke(focusPath);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = HIGHLIGHT_COLOR;
        ctx.lineWidth = 2.5;
        ctx.stroke(focusPath);
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = mode === 'selected' ? `boundary-export-${Date.now()}.png` : `map-view-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
        finish();
      }, 'image/png');
    } catch (err) {
      console.error('Map export failed - usually a tainted canvas from a tile provider without CORS headers', err);
      finish();
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

      {/* Floating map toolbar - slides left to clear the inspector when it's open */}
      <div
        className="absolute z-[1000] flex flex-col gap-2 pointer-events-auto transition-[right] duration-300"
        style={{ right: insets.right + 16, bottom: insets.bottom + 16 }}
      >
        <div className="glass-panel flex flex-col overflow-hidden divide-y divide-line">
          <button onClick={() => mapRef.current?.zoomIn()} title="Zoom in (+)" aria-label="Zoom in" className={toolButton}>
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => mapRef.current?.zoomOut()} title="Zoom out (-)" aria-label="Zoom out" className={toolButton}>
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapRef.current?.flyTo(RWANDA_CENTER, RWANDA_ZOOM, { duration: 1 })}
            title="Reset to all of Rwanda"
            aria-label="Reset view to all of Rwanda"
            className={toolButton}
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
        <div className="glass-panel flex flex-col overflow-hidden divide-y divide-line">
          <button
            onClick={() => exportMapImage('view')}
            disabled={isExporting}
            title="Export current view as PNG"
            aria-label="Export current view as PNG"
            className={toolButton}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => exportMapImage('selected')}
            disabled={isExporting || !focusGeometry}
            title={focusGeometry ? 'Export the selected boundary, clipped to its shape, as PNG' : 'Select a boundary to export it'}
            aria-label="Export selected boundary as PNG"
            className={toolButton}
          >
            <Crop className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
