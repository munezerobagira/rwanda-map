'use client';
import { useEffect, useState } from 'react';
import type { Period, Scene } from './catalog';
export interface ImagerySnapshot {
  version?: string;
  period: Period;
  source: string;
  nativeResolutionM: number;
  method: string;
  confidence: string;
  scenes: Omit<Scene, 'visual' | 'epsg'>[];
  error?: string;
}
export function useImagerySnapshot(period: Period, enabled: boolean): ImagerySnapshot | null {
  const key = `${period.start}/${period.end}`;
  const [result, setResult] = useState<{ key: string; snapshot: ImagerySnapshot } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ start: period.start, end: period.end });
    fetch(`/api/imagery/scenes?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Catalog unavailable');
        return response.json() as Promise<ImagerySnapshot>;
      })
      .then((snapshot) => {
        if (!controller.signal.aborted) setResult({ key, snapshot });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            key,
            snapshot: {
              period,
              source: 'Copernicus Sentinel-2 L2A / Earth Search',
              nativeResolutionM: 10,
              method: 'Unavailable',
              confidence: 'Unavailable',
              scenes: [],
              error: 'Catalog unavailable'
            }
          });
      });
    return () => controller.abort();
  }, [period, enabled, key]);
  return enabled && result?.key === key ? result.snapshot : null;
}
