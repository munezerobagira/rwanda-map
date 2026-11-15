import fs from 'fs';
import path from 'path';
import GeoJSONVT from 'geojson-vt';
import { roundGeometry, calculateFeatureAreaKm2 } from './boundaryGeometry';

type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

export interface BoundaryFeature {
  type: 'Feature';
  properties: {
    FID: number;
    province?: string;
    province_i?: string;
    district?: string;
    district_i?: string;
    sector?: string;
    sector_id?: string;
    cell?: string;
    cell_id?: string;
    village?: string;
    village_id?: string;
    [key: string]: string | number | undefined;
    area_km2?: number;
    connection_rate?: number;
    peak_load_mw?: number;
    status?: string;
  };
  geometry: BoundaryGeometry;
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

// Literal readers let Next's filesystem tracer include only these six assets,
// not every nested building index under public/data. Keep URLs/data unchanged.
const BOUNDARY_READERS: Record<string, () => string> = {
  country: () => fs.readFileSync(path.join(process.cwd(), 'public/data/country boundary.geojson'), 'utf8'),
  provinces: () => fs.readFileSync(path.join(process.cwd(), 'public/data/provinces.simplified.geojson'), 'utf8'),
  districts: () => fs.readFileSync(path.join(process.cwd(), 'public/data/districts.simplified.geojson'), 'utf8'),
  sectors: () => fs.readFileSync(path.join(process.cwd(), 'public/data/sectors.simplified.geojson'), 'utf8'),
  cells: () => fs.readFileSync(path.join(process.cwd(), 'public/data/cells.simplified.geojson'), 'utf8'),
  villages: () => fs.readFileSync(path.join(process.cwd(), 'public/data/villages.simplified.geojson'), 'utf8')
};

const TILE_PARENT_FIELD: Record<string, string | null> = {
  country: null,
  provinces: null,
  districts: 'province',
  sectors: 'district',
  cells: 'sector',
  villages: 'cell'
};

class SpatialStore {
  private layers: Record<string, BoundaryFeature[]> = {
    country: [],
    provinces: [],
    districts: [],
    sectors: [],
    cells: [],
    villages: []
  };

  private loadedLayers: Record<string, boolean> = {
    country: false,
    provinces: false,
    districts: false,
    sectors: false,
    cells: false,
    villages: false
  };

  // One vector-tile index per layer, built on first tile request
  private tileIndexes: Record<string, Promise<GeoJSONVT>> = {};

  constructor() {}

  // Tiles only carry what the map draws and labels: a stable id, the
  // feature's own name and its parent's name. Everything else (codes, area,
  // grid metrics) is fetched per feature on selection via /api/feature.
  public getTileIndex(layerName: string): Promise<GeoJSONVT> {
    if (!this.tileIndexes[layerName]) {
      this.tileIndexes[layerName] = (async () => {
        await this.loadLayerIfNeeded(layerName);
        const nameField = layerName.slice(0, -1);
        const parentField = TILE_PARENT_FIELD[layerName];
        const startTime = Date.now();
        const index = new GeoJSONVT(
          {
            type: 'FeatureCollection',
            features: this.layers[layerName].map((f) => ({
              type: 'Feature',
              id: f.properties.FID,
              properties: {
                n: f.properties[nameField],
                ...(parentField ? { p: f.properties[parentField] } : {})
              },
              geometry: f.geometry
            }))
          } as GeoJSON.FeatureCollection,
          {
            maxZoom: 18, // detail kept all the way to the map's max zoom
            indexMaxZoom: 7, // pre-slice the coarse pyramid; deeper tiles are cut on demand
            extent: 4096,
            // Clip edges land this far outside the tile - wider than the
            // thickest stroke, so polygon strokes never show seams at tile borders
            buffer: 128,
            // 0.5px at the tile's own zoom: invisible, and ~30% lighter than
            // 2 for fine tiers seen zoomed out (sectors at z10). Deeper tiles
            // are unaffected - the source is already generalised to ~11-22m.
            tolerance: 4
          }
        );
        console.log(`SpatialStore: Built tile index for ${layerName} in ${(Date.now() - startTime) / 1000}s`);
        return index;
      })().catch((err) => {
        delete this.tileIndexes[layerName];
        throw err;
      });
    }
    return this.tileIndexes[layerName];
  }

