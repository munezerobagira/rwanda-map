'use client';

import React from 'react';

interface StatsFooterProps {
  activeTab: string;
  activeLayerName: string;
  currentZoom: number;
  featuresInView: number;
  selectedVillage: any;
}

// Bottom stats bar - content reflects whichever sidebar section is currently active
export function StatsFooter({
  activeTab,
  activeLayerName,
  currentZoom,
  featuresInView,
  selectedVillage
}: StatsFooterProps) {
  const dashboardStats = [
    { label: 'Tracked Villages', value: '14,823', sub: 'Rwanda RLA Basemap', color: '#007A33' },             // Flag Green
    { label: 'Mapped Districts', value: '30', sub: '5 Provinces', color: '#FCD116' },                       // Flag Yellow
    { label: 'Database Status', value: 'ONLINE', sub: 'All Systems Connected', color: '#00A3E0' }            // Flag Blue
  ];

  const explorerStats = [
    { label: 'Active Layer', value: activeLayerName.replace(' Layer', ''), sub: 'Boundary level in view', color: '#00A3E0' },
    { label: 'Zoom Level', value: currentZoom.toFixed(1), sub: 'Current map zoom', color: '#FCD116' },
    { label: 'Features In View', value: String(featuresInView), sub: 'Rendered boundary shapes', color: '#007A33' }
  ];

  const villageSelected = selectedVillage && !selectedVillage.outside && selectedVillage.village;
  const registryStats = villageSelected
    ? [
        { label: 'Selected Village', value: selectedVillage.village, sub: `${selectedVillage.cell} Cell, ${selectedVillage.sector} Sector`, color: '#00A3E0' },
        { label: 'Connection Rate', value: `${selectedVillage.connection_rate}%`, sub: 'Grid access coverage', color: '#007A33' },
        { label: 'Peak Load', value: `${selectedVillage.peak_load_mw} MW`, sub: 'Estimated demand', color: '#FCD116' }
      ]
    : [
        { label: 'Selected Village', value: 'None', sub: 'Zoom in and click a village', color: '#8c9ba5' },
        { label: 'Tracked Villages', value: '14,823', sub: 'Rwanda RLA Basemap', color: '#007A33' },
        { label: 'Database Status', value: 'ONLINE', sub: 'All Systems Connected', color: '#00A3E0' }
      ];

  const footerStats =
    activeTab === 'explorer' ? explorerStats :
    activeTab === 'villages' ? registryStats :
    dashboardStats;

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
