import RWANDA from '../regions/rwanda.json';
export interface CoverageGrid { x: number; y: number; width: number; height: number }
const ZOOM = 19;
function tile(lon: number, lat: number) {
  return { x: Math.floor((lon + 180) / 360 * 2 ** ZOOM), y: Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** ZOOM) };
}
export function validCoverageGrid(grid: CoverageGrid): boolean {
  const [w, s, e, n] = RWANDA.bounds;
  const nw = tile(w, n), se = tile(e, s);
  return Object.values(grid).every(Number.isInteger) && grid.width > 0 && grid.height > 0 && grid.width <= 64 && grid.height <= 64 &&
    grid.x >= nw.x - 64 && grid.y >= nw.y - 64 && grid.x + grid.width <= se.x + 65 && grid.y + grid.height <= se.y + 65;
}
export function coverageGrid(bounds: [number, number, number, number]): CoverageGrid | null {
  if (!bounds.every(Number.isFinite)) return null;
  const [w, s, e, n] = bounds;
  if (w >= e || s >= n || s < -85 || n > 85) return null;
  const nw = tile(w, n), se = tile(e, s);
  const grid = { x: nw.x - 1, y: nw.y - 1, width: se.x - nw.x + 3, height: se.y - nw.y + 3 };
  return validCoverageGrid(grid) ? grid : null;
}
/** Source tilemap responses clip at 128-tile cache bundle borders. */
export function coverageChunks(grid: CoverageGrid): CoverageGrid[] {
  if (!validCoverageGrid(grid)) throw new Error('Invalid coverage extent');
  const chunks: CoverageGrid[] = [];
  for (let y = grid.y; y < grid.y + grid.height;) {
    const height = Math.min(grid.y + grid.height - y, 128 - y % 128);
    for (let x = grid.x; x < grid.x + grid.width;) {
      const width = Math.min(grid.x + grid.width - x, 128 - x % 128);
      chunks.push({ x, y, width, height }); x += width;
    }
    y += height;
  }
  return chunks;
}
export function allCoverageAvailable(value: unknown, grid: CoverageGrid): boolean {
  if (!value || typeof value !== 'object') throw new Error('Invalid tilemap response');
  const response = value as { location?: Record<string, unknown>; data?: unknown; error?: { code?: number } };
  if (response.error?.code === 422) return false;
  const location = response.location;
  if (!location || location.left !== grid.x || location.top !== grid.y || location.width !== grid.width || location.height !== grid.height ||
    !Array.isArray(response.data) || response.data.length !== grid.width * grid.height || !response.data.every((cell) => cell === 0 || cell === 1))
    throw new Error('Incomplete tilemap coverage');
  return response.data.every((cell) => cell === 1);
}
