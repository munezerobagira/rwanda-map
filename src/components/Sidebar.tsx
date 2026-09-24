'use client';

import React from 'react';
import {
  LayoutDashboard,
  FileJson,
  Compass,
  X,
  Lock
} from 'lucide-react';
import { BASEMAPS, isBasemapAvailable } from '@/lib/basemaps';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeBasemap: string;
  setActiveBasemap: (basemap: string) => void;
  sentinelYear: string;
  setSentinelYear: (year: string) => void;
  availableYears: string[];
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeBasemap,
  setActiveBasemap,
  sentinelYear,
  setSentinelYear,
  availableYears,
  isOpen,
  onClose
}: SidebarProps) {
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'explorer', name: 'Map Explorer', icon: Compass },
    { id: 'villages', name: 'Village Registry', icon: FileJson },
  ];

  const activeBasemapDef = BASEMAPS.find(bm => bm.id === activeBasemap);

  return (
    <>
      {/* Mobile backdrop overlay - only shown when sidebar is open on small screens */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-72 bg-[#0d0f13] border-r border-white/[0.06] flex flex-col h-screen shrink-0 text-left z-50 select-none
          fixed top-0 left-0 transition-transform duration-300 ease-in-out
          md:static md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
      {/* Sidebar Header */}
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Logo with Rwanda Flag Blue background */}
            <div className="w-9 h-9 bg-[#00A3E0] rounded-md flex items-center justify-center font-bold text-[#060709] text-lg shadow-[0_0_15px_rgba(0,163,224,0.4)]">
              RM
            </div>
            <div>
              <h1 className="font-semibold text-white tracking-wider text-base m-0 font-sans">Rwanda Map</h1>
              <p className="text-[10px] uppercase text-[#00A3E0] tracking-widest font-semibold opacity-95 m-0 font-mono">Map Intelligence</p>
            </div>
          </div>
          {/* Close button - only visible on small screens */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 text-[#8c9ba5] hover:text-white hover:bg-white/5 rounded-full transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
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
              onClick={() => {
                setActiveTab(item.id);
                onClose();
              }}
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
          {BASEMAPS.map(bm => {
            const available = isBasemapAvailable(bm);
            return (
              <button
                key={bm.id}
                disabled={!available}
                onClick={() => available && setActiveBasemap(bm.id)}
                title={!available ? bm.unavailableHint : undefined}
                className={`w-full py-2 px-3 rounded text-xs font-semibold border text-left transition-all duration-300 flex justify-between items-center ${
                  !available
                    ? 'bg-transparent border-white/5 text-[#53606b] cursor-not-allowed opacity-60'
                    : activeBasemap === bm.id
                    ? 'bg-[#0d0f13] border-[#00A3E0] text-white shadow-[0_0_8px_rgba(0,163,224,0.25)] font-bold cursor-pointer'
                    : 'bg-transparent border-white/5 text-[#8c9ba5] hover:text-white hover:border-white/10 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {!available && <Lock className="w-3 h-3 shrink-0" />}
                  {bm.name}
                </span>
                <span className="text-[9px] opacity-75 uppercase font-mono font-normal tracking-wide px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.05]">
                  {bm.group}
                </span>
              </button>
            );
          })}
        </div>

        {/* Year Selector - shown for any basemap that exposes an annual timeline */}
        {activeBasemapDef?.supportsYear && availableYears.length > 0 && (
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
    </>
  );
}
