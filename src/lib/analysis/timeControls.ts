import RWANDA from '../regions/rwanda.json';
import type { BuildingSource } from './types';
import type { Period } from '../imagery/catalog';
export const buildingSnapshotDates = RWANDA.buildingSnapshots.map((version) => version.slice(4, 14));
export function buildingDatesFor(source: BuildingSource = 'osm'): string[] {
  return source === 'overture' ? RWANDA.overtureSnapshots.map((version) => version.slice(9, 19)) : buildingSnapshotDates;
}
export function buildingDateAtOrBefore(date: string, source: BuildingSource = 'osm'): string | undefined {
  return buildingDatesFor(source).filter((candidate) => candidate <= date).at(-1);
}
export function analysisDates(period: Period, comparison: Period, compare: boolean): string[] {
  return compare ? [period.end, comparison.end] : [period.end];
}
export function snapshotPeriod(date: string, source: BuildingSource = 'osm'): Period {
  if (!buildingDatesFor(source).includes(date)) throw new Error('Unknown building snapshot date.');
  return { start: date, end: date };
}
