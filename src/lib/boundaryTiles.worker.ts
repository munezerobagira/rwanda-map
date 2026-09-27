// Boundary tile worker: everything tile-related that isn't displaying pixels
// runs here - fetching and parsing tile batches, slicing tiers for each
// display tile, drawing strokes onto an OffscreenCanvas, and answering hover
// hit-tests. The main thread only puts finished ImageBitmaps on screen, so
// canvas rasterisation and JSON parsing never block panning, zooming or input.
//
// Protocol (see BoundaryTiles in boundaryTiles.ts):
//   in:  drawMany {ns, items: [{key, coords, seq}], tiers, outline, dpr} | drop {ns, key} | dispose {ns}
//        | prefetch {coords, tiers} | snapshot {ns, id, keys, tiers, outline, dpr}
//        | featureAt {ns, id, key, tiers, x, y} | shape {ns, id, featureId, z, tiers} | count {ns, id, z, tiers, bounds}
//   `ns` separates map instances sharing this worker (React Strict Mode mounts twice in dev).
//   out: drawn {key, seq, bitmap, fetchMs} | error {key, seq, message} | result {id, value}

import { CASING, TileTier } from './adminLevels';

const TILE_SIZE = 512; // CSS px per display tile
const EXTENT = 4096; // server tile coordinate extent

interface Coords {
  x: number;
  y: number;
  z: number;
}

interface TileFeature {
  id: number;
  n?: string;
  p?: string;
  g: [number, number][][];
}

// ---------------------------------------------------------------
// Shared fetch cache - survives layers being removed/re-added as the active
// tier changes, so zooming back out never refetches what's already loaded
// ---------------------------------------------------------------
const MAX_CACHED_TILES = 1500;
const tileCache = new Map<string, Promise<TileFeature[]>>();

// Tile requests made during one Leaflet update (it creates all of a view's
// tiles in a single synchronous loop) are collected and flushed as one batch
// request per tier and zoom, instead of one HTTP request per tile.
const MAX_BATCH = 64;
type Pending = { x: number; y: number; resolve: (f: TileFeature[]) => void; reject: (e: unknown) => void };
const pendingBatches = new Map<string, { layer: string; z: number; tiles: Pending[]; onTiming: (ms: number) => void }>();
let flushScheduled = false;

