import { COUNTRY_TIER, levelForZoom, parentLevel } from './adminLevels';
import { readUrlState } from './urlState';

// The boundary tile worker, shared by the page. Kept free of Leaflet/React
// imports so page.tsx can start it at first script execution: its bootstrap
// (a few chained script fetches) then overlaps framework start-up and the map
// chunk download instead of delaying the first tiles. BoundaryTiles layers
// talk to it under their own namespace.

export interface WorkerMessage {
  type: string;
  ns?: number;
  key?: string;
  seq?: number;
  bitmap?: ImageBitmap;
  fetchMs?: number | null;
  message?: string;
  id?: number;
  value?: unknown;
}

export const workerListeners = new Map<number, (msg: WorkerMessage) => void>();
export const resultHandlers = new Map<number, (value: unknown) => void>();

let worker: Worker | null = null;
let ns = 1;
let requestId = 1;
export const nextNamespace = () => ns++;
export const nextRequestId = () => requestId++;

export function getTileWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./boundaryTiles.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'result') {
        resultHandlers.get(msg.id!)?.(msg.value);
        resultHandlers.delete(msg.id!);
      } else {
        const listener = workerListeners.get(msg.ns!);
        if (listener) listener(msg);
        else msg.bitmap?.close();
      }
    };
  }
  return worker;
}

// Must match InteractiveMap's defaults and BoundaryTiles' tile size
const DEFAULT_VIEW = { lat: -1.9403, lng: 29.8739, zoom: 9.3 };
const TILE_SIZE = 512;

/**
 * Starts fetching the first screen's boundary tiles before React or Leaflet
 * have even loaded. The initial view is fully known up front - the URL (or
 * the default Rwanda view) gives centre and zoom, and the map fills the
 * window - so this computes exactly the tiles Leaflet's GridLayer will ask for
 * and has the worker load them into its cache; when the map then requests
 * them they're already there (or in flight).
 */
export function prefetchInitialView() {
  const view = readUrlState().center ?? DEFAULT_VIEW;
  const zoom = Math.min(18, Math.max(8, view.zoom));
  const tileZoom = Math.round(zoom);

  // Leaflet's spherical-mercator projection at the tile zoom
  const worldPx = 256 * 2 ** tileZoom;
  const lat = Math.max(-85.0511287798, Math.min(85.0511287798, view.lat));
  const sin = Math.sin((lat * Math.PI) / 180);
  const cx = Math.floor(((view.lng + 180) / 360) * worldPx);
  const cy = Math.floor((0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldPx);

  // Same tile range GridLayer derives from its tiled pixel bounds
  const scale = 2 ** (zoom - tileZoom);
  const halfW = window.innerWidth / (scale * 2);
  const halfH = window.innerHeight / (scale * 2);
  const coords: { x: number; y: number; z: number }[] = [];
  for (let x = Math.floor((cx - halfW) / TILE_SIZE); x <= Math.ceil((cx + halfW) / TILE_SIZE) - 1; x++) {
    for (let y = Math.floor((cy - halfH) / TILE_SIZE); y <= Math.ceil((cy + halfH) / TILE_SIZE) - 1; y++) {
      coords.push({ x, y, z: tileZoom });
    }
  }

  const active = levelForZoom(zoom);
  const parent = parentLevel(active);
  getTileWorker().postMessage({ type: 'prefetch', coords, tiers: [...(parent ? [parent] : []), active, COUNTRY_TIER] });
}
