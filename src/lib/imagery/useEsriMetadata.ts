'use client';
import { useEffect, useMemo, useState } from 'react';
import { ESRI_METADATA_URL, metadataPoint, type MetadataPoint, type EsriPointMetadata } from './esriMetadata';
export function useEsriMetadata(point: MetadataPoint | null, enabled: boolean): EsriPointMetadata | null {
  const canonical = point && metadataPoint(point.lat, point.lng);
  const lat = canonical?.lat, lng = canonical?.lng;
  const key = enabled && canonical ? `${lat}/${lng}` : null;
  const [result, setResult] = useState<{ key: string; value: EsriPointMetadata } | null>(null);
  useEffect(() => {
    if (!key || lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 8000);
    let current = true;
    fetch(`/api/imagery/esri-metadata?${new URLSearchParams({ lat: String(lat), lng: String(lng) })}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Metadata unavailable');
        const value = await response.json() as EsriPointMetadata;
        if (value.point.lat !== lat || value.point.lng !== lng) throw new Error('Stale point');
        if (current) setResult({ key, value });
      }).catch(() => {
        if (current) setResult({ key, value: { point: { lat, lng }, status: 'unavailable', records: [], source: ESRI_METADATA_URL } });
      }).finally(() => clearTimeout(deadline));
    return () => { current = false; clearTimeout(deadline); controller.abort(); };
  }, [key, lat, lng]);
  return useMemo(() => {
    if (!key || lat === undefined || lng === undefined) return null;
    return result?.key === key ? result.value : { point: { lat, lng }, status: 'loading', records: [], source: ESRI_METADATA_URL };
  }, [key, lat, lng, result]);
}
