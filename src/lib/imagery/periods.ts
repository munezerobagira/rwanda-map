import type { Period } from './catalog';
export function latestCompleteMonth(now = new Date()): Period {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { start: `${end.toISOString().slice(0, 7)}-01`, end: end.toISOString().slice(0, 10) };
}
export function sameSeasonLastYear(period: Period): Period {
  const shift = (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    const days = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
    return `${y - 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, days)).padStart(2, '0')}`;
  };
  return { start: shift(period.start), end: shift(period.end) };
}
export function imageryTileUrl(period: Period, version?: string): string {
  return `/api/imagery/tiles/{z}/{x}/{y}?start=${period.start}&end=${period.end}${version ? `&v=${encodeURIComponent(version)}` : ''}`;
}
