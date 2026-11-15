import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCanvas, Path2D as NativePath, type Canvas } from '@napi-rs/canvas';
import { drawMapCapture, attachExportFooter, wrapExportLines, captureMatches } from '../src/lib/imageExport';
import { maskLatLngs } from '../src/lib/selection';
import { pointInGeometry } from '../src/lib/analysis/geometry';
import { translate } from '../src/lib/i18n';
const Path = NativePath as unknown as typeof Path2D;
const image = (color: string) => {
  const canvas = createCanvas(64, 64);
  const c = canvas.getContext('2d');
  c.fillStyle = color;
  c.fillRect(0, 0, 64, 64);
  return canvas;
};
const geometry: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [8, 8],
      [56, 8],
      [56, 56],
      [8, 56],
      [8, 8]
    ],
    [
      [24, 24],
      [40, 24],
      [40, 40],
      [24, 40],
      [24, 24]
    ]
  ]
};
const rect = { x: 0, y: 0, width: 64, height: 64 };
const tile = (canvas: Canvas, sideB = false) => ({ image: canvas as unknown as CanvasImageSource, rect, sideB });
const project = ([x, y]: GeoJSON.Position) => ({ x, y });
const pixel = (canvas: Canvas, x: number, y: number) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data];

test('selected PNG rendering retains transparent surroundings/holes and worker boundary snapshots', () => {
  const canvas = createCanvas(64, 64),
    boundary = createCanvas(64, 64),
    context = boundary.getContext('2d');
  context.fillStyle = '#00ff00';
  context.fillRect(44, 44, 4, 4);
  drawMapCapture(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, {
    viewport: rect,
    crop: rect,
    scale: 1,
    geometry,
    cutout: true,
    project,
    Path,
    basemapTiles: [tile(image('#ff0000'))],
    boundaryTiles: [tile(boundary)],
    points: [{ position: [32, 32], color: '#00ff00' }]
  });
  assert.equal(pixel(canvas, 0, 0)[3], 0, 'cutout surroundings stay transparent');
  assert.equal(pixel(canvas, 32, 32)[3], 0, 'holes stay transparent, including clipped analysis points');
  assert.deepEqual(pixel(canvas, 16, 16), [255, 0, 0, 255]);
  assert.deepEqual(pixel(canvas, 45, 45), [0, 255, 0, 255]);
});

test('full-view PNG dims outside selection and hole interiors without dimming the selected surface', () => {
  const canvas = createCanvas(64, 64);
  drawMapCapture(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, {
    viewport: rect,
    crop: rect,
    scale: 1,
    geometry,
    cutout: false,
    project,
    Path,
    basemapTiles: [tile(image('#ff0000'))],
    boundaryTiles: [],
    points: []
  });
  assert.equal(pixel(canvas, 16, 16)[0], 255);
  assert.ok(pixel(canvas, 0, 0)[0] < 180);
  assert.ok(pixel(canvas, 32, 32)[0] < 180);
});

test('A/B imagery swipe stays at viewport position in both full-view and cropped PNGs', () => {
  for (const crop of [rect, { x: 8, y: 8, width: 48, height: 48 }]) {
    const canvas = createCanvas(crop.width, crop.height);
    drawMapCapture(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, {
      viewport: rect,
      crop,
      scale: 1,
      geometry: null,
      cutout: false,
      project,
      Path,
      swipe: 50,
      basemapTiles: [tile(image('#ff0000')), tile(image('#0000ff'), true)],
      boundaryTiles: [],
      points: []
    });
    assert.deepEqual(pixel(canvas, 16 - crop.x, 16 - crop.y), [255, 0, 0, 255]);
    assert.deepEqual(pixel(canvas, 48 - crop.x, 16 - crop.y), [0, 0, 255, 255]);
  }
});

