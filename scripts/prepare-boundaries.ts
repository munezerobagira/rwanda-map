// Explicit offline regeneration; never imported into the web runtime.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import RWANDA from '../src/lib/regions/rwanda.json';
import { roundGeometry, simplifyGeometry } from '../src/lib/boundaryGeometry';
import type { BoundaryFeature } from '../src/lib/spatialStore';
const layers = ['country', 'provinces', 'districts', 'sectors', 'cells', 'villages'];
const tolerances = [0.0001, 0.001, 0.0005, 0.0002, 0.0001, 0.0001];
async function main() {
  const check = process.argv.includes('--check');
  for (const [index, layer] of layers.entries()) {
    const source = path.join(process.cwd(), 'data', 'raw-boundaries', RWANDA.boundaries.rawInputs[index]);
    const text = await readFile(source, 'utf8');
    if (text.startsWith('version https://git-lfs.github.com/spec/'))
      throw new Error('Original boundary input is a Git LFS pointer. Run git lfs pull.');
    const data = JSON.parse(text) as { type: 'FeatureCollection'; features: BoundaryFeature[] };
    const name = layer === 'country' ? 'country boundary.geojson' : `${layer}.simplified.geojson`;
    const expected = RWANDA.boundaries.precomputed[name as keyof typeof RWANDA.boundaries.precomputed];
    if (data.type !== 'FeatureCollection' || data.features.length !== expected)
      throw new Error(`Unexpected source shape count for ${layer}`);
    if (!check) {
      const features = data.features.map((feature) => ({
        ...feature,
        geometry: roundGeometry(simplifyGeometry(feature.geometry, tolerances[index] ** 2))
      }));
      await writeFile(path.join(process.cwd(), 'public', 'data', name), JSON.stringify({ ...data, features }));
    }
    console.log(`${check ? 'Verified source' : 'Regenerated'} ${layer}: ${expected} features`);
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
