import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const region = JSON.parse(await readFile(new URL('../src/lib/regions/rwanda.json', import.meta.url), 'utf8'));
for (const version of region.buildingSnapshots) {
  const root = new URL(`../public/data/buildings/${version}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  if (
    manifest.schemaVersion !== 1 ||
    manifest.processingVersion !== 2 ||
    version !== `osm-${manifest.dataDate.slice(0, 10)}-p${manifest.processingVersion}` ||
    manifest.version !== version ||
    manifest.license !== 'ODbL-1.0' ||
    manifest.coordinateScale !== 1e6 ||
    manifest.tileZoom !== 12
  )
    throw new Error(`Unsupported building manifest ${version}`);
  let count = 0;
  for (const [tile, expected] of Object.entries(manifest.tiles)) {
    if (!/^\d+_\d+$/.test(tile)) throw new Error('Invalid building tile name');
    const bytes = await readFile(new URL(`${tile}.json.gz`, root));
    if (bytes.length !== expected.bytes || createHash('sha256').update(bytes).digest('hex') !== expected.sha256)
      throw new Error(`${version}/${tile}: hash mismatch or unhydrated Git LFS pointer`);
    const rows = JSON.parse(gunzipSync(bytes).toString());
    if (
      rows.length !== expected.count ||
      rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== 5 ||
          !row.every(Number.isFinite) ||
          !row.every(Number.isInteger) ||
          row[0] === 0 ||
          row[1] < 28860000 ||
          row[1] > 30900000 ||
          row[2] < -2840000 ||
          row[2] > -1050000 ||
          row[3] < 1 ||
          row[4] < 0 ||
          row[4] > 3
      )
    )
      throw new Error(`${version}/${tile}: invalid point records`);
    count += rows.length;
  }
  if (count !== manifest.statistics.accepted) throw new Error(`${version}: count mismatch`);
  console.log(
    `Building snapshot verified: ${version} (${count.toLocaleString('en')} points, ${Object.keys(manifest.tiles).length} tiles)`
  );
}
