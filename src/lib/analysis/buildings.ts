import {
  buildingManifest,
  rowsForGeometry,
  snapshotAt
} from './buildingStore';
import { geometryAreaKm2 } from './geometry';
import type { AnalysisModule, AnalysisSnapshot } from './types';
import { analyzeRows, compareSnapshots } from './countBuildings';
export { analyzeRows, compareSnapshots } from './countBuildings';
export const buildingAnalysis: AnalysisModule = {
  id: 'buildings',
  async run(input) {
    const snapshots: AnalysisSnapshot[] = [];
    for (const date of input.dates) {
      const manifest = await snapshotAt(date);
      const rows = manifest ? await rowsForGeometry(manifest, input.geometry) : [];
      snapshots.push(analyzeRows(input, date, manifest, rows));
    }
    const areaKm2 = geometryAreaKm2(input.geometry);
    return { moduleId: 'buildings', areaKm2, snapshots, comparison: compareSnapshots(snapshots, areaKm2) };
  }
};
// Explicit export supports reproducible fixture/integration checks of source metadata.
export { buildingManifest };
