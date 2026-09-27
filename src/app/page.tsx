'use client';

import dynamic from 'next/dynamic';
import { Activity } from 'lucide-react';
import { prefetchInitialView } from '@/lib/tileWorker';

// Start everything the first screen needs as soon as this script runs,
// instead of after React has hydrated and rendered the dynamic() placeholder:
// the workstation chunk (map + UI), the boundary tile worker, and the first
// view's tiles (see tileWorker.ts). They all download in parallel.
const loadWorkstation = () => import('@/components/Workstation');
if (typeof window !== 'undefined') {
  loadWorkstation();
  prefetchInitialView();
}

// The whole workstation renders client-only: Leaflet needs `window`, and the
// initial view (map position, basemap, selection) is read from the URL, which
// a prerendered shell can't know - rendering it on the server would only
// produce a hydration mismatch.
const Workstation = dynamic(loadWorkstation, {
  ssr: false,
  loading: () => (
    <div className="w-screen h-screen flex flex-col items-center justify-center bg-surface-base text-fg-secondary">
      <Activity className="w-8 h-8 text-accent animate-spin mb-3" />
      <span className="text-[13px] font-medium">Loading map workstation…</span>
    </div>
  )
});

export default function Home() {
  return <Workstation />;
}