test('wrapped provenance keeps all dates/method/confidence and never shrinks captured map pixels', () => {
  const source = image('#ff0000');
  for (const language of ['rw', 'en', 'fr'] as const) {
    const lines = [
      `A 2026-01-01 / B 2025-01-01 · ODbL · ${translate('Low confidence · coverage and residential use unvalidated.', language)}`,
      translate(
        'Method: count points in mapped building footprints inside the selected polygon; no residential model validated.',
        language
      ),
      'source-version-identifier-with-no-breaks-'.repeat(10)
    ];
    const result = attachExportFooter(
      source as unknown as HTMLCanvasElement,
      1,
      lines,
      () => createCanvas(1, 1) as unknown as HTMLCanvasElement
    );
    const canvas = result.canvas as unknown as Canvas;
    assert.equal(canvas.width, 480);
    assert.ok(canvas.height > 64 + 30);
    assert.deepEqual(pixel(canvas, result.bodyOffsetX + 16, 16), pixel(source, 16, 16));
    assert.equal(pixel(canvas, 0, 0)[3], 0, 'padding remains transparent');
    assert.equal(result.lines.join('').replace(/\s/g, ''), lines.join('').replace(/\s/g, ''));
    const context = canvas.getContext('2d');
    context.font = '11px sans-serif';
    assert.ok(result.lines.every((line) => context.measureText(line).width <= 464));
  }
  assert.throws(() => wrapExportLines(['data'], 0, () => 1));
});

test('capture consistency rejects source/date revisions, panning, zoom and resizing', () => {
  const view = { revision: 1, lat: -1.9441, lng: 30.0619, zoom: 14, width: 390, height: 844 };
  assert.ok(captureMatches(view, { ...view }));
  for (const changed of [
    { ...view, revision: 2 },
    { ...view, lat: -1.95 },
    { ...view, zoom: 15 },
    { ...view, width: 844 }
  ])
    assert.equal(captureMatches(view, changed), false);
});

test('odd-width captures keep source pixels exact at fractional device scale', () => {
  const source = createCanvas(63, 65),
    context = source.getContext('2d');
  for (let x = 0; x < 63; x++) {
    context.fillStyle = x % 2 ? '#ff0000' : '#0000ff';
    context.fillRect(x, 0, 1, 65);
  }
  const result = attachExportFooter(
    source as unknown as HTMLCanvasElement,
    1.25,
    ['Source: 2026-01-01 · low confidence'],
    () => createCanvas(1, 1) as unknown as HTMLCanvasElement
  );
  const report = result.canvas as unknown as Canvas;
  assert.ok(Number.isInteger(result.bodyOffsetPixels));
  assert.deepEqual(
    [...report.getContext('2d').getImageData(result.bodyOffsetPixels, 0, 63, 65).data],
    [...source.getContext('2d').getImageData(0, 0, 63, 65).data]
  );
});

test('the on-map inverted mask dims hole interiors just like selected PNG clipping', () => {
  const rings = maskLatLngs(geometry).map((ring) => ring.map(([lat, lng]) => [lng, lat]));
  const masked = (x: number, y: number) =>
    rings.reduce((inside, ring) => inside !== pointInGeometry(x, y, { type: 'Polygon', coordinates: [ring] }), false);
  assert.equal(masked(0, 0), true);
  assert.equal(masked(16, 16), false);
  assert.equal(masked(32, 32), true);
});

test('PNG capture draws actual source outlines, preserving holes and transparent fill', () => {
  const output = createCanvas(64, 64);
  drawMapCapture(output.getContext('2d') as unknown as CanvasRenderingContext2D, {
    viewport: { x: 0, y: 0, width: 64, height: 64 }, crop: { x: 0, y: 0, width: 64, height: 64 }, scale: 1,
    geometry: null, cutout: false, project: ([x, y]) => ({ x, y }), Path,
    basemapTiles: [{ image: image('#ffffff') as unknown as CanvasImageSource, rect: { x: 0, y: 0, width: 64, height: 64 } }],
    boundaryTiles: [], points: [], footprints: [{ geometry, color: '#0000ff' }]
  });
  assert.deepEqual(pixel(output, 32, 32), [255, 255, 255, 255], 'source hole remains open');
  const interior = pixel(output, 16, 16);
  assert.ok(interior[0] < 255 && interior[0] > 200 && interior[2] === 255, 'imagery remains visible through footprint fill');
  assert.ok(pixel(output, 8, 16)[0] < interior[0], 'actual ring is stroked');
});
