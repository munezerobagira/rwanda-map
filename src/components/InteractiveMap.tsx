'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Download, Crop, Plus, Minus, Maximize } from 'lucide-react';
import { BASEMAPS, isBasemapAvailable } from '@/lib/basemaps';
import {
  ADMIN_LEVELS,
  AdminLevel,
  CASING,
  HIGHLIGHT_COLOR,
  levelOfProperties
} from '@/lib/adminLevels';

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
  /** A boundary polygon was clicked - its properties, the click point and its geometry. */
  onSelectFeature: (props: Record<string, any>, latlng: { lat: number; lng: number }, geometry: BoundaryGeometry) => void;
  /** Empty map (no boundary under the pointer) was clicked. */
  onMapClick: (lat: number, lng: number) => void;
  onViewportChange: (viewport: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    zoom: number;
    centerLat: number;
    centerLng: number;
  }) => void;
  boundaryGeoJson: any;
  parentBoundaryGeoJson: any;
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

// Line width grows gently as you zoom past the tier's entry zoom, so a tier
// that looks right when it first appears doesn't turn hairline-thin (or
// clunky) a couple of levels later.
function zoomScale(zoom: number, level: AdminLevel) {
  return Math.min(1.6, Math.max(0.85, 1 + (zoom - level.minZoom) * 0.12));
}

function strokeFor(level: AdminLevel, zoom: number): L.PathOptions {
  const s = level.stroke;
  return {
    color: s.color,
    weight: s.weight * zoomScale(zoom, level),
    opacity: s.opacity,
    dashArray: s.dashArray,
    lineJoin: 'round',
    // fill stays on (at 0 opacity) so the canvas renderer still hit-tests the
    // polygon interior for hover/click
    fill: true,
    fillColor: s.color,
    fillOpacity: 0
  };
}

