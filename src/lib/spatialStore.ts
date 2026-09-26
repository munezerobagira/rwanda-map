import fs from 'fs';
import path from 'path';

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
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
}

const LAYER_FILES: Record<string, string> = {
  provinces: 'Province_Boundary_4676559859435530581.geojson',
  districts: 'district_boundary_-3032280129748906159.geojson',
  sectors: 'sector_boundary_-5923869450411707723.geojson',
  cells: 'cell_boundary_-8868604078708118700.geojson',
  villages: 'village_boundary_-3842883156168712087.geojson'
};

const SIMPLIFIED_FILES: Record<string, string> = {
  provinces: 'provinces.simplified.geojson',
  districts: 'districts.simplified.geojson',
  sectors: 'sectors.simplified.geojson',
  cells: 'cells.simplified.geojson',
  villages: 'villages.simplified.geojson'
};

const SIMPLIFICATION_TOLERANCES: Record<string, number> = {
  provinces: 0.001,   // ~110m resolution
  districts: 0.0005,  // ~55m resolution
  sectors: 0.0002,    // ~22m resolution
  cells: 0.0001,      // ~11m resolution
  villages: 0.0001    // ~11m resolution
};

// -------------------------------------------------------------
// DOUGLAS-PEUCKER SIMPLIFICATION ALGORITHM HELPERS
// -------------------------------------------------------------

function getSqSegDist(p: [number, number], p1: [number, number], p2: [number, number]): number {
  let x = p1[0];
  let y = p1[1];
  let dx = p2[0] - x;
  let dy = p2[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = p2[0];
      y = p2[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplifyDPStep(points: [number, number][], first: number, last: number, sqTolerance: number, simplified: [number, number][]) {
  let maxSqDist = sqTolerance;
  let index = -1;

  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], points[first], points[last]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (index !== -1) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
}

function simplifyPoints(points: [number, number][], sqTolerance: number): [number, number][] {
  if (points.length <= 2) return points;
  const simplified: [number, number][] = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified);
  simplified.push(points[points.length - 1]);
  return simplified;
}

function simplifyRing(ring: [number, number][], sqTolerance: number): [number, number][] {
  const simplified = simplifyPoints(ring, sqTolerance);
  if (simplified.length < 4) {
    if (ring.length >= 4) {
      return [ring[0], ring[Math.floor(ring.length / 3)], ring[Math.floor(2 * ring.length / 3)], ring[0]];
    }
    return ring;
  }
  return simplified;
}

function simplifyGeometry(geom: any, sqTolerance: number) {
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring: any) => simplifyRing(ring, sqTolerance))
    };
  } else if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly: any) => 
        poly.map((ring: any) => simplifyRing(ring, sqTolerance))
      )
    };
  }
  return geom;
}

// Every coordinate here comes out of JS's float64 (~17 significant digits),
// which is absurd precision for an admin boundary - 6 decimal places is
// already ~11cm on the ground. That excess precision is most of what makes
// these payloads slow to fetch and parse: rounding it away (measured on the
// villages layer) cuts the raw JSON by a third and, because gzip/brotli
// compress short repeating decimals far better than near-random float
// tails, roughly halves the *compressed* size on top of that.
function roundCoord(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function roundGeometry(geom: any): any {
  if (!geom) return geom;
  const roundRing = (ring: [number, number][]) => ring.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)]);
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map(roundRing) };
  } else if (geom.type === 'MultiPolygon') {
    return { type: 'MultiPolygon', coordinates: geom.coordinates.map((poly: any) => poly.map(roundRing)) };
  }
  return geom;
}

