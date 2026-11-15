import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const project = process.cwd();
const region = JSON.parse(await readFile(path.join(project, 'src/lib/regions/rwanda.json'), 'utf8'));
const raw = new Set(region.boundaries.rawInputs);
async function traces(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await traces(file)));
    else if (entry.name.endsWith('.nft.json')) result.push(file);
  }
  return result;
}
const boundaryAssets = Object.keys(region.boundaries.precomputed).map((name) => path.join(project, 'public/data', name));
const buildingAssets = [];
for (const version of region.buildingSnapshots) {
  const root = path.join(project, 'public/data/buildings', version);
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  buildingAssets.push(path.join(root, 'manifest.json'), ...Object.keys(manifest.tiles).map((tile) => path.join(root, `${tile}.json.gz`)));
}
let largest = { file: '', bytes: 0 };
for (const file of await traces(path.join(project, '.next/server'))) {
  const trace = JSON.parse(await readFile(file, 'utf8'));
  const assets = new Set(trace.files.map((relative) => path.resolve(path.dirname(file), relative)));
  if (file.endsWith('/instrumentation.js.nft.json') || boundaryAssets.some((asset) => assets.has(asset))) {
    if (!boundaryAssets.every((asset) => assets.has(asset))) throw new Error(`Missing required boundary assets in ${file}`);
    if ([...assets].some((asset) => asset.includes('/public/data/buildings/'))) throw new Error(`Unrelated building data in boundary/startup trace ${file}`);
  }
  if (file.endsWith('/api/analysis/route.js.nft.json') && !buildingAssets.every((asset) => assets.has(asset)))
    throw new Error('Analysis trace is missing active building manifests/tiles.');
  let bytes = 0;
  for (const relative of new Set(trace.files)) {
    const asset = path.resolve(path.dirname(file), relative);
    if (asset.includes('/public/data/footprints/objects/')) throw new Error(`Static national display/query assets in function trace: ${asset}`);
    if (asset.includes('/data/archived-building-indexes/')) throw new Error(`Archived building index in production trace: ${asset}`);
    if ((asset.includes('/public/data/') || asset.includes('/data/raw-boundaries/')) && raw.has(path.basename(asset)))
      throw new Error(
        `Redundant raw data in production trace ${path.relative(project, file)}: ${path.basename(asset)}`
      );
    try {
      const info = await stat(asset);
      if (info.isFile()) bytes += info.size;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (bytes > 100 * 1024 * 1024)
    throw new Error(
      `${path.relative(project, file)} exceeds the 100MiB project trace budget (${(bytes / 1024 / 1024).toFixed(1)}MiB).`
    );
  if (bytes > largest.bytes) largest = { file: path.relative(project, file), bytes };
}
console.log(
  `Production trace budget passed. Largest: ${largest.file} (${(largest.bytes / 1024 / 1024).toFixed(2)}MiB / 100MiB). Includes startup instrumentation.`
);
