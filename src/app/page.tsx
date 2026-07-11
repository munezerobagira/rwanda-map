'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import { StatsFooter } from '@/components/OverlayCards';
import { 
  MapPin, 
  Wifi, 
  Activity, 
  X,
  HelpCircle
} from 'lucide-react';

// Dynamic import of Leaflet map to prevent SSR window crashes
const InteractiveMap = dynamic(
  () => import('@/components/InteractiveMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#060709] text-[#8c9ba5] font-sans">
        <Activity className="w-10 h-10 text-[#00A3E0] animate-spin mb-3" />
        <span className="text-sm font-semibold tracking-wider uppercase">Loading Grid Infrastructure Map...</span>
      </div>
    )
  }
);

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [liveTime, setLiveTime] = useState('');
  
  // Grid Data & Map State
  const [boundaryGeoJson, setBoundaryGeoJson] = useState<any>(null);
  const [parentBoundaryGeoJson, setParentBoundaryGeoJson] = useState<any>(null);
  const [selectedVillage, setSelectedVillage] = useState<any>(null);
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(9.3);
  const [isResolvingCoordinate, setIsResolvingCoordinate] = useState(false);

  // Basemap & Satellite Provider State
  const [activeBasemap, setActiveBasemap] = useState<string>('esri');
  const [sentinelYear, setSentinelYear] = useState<string>('2023');
  const [availableYears, setAvailableYears] = useState<string[]>(['2018', '2019', '2020', '2021', '2022', '2023']);

  // Fetch capabilities to dynamically determine available Sentinel years
  useEffect(() => {
    const fetchCapabilities = async () => {
      try {
        const res = await fetch('/api/satellite-capabilities');
        const data = await res.json();
        if (data.years && data.years.length > 0) {
          setAvailableYears(data.years);
          setSentinelYear(data.years[data.years.length - 1]); // default to newest
        }
      } catch (err) {
        console.error('Failed to load satellite capabilities', err);
      }
    };
    fetchCapabilities();
  }, []);

  // Viewport tracking state to manage API requests
  const [viewport, setViewport] = useState<{
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    zoom: number;
  } | null>(null);

  // Network abort controller to manage spatial requests during pan/zoom
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. Real-time Live Clock Updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setLiveTime(timeStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Viewport-Based Boundary Fetcher (with dynamic active and parent layers depending on zoom)
  useEffect(() => {
    if (!viewport) {
      setBoundaryGeoJson(null);
      setParentBoundaryGeoJson(null);
      return;
    }

    const { minLng, minLat, maxLng, maxLat, zoom } = viewport;
    setCurrentZoom(zoom);

    // Determine target active administrative layer and its parent overlay
    let activeLayer = 'provinces';
    let parentLayer: string | null = null;

    if (zoom < 9.0) {
      activeLayer = 'provinces';
      parentLayer = null;
    } else if (zoom >= 9.0 && zoom < 10.5) {
      activeLayer = 'districts';
      parentLayer = 'provinces';
    } else if (zoom >= 10.5 && zoom < 12.0) {
      activeLayer = 'sectors';
      parentLayer = 'districts';
    } else if (zoom >= 12.0 && zoom < 13.5) {
      activeLayer = 'cells';
      parentLayer = 'sectors';
    } else {
      activeLayer = 'villages';
      parentLayer = 'cells';
    }

    // Abort previous pending fetch request to avoid race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchBoundaries = async () => {
      setIsLoadingBoundaries(true);
      try {
        const activeUrl = `/api/boundaries?layer=${activeLayer}&minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`;
        const parentUrl = parentLayer
          ? `/api/boundaries?layer=${parentLayer}&minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`
          : null;

        // Fetch both the detailed active boundaries and bold parent outline in parallel
        const promises: [Promise<Response>, Promise<Response | null>] = [
          fetch(activeUrl, { signal: controller.signal }),
          parentUrl ? fetch(parentUrl, { signal: controller.signal }) : Promise.resolve(null)
        ];

        const [activeRes, parentRes] = await Promise.all(promises);
        const activeData = await activeRes.json();
        const parentData = parentRes ? await parentRes.json() : null;
        
        if (!controller.signal.aborted) {
          // Double verify layer consistency to prevent race conditions during fast scrolling/zooming
          if (activeData.layer === activeLayer) {
            setBoundaryGeoJson(activeData);
          }
          if (parentData === null) {
            setParentBoundaryGeoJson(null);
          } else if (parentData.layer === parentLayer) {
            setParentBoundaryGeoJson(parentData);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch boundaries', err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingBoundaries(false);
        }
      }
    };

    // Debounce to smooth out layout requests
    const timer = setTimeout(fetchBoundaries, 150);
    return () => {
      clearTimeout(timer);
      if (controller) controller.abort();
    };
  }, [viewport]);

  // 3. Map Click Handler (Resolves Coordinate Hierarchically)
  const handleMapClick = async (lat: number, lng: number) => {
    setIsResolvingCoordinate(true);
    setSelectedVillage(null); // Clear previous selection

    try {
      const res = await fetch(`/api/search-coordinate?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      
      if (data.found && data.data) {
        setSelectedVillage(data.data);
      } else {
        setSelectedVillage({
          outside: true,
          latitude: lat,
          longitude: lng,
          message: 'Selected coordinate lies outside mapped boundaries.'
        });
      }
    } catch (err) {
      console.error('Failed to resolve clicked coordinates', err);
    } finally {
      setIsResolvingCoordinate(false);
    }
  };

  const handleSelectVillage = (villageProperties: any) => {
    setSelectedVillage(villageProperties);
  };

  // Get dynamic tag indicating which boundary layer is currently active
  const getActiveLayerName = () => {
    if (currentZoom < 9.0) return 'Provinces Layer';
    if (currentZoom >= 9.0 && currentZoom < 10.5) return 'Districts Layer';
    if (currentZoom >= 10.5 && currentZoom < 12.0) return 'Sectors Layer';
    if (currentZoom >= 12.0 && currentZoom < 13.5) return 'Cells Layer';
    return 'Villages (Satellite Active)';
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060709] text-white">
      {/* 1. Sidebar Panel (Left) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        activeBasemap={activeBasemap}
        setActiveBasemap={setActiveBasemap}
        sentinelYear={sentinelYear}
        setSentinelYear={setSentinelYear}
        availableYears={availableYears}
      />

      {/* 2. Main Dashboard Display (Right) */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        
        {/* Header telemetry bar */}
        <header className="h-16 border-b border-white/[0.06] bg-[#0d0f13] flex items-center justify-between px-8 select-none shrink-0 z-20">
          <div className="flex items-center gap-4 font-sans">
            <span className="text-xs uppercase text-[#8c9ba5] font-semibold tracking-wider">Rwanda Map</span>
            <div className="h-4 w-[1px] bg-white/10" />
            <h2 className="text-sm font-bold text-white uppercase tracking-widest font-mono">
              {activeTab === 'dashboard' ? 'Overview' : activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-6">
            {/* Live blinking clock */}
            <div className="flex items-center text-xs font-semibold text-[#8c9ba5] font-mono">
              <span className="pulse-indicator"></span>
              <span className="text-white select-none">Live</span>
              <span className="mx-2 text-[#53606b] font-normal">|</span>
              <span className="text-[#f0f2f5] tracking-wide w-24 text-left">{liveTime || '04:39 PM'}</span>
            </div>
          </div>
        </header>

        {/* 3. Interactive Map & Overlays */}
        <div className="flex-1 w-full relative overflow-hidden">
          
          {/* Core Interactive Map Layer */}
          <InteractiveMap 
            onSelectVillage={handleSelectVillage}
            onMapClick={handleMapClick}
            onViewportChange={setViewport}
            boundaryGeoJson={boundaryGeoJson}
            parentBoundaryGeoJson={parentBoundaryGeoJson}
            activeBasemap={activeBasemap}
            sentinelYear={sentinelYear}
          />

          {/* Floating UI Overlays (Only render after map has loaded and initialized viewport) */}
          {viewport && (
            <div className="absolute inset-0 z-30 p-6 flex flex-col justify-between pointer-events-none animate-fade-in">
              
              {/* Upper Widgets row */}
              <div className="flex justify-end items-start w-full">
                {/* Widget: Telemetry Sync Status */}
                <div className="glass-panel p-3 flex items-center gap-2.5 bg-[#0d0f13]/90 border border-white/10 rounded-md pointer-events-auto select-none text-[10px] uppercase font-mono tracking-wider font-bold">
                  <span className={`w-2.5 h-2.5 rounded-full ${isLoadingBoundaries ? 'bg-[#00A3E0] animate-pulse shadow-[0_0_8px_#00A3E0]' : 'bg-[#007A33] shadow-[0_0_8px_#007A33]'}`} />
                  <span className="text-white">{isLoadingBoundaries ? 'Database Syncing...' : 'Database Connected'}</span>
                </div>
              </div>

              {/* Middle Row: Load Indicator, Resolving message & Details card */}
              <div className="flex justify-between items-center w-full my-auto">
                
                {/* Zoom Notification helper */}
                <div className="glass-panel mx-auto p-4 flex items-center gap-3 pointer-events-auto bg-[#0d0f13]/90 border-[#00A3E0]/30 shadow-[0_0_15px_rgba(0,163,224,0.1)]">
                  <MapPin className="w-5 h-5 text-[#00A3E0] animate-bounce" />
                  <div>
                    <h5 className="text-xs font-bold text-white font-sans">Active Boundaries Level</h5>
                    <p className="text-[10px] text-[#00A3E0] font-mono mt-0.5 uppercase tracking-wider font-semibold">{getActiveLayerName()}</p>
                  </div>
                </div>

                {/* Coordinate Query Resolver overlay */}
                {isResolvingCoordinate && (
                  <div className="glass-panel mx-auto p-4 flex items-center gap-3 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto bg-[#0d0f13]/95 border-[#00A3E0]/40 z-30">
                    <Activity className="w-5 h-5 text-[#00A3E0] animate-spin" />
                    <span className="text-xs font-bold text-white font-sans tracking-wide">Resolving coordinate hierarchy...</span>
                  </div>
                )}

                {/* Village Details Detail Slider Overlay */}
                {selectedVillage && (
                  <div className="glass-panel w-96 p-6 absolute left-6 top-32 pointer-events-auto text-left z-20 border border-[#00A3E0]/30 shadow-[0_12px_40px_rgba(0,163,224,0.15)] bg-[#0d0f13]/95">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider bg-[#00A3E0]/10 border border-[#00A3E0]/20 px-2 py-0.5 rounded text-[#00A3E0] font-semibold font-mono">
                          {selectedVillage.outside ? 'Spatial Query Error' : 'Administrative hierarchy'}
                        </span>
                        
                        <h4 className="text-lg font-bold text-white mt-1.5 leading-snug font-sans">
                          {selectedVillage.outside ? 'Out of Bounds' :
                           selectedVillage.village ? selectedVillage.village :
                           selectedVillage.cell ? `${selectedVillage.cell} Cell` :
                           selectedVillage.sector ? `${selectedVillage.sector} Sector` :
                           selectedVillage.district ? `${selectedVillage.district} District` :
                           selectedVillage.province}
                        </h4>
                        <p className="text-[10px] text-[#8c9ba5] mt-0.5 font-medium font-mono">
                          {selectedVillage.outside ? 'COORDINATES UNRESOLVABLE' :
                           selectedVillage.village_id ? `VILLAGE ID: ${selectedVillage.village_id}` :
                           selectedVillage.cell_id ? `CELL ID: ${selectedVillage.cell_id}` :
                           selectedVillage.sector_id ? `SECTOR ID: ${selectedVillage.sector_id}` :
                           selectedVillage.district_id ? `DISTRICT ID: ${selectedVillage.district_id}` :
                           `PROVINCE ID: ${selectedVillage.province_id}`}
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedVillage(null)} 
                        className="p-1 text-[#8c9ba5] hover:text-[#00A3E0] hover:bg-white/5 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Dynamic Stats Grid */}
                    <div className="space-y-4 text-xs font-sans">
                      {selectedVillage.outside ? (
                        <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded text-[#8c9ba5]">
                          <p className="mb-2 leading-relaxed">{selectedVillage.message}</p>
                          <p className="font-mono text-[10px]"><span className="text-white font-semibold">Lat:</span> {selectedVillage.latitude.toFixed(5)}</p>
                          <p className="font-mono text-[10px]"><span className="text-white font-semibold">Lng:</span> {selectedVillage.longitude.toFixed(5)}</p>
                        </div>
                      ) : (
                        <>
                          {/* Location hierarchy tree */}
                          <div className="grid grid-cols-2 gap-3 py-2 border-b border-white/[0.05]">
                            <div>
                              <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Province</span>
                              <span className="text-white font-medium">{selectedVillage.province}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase text-[#53606b] block font-semibold">District</span>
                              <span className="text-white font-medium">{selectedVillage.district || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 py-2 border-b border-white/[0.05]">
                            <div>
                              <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Sector</span>
                              <span className="text-white font-medium">{selectedVillage.sector || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Cell</span>
                              <span className="text-white font-medium">{selectedVillage.cell || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 py-2 border-b border-white/[0.05]">
                            <div>
                              <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Calculated Area</span>
                              <span className="text-[#00A3E0] font-bold font-mono">
                                {selectedVillage.area_km2 ? `${selectedVillage.area_km2} km²` : 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Hierarchy Level</span>
                              <span className="text-white font-medium">
                                {selectedVillage.village ? 'Village' :
                                 selectedVillage.cell ? 'Cell' :
                                 selectedVillage.sector ? 'Sector' :
                                 selectedVillage.district ? 'District' :
                                 'Province'}
                              </span>
                            </div>
                          </div>

                          {/* Connection Rate Specs - Rendered only if it's a village */}
                          {selectedVillage.village ? (
                            <div className="space-y-2 pt-1">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[#8c9ba5] font-medium flex items-center gap-1.5">
                                  <Wifi className="w-3.5 h-3.5 text-[#00A3E0]" /> Grid Connection Rate
                                </span>
                                <span className="font-mono text-[#00A3E0] font-bold">{selectedVillage.connection_rate}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-[#141b22] rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full bg-[#00A3E0] shadow-[0_0_6px_#00A3E0] transition-all duration-500 ease-out"
                                  style={{ width: `${selectedVillage.connection_rate}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-white/[0.01] border border-white/[0.03] rounded text-[#8c9ba5] flex items-center gap-2">
                              <HelpCircle className="w-4 h-4 text-[#00A3E0]" />
                              <span>Zoom in further (Zoom &ge; 13.5) to view village-level access metadata.</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Row: Stats Footer Dashboard */}
              <StatsFooter />

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