function casingFor(level: AdminLevel, zoom: number): L.PathOptions {
  return {
    color: CASING.color,
    weight: level.stroke.weight * zoomScale(zoom, level) + CASING.extraWeight,
    opacity: CASING.opacity * Math.min(1, level.stroke.opacity + 0.3),
    fill: false,
    lineJoin: 'round'
  };
}

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
  onSelectFeature,
  onMapClick,
  onViewportChange,
  boundaryGeoJson,
  parentBoundaryGeoJson,
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
  const onSelectFeatureRef = useRef(onSelectFeature);
  const onMapClickRef = useRef(onMapClick);
  const onViewportChangeRef = useRef(onViewportChange);
  const insetsRef = useRef(insets);
  useEffect(() => {
    onSelectFeatureRef.current = onSelectFeature;
    onMapClickRef.current = onMapClick;
    onViewportChangeRef.current = onViewportChange;
    insetsRef.current = insets;
  });

  const tileLayersRef = useRef<Map<string, L.TileLayer>>(new Map());

  // Each boundary set is drawn twice - a dark casing underneath, then the
  // colored line - in its own pane/canvas so parent context always sits under
  // the active tier and the focus mask sits over both.
  const renderersRef = useRef<{ parent: L.Canvas; active: L.Canvas; mask: L.Canvas; focus: L.Canvas } | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const boundaryCasingRef = useRef<L.GeoJSON | null>(null);
  const parentLayerRef = useRef<L.GeoJSON | null>(null);
  const parentCasingRef = useRef<L.GeoJSON | null>(null);
  const focusLayerRef = useRef<L.LayerGroup | null>(null);

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
      preferCanvas: true
    });

    mapRef.current = map;
    map.attributionControl.setPrefix(false);

    const makePane = (name: string, zIndex: number, interactive: boolean) => {
      const pane = map.createPane(name);
      pane.style.zIndex = String(zIndex);
      if (!interactive) pane.style.pointerEvents = 'none';
      return name;
    };
    // overlayPane is 400 - parent context under it, focus mask + outline over it
    renderersRef.current = {
      parent: L.canvas({ pane: makePane('parentBoundaries', 390, false), padding: 0.5 }),
      active: L.canvas({ padding: 0.5 }),
      mask: L.canvas({ pane: makePane('focusMask', 440, false), padding: 0.5 }),
      focus: L.canvas({ pane: makePane('focusOutline', 450, false), padding: 0.5 })
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

    // Static national outline - always visible context under every tier
    fetch('/data/country boundary.geojson')
      .then(res => res.json())
      .then(data => {
        if (!mapRef.current || !renderersRef.current) return;
        const renderer = renderersRef.current.parent;
        L.geoJSON(data, {
          style: { color: CASING.color, weight: 4, opacity: 0.5, fill: false },
          interactive: false,
          renderer
        } as L.GeoJSONOptions).addTo(mapRef.current);
        L.geoJSON(data, {
          style: { color: '#F8FAFC', weight: 2, opacity: 0.7, fill: false },
          interactive: false,
          renderer
        } as L.GeoJSONOptions).addTo(mapRef.current);
      })
      .catch(err => console.error('Failed to load Rwanda country outline', err));

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
      onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    };
    map.on('click', handleClick);

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
      map.off('moveend', updateViewport);
      map.off('click', handleClick);
      map.remove();
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
  // ACTIVE TIER - casing + styled, interactive boundaries
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const renderers = renderersRef.current;
    if (!map || !renderers || !isMapReady) return;

    boundaryLayerRef.current?.remove();
    boundaryCasingRef.current?.remove();
    boundaryLayerRef.current = null;
    boundaryCasingRef.current = null;

    if (!boundaryGeoJson?.features?.length) return;

    const level = levelOfProperties(boundaryGeoJson.features[0].properties);
    const zoom = map.getZoom();
    const baseStyle = strokeFor(level, zoom);
    const hoverStyle: L.PathOptions = {
      color: HIGHLIGHT_COLOR,
      weight: Math.max(2, (baseStyle.weight ?? 1) + 1),
      opacity: 1,
      dashArray: undefined,
      fillColor: HIGHLIGHT_COLOR,
      fillOpacity: level.highlightFill
    };

    boundaryCasingRef.current = L.geoJSON(boundaryGeoJson, {
      style: () => casingFor(level, zoom),
      interactive: false,
      renderer: renderers.active
    } as L.GeoJSONOptions).addTo(map);

    const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
      layer.on({
        mouseover: (e) => {
          (e.target as L.Path).setStyle(hoverStyle);
          (e.target as L.Path).bringToFront();
        },
        mouseout: (e) => {
          boundaryLayerRef.current?.resetStyle(e.target);
        },
        click: (e: L.LeafletMouseEvent) => {
          if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
          onSelectFeatureRef.current(
            feature.properties ?? {},
            { lat: e.latlng.lat, lng: e.latlng.lng },
            feature.geometry as BoundaryGeometry
          );
        }
      });

      // Lazy tooltip - built only when it opens, not for every feature up front
      layer.bindTooltip(
        () => {
          const props = feature.properties ?? {};
          const name = props[level.key];
          const parentKey = ADMIN_LEVELS[ADMIN_LEVELS.indexOf(level) - 1]?.key;
          const parent = parentKey ? props[parentKey] : 'Rwanda';
          return `<div class="font-sans text-left"><div class="text-[12px] font-semibold text-fg">${name}</div><div class="text-[11px] text-fg-secondary">${level.label} · ${parent}</div></div>`;
        },
        { sticky: true, className: 'leaflet-tooltip' }
      );
    };

    boundaryLayerRef.current = L.geoJSON(boundaryGeoJson, {
      style: () => baseStyle,
      onEachFeature,
      renderer: renderers.active
    } as L.GeoJSONOptions).addTo(map);
  }, [boundaryGeoJson, isMapReady]);

  // -------------------------------------------------------------
  // PARENT TIER - non-interactive context outlines
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const renderers = renderersRef.current;
    if (!map || !renderers || !isMapReady) return;

    parentLayerRef.current?.remove();
    parentCasingRef.current?.remove();
    parentLayerRef.current = null;
    parentCasingRef.current = null;

    if (!parentBoundaryGeoJson?.features?.length) return;

    const level = levelOfProperties(parentBoundaryGeoJson.features[0].properties);
    const zoom = map.getZoom();
    // Parent lines are drawn in their own tier style, slightly heavier than
    // the active tier's so the hierarchy reads at a glance
    const style = { ...strokeFor(level, zoom), fill: false };

    parentCasingRef.current = L.geoJSON(parentBoundaryGeoJson, {
      style: () => casingFor(level, zoom),
      interactive: false,
      renderer: renderers.parent
    } as L.GeoJSONOptions).addTo(map);
    parentLayerRef.current = L.geoJSON(parentBoundaryGeoJson, {
      style: () => style,
      interactive: false,
      renderer: renderers.parent
    } as L.GeoJSONOptions).addTo(map);
  }, [parentBoundaryGeoJson, isMapReady]);

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
  // cursor - a single tile <img> or one transparent boundary <canvas> - never
  // both. This flattens every visible tile plus every vector canvas (in pane
  // stacking order) into one offscreen canvas and downloads it as a PNG.
  //
  // mode: 'view' exports the full current viewport as seen (focus mask included).
  // mode: 'selected' crops and clips to the selected entity's geometry so only
  // that shape - outline plus the imagery inside it - is visible. It first
  // flies in to the tightest zoom that fits the shape (capped at the basemap's
  // maxZoom) so the export isn't built from blurry zoomed-out tiles, waits for
  // those tiles, captures, then flies back.
  const waitForMapIdle = (map: L.Map, tileLayer?: L.TileLayer): Promise<void> => {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      const onMoveEnd = () => {
        const loading = (tileLayer as (L.TileLayer & { isLoading?: () => boolean }) | undefined)?.isLoading?.();
        if (tileLayer && loading) {
          const onLoad = () => {
            tileLayer.off('load', onLoad);
            finish();
          };
          tileLayer.on('load', onLoad);
          setTimeout(finish, 6000); // fallback in case a tile stalls/fails to ever fire 'load'
        } else {
          finish();
        }
      };

      map.once('moveend', onMoveEnd);
      setTimeout(finish, 6000); // fallback in case moveend itself never fires
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

      // Exact polygon (holes included) in current screen-pixel space
      const path = new Path2D();
      const addRing = (ring: GeoJSON.Position[]) => {
        ring.forEach((coord, i) => {
          const pt = map.latLngToContainerPoint([coord[1], coord[0]]);
          if (i === 0) path.moveTo(pt.x, pt.y);
          else path.lineTo(pt.x, pt.y);
        });
        path.closePath();
      };
      if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach(addRing);
      } else {
        geometry.coordinates.forEach((poly) => poly.forEach(addRing));
      }
      clipPath = path;
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

      // 2. Vector canvases in pane stacking order. A cutout export skips the
      // focus mask, which would otherwise paint the transparent surroundings dark.
      const paneZ = (c: HTMLCanvasElement) => Number(c.closest<HTMLElement>('.leaflet-pane:not(.leaflet-map-pane)')?.style.zIndex || 400);
      const overlayCanvases = (Array.from(container.querySelectorAll('canvas')) as HTMLCanvasElement[])
        .filter((c) => !(clipPath && c.closest('.leaflet-focusMask-pane')))
        .sort((a, b) => paneZ(a) - paneZ(b));
      // Boundary lines are clipped to the shape too (only its own outline is
      // drawn full-width), so the surroundings stay genuinely transparent.
      for (const c of overlayCanvases) {
        const r = c.getBoundingClientRect();
        const clipThis = clipPath && !c.closest('.leaflet-focusOutline-pane');
        if (clipThis) {
          ctx.save();
          ctx.clip(clipPath!, 'evenodd');
        }
        ctx.drawImage(c, r.left - containerRect.left, r.top - containerRect.top, r.width, r.height);
        if (clipThis) ctx.restore();
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
