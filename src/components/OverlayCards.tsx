'use client';

import React from 'react';

// Bottom stats bar covering the grid database status
export function StatsFooter() {
  const footerStats = [
    { label: 'Tracked Villages', value: '14,823', sub: 'Rwanda RLA Basemap', color: '#007A33' },             // Flag Green
    { label: 'Mapped Districts', value: '30', sub: '5 Provinces', color: '#FCD116' },                       // Flag Yellow
    { label: 'Database Status', value: 'ONLINE', sub: 'All Systems Connected', color: '#00A3E0' }            // Flag Blue
  ];

  return (
    <div className="glass-panel w-full flex items-center justify-around p-6 select-none pointer-events-auto h-24">
      {footerStats.map((stat) => (
        <div key={stat.label} className="flex-1 flex flex-col items-center justify-center relative last:border-r-0 border-r border-white/[0.05]">
          <span className="text-[10px] uppercase text-[#8c9ba5] tracking-wider mb-1 block text-center font-medium">
            {stat.label}
          </span>
          <span 
            className="text-xl font-bold font-mono tracking-tight text-center"
            style={{ color: stat.color }}
          >
            {stat.value}
          </span>
          <span className="text-[9px] text-[#53606b] mt-0.5 block text-center font-medium">
            {stat.sub}
          </span>
        </div>
      ))}
    </div>
  );
}
