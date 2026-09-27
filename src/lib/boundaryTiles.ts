// Boundary tiles on the map. One Leaflet GridLayer shows every visible admin
// tier (parent first, active on top) as 512px canvas tiles. All the real work
// - fetching/parsing tile batches, drawing strokes, hit-testing - happens in
// boundaryTiles.worker.ts; this layer only displays the finished bitmaps and
// forwards hover/count queries, so the main thread stays free for panning,
// zooming and input.
//
// Leaflet-dependent: import only from client-only modules (InteractiveMap).

import L from 'leaflet';
import { AdminLevel, TileTier } from './adminLevels';
import { WorkerMessage, getTileWorker, nextRequestId, nextNamespace, resultHandlers, workerListeners } from './tileWorker';

const TILE_SIZE = 512;

export interface HoverFeature {
  id: number;
  /** Feature name */
  n?: string;
  /** Parent tier's name */
  p?: string;
}

/** Hovered feature's shape in lat/lng: seam-free fill rings plus outline polylines. */
export interface FeatureShape {
  fill: L.LatLng[][];
  outline: L.LatLng[][];
}

interface DisplayTile {
  canvas: HTMLCanvasElement;
  ctx: ImageBitmapRenderingContext;
  coords: L.Coords;
  seq: number;
  done?: L.DoneCallback;
}

const tileKey = (c: { x: number; y: number; z: number }) => `${c.x}:${c.y}:${c.z}`;

export class BoundaryTiles extends L.GridLayer {
  private tiers: AdminLevel[] = [];
  private tiles = new Map<string, DisplayTile>();
  private worker = getTileWorker();
  private readonly ns = nextNamespace();
  private outline: TileTier | null;
  private pendingRedraws = new Set<string>();
  private fetchMs: number | null = null;
  // Draw requests made during one Leaflet update go to the worker as a single
  // message, so its tile fetches for the whole view batch into one request
  private drawQueue: Record<string, unknown>[] = [];

  constructor(options: L.GridLayerOptions & { outline?: TileTier } = {}) {
    super({
      tileSize: TILE_SIZE,
      updateWhenZooming: false,
      keepBuffer: 2,
      ...options
    });
    this.outline = options.outline ?? null;
    workerListeners.set(this.ns, (msg) => this.onWorkerMessage(msg));
    this.on('tileunload', (e: L.TileEvent) => {
      const key = tileKey(e.coords);
      this.tiles.delete(key);
      this.pendingRedraws.delete(key);
      this.worker.postMessage({ type: 'drop', ns: this.ns, key });
    });
  }

  get activeTier(): AdminLevel | undefined {
    return this.tiers[this.tiers.length - 1];
  }

  /** True while tiles are loading or being redrawn for a tier change. */
  isBusy(): boolean {
    return this.isLoading() || this.pendingRedraws.size > 0;
  }

  averageFetchMs(): number | null {
    return this.fetchMs;
  }

  /** Frees this layer's tile data in the worker - call after removing it for good. */
  dispose() {
    workerListeners.delete(this.ns);
    this.worker.postMessage({ type: 'dispose', ns: this.ns });
  }

  // Changing tiers redraws existing canvases in place once the worker has
  // their data (usually cached already), so nothing blanks
  setTiers(tiers: AdminLevel[]) {
    if (tiers.length === this.tiers.length && tiers.every((t, i) => t === this.tiers[i])) return;
    this.tiers = tiers;
    for (const [key, tile] of this.tiles) {
      this.pendingRedraws.add(key);
      this.requestDraw(key, tile);
    }
    this.fire('redrawprogress');
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = TILE_SIZE * dpr;
    // 'bitmaprenderer' takes the worker's finished bitmap without a copy
    // (measured ~25% faster tile display than drawing it into a 2D canvas).
    // Such canvases can't be read back, so the PNG export uses snapshot().
    const tile: DisplayTile = { canvas, ctx: canvas.getContext('bitmaprenderer')!, coords, seq: 0, done };
    const key = tileKey(coords);
    this.tiles.set(key, tile);
    this.requestDraw(key, tile);
    return canvas;
  }

