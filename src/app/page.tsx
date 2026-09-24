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
  HelpCircle,
  Menu,
  Download,
  Loader2
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Grid Data & Map State
  const [boundaryGeoJson, setBoundaryGeoJson] = useState<any>(null);
  const [parentBoundaryGeoJson, setParentBoundaryGeoJson] = useState<any>(null);
  const [selectedVillage, setSelectedVillage] = useState<any>(null);
  const [isLoadingBoundaries, setIsLoadingBoundaries] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(9.3);
  const [isResolvingCoordinate, setIsResolvingCoordinate] = useState(false);

  // Ref to the Administrative Hierarchy detail card + its own export-to-PNG state
  const villageCardRef = useRef<HTMLDivElement>(null);
  const [isExportingCard, setIsExportingCard] = useState(false);

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

    // Debounce to smooth out layout requests - long enough that a continuous zoom/pan
    // gesture settles before we fetch and rebuild the (potentially large) vector layer,
    // avoiding a rebuild on every intermediate frame of the gesture
    const timer = setTimeout(fetchBoundaries, 350);
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

  // Export the Administrative Hierarchy detail card (whatever level is currently
  // resolved - province through village) as a standalone PNG image, satellite
  // thumbnail/background and all. html2canvas is loaded lazily since it only
  // ever runs client-side, in response to a click.
  const handleExportVillageCard = async () => {
    if (!villageCardRef.current || isExportingCard) return;
    setIsExportingCard(true);

    // Tailwind v4's opacity-modifier utilities (bg-[#..]/95, border-white/[0.05], etc.)
    // compile to `color-mix(in oklab, ...)`, and the browser now reports THAT back from
    // getComputedStyle in a modern color-function notation (lab()/oklab()/etc.) instead
    // of plain rgb() - a syntax html2canvas's own (non-browser) CSS parser doesn't
    // understand, so it throws "unsupported color function" the moment it inspects any
    // element using one, wherever in the cascade it shows up (background, border,
    // box-shadow, ...). Rather than patch every property that might carry a color,
    // wrap getComputedStyle itself for the duration of the export so every string it
    // returns is passed through a <canvas> 2D context first - canvas always normalizes
    // any CSS color it's given down to plain sRGB rgb()/rgba(), regardless of what
    // color space it started in.
    const nativeGetComputedStyle = window.getComputedStyle.bind(window);
    const probe = document.createElement('canvas').getContext('2d');
    const unsafeColorFn = /(?:^|[^a-z-])(lab|lch|oklab|oklch|color)\(/i;
    const toSafeColor = (value: string): string => {
      if (!probe || typeof value !== 'string' || !unsafeColorFn.test(value)) return value;
      try {
        probe.fillStyle = '#000';
        probe.fillStyle = value;
        return probe.fillStyle;
      } catch {
        return value;
      }
    };

    window.getComputedStyle = ((elt: Element, pseudo?: string | null) => {
      const original = nativeGetComputedStyle(elt, pseudo ?? undefined);
      return new Proxy(original, {
        get(target, prop, receiver) {
          if (prop === 'getPropertyValue') {
            return (name: string) => toSafeColor(target.getPropertyValue(name));
          }
          const value = Reflect.get(target, prop, receiver);
          if (typeof value === 'function') return value.bind(target);
          return typeof value === 'string' ? toSafeColor(value) : value;
        }
      });
    }) as typeof window.getComputedStyle;

    try {
      const cardEl = villageCardRef.current;
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardEl, {
        backgroundColor: '#0d0f13',
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 1, 2) * 1.5,
        ignoreElements: (el) => el.classList.contains('export-ignore')
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const label =
          selectedVillage?.village || selectedVillage?.cell || selectedVillage?.sector ||
          selectedVillage?.district || selectedVillage?.province || 'location';
        const slug = String(label).trim().replace(/\s+/g, '-').toLowerCase();

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug}-details-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to export details card', err);
    } finally {
      window.getComputedStyle = nativeGetComputedStyle;
      setIsExportingCard(false);
    }
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
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* 2. Main Dashboard Display (Right) */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden min-w-0">

        {/* Header telemetry bar */}
        <header className="h-16 border-b border-white/[0.06] bg-[#0d0f13] flex items-center justify-between px-4 md:px-8 select-none shrink-0 z-20">
          <div className="flex items-center gap-4 font-sans">
            {/* Sidebar toggle - visible only on small devices */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1.5 text-[#8c9ba5] hover:text-white hover:bg-white/5 rounded-md transition-colors"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs uppercase text-[#8c9ba5] font-semibold tracking-wider hidden sm:inline">Rwanda Map</span>
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
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
                  <div
                    ref={villageCardRef}
                    className="glass-panel w-96 p-8 absolute left-6 top-32 pointer-events-auto text-left z-20 border-2 border-[#00A3E0]/40 shadow-[0_12px_40px_rgba(0,163,224,0.15)] bg-[#0d0f13]/95"
                  >
                    <div className="flex justify-between items-start mb-5">
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
                      <div className="flex items-center gap-1 export-ignore">
                        {!selectedVillage.outside && (
                          <button
                            onClick={handleExportVillageCard}
                            disabled={isExportingCard}
                            title="Export this card as a PNG image"
                            className="p-1.5 text-[#8c9ba5] hover:text-[#00A3E0] hover:bg-white/5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isExportingCard ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedVillage(null)}
                          className="p-1.5 text-[#8c9ba5] hover:text-[#00A3E0] hover:bg-white/5 rounded-full transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Stats Grid */}
                    <div className="space-y-5 text-xs font-sans">
                      {selectedVillage.outside ? (
                        <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded text-[#8c9ba5]">
                          <p className="mb-2 leading-relaxed">{selectedVillage.message}</p>
                          <p className="font-mono text-[10px]"><span className="text-white font-semibold">Lat:</span> {selectedVillage.latitude.toFixed(5)}</p>
                          <p className="font-mono text-[10px]"><span className="text-white font-semibold">Lng:</span> {selectedVillage.longitude.toFixed(5)}</p>
                        </div>
                      ) : (
                        <>
                          {/* Location hierarchy tree - only render fields present at (or above) the resolved level */}
                          <div className="grid grid-cols-2 gap-3 py-3 border-b border-white/[0.05]">
                            <div>
                              <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Province</span>
                              <span className="text-white font-medium">{selectedVillage.province}</span>
                            </div>
                            {selectedVillage.district && (
                              <div>
                                <span className="text-[9px] uppercase text-[#53606b] block font-semibold">District</span>
                                <span className="text-white font-medium">{selectedVillage.district}</span>
                              </div>
                            )}
                          </div>

                          {(selectedVillage.sector || selectedVillage.cell) && (
                            <div className="grid grid-cols-2 gap-3 py-3 border-b border-white/[0.05]">
                              {selectedVillage.sector && (
                                <div>
                                  <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Sector</span>
                                  <span className="text-white font-medium">{selectedVillage.sector}</span>
                                </div>
                              )}
                              {selectedVillage.cell && (
                                <div>
                                  <span className="text-[9px] uppercase text-[#53606b] block font-semibold">Cell</span>
                                  <span className="text-white font-medium">{selectedVillage.cell}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-3 py-3 border-b border-white/[0.05]">
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

              {/* Bottom Row: Stats Footer Dashboard - reflects the active sidebar section */}
              <StatsFooter
                activeTab={activeTab}
                activeLayerName={getActiveLayerName()}
                currentZoom={currentZoom}
                featuresInView={boundaryGeoJson?.features?.length || 0}
                selectedVillage={selectedVillage}
              />

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
