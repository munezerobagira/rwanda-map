import { CASING, HIGHLIGHT_COLOR } from './adminLevels';
import type { BoundaryGeometry } from './selection';

// Pure layout shared by map PNG captions; never shrink source/date text to fit.
export function wrapExportLines(lines: string[], maxWidth: number, measure: (text: string) => number): string[] {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) throw new Error('Export text width must be positive.');
  const output: string[] = [];
  for (const line of lines) {
    if (!line) {
      output.push('');
      continue;
    }
    let current = '';
    for (const word of line.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        output.push(current);
        current = '';
      }
      if (measure(word) <= maxWidth) {
        current = word;
        continue;
      }
      // Long IDs/URLs must wrap too, without dropping any characters.
      for (const character of word) {
        if (current && measure(current + character) > maxWidth) {
          output.push(current);
          current = '';
        }
        current += character;
      }
    }
    if (current) output.push(current);
  }
  return output;
}

export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface CaptureTile {
  image: CanvasImageSource;
  rect: CaptureRect;
  sideB?: boolean;
}
export interface MapCapture {
  viewport: CaptureRect;
  crop: CaptureRect;
  scale: number;
  geometry: BoundaryGeometry | null | undefined;
  cutout: boolean;
  project: (coordinate: GeoJSON.Position) => { x: number; y: number };
  Path?: typeof Path2D;
  swipe?: number;
  basemapTiles: CaptureTile[];
  boundaryTiles: CaptureTile[];
  footprints?: { geometry: BoundaryGeometry; color: string }[];
  points: { position: GeoJSON.Position; color: string }[];
}
// The existing map/cutout renderer, isolated so geometry/alpha/swipe contracts
// can be regression-tested without a browser or any remote imagery.
export function drawMapCapture(ctx: CanvasRenderingContext2D, options: MapCapture) {
  const { crop, viewport, project, geometry } = options;
  const Path = options.Path ?? Path2D;
  let focus: Path2D | null = null;
  if (geometry) {
    focus = new Path();
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons)
      for (const ring of polygon) {
        ring.forEach((coordinate, index) => {
          const p = project(coordinate);
          if (index === 0) focus!.moveTo(p.x, p.y);
          else focus!.lineTo(p.x, p.y);
        });
        focus.closePath();
      }
  }
  const clip = options.cutout ? focus : null;
  ctx.save();
  ctx.scale(options.scale, options.scale);
  ctx.translate(-crop.x, -crop.y);
  const draw = (tile: CaptureTile, withSwipe: boolean) => {
    ctx.save();
    try {
      if (clip) ctx.clip(clip, 'evenodd');
      if (withSwipe && tile.sideB && options.swipe !== undefined) {
        ctx.beginPath();
        ctx.rect((viewport.width * options.swipe) / 100, 0, viewport.width, viewport.height);
        ctx.clip();
      }
      const r = tile.rect;
      if (r.width && r.height) ctx.drawImage(tile.image, r.x, r.y, r.width, r.height);
    } finally {
      ctx.restore();
    }
  };
  try {
    for (const tile of options.basemapTiles) draw(tile, true);
    for (const tile of options.boundaryTiles) draw(tile, false);
    if (focus) {
      if (!clip) {
        const dim = new Path();
        dim.rect(crop.x, crop.y, crop.width, crop.height);
        dim.addPath(focus);
        ctx.fillStyle = 'rgba(9,13,22,0.55)';
        ctx.fill(dim, 'evenodd');
      }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = CASING.color;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 6;
      ctx.stroke(focus);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = HIGHLIGHT_COLOR;
      ctx.lineWidth = 2.5;
      ctx.stroke(focus);
    }
    ctx.save();
    if (clip) ctx.clip(clip, 'evenodd');
    for (const { geometry: footprint, color } of options.footprints ?? []) {
      const path = new Path();
      const polygons = footprint.type === 'Polygon' ? [footprint.coordinates] : footprint.coordinates;
      for (const polygon of polygons) for (const ring of polygon) {
        ring.forEach((coordinate, i) => { const p = project(coordinate); if (i) path.lineTo(p.x, p.y); else path.moveTo(p.x, p.y); });
        path.closePath();
      }
      ctx.globalAlpha = 0.12; ctx.fillStyle = color; ctx.fill(path, 'evenodd');
      ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke(path);
    }
    for (const point of options.points) {
      const p = project(point.position);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = point.color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
    }
    ctx.restore();
  } finally {
    ctx.restore();
  }
}
export function attachExportFooter(
  body: HTMLCanvasElement,
  scale: number,
  lines: string[],
  createCanvas = () => document.createElement('canvas')
) {
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid export scale.');
  const bodyWidth = body.width / scale,
    bodyHeight = body.height / scale;
  const width = Math.max(480, bodyWidth);
  const canvas = createCanvas();
  canvas.width = Math.ceil(width * scale);
  const bodyOffsetPixels = Math.floor((canvas.width - body.width) / 2),
    bodyOffsetX = bodyOffsetPixels / scale;
  let ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.font = '11px sans-serif';
  const wrapped = wrapExportLines(lines, width - 16, (text) => ctx!.measureText(text).width);
  const footerHeight = 16 + wrapped.length * 15;
  canvas.height = Math.ceil((bodyHeight + footerHeight) * scale);
  ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.drawImage(body, bodyOffsetPixels, 0);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, bodyHeight, width, footerHeight);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = '11px sans-serif';
  wrapped.forEach((line, index) => ctx!.fillText(line, 8, bodyHeight + 15 + index * 15));
  return { canvas, lines: wrapped, bodyOffsetX, bodyOffsetPixels, footerHeight };
}
export function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))), 'image/png')
  );
}

export interface CaptureView {
  revision: number;
  lat: number;
  lng: number;
  zoom: number;
  width: number;
  height: number;
}
export function captureMatches(a: CaptureView, b: CaptureView): boolean {
  return (
    a.revision === b.revision &&
    Math.abs(a.lat - b.lat) < 1e-8 &&
    Math.abs(a.lng - b.lng) < 1e-8 &&
    Math.abs(a.zoom - b.zoom) < 1e-8 &&
    a.width === b.width &&
    a.height === b.height
  );
}
