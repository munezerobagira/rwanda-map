import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const region = JSON.parse(await readFile('src/lib/regions/rwanda.json', 'utf8'));
const checked = new Set();
let bytesTotal = 0;
for (const version of region.overtureSnapshots) {
  const manifestBytes = await readFile(`src/lib/analysis/footprints/${version}.json`);
  const manifest = JSON.parse(manifestBytes);
  if (!manifestBytes.equals(await readFile(`public/data/footprints/manifests/${version}.json`))) throw new Error('Public derivative data manifest differs from runtime metadata');
  if (manifest.schemaVersion !== 1 || manifest.processingVersion !== 1 || manifest.version !== version ||
      manifest.dataDate !== manifest.release.slice(0, 10) || manifest.license !== 'ODbL-1.0' ||
      manifest.tileZoom !== 12 || manifest.outlineZoom !== 14 || manifest.coordinateScale !== 1e6)
    throw new Error(`Invalid footprint manifest ${version}`);
  const mask = await readFile('data/reference/rwanda-district-coverage-wb2012.geojson');
  if (createHash('sha256').update(mask).digest('hex') !== manifest.countryMaskSha256)
    throw new Error('Country clip provenance hash mismatch');
  for (const [kind, entries] of [['points', manifest.tiles], ['outlines', manifest.outlineTiles]]) {
    let count = 0;
    for (const [tile, entry] of Object.entries(entries)) {
      if (!/^\d+_\d+$/.test(tile) || !/^[a-f0-9]{64}$/.test(entry.hash) || entry.bytes > 6_000_000)
        throw new Error(`Invalid tile metadata ${version}/${tile}`);
      const bytes = await readFile(`public/data/footprints/objects/${entry.hash}.json.gz`);
      if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.hash)
        throw new Error(`Missing, corrupted or unhydrated LFS asset ${version}/${tile}`);
      const key = `${kind}:${entry.hash}`;
      if (!checked.has(key)) {
        const rows = JSON.parse(gunzipSync(bytes, { maxOutputLength: 32_000_000 }));
        if (rows.length !== entry.count) throw new Error(`Record count mismatch ${tile}`);
        const ids = new Set();
        for (const row of rows) {
          if (typeof row[0] !== 'string' || !/^[a-f0-9-]{36}$/.test(row[0]) || ids.has(row[0])) throw new Error('Invalid/duplicate GERS ID');
          ids.add(row[0]);
          if (kind === 'points') {
            if (row.length !== 7 || !row.slice(1).every(Number.isInteger) || row[1] < 28e6 || row[1] > 31e6 || row[2] < -3e6 || row[2] > -1e6 || row[3] < 1 || row[4] < 0 || row[4] > 3)
              throw new Error(`Invalid query point ${tile}`);
          } else if (row.length !== 3 || !['Polygon', 'MultiPolygon'].includes(row[1]) || !Array.isArray(row[2])) throw new Error(`Invalid source outline ${tile}`);
        }
        checked.add(key); bytesTotal += bytes.length;
      }
      count += entry.count;
    }
    if (count !== manifest.statistics.accepted) throw new Error(`Incomplete national ${kind}: ${version}`);
  }
  console.log(`Footprint snapshot verified: ${version} (${manifest.statistics.accepted.toLocaleString('en')} points and outlines)`);
}
if (bytesTotal > 850 * 1024 * 1024 || checked.size > 10_000) throw new Error('National static footprint storage budget exceeded');
console.log(`Immutable footprint assets: ${checked.size} objects, ${(bytesTotal / 1024 / 1024).toFixed(2)}MiB / 850MiB static budget; excluded from functions.`);
