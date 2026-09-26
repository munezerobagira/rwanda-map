'use client';

import dynamic from 'next/dynamic';
import { Activity } from 'lucide-react';

// The whole workstation renders client-only: Leaflet needs `window`, and the
// initial view (map position, basemap, selection) is read from the URL, which
// a prerendered shell can't know - rendering it on the server would only
// produce a hydration mismatch.
const Workstation = dynamic(() => import('@/components/Workstation'), {
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