  public async loadLayerIfNeeded(layerName: string) {
    if (!Object.hasOwn(BOUNDARY_READERS, layerName)) {
      throw new Error(`Unknown layer: ${layerName}`);
    }

    if (this.loadedLayers[layerName]) {
      // Self-healing: if the layer was loaded but has no area_km2 computed, force a reload
      const features = this.layers[layerName];
      if (
        features &&
        features.length > 0 &&
        features[0].properties &&
        typeof features[0].properties.area_km2 === 'number'
      ) {
        return;
      }
      console.log(`SpatialStore: Forcing memory reload of ${layerName} to calculate area_km2...`);
      this.loadedLayers[layerName] = false;
    }

    try {
      const startTime = Date.now();
      let fileData: string;
      try {
        fileData = BOUNDARY_READERS[layerName]();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        throw new Error(
          `Missing precomputed ${layerName} boundaries. Run git lfs pull or pnpm data:boundaries before starting the server.`
        );
      }
      if (fileData.startsWith('version https://git-lfs.github.com/spec/'))
        throw new Error('Boundary asset is a Git LFS pointer. Run git lfs pull.');
      const geojson = JSON.parse(fileData) as { type: 'FeatureCollection'; features: BoundaryFeature[] };

      // A simplified cache written before coordinate rounding was added would
      // still be full-precision on disk - normalize on every load so an old
      // cache gets the same payload-size win without needing to be deleted.
      // No-op (cheap) once the cache is already rounded.
      geojson.features = (geojson.features || []).map((f: BoundaryFeature) => ({
        ...f,
        geometry: roundGeometry(f.geometry)
      }));

      this.layers[layerName] = (geojson.features || []).map((f: BoundaryFeature) => {
        const bbox = this.computeBBox(f.geometry);
        const area_km2 = parseFloat(calculateFeatureAreaKm2(f.geometry).toFixed(2));

        // Add specific metadata if it's villages
        if (layerName === 'villages') {
          const seed = f.properties.FID || 1;
          const connRate = Math.floor(62 + (seed % 34)); // 62% to 95% electrical connection rate
          const peakLoad = parseFloat((0.2 + (seed % 18) * 0.12).toFixed(2)); // 0.2 MW to 2.36 MW
          const status = seed % 45 === 0 ? 'alert' : 'stable';

          return {
            ...f,
            properties: {
              ...f.properties,
              area_km2,
              connection_rate: connRate,
              peak_load_mw: peakLoad,
              status
            },
            bbox
          };
        }

        return {
          ...f,
          properties: {
            ...f.properties,
            area_km2
          },
          bbox
        };
      });

      console.log(
        `SpatialStore: Loaded ${this.layers[layerName].length} features for ${layerName} in ${(Date.now() - startTime) / 1000}s`
      );
      this.loadedLayers[layerName] = true;
    } catch (err) {
      console.error(`SpatialStore: Failed to load layer ${layerName}`, err);
      throw err;
    }
  }

  private computeBBox(geometry: BoundaryGeometry): [number, number, number, number] {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    const traverse = (coords: unknown) => {
      if (Array.isArray(coords) && typeof coords[0] === 'number') {
        const [lng, lat] = coords;
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      } else if (Array.isArray(coords)) {
        coords.forEach(traverse);
      }
    };

    if (geometry && geometry.coordinates) {
      traverse(geometry.coordinates);
    }

    return [
      minLng === Infinity ? 28.8 : minLng,
      minLat === Infinity ? -2.9 : minLat,
      maxLng === -Infinity ? 30.9 : maxLng,
      maxLat === -Infinity ? -1.0 : maxLat
    ];
  }

  // Viewport query for specific layer
  public async queryViewport(
    layerName: string,
    minLng: number,
    minLat: number,
    maxLng: number,
    maxLat: number
  ): Promise<BoundaryFeature[]> {
    await this.loadLayerIfNeeded(layerName);
    const features = this.layers[layerName];

    return features.filter((f) => {
      if (!f.bbox) return false;
      const [fMinLng, fMinLat, fMaxLng, fMaxLat] = f.bbox;
      return fMinLng <= maxLng && fMaxLng >= minLng && fMinLat <= maxLat && fMaxLat >= minLat;
    });
  }

  // Custom ray-casting Point-in-Polygon check
  private isPointInPolygon(point: GeoJSON.Position, vs: GeoJSON.Position[]) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0],
        yi = vs[i][1];
      const xj = vs[j][0],
        yj = vs[j][1];

      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private checkPolygon(point: GeoJSON.Position, rings: GeoJSON.Position[][]): boolean {
    if (rings.length === 0) return false;
    const outerRing = rings[0];
    if (!this.isPointInPolygon(point, outerRing)) return false;

    // Check if it is inside any holes
    for (let i = 1; i < rings.length; i++) {
      if (this.isPointInPolygon(point, rings[i])) {
        return false;
      }
    }
    return true;
  }

