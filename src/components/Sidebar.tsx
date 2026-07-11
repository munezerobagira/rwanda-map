'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  FileJson, 
  Compass
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeBasemap: string;
  setActiveBasemap: (basemap: string) => void;
  sentinelYear: string;
  setSentinelYear: (year: string) => void;
  availableYears: string[];
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeBasemap,
  setActiveBasemap,
  sentinelYear,
  setSentinelYear,
  availableYears
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'explorer', name: 'Map Explorer', icon: Compass },
    { id: 'villages', name: 'Village Registry', icon: FileJson },
  ];

  const basemaps = [
    { id: 'esri', name: 'Esri World Imagery', group: 'Satellite' },
    { id: 'sentinel2', name: 'Sentinel-2 Cloudless', group: 'Satellite' },
    { id: 'blackmarble', name: 'NASA Earth at Night', group: 'Night' },
    { id: 'dark', name: 'CartoDB Dark Matter', group: 'Vector' },
    { id: 'osm', name: 'EOX Street Map', group: 'Vector' },
    { id: 'terrain', name: 'EOX Terrain Light', group: 'Physical' }
  ];

  return (
    <aside className="w-72 bg-[#0d0f13] border-r border-white/[0.06] flex flex-col h-screen shrink-0 text-left z-30 select-none">
      {/* Sidebar Header */}
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {/* Logo with Rwanda Flag Blue background */}
          <div className="w-9 h-9 bg-[#00A3E0] rounded-md flex items-center justify-center font-bold text-[#060709] text-lg shadow-[0_0_15px_rgba(0,163,224,0.4)]">
            IM
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-wider text-base m-0 font-sans">InfraMap</h1>
            <p className="text-[10px] uppercase text-[#00A3E0] tracking-widest font-semibold opacity-95 m-0 font-mono">Map Intelligence</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5 mr-3 shrink-0" />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Map Basemap / Satellite Switcher */}
      <div className="p-6 border-t border-white/[0.06] bg-black/[0.15] max-h-[400px] overflow-y-auto">
        <h3 className="text-xs uppercase text-[#8c9ba5] tracking-wider mb-3.5 font-semibold">
          Map Basemap
        </h3>
        
        {/* Basemap Options List */}
        <div className="space-y-1.5 mb-3">
          {basemaps.map(bm => (
            <button
              key={bm.id}
              onClick={() => setActiveBasemap(bm.id)}
              className={`w-full py-2 px-3 rounded text-xs font-semibold border text-left transition-all duration-300 cursor-pointer flex justify-between items-center ${
                activeBasemap === bm.id
                  ? 'bg-[#0d0f13] border-[#00A3E0] text-white shadow-[0_0_8px_rgba(0,163,224,0.25)] font-bold'
                  : 'bg-transparent border-white/5 text-[#8c9ba5] hover:text-white hover:border-white/10'
              }`}
            >
              <span>{bm.name}</span>
              <span className="text-[9px] opacity-75 uppercase font-mono font-normal tracking-wide px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05]">
                {bm.group}
              </span>
            </button>
          ))}
        </div>

        {/* Year Selector for Sentinel-2 */}
        {activeBasemap === 'sentinel2' && availableYears.length > 0 && (
          <div className="pt-2.5 border-t border-white/[0.04] space-y-1.5 transition-all duration-300">
            <span className="text-[9px] uppercase tracking-wider text-[#53606b] block font-semibold font-mono">
              Imagery Year
            </span>
            <div className="flex flex-wrap gap-1">
              {availableYears.map(yr => (
                <button
                  key={yr}
                  onClick={() => setSentinelYear(yr)}
                  className={`py-1 px-2 rounded text-[10px] font-semibold border transition-all duration-200 cursor-pointer ${
                    sentinelYear === yr
                      ? 'bg-[#00A3E0]/15 border-[#00A3E0]/40 text-[#00A3E0] shadow-[0_0_4px_rgba(0,163,224,0.05)]'
                      : 'bg-transparent border-white/[0.04] text-[#8c9ba5] hover:text-white hover:border-white/10'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
