import { readFile } from 'node:fs/promises';
const region = JSON.parse(await readFile(new URL('../src/lib/regions/rwanda.json', import.meta.url), 'utf8'));
const files = region.boundaries.precomputed;
for (const [name, expected] of Object.entries(files)) {
  const text = await readFile(new URL(`../public/data/${name}`, import.meta.url), 'utf8');
  if (text.startsWith('version https://git-lfs.github.com/spec/')) {
    throw new Error(`${name} is a Git LFS pointer. Run git lfs pull; enable Git LFS in Vercel Git settings.`);
  }
  const data = JSON.parse(text);
  if (
    data.type !== 'FeatureCollection' ||
    data.features?.length !== expected ||
    data.features.some((f) => !['Polygon', 'MultiPolygon'].includes(f.geometry?.type))
  ) {
    throw new Error(
      `${name}: expected ${expected} polygonal features. Check source version and update the validation manifest explicitly.`
    );
  }
  console.log(`Boundary asset verified: ${name} (${expected} features)`);
}