// Helper to calculate area of polygon or multipolygon in sq km
function calculateFeatureAreaKm2(geometry: any): number {
  if (!geometry) return 0;
  
  const degToKmY = 110.574;
  const degToKmX = 111.320 * Math.cos((-1.9403 * Math.PI) / 180);

  const getRingArea = (ring: [number, number][]) => {
    let area = 0;
    const n = ring.length;
    if (n < 3) return 0;
    for (let i = 0; i < n; i++) {
      const p1 = ring[i];
      const p2 = ring[(i + 1) % n];
      const x1 = p1[0] * degToKmX;
      const y1 = p1[1] * degToKmY;
      const x2 = p2[0] * degToKmX;
      const y2 = p2[1] * degToKmY;
      area += (x1 * y2 - x2 * y1);
    }
    return Math.abs(area) / 2;
  };

  const getPolygonArea = (polyCoords: [number, number][][]) => {
    if (polyCoords.length === 0) return 0;
    let outerArea = getRingArea(polyCoords[0]);
    for (let i = 1; i < polyCoords.length; i++) {
      outerArea -= getRingArea(polyCoords[i]);
    }
    return outerArea;
  };

  if (geometry.type === 'Polygon') {
    return getPolygonArea(geometry.coordinates);
  } else if (geometry.type === 'MultiPolygon') {
    let totalArea = 0;
    for (const poly of geometry.coordinates) {
      totalArea += getPolygonArea(poly);
    }
    return totalArea;
  }
  return 0;
}

class SpatialStore {
  private layers: Record<string, BoundaryFeature[]> = {
    provinces: [],
    districts: [],
    sectors: [],
    cells: [],
    villages: []
  };

  private loadedLayers: Record<string, boolean> = {
    provinces: false,
    districts: false,
    sectors: false,
    cells: false,
    villages: false
  };

  constructor() {}

