// Shared pure boundary processing; web runtime never loads original inputs.
type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;

function getSqSegDist(p: GeoJSON.Position, p1: GeoJSON.Position, p2: GeoJSON.Position): number {
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

function simplifyDPStep(
  points: GeoJSON.Position[],
  first: number,
  last: number,
  sqTolerance: number,
  simplified: GeoJSON.Position[]
) {
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

function simplifyPoints(points: GeoJSON.Position[], sqTolerance: number): GeoJSON.Position[] {
  if (points.length <= 2) return points;
  const simplified: GeoJSON.Position[] = [points[0]];
  simplifyDPStep(points, 0, points.length - 1, sqTolerance, simplified);
  simplified.push(points[points.length - 1]);
  return simplified;
}

function simplifyRing(ring: GeoJSON.Position[], sqTolerance: number): GeoJSON.Position[] {
  const simplified = simplifyPoints(ring, sqTolerance);
  if (simplified.length < 4) {
    if (ring.length >= 4) {
      return [ring[0], ring[Math.floor(ring.length / 3)], ring[Math.floor((2 * ring.length) / 3)], ring[0]];
    }
    return ring;
  }
  return simplified;
}

export function simplifyGeometry(geom: BoundaryGeometry, sqTolerance: number): BoundaryGeometry {
  if (geom.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geom.coordinates.map((ring: GeoJSON.Position[]) => simplifyRing(ring, sqTolerance))
    };
  } else if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly: GeoJSON.Position[][]) =>
        poly.map((ring: GeoJSON.Position[]) => simplifyRing(ring, sqTolerance))
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

export function roundGeometry(geom: BoundaryGeometry): BoundaryGeometry {
  if (!geom) return geom;
  const roundRing = (ring: GeoJSON.Position[]) => ring.map(([lng, lat]) => [roundCoord(lng), roundCoord(lat)]);
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geom.coordinates.map(roundRing) };
  } else if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geom.coordinates.map((poly: GeoJSON.Position[][]) => poly.map(roundRing))
    };
  }
  return geom;
}

// Helper to calculate area of polygon or multipolygon in sq km
export function calculateFeatureAreaKm2(geometry: BoundaryGeometry): number {
  if (!geometry) return 0;

  const degToKmY = 110.574;
  const degToKmX = 111.32 * Math.cos((-1.9403 * Math.PI) / 180);

  const getRingArea = (ring: GeoJSON.Position[]) => {
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
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area) / 2;
  };

  const getPolygonArea = (polyCoords: GeoJSON.Position[][]) => {
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