  private isPointInBoundary(point: GeoJSON.Position, feature: BoundaryFeature): boolean {
    const geom = feature.geometry;
    if (!geom) return false;

    // Fast bbox boundary check first
    if (feature.bbox) {
      const [minLng, minLat, maxLng, maxLat] = feature.bbox;
      if (point[0] < minLng || point[0] > maxLng || point[1] < minLat || point[1] > maxLat) {
        return false;
      }
    }

    if (geom.type === 'Polygon') {
      return this.checkPolygon(point, geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      return geom.coordinates.some((poly: GeoJSON.Position[][]) => this.checkPolygon(point, poly));
    }
    return false;
  }

  // Hierarchical top-down coordinate lookup (Province -> District -> Sector -> Cell -> Village)
  public async queryCoordinate(lng: number, lat: number) {
    const point: GeoJSON.Position = [lng, lat];

    // Load all layers for complete lookup
    await this.loadLayerIfNeeded('provinces');
    await this.loadLayerIfNeeded('districts');
    await this.loadLayerIfNeeded('sectors');
    await this.loadLayerIfNeeded('cells');
    await this.loadLayerIfNeeded('villages');

    const result: {
      province?: string;
      province_id?: string;
      district?: string;
      district_id?: string;
      sector?: string;
      sector_id?: string;
      cell?: string;
      cell_id?: string;
      village?: string;
      village_id?: string;
      connection_rate?: number;
      peak_load_mw?: number;
      status?: string;
      area_km2?: number;
    } = {};

    // 1. Find Province (5 features)
    const provinceFeature = this.layers.provinces.find((f) => this.isPointInBoundary(point, f));
    if (!provinceFeature) return null; // Outside Rwanda
    result.province = provinceFeature.properties.province;
    result.province_id = String(provinceFeature.properties.FID);
    result.area_km2 = provinceFeature.properties.area_km2;

    // 2. Find District in Province (Looping ~5-8 districts)
    const districtFeature = this.layers.districts
      .filter((f) => f.properties.province === result.province)
      .find((f) => this.isPointInBoundary(point, f));
    if (!districtFeature) return result;
    result.district = districtFeature.properties.district;
    result.district_id = districtFeature.properties.district_i;
    result.area_km2 = districtFeature.properties.area_km2;

    // 3. Find Sector in District (Looping ~10-15 sectors)
    const sectorFeature = this.layers.sectors
      .filter((f) => f.properties.district === result.district)
      .find((f) => this.isPointInBoundary(point, f));
    if (!sectorFeature) return result;
    result.sector = sectorFeature.properties.sector;
    result.sector_id = sectorFeature.properties.sector_id;
    result.area_km2 = sectorFeature.properties.area_km2;

    // 4. Find Cell in Sector (Looping ~4-6 cells)
    const cellFeature = this.layers.cells
      .filter((f) => f.properties.sector_id === result.sector_id)
      .find((f) => this.isPointInBoundary(point, f));
    if (!cellFeature) return result;
    result.cell = cellFeature.properties.cell;
    result.cell_id = cellFeature.properties.cell_id;
    result.area_km2 = cellFeature.properties.area_km2;

    // 5. Find Village in Cell (Looping ~5-10 villages)
    const villageFeature = this.layers.villages
      .filter((f) => f.properties.cell_id === result.cell_id)
      .find((f) => this.isPointInBoundary(point, f));
    if (!villageFeature) return result;
    result.village = villageFeature.properties.village;
    result.village_id = villageFeature.properties.village_id;
    result.connection_rate = villageFeature.properties.connection_rate;
    result.peak_load_mw = villageFeature.properties.peak_load_mw;
    result.status = villageFeature.properties.status;
    result.area_km2 = villageFeature.properties.area_km2;

    return result;
  }

  // A point guaranteed to lie inside the feature (unlike its bbox center,
  // which can fall outside a concave boundary): scan a horizontal line through
  // the middle of the largest ring's bbox and take the midpoint of the widest
  // inside span. Callers resolve hierarchy/geometry from this point.
  private interiorPoint(feature: BoundaryFeature): GeoJSON.Position | null {
    const polygons: GeoJSON.Position[][][] =
      feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    let best: GeoJSON.Position | null = null;
    let bestWidth = -1;

    for (const rings of polygons) {
      const outer = rings[0];
      if (!outer || outer.length < 4) continue;
      let minLat = Infinity;
      let maxLat = -Infinity;
      for (const [, y] of outer) {
        if (y < minLat) minLat = y;
        if (y > maxLat) maxLat = y;
      }
      const y = (minLat + maxLat) / 2;

      const xs: number[] = [];
      for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i];
          const [xj, yj] = ring[j];
          if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const width = xs[k + 1] - xs[k];
        if (width > bestWidth) {
          bestWidth = width;
          best = [(xs[k] + xs[k + 1]) / 2, y];
        }
      }
    }
    return best;
  }

  // The single feature of one tier containing a point - geometry included -
  // so the client can fit/mask a specific ancestor (breadcrumb navigation,
  // restoring a shared selection) without fetching a whole viewport.
  public async findFeatureAt(layerName: string, lng: number, lat: number): Promise<BoundaryFeature | null> {
    await this.loadLayerIfNeeded(layerName);
    const point: GeoJSON.Position = [lng, lat];
    return this.layers[layerName].find((f) => this.isPointInBoundary(point, f)) || null;
  }

  // Name search across every administrative level (village down to province).
  // Each layer's features already carry their full ancestor chain (a village
  // feature has province/district/sector/cell names on it directly), so a
  // single pass per layer is enough - no cross-layer joins needed.
  public async searchByName(query: string, limit = 8) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    await this.loadLayerIfNeeded('provinces');
    await this.loadLayerIfNeeded('districts');
    await this.loadLayerIfNeeded('sectors');
    await this.loadLayerIfNeeded('cells');
    await this.loadLayerIfNeeded('villages');

    const levels: { layer: string; field: string }[] = [
      { layer: 'villages', field: 'village' },
      { layer: 'cells', field: 'cell' },
      { layer: 'sectors', field: 'sector' },
      { layer: 'districts', field: 'district' },
      { layer: 'provinces', field: 'province' }
    ];

    const results: {
      level: string;
      label: string;
      province?: string;
      district?: string;
      sector?: string;
      cell?: string;
      village?: string;
      area_km2?: number;
      lat: number;
      lng: number;
      // [minLng, minLat, maxLng, maxLat] - lets the map fit the shape's real
      // extent instead of flying to a point at a fixed zoom (a province and a
      // village need very different zoom levels to look right on screen).
      bounds: [number, number, number, number];
    }[] = [];

    for (const { layer, field } of levels) {
      for (const feature of this.layers[layer]) {
        const name = feature.properties[field];
        if (typeof name !== 'string' || !name.toLowerCase().includes(q)) continue;

        const bbox = feature.bbox;
        const [minLng, minLat, maxLng, maxLat] = bbox || [28.8, -2.9, 30.9, -1.0];
        const [lng, lat] = this.interiorPoint(feature) ?? [(minLng + maxLng) / 2, (minLat + maxLat) / 2];

        results.push({
          level: layer.slice(0, -1),
          label: name,
          province: feature.properties.province,
          district: feature.properties.district,
          sector: feature.properties.sector,
          cell: feature.properties.cell,
          village: feature.properties.village,
          area_km2: feature.properties.area_km2,
          lat,
          lng,
          bounds: [minLng, minLat, maxLng, maxLat]
        });
      }
    }

    // Exact, then prefix, then substring matches; within each, coarser tiers
    // first (a sector named "Kacyiru" outranks the villages sharing the name).
    // Each tier is capped so a common name can't fill the list with villages.
    const tierRank = ['province', 'district', 'sector', 'cell', 'village'];
    const matchRank = (label: string) => {
      const l = label.toLowerCase();
      return l === q ? 0 : l.startsWith(q) ? 1 : 2;
    };
    results.sort(
      (a, b) => matchRank(a.label) - matchRank(b.label) || tierRank.indexOf(a.level) - tierRank.indexOf(b.level)
    );

    const perTierCap = Math.max(3, Math.ceil(limit / 3));
    const perTier: Record<string, number> = {};
    const picked = results.filter((r) => (perTier[r.level] = (perTier[r.level] || 0) + 1) <= perTierCap);
    return picked.slice(0, limit);
  }
}

// One store per server process: shared across hot-reloads in development, and
// between instrumentation.ts (which warms it at startup) and the route
// handlers in production, which may be separate module instances
const globalForSpatial = global as unknown as { spatialStore?: SpatialStore };
export const spatialStore = (globalForSpatial.spatialStore ??= new SpatialStore());

// Loads every layer and builds its tile index ahead of the first request, so
// no visitor pays the multi-second parse (villages alone: ~1.5s). Coarse tiers
// first - they're what the first screen shows.
export async function warmSpatialStore() {
  const start = Date.now();
  for (const layer of ['country', 'provinces', 'districts', 'sectors', 'cells', 'villages']) {
    await spatialStore.getTileIndex(layer);
  }
  console.log(`SpatialStore: warmed all layers in ${(Date.now() - start) / 1000}s`);
}
