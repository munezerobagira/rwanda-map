// Generates the Rwanda Map brand icons from the real national boundary in
// public/data, so the silhouette is geographically accurate and the output is
// a few KB of true vector paths.
//
//   node scripts/generate-logo.mjs
//
// Writes:
//   public/brand/logo.svg       full icon (silhouette + pin + hills)
//   public/brand/logo-mark.svg  simplified mark for small sizes / the header
//   src/app/icon.svg            favicon (same as logo-mark)

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// Brand palette - the blues from src/app/globals.css
const BRAND = '#2563EB'; // --brand-primary
const BRAND_DEEP = '#1D4ED8';
const SKY = '#38BDF8'; // sector-tier sky blue
const LIGHT = '#F8FAFC'; // --text-primary

const SIZE = 512;
const RADIUS = 112;

// ---------------------------------------------------------------
// Boundary -> simplified outer ring
// ---------------------------------------------------------------
const geo = JSON.parse(fs.readFileSync(path.join(root, 'public/data/country boundary.geojson'), 'utf8'));
const rings = [];
for (const f of geo.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polys) rings.push(p[0]);
}
// Largest ring only - tiny islands vanish at icon size anyway
const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));

// Equirectangular with cos(lat) correction - accurate at Rwanda's latitude
const lat0 = (-2.0 * Math.PI) / 180;
const projected = ring.map(([lng, lat]) => [lng * Math.cos(lat0), -lat]);

function sqSegDist(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) [x, y] = b;
    else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

function simplify(points, tolerance) {
  const sq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = sq;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = sqSegDist(points[i], points[first], points[last]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx !== -1) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// Fits the silhouette into a box and returns its path plus the transform, so
// the pin can be placed in the same coordinate space.
function silhouette(box, tolerance) {
  const pts = simplify(projected, tolerance);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const k = Math.min(box.w / (maxX - minX), box.h / (maxY - minY));
  const w = (maxX - minX) * k;
  const h = (maxY - minY) * k;
  const ox = box.x + (box.w - w) / 2;
  const oy = box.y + (box.h - h) / 2;
  const d =
    pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(ox + (x - minX) * k).toFixed(1)} ${(oy + (y - minY) * k).toFixed(1)}`).join('') + 'Z';
  return { d, points: pts.length, x: ox, y: oy, w, h };
}

// Teardrop map pin: circle of radius r at (cx, cy), tip at distance `tip` below
function pin(cx, cy, r, tip) {
  const px = r * Math.sqrt(1 - (r * r) / (tip * tip));
  const py = (r * r) / tip;
  const f = (n) => n.toFixed(1);
  return `M${f(cx)} ${f(cy + tip)}L${f(cx - px)} ${f(cy + py)}A${r} ${r} 0 1 1 ${f(cx + px)} ${f(cy + py)}Z`;
}

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Rwanda Map">
<title>Rwanda Map</title>
<defs><clipPath id="tile"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}"/></clipPath></defs>
<g clip-path="url(#tile)">
<rect width="${SIZE}" height="${SIZE}" fill="${BRAND}"/>
${body}
</g>
</svg>
`;
}

function pinOn(s, scale) {
  // Slightly left of and above center - Rwanda's widest, most solid area
  const cx = s.x + s.w * 0.47;
  const r = s.w * scale;
  const cy = s.y + s.h * 0.4;
  return `<path d="${pin(cx, cy, r, r * 2.3)}" fill="${BRAND}"/>
<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 0.42).toFixed(1)}" fill="${LIGHT}"/>`;
}

// Full logo: silhouette in the upper area, rolling hills across the bottom
const full = silhouette({ x: 96, y: 60, w: 320, h: 300 }, 0.004);
const hills = `<path d="M0 388C96 356 176 380 256 404S416 420 512 356V512H0Z" fill="${BRAND_DEEP}"/>
<path d="M0 420C96 392 176 412 256 436S416 452 512 392V412C416 470 336 460 256 456S96 424 0 440Z" fill="${SKY}"/>`;
const fullSvg = svg(`<path d="${full.d}" fill="${LIGHT}" stroke-linejoin="round"/>
${pinOn(full, 0.13)}
${hills}`);

// Mark: bigger silhouette, coarser outline, no hills - legible at 16-32px
const mark = silhouette({ x: 72, y: 72, w: 368, h: 368 }, 0.012);
const markSvg = svg(`<path d="${mark.d}" fill="${LIGHT}" stroke-linejoin="round"/>
${pinOn(mark, 0.14)}`);

fs.mkdirSync(path.join(root, 'public/brand'), { recursive: true });
fs.writeFileSync(path.join(root, 'public/brand/logo.svg'), fullSvg);
fs.writeFileSync(path.join(root, 'public/brand/logo-mark.svg'), markSvg);
fs.writeFileSync(path.join(root, 'src/app/icon.svg'), markSvg);

console.log(`logo.svg: ${full.points} pts, ${fullSvg.length} bytes`);
console.log(`logo-mark.svg: ${mark.points} pts, ${markSvg.length} bytes`);