  private requestDraw(key: string, tile: DisplayTile) {
    tile.seq++;
    const { x, y, z } = tile.coords;
    if (!this.drawQueue.length) {
      queueMicrotask(() => {
        const items = this.drawQueue;
        this.drawQueue = [];
        this.worker.postMessage({ type: 'drawMany', ns: this.ns, items, tiers: this.tiers, outline: this.outline, dpr: window.devicePixelRatio || 1 });
      });
    }
    this.drawQueue.push({ key, coords: { x, y, z }, seq: tile.seq });
  }

  private onWorkerMessage(msg: WorkerMessage) {
    const tile = this.tiles.get(msg.key!);
    if (!tile || msg.seq !== tile.seq) {
      msg.bitmap?.close(); // superseded or unloaded
      return;
    }
    if (msg.type === 'drawn') {
      tile.ctx.transferFromImageBitmap(msg.bitmap!);
      if (msg.fetchMs !== undefined) this.fetchMs = msg.fetchMs;
    }
    const done = tile.done;
    tile.done = undefined;
    done?.(msg.type === 'error' ? new Error(msg.message) : undefined, tile.canvas);
    if (this.pendingRedraws.delete(msg.key!)) this.fire('redrawprogress');
  }

  private ask<T>(message: Record<string, unknown>): Promise<T> {
    const id = nextRequestId();
    return new Promise<T>((resolve) => {
      resultHandlers.set(id, resolve as (value: unknown) => void);
      this.worker.postMessage({ ...message, id, ns: this.ns, tiers: this.tiers });
    });
  }

  private currentZoom(): { map: L.Map; z: number } | null {
    const map = (this as unknown as { _map?: L.Map })._map;
    const z = (this as unknown as { _tileZoom?: number })._tileZoom;
    return map && z !== undefined ? { map, z } : null;
  }

  /**
   * Fresh bitmaps of every displayed tile, re-rendered by the worker from its
   * cached data - for the PNG export, since 'bitmaprenderer' canvases can't be
   * drawn into another canvas. Caller must close() the bitmaps.
   */
  async snapshot(): Promise<Map<HTMLCanvasElement, ImageBitmap>> {
    const entries = [...this.tiles.entries()];
    const bitmaps = await this.ask<(ImageBitmap | null)[]>({
      type: 'snapshot',
      keys: entries.map(([key]) => key),
      outline: this.outline,
      dpr: window.devicePixelRatio || 1
    });
    const out = new Map<HTMLCanvasElement, ImageBitmap>();
    entries.forEach(([, tile], i) => bitmaps[i] && out.set(tile.canvas, bitmaps[i]!));
    return out;
  }

  /** The active-tier feature under a map position, from loaded tile data. */
  async featureAt(latlng: L.LatLng): Promise<HoverFeature | null> {
    const cur = this.currentZoom();
    if (!cur || !this.activeTier) return null;
    const p = cur.map.project(latlng, cur.z);
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    return this.ask<HoverFeature | null>({
      type: 'featureAt',
      key: tileKey({ x: tx, y: ty, z: cur.z }),
      x: p.x - tx * TILE_SIZE,
      y: p.y - ty * TILE_SIZE
    });
  }

  /** Shape of an active-tier feature across the loaded tiles, for a hover overlay. */
  async shapeOf(featureId: number): Promise<FeatureShape | null> {
    const cur = this.currentZoom();
    if (!cur || !this.activeTier) return null;
    const shape = await this.ask<{ fill: [number, number][][]; outline: [number, number][][] } | null>({ type: 'shape', featureId, z: cur.z });
    if (!shape) return null;
    const toLatLng = (ring: [number, number][]) => ring.map(([x, y]) => cur.map.unproject(L.point(x, y), cur.z));
    return { fill: shape.fill.map(toLatLng), outline: shape.outline.map(toLatLng) };
  }

  /** Distinct active-tier features across loaded tiles in the current view. */
  async visibleFeatureCount(): Promise<number> {
    const cur = this.currentZoom();
    if (!cur || !this.activeTier) return 0;
    const view = cur.map.getBounds();
    const nw = cur.map.project(view.getNorthWest(), cur.z);
    const se = cur.map.project(view.getSouthEast(), cur.z);
    return this.ask<number>({ type: 'count', z: cur.z, bounds: [nw.x, nw.y, se.x, se.y] });
  }
}