function flushBatches() {
  flushScheduled = false;
  const batches = [...pendingBatches.values()];
  pendingBatches.clear();
  for (const { layer, z, tiles, onTiming } of batches) {
    for (let i = 0; i < tiles.length; i += MAX_BATCH) {
      const chunk = tiles.slice(i, i + MAX_BATCH);
      const start = performance.now();
      fetch(`/api/tiles/${layer}/batch?z=${z}&t=${chunk.map((t) => `${t.x}_${t.y}`).join(',')}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Tile batch ${layer}/${z} failed: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          onTiming(performance.now() - start);
          for (const t of chunk) t.resolve((data.tiles?.[`${t.x}_${t.y}`] ?? []) as TileFeature[]);
        })
        .catch((err) => chunk.forEach((t) => t.reject(err)));
    }
  }
}

function fetchTile(layer: string, z: number, x: number, y: number, onTiming: (ms: number) => void): Promise<TileFeature[]> {
  const key = `${layer}/${z}/${x}/${y}`;
  const cached = tileCache.get(key);
  if (cached) {
    // refresh LRU position
    tileCache.delete(key);
    tileCache.set(key, cached);
    return cached;
  }

  const promise = new Promise<TileFeature[]>((resolve, reject) => {
    const batchKey = `${layer}/${z}`;
    let batch = pendingBatches.get(batchKey);
    if (!batch) {
      batch = { layer, z, tiles: [], onTiming };
      pendingBatches.set(batchKey, batch);
    }
    batch.tiles.push({ x, y, resolve, reject });
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flushBatches);
    }
  }).catch((err) => {
    tileCache.delete(key); // let a later request retry
    throw err;
  });

  tileCache.set(key, promise);
  if (tileCache.size > MAX_CACHED_TILES) {
    tileCache.delete(tileCache.keys().next().value!);
  }
  return promise;
}

// Line width grows gently as you zoom past the tier's entry zoom, so a tier
// that looks right when it first appears doesn't turn hairline-thin (or
// clunky) a couple of levels later.
function zoomScale(zoom: number, level: TileTier) {
  return Math.min(1.6, Math.max(0.85, 1 + (zoom - level.minZoom) * 0.12));
}

function pointInRings(x: number, y: number, rings: [number, number][][]): boolean {
  // Even-odd over every ring handles holes and multipolygon parts alike
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** One tier's server-tile data as seen from one display tile. */
interface TierSlice {
  features: TileFeature[];
  /** The display tile is the (ix, iy) cell of a sub x sub grid over the server tile */
  sub: number;
  ix: number;
  iy: number;
}

/** Which server tile (and which cell of it) a display tile needs for a tier. */
function sliceCoords(coords: Coords, level: TileTier) {
  // A 512px tile at map zoom z covers exactly one server tile at z-1 - or,
  // past the tier's tileMaxZoom, one cell of a coarser server tile that is
  // shared by every display tile it covers (and fetched once)
  const z = Math.min(coords.z - 1, level.tileMaxZoom);
  const sub = 2 ** (coords.z - 1 - z);
  const sx = Math.floor(coords.x / sub);
  const sy = Math.floor(coords.y / sub);
  return { z, sx, sy, sub, ix: coords.x - sx * sub, iy: coords.y - sy * sub };
}

// Feature extents in server-tile units, computed once per feature object, so
// a display tile that shows only part of a large server tile can skip
// everything outside it
const featureBounds = new WeakMap<TileFeature, [number, number, number, number]>();
function boundsOf(f: TileFeature): [number, number, number, number] {
  let b = featureBounds.get(f);
  if (!b) {
    b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of f.g) {
      for (const [x, y] of ring) {
        if (x < b[0]) b[0] = x;
        if (y < b[1]) b[1] = y;
        if (x > b[2]) b[2] = x;
        if (y > b[3]) b[3] = y;
      }
    }
    featureBounds.set(f, b);
  }
  return b;
}

/** The display tile's cell of a slice, in server-tile units. */
function cellRect({ sub, ix, iy }: TierSlice): [number, number, number, number] {
  const size = EXTENT / sub;
  return [ix * size, iy * size, (ix + 1) * size, (iy + 1) * size];
}

/** Features of a slice's server tile that overlap the display tile. */
function visibleFeatures(slice: TierSlice): TileFeature[] {
  if (slice.sub === 1) return slice.features;
  const [x0, y0, x1, y1] = cellRect(slice);
  return slice.features.filter((f) => {
    const b = boundsOf(f);
    return b[2] >= x0 && b[0] <= x1 && b[3] >= y0 && b[1] <= y1;
  });
}

// Sutherland-Hodgman clip of a ring to an axis-aligned rectangle
function clipRing(ring: [number, number][], [x0, y0, x1, y1]: [number, number, number, number]): [number, number][] {
  const edges: [(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]][] = [
    [(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]]
  ];
  let out = ring;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
    }
    if (!out.length) break;
  }
  return out;
}

interface WorkerRecord {
  ns: number;
  coords: Coords;
  slices: Map<string, TierSlice>;
}

const records = new Map<string, WorkerRecord>();
const fetchTimings: number[] = [];
const recordTiming = (ms: number) => {
  fetchTimings.push(ms);
  if (fetchTimings.length > 20) fetchTimings.shift();
};
const averageFetchMs = () => (fetchTimings.length ? fetchTimings.reduce((a, b) => a + b, 0) / fetchTimings.length : null);

async function loadSlices(record: WorkerRecord, tiers: TileTier[]) {
  await Promise.all(
    tiers.map(async (level) => {
      if (record.slices.has(level.id)) return;
      const c = sliceCoords(record.coords, level);
      const features = await fetchTile(level.id, c.z, c.sx, c.sy, recordTiming);
      record.slices.set(level.id, { features, sub: c.sub, ix: c.ix, iy: c.iy });
    })
  );
}

function draw(record: WorkerRecord, tiers: TileTier[], dpr: number): ImageBitmap {
  const size = TILE_SIZE * dpr;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const level of tiers) {
    const slice = record.slices.get(level.id);
    if (!slice) continue;
    const features = visibleFeatures(slice);
    if (!features.length) continue;

    // server-tile units -> canvas px, shifted to this display tile's cell
    const k = (TILE_SIZE * slice.sub * dpr) / EXTENT;
    const ox = slice.ix * TILE_SIZE * dpr;
    const oy = slice.iy * TILE_SIZE * dpr;
    const path = new Path2D();
    for (const f of features) {
      for (const ring of f.g) {
        ring.forEach(([x, y], i) => (i ? path.lineTo(x * k - ox, y * k - oy) : path.moveTo(x * k - ox, y * k - oy)));
        path.closePath();
      }
    }

    const { stroke } = level;
    const width = stroke.weight * zoomScale(record.coords.z, level);

    // 1. dark casing so lines survive any imagery
    ctx.setLineDash([]);
    ctx.strokeStyle = CASING.color;
    ctx.globalAlpha = CASING.opacity * Math.min(1, stroke.opacity + 0.3);
    ctx.lineWidth = (width + CASING.extraWeight) * dpr;
    ctx.stroke(path);

    // 2. the tier line itself. Dashed tiers use flat caps: round caps on
    // every tiny dash segment made them ~1.7x slower to rasterise, which
    // dominated tile draw time (measured 48 -> 29 ms per tile at 4x CPU)
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = stroke.opacity;
    ctx.lineWidth = width * dpr;
    ctx.setLineDash(stroke.dashArray ? stroke.dashArray.split(/[ ,]+/).map((n) => Number(n) * dpr) : []);
    ctx.lineCap = stroke.dashArray ? 'butt' : 'round';
    ctx.stroke(path);
    ctx.lineCap = 'round';
  }
  return canvas.transferToImageBitmap();
}

function featureAt(record: WorkerRecord, level: TileTier, px: number, py: number): TileFeature | null {
  const slice = record.slices.get(level.id);
  if (!slice) return null;
  // display-tile px -> server-tile units
  const x = ((slice.ix * TILE_SIZE + px) / (TILE_SIZE * slice.sub)) * EXTENT;
  const y = ((slice.iy * TILE_SIZE + py) / (TILE_SIZE * slice.sub)) * EXTENT;
  for (let i = slice.features.length - 1; i >= 0; i--) {
    const f = slice.features[i];
    const b = boundsOf(f);
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    if (pointInRings(x, y, f.g)) return f;
  }
  return null;
}

// Hovered feature's shape across loaded tiles, in global pixel coords at z:
// fill rings clipped to each tile's own cell (no overlaps, no seams) and
// outline polylines with the artificial clip edges removed
function shapeOf(ns: number, featureId: number, z: number, level: TileTier) {
  const fill: [number, number][][] = [];
  const outline: [number, number][][] = [];
  for (const record of records.values()) {
    const { coords, slices } = record;
    if (record.ns !== ns || coords.z !== z) continue;
    const slice = slices.get(level.id);
    const f = slice?.features.find((feat) => feat.id === featureId);
    if (!slice || !f) continue;

    const rect = cellRect(slice);
    const scale = (TILE_SIZE * slice.sub) / EXTENT;
    const toPx = ([x, y]: [number, number]): [number, number] => [
      coords.x * TILE_SIZE + x * scale - slice.ix * TILE_SIZE,
      coords.y * TILE_SIZE + y * scale - slice.iy * TILE_SIZE
    ];
    const onEdge = ([x, y]: [number, number], [x2, y2]: [number, number]) =>
      (x === x2 && (x === rect[0] || x === rect[2])) || (y === y2 && (y === rect[1] || y === rect[3]));

    for (const ring of f.g) {
      const clipped = clipRing(ring, rect);
      if (clipped.length < 3) continue;
      fill.push(clipped.map(toPx));
      let run: [number, number][] = [];
      for (let i = 0; i < clipped.length; i++) {
        const a = clipped[i];
        const b = clipped[(i + 1) % clipped.length];
        if (onEdge(a, b)) {
          if (run.length > 1) outline.push(run);
          run = [];
          continue;
        }
        if (!run.length) run.push(toPx(a));
        run.push(toPx(b));
      }
      if (run.length > 1) outline.push(run);
    }
  }
  return fill.length ? { fill, outline } : null;
}

function countInView(ns: number, z: number, level: TileTier, [minX, minY, maxX, maxY]: [number, number, number, number]) {
  const ids = new Set<number>();
  for (const record of records.values()) {
    const { coords, slices } = record;
    if (record.ns !== ns || coords.z !== z) continue;
    const x0 = coords.x * TILE_SIZE;
    const y0 = coords.y * TILE_SIZE;
    if (x0 + TILE_SIZE < minX || x0 > maxX || y0 + TILE_SIZE < minY || y0 > maxY) continue;
    const slice = slices.get(level.id);
    if (slice) for (const f of visibleFeatures(slice)) ids.add(f.id);
  }
  return ids.size;
}

type Message =
  | { type: 'drawMany'; ns: number; items: { key: string; coords: Coords; seq: number }[]; tiers: TileTier[]; outline: TileTier | null; dpr: number }
  | { type: 'drop'; ns: number; key: string }
  | { type: 'dispose'; ns: number }
  | { type: 'prefetch'; coords: Coords[]; tiers: TileTier[] }
  | { type: 'snapshot'; ns: number; id: number; keys: string[]; tiers: TileTier[]; outline: TileTier | null; dpr: number }
  | { type: 'featureAt'; ns: number; id: number; key: string; tiers: TileTier[]; x: number; y: number }
  | { type: 'shape'; ns: number; id: number; featureId: number; z: number; tiers: TileTier[] }
  | { type: 'count'; ns: number; id: number; z: number; tiers: TileTier[]; bounds: [number, number, number, number] };

const reply = (id: number, value: unknown) => self.postMessage({ type: 'result', id, value });

async function drawTile(ns: number, key: string, coords: Coords, seq: number, tiers: TileTier[], dpr: number) {
  const recordKey = `${ns}|${key}`;
  let record = records.get(recordKey);
  if (!record) {
    record = { ns, coords, slices: new Map() };
    records.set(recordKey, record);
  }
  try {
    await loadSlices(record, tiers);
    if (records.get(recordKey) !== record) return; // dropped meanwhile
    const bitmap = draw(record, tiers, dpr);
    (self as unknown as Worker).postMessage({ type: 'drawn', ns, key, seq, bitmap, fetchMs: averageFetchMs() }, [bitmap]);
  } catch (err) {
    self.postMessage({ type: 'error', ns, key, seq, message: String(err) });
  }
}

self.onmessage = async (e: MessageEvent<Message>) => {
  const msg = e.data;
  const active = 'tiers' in msg ? msg.tiers[msg.tiers.length - 1] : undefined;
  switch (msg.type) {
    case 'drawMany': {
      // The outline draws last, over the tiers. All items start loading in
      // this one task, so their fetches share a batch request per tier.
      const drawn = msg.outline ? [...msg.tiers, msg.outline] : msg.tiers;
      for (const item of msg.items) drawTile(msg.ns, item.key, item.coords, item.seq, drawn, msg.dpr);
      break;
    }
    case 'prefetch':
      // Warm the tile cache for the first screen before the map exists; the
      // map's own draw requests then hit these same cached promises
      for (const coords of msg.coords) {
        for (const tier of msg.tiers) {
          const c = sliceCoords(coords, tier);
          fetchTile(tier.id, c.z, c.sx, c.sy, recordTiming).catch(() => {});
        }
      }
      break;
    case 'snapshot': {
      // Re-render displayed tiles for the PNG export (their on-screen
      // bitmaps were transferred away and can't be read back)
      const drawn = msg.outline ? [...msg.tiers, msg.outline] : msg.tiers;
      const bitmaps = msg.keys.map((key) => {
        const record = records.get(`${msg.ns}|${key}`);
        return record ? draw(record, drawn, msg.dpr) : null;
      });
      (self as unknown as Worker).postMessage(
        { type: 'result', id: msg.id, value: bitmaps },
        bitmaps.filter((b): b is ImageBitmap => b !== null)
      );
      break;
    }
    case 'drop':
      records.delete(`${msg.ns}|${msg.key}`);
      break;
    case 'dispose':
      for (const [k, r] of records) if (r.ns === msg.ns) records.delete(k);
      break;
    case 'featureAt': {
      const record = records.get(`${msg.ns}|${msg.key}`);
      const f = record && active ? featureAt(record, active, msg.x, msg.y) : null;
      reply(msg.id, f ? { id: f.id, n: f.n, p: f.p } : null);
      break;
    }
    case 'shape':
      reply(msg.id, active ? shapeOf(msg.ns, msg.featureId, msg.z, active) : null);
      break;
    case 'count':
      reply(msg.id, active ? countInView(msg.ns, msg.z, active, msg.bounds) : 0);
      break;
  }
};