  public async loadLayerIfNeeded(layerName: string) {
    if (!LAYER_FILES[layerName]) {
      throw new Error(`Unknown layer: ${layerName}`);
    }

    if (this.loadedLayers[layerName]) {
      // Self-healing: if the layer was loaded but has no area_km2 computed, force a reload
      const features = this.layers[layerName];
      if (features && features.length > 0 && features[0].properties && typeof features[0].properties.area_km2 === 'number') {
        return;
      }
      console.log(`SpatialStore: Forcing memory reload of ${layerName} to calculate area_km2...`);
      this.loadedLayers[layerName] = false;
    }

    try {
      const publicDataDir = path.join(process.cwd(), 'public', 'data');
      const simplifiedPath = path.join(publicDataDir, SIMPLIFIED_FILES[layerName]);
      const originalPath = path.join(publicDataDir, LAYER_FILES[layerName]);
      
      let geojson: any;
      const startTime = Date.now();

      if (fs.existsSync(simplifiedPath)) {
        console.log(`SpatialStore: Loading pre-simplified ${layerName} layer from ${simplifiedPath}...`);
        const fileData = fs.readFileSync(simplifiedPath, 'utf8');
        geojson = JSON.parse(fileData);
      } else {
        console.log(`SpatialStore: Simplified layer not found for "${layerName}". Generating simplified version from ${originalPath}...`);
        if (!fs.existsSync(originalPath)) {
          throw new Error(`Original boundary file not found at ${originalPath}`);
        }
        
        const fileData = fs.readFileSync(originalPath, 'utf8');
        const originalGeojson = JSON.parse(fileData);
        
        // Simplify in-memory
        const tolerance = SIMPLIFICATION_TOLERANCES[layerName];
        const sqTolerance = tolerance * tolerance;
        
        const simplifiedFeatures = originalGeojson.features.map((f: any) => ({
          ...f,
          geometry: roundGeometry(simplifyGeometry(f.geometry, sqTolerance))
        }));

        geojson = {
          ...originalGeojson,
          features: simplifiedFeatures
        };

        // Cache simplified layer to disk
        try {
          fs.writeFileSync(simplifiedPath, JSON.stringify(geojson), 'utf8');
          console.log(`SpatialStore: Saved simplified ${layerName} to disk`);
        } catch (writeErr) {
          console.error(`SpatialStore: Failed to save simplified ${layerName} to disk`, writeErr);
        }
      }

      // A simplified cache written before coordinate rounding was added would
      // still be full-precision on disk - normalize on every load so an old
      // cache gets the same payload-size win without needing to be deleted.
      // No-op (cheap) once the cache is already rounded.
      geojson.features = (geojson.features || []).map((f: any) => ({
        ...f,
        geometry: roundGeometry(f.geometry)
      }));

      this.layers[layerName] = (geojson.features || []).map((f: any) => {
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

      console.log(`SpatialStore: Loaded ${this.layers[layerName].length} features for ${layerName} in ${(Date.now() - startTime) / 1000}s`);
      this.loadedLayers[layerName] = true;
    } catch (err) {
      console.error(`SpatialStore: Failed to load layer ${layerName}`, err);
      throw err;
    }
  }

  private computeBBox(geometry: any): [number, number, number, number] {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

    const traverse = (coords: any) => {
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

    return features.filter(f => {
      if (!f.bbox) return false;
      const [fMinLng, fMinLat, fMaxLng, fMaxLat] = f.bbox;
      return (
        fMinLng <= maxLng &&
        fMaxLng >= minLng &&
        fMinLat <= maxLat &&
        fMaxLat >= minLat
      );
    });
  }

  // Custom ray-casting Point-in-Polygon check
  private isPointInPolygon(point: [number, number], vs: [number, number][]) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][0], yi = vs[i][1];
      const xj = vs[j][0], yj = vs[j][1];

      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private checkPolygon(point: [number, number], rings: [number, number][][]): boolean {
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

  private isPointInBoundary(point: [number, number], feature: BoundaryFeature): boolean {
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
      return geom.coordinates.some((poly: any) => this.checkPolygon(point, poly));
    }
    return false;
  }

  // Hierarchical top-down coordinate lookup (Province -> District -> Sector -> Cell -> Village)
  public async queryCoordinate(lng: number, lat: number) {
    const point: [number, number] = [lng, lat];

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
    const provinceFeature = this.layers.provinces.find(f => this.isPointInBoundary(point, f));
    if (!provinceFeature) return null; // Outside Rwanda
    result.province = provinceFeature.properties.province;
    result.province_id = String(provinceFeature.properties.FID);
    result.area_km2 = provinceFeature.properties.area_km2;

    // 2. Find District in Province (Looping ~5-8 districts)
    const districtFeature = this.layers.districts
      .filter(f => f.properties.province === result.province)
      .find(f => this.isPointInBoundary(point, f));
    if (!districtFeature) return result;
    result.district = districtFeature.properties.district;
    result.district_id = districtFeature.properties.district_i;
    result.area_km2 = districtFeature.properties.area_km2;

    // 3. Find Sector in District (Looping ~10-15 sectors)
    const sectorFeature = this.layers.sectors
      .filter(f => f.properties.district === result.district)
      .find(f => this.isPointInBoundary(point, f));
    if (!sectorFeature) return result;
    result.sector = sectorFeature.properties.sector;
    result.sector_id = sectorFeature.properties.sector_id;
    result.area_km2 = sectorFeature.properties.area_km2;

    // 4. Find Cell in Sector (Looping ~4-6 cells)
    const cellFeature = this.layers.cells
      .filter(f => f.properties.sector_id === result.sector_id)
      .find(f => this.isPointInBoundary(point, f));
    if (!cellFeature) return result;
    result.cell = cellFeature.properties.cell;
    result.cell_id = cellFeature.properties.cell_id;
    result.area_km2 = cellFeature.properties.area_km2;

    // 5. Find Village in Cell (Looping ~5-10 villages)
    const villageFeature = this.layers.villages
      .filter(f => f.properties.cell_id === result.cell_id)
      .find(f => this.isPointInBoundary(point, f));
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
  private interiorPoint(feature: BoundaryFeature): [number, number] | null {
    const polygons: [number, number][][][] =
      feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    let best: [number, number] | null = null;
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
          if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
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
    const point: [number, number] = [lng, lat];
    return this.layers[layerName].find(f => this.isPointInBoundary(point, f)) || null;
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

// Ensure the store is persistent across hot-reloads during local development
const globalForSpatial = global as unknown as { spatialStore: SpatialStore };
export const spatialStore = globalForSpatial.spatialStore || new SpatialStore();
if (process.env.NODE_ENV !== 'production') globalForSpatial.spatialStore = spatialStore;
