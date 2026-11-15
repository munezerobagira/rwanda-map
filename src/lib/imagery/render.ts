import { fromUrl, type GeoTIFF } from 'geotiff';
import proj4 from 'proj4';
import sharp from 'sharp';
import { overlaps, tileBbox, type Scene } from './catalog';

const SIZE = 256;
const READ_SIZE = 384;
const handles = new Map<string, Promise<GeoTIFF>>();
function open(scene: Scene, signal: AbortSignal) {
  let handle = handles.get(scene.id);
  if (!handle) {
    const options = { allowFullFile: false, blockSize: 65536, cacheSize: 16 };
    handle = fromUrl(scene.visual, options, signal).catch((e) => {
      handles.delete(scene.id);
      throw e;
    });
    handles.set(scene.id, handle);
    if (handles.size > 8) {
      const first = handles.keys().next().value!;
      const old = handles.get(first);
      handles.delete(first);
      old
        ?.then((t) => {
          t.close();
        })
        .catch(() => {});
    }
  }
  return handle;
}
// Pixel centers in Web Mercator, transformed to the source UTM grid. Reading
// bounded windows/overviews avoids ever downloading a 100km TIFF in full.
export async function renderTile(
  z: number,
  x: number,
  y: number,
  scenes: Scene[],
  signal: AbortSignal
): Promise<Buffer> {
  const bbox = tileBbox(z, x, y);
  const output = new Uint8Array(SIZE * SIZE * 4);
  const candidates = scenes.filter((s) => overlaps(s.bbox, bbox)).slice(0, 8);
  for (const scene of candidates) {
    signal.throwIfAborted();
    const tiff = await open(scene, signal);
    const image = await tiff.getImage();
    const resolution = image.getResolution();
    if (Math.abs(resolution[0]) > 10.01 || Math.abs(resolution[1]) > 10.01)
      throw new Error('Imagery exceeds 10m native resolution.');
    const projection = proj4(
      'EPSG:4326',
      `+proj=utm +zone=${scene.epsg - 32700} +south +datum=WGS84 +units=m +no_defs`
    );
    const positions = new Float64Array(SIZE * SIZE * 2);
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let py = 0; py < SIZE; py++) {
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + (py + 0.5) / SIZE)) / 2 ** z))) * 180) / Math.PI;
      for (let px = 0; px < SIZE; px++) {
        const lon = ((x + (px + 0.5) / SIZE) / 2 ** z) * 360 - 180;
        const [east, north] = projection.forward([lon, lat]);
        const i = (py * SIZE + px) * 2;
        positions[i] = east;
        positions[i + 1] = north;
        minX = Math.min(minX, east);
        maxX = Math.max(maxX, east);
        minY = Math.min(minY, north);
        maxY = Math.max(maxY, north);
      }
    }
    const ib = image.getBoundingBox();
    const window: [number, number, number, number] = [
      Math.max(ib[0], minX),
      Math.max(ib[1], minY),
      Math.min(ib[2], maxX),
      Math.min(ib[3], maxY)
    ];
    if (window[0] >= window[2] || window[1] >= window[3]) continue;
    const raster = await tiff.readRasters({
      bbox: window,
      width: READ_SIZE,
      height: READ_SIZE,
      samples: [0, 1, 2],
      interleave: true,
      signal
    });
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (output[i * 4 + 3]) continue; // Least scene-cloud candidate takes precedence.
      const east = positions[i * 2],
        north = positions[i * 2 + 1];
      if (east < window[0] || east >= window[2] || north <= window[1] || north > window[3]) continue;
      const sx = Math.min(READ_SIZE - 1, Math.floor(((east - window[0]) / (window[2] - window[0])) * READ_SIZE));
      const sy = Math.min(READ_SIZE - 1, Math.floor(((window[3] - north) / (window[3] - window[1])) * READ_SIZE));
      const j = (sy * READ_SIZE + sx) * 3;
      if (!raster[j] && !raster[j + 1] && !raster[j + 2]) continue;
      output[i * 4] = Number(raster[j]);
      output[i * 4 + 1] = Number(raster[j + 1]);
      output[i * 4 + 2] = Number(raster[j + 2]);
      output[i * 4 + 3] = 255;
    }
    if (output.every((v, i) => i % 4 !== 3 || v === 255)) break;
  }
  if (!output.some((v, i) => i % 4 === 3 && v > 0))
    throw new Error('No imagery covers this tile for the selected period.');
  return sharp(output, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .webp({ quality: 90 })
    .toBuffer();
}
