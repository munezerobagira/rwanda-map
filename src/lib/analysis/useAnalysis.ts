'use client';
import { useEffect, useState } from 'react';
import type { AnalysisResult, BuildingSource } from './types';
import type { BoundaryGeometry } from '../selection';
export function useAnalysis(geometry: BoundaryGeometry | null, dates: string[], enabled: boolean, nonce: number, source: BuildingSource = 'osm') {
  const body = geometry ? JSON.stringify({ geometry, dates, source, featureTypes: ['buildings'] }) : '';
  const key = `${nonce}:${body}`;
  const [state, setState] = useState<{ key: string; result: AnalysisResult | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!enabled || !body) return;
    const controller = new AbortController();
    fetch('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Building analysis unavailable.');
        return data as AnalysisResult;
      })
      .then((result) => {
        if (!controller.signal.aborted) setState({ key, result, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            key,
            result: null,
            error: error instanceof Error ? error.message : 'Building analysis unavailable.'
          });
      });
    return () => controller.abort();
  }, [body, enabled, key]);
  const current = state?.key === key ? state : null;
  return {
    result: enabled ? (current?.result ?? null) : null,
    error: enabled ? (current?.error ?? null) : null,
    pending: enabled && Boolean(body) && !current
  };
}
