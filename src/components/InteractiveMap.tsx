'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface InteractiveMapProps {
  onSelectVillage: (village: any) => void;
  onMapClick: (lat: number, lng: number) => void;
  onViewportChange: (viewport: {
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    zoom: number;
  }) => void;
  boundaryGeoJson: any;
  parentBoundaryGeoJson: any;
  activeBasemap: string;
  sentinelYear: string;
}

export default function InteractiveMap({
  onSelectVillage,
  onMapClick,
  onViewportChange,
  boundaryGeoJson,
  parentBoundaryGeoJson,
  activeBasemap,
  sentinelYear
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Basemap Tile Layers
  const darkTilesRef = useRef<L.TileLayer | null>(null);
  const satTilesRef = useRef<L.TileLayer | null>(null);
  const sentinelTilesRef = useRef<L.TileLayer | null>(null);
  const blackMarbleTilesRef = useRef<L.TileLayer | null>(null);
  const osmTilesRef = useRef<L.TileLayer | null>(null);
  const terrainTilesRef = useRef<L.TileLayer | null>(null);

  // Layer References
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const parentBoundaryLayerRef = useRef<L.GeoJSON | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Map centered in Rwanda with Canvas rendering enabled for 10x vector performance
    const map = L.map(mapContainerRef.current, {
      center: [-1.9403, 29.8739],
      zoom: 9.3,
      minZoom: 8,
      maxZoom: 18,
      zoomControl: false,
      zoomSnap: 0.1,
      renderer: L.canvas() // Butter-smooth canvas drawing instead of heavy SVG path DOM nodes
    });

    mapRef.current = map;

    // Add Zoom Control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 1. Initialize Dark basemap
    darkTilesRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18
    });

    // 2. Initialize Esri Satellite basemap
    satTilesRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 18
    });

    // 3. Initialize Sentinel-2 basemap using the initial year (uses EOX 'g' tile matrix set)
    sentinelTilesRef.current = L.tileLayer(`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${sentinelYear}_3857/default/g/{z}/{y}/{x}.jpg`, {
      attribution: 'Sentinel-2 cloudless &copy; <a href="https://s2maps.eu">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data)',
      maxZoom: 18
    });

    // 4. Initialize NASA Earth at Night (Black Marble) basemap (only supports 'g' tile matrix set)
    blackMarbleTilesRef.current = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/blackmarble_3857/default/g/{z}/{y}/{x}.jpg', {
      attribution: 'NASA Earth at Night &copy; NASA &copy; EOX',
      maxZoom: 18
    });

    // 5. Initialize EOX Street Map (OpenStreetMap) basemap
    osmTilesRef.current = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/osm_3857/default/g/{z}/{y}/{x}.jpg', {
      attribution: 'Street Map &copy; OpenStreetMap contributors &copy; EOX',
      maxZoom: 18
    });

    // 6. Initialize EOX Terrain Light basemap
    terrainTilesRef.current = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/terrain-light_3857/default/g/{z}/{y}/{x}.jpg', {
      attribution: 'Terrain &copy; EOX IT Services GmbH',
      maxZoom: 18
    });

    // Set initial basemap
    if (activeBasemap === 'esri') satTilesRef.current.addTo(map);
    else if (activeBasemap === 'sentinel2') sentinelTilesRef.current.addTo(map);
    else if (activeBasemap === 'blackmarble') blackMarbleTilesRef.current.addTo(map);
    else if (activeBasemap === 'dark') darkTilesRef.current.addTo(map);
    else if (activeBasemap === 'osm') osmTilesRef.current.addTo(map);
    else if (activeBasemap === 'terrain') terrainTilesRef.current.addTo(map);

    // Load static Country Boundary outline
    fetch('/data/country boundary.geojson')
      .then(res => res.json())
      .then(data => {
        if (!mapRef.current) return;
        countryLayerRef.current = L.geoJSON(data, {
          style: {
            color: '#ffffff',
            weight: 1.5,
            opacity: 0.25,
            fillOpacity: 0.0,
            dashArray: '4,4'
          },
          interactive: false
        }).addTo(mapRef.current);
      })
      .catch(err => console.error('Failed to load Rwanda country outline', err));

    // Monitor viewport changes
    const updateViewport = () => {
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      onViewportChange({
        minLng: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),
        maxLat: bounds.getNorth(),
        zoom: zoom
      });
    };

    map.on('moveend', updateViewport);
    
    // Add map click listener to resolve coordinates hierarchically
    map.on('click', (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    // Trigger initial fetch
    setTimeout(() => {
      updateViewport();
      setIsMapReady(true);
    }, 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------
  // DYNAMIC BASEMAP CONTROLLER
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove any active tiles
    if (darkTilesRef.current && map.hasLayer(darkTilesRef.current)) map.removeLayer(darkTilesRef.current);
    if (satTilesRef.current && map.hasLayer(satTilesRef.current)) map.removeLayer(satTilesRef.current);
    if (sentinelTilesRef.current && map.hasLayer(sentinelTilesRef.current)) map.removeLayer(sentinelTilesRef.current);
    if (blackMarbleTilesRef.current && map.hasLayer(blackMarbleTilesRef.current)) map.removeLayer(blackMarbleTilesRef.current);
    if (osmTilesRef.current && map.hasLayer(osmTilesRef.current)) map.removeLayer(osmTilesRef.current);
    if (terrainTilesRef.current && map.hasLayer(terrainTilesRef.current)) map.removeLayer(terrainTilesRef.current);

    // Update Sentinel tiles URL if year changed
    if (sentinelTilesRef.current) {
      sentinelTilesRef.current.setUrl(`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${sentinelYear}_3857/default/g/{z}/{y}/{x}.jpg`);
    }

    // Add selected layer
    if (activeBasemap === 'dark') {
      darkTilesRef.current?.addTo(map);
    } else if (activeBasemap === 'esri') {
      satTilesRef.current?.addTo(map);
    } else if (activeBasemap === 'sentinel2') {
      sentinelTilesRef.current?.addTo(map);
    } else if (activeBasemap === 'blackmarble') {
      blackMarbleTilesRef.current?.addTo(map);
    } else if (activeBasemap === 'osm') {
      osmTilesRef.current?.addTo(map);
    } else if (activeBasemap === 'terrain') {
      terrainTilesRef.current?.addTo(map);
    }
  }, [activeBasemap, sentinelYear]);

  // -------------------------------------------------------------
  // RENDER DYNAMIC BOUNDARIES BASED ON ACTIVE LAYER DATA
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Clean up previous active boundary layer
    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }

    if (!boundaryGeoJson || !boundaryGeoJson.features || boundaryGeoJson.features.length === 0) return;

    // Detect layer type from feature properties
    const sample = boundaryGeoJson.features[0].properties;
    const isVillage = 'village_id' in sample;
    const isCell = 'cell_id' in sample && !isVillage;
    const isSector = 'sector_id' in sample && !isCell && !isVillage;
    const isDistrict = 'district_i' in sample && !isSector && !isCell && !isVillage;
    const isProvince = !isDistrict && !isSector && !isCell && !isVillage;

    const isSatellite = activeBasemap === 'esri' || activeBasemap === 'sentinel2' || activeBasemap === 'blackmarble';

    // Custom stylings based on Rwanda Flag Colors (Active layer has lighter weight for contextual comparison)
    const style = (feature: any) => {
      if (isProvince) {
        return {
          color: '#00A3E0', // Flag Blue
          weight: 1.5,
          opacity: 0.6,
          fillColor: '#00A3E0',
          fillOpacity: 0.03
        };
      } else if (isDistrict) {
        return {
          color: '#FCD116', // Flag Yellow
          weight: 1.2,
          opacity: 0.55,
          fillColor: '#FCD116',
          fillOpacity: 0.03
        };
      } else if (isSector) {
        return {
          color: '#FCD116', // Flag Yellow
          weight: 1.0,
          opacity: 0.5,
          fillColor: '#FCD116',
          fillOpacity: 0.02
        };
      } else if (isCell) {
        return {
          color: '#FCD116', // Flag Yellow
          weight: 0.8,
          opacity: 0.45,
          fillColor: '#FCD116',
          fillOpacity: 0.02
        };
      } else {
        // Villages
        return {
          color: '#FCD116', // Flag Yellow for Villages
          weight: isSatellite ? 1.4 : 0.6, 
          opacity: isSatellite ? 0.8 : 0.4, 
          fillColor: '#FCD116',
          fillOpacity: isSatellite ? 0.05 : 0.01
        };
      }
    };

    // Hover events and popups
    const onEachFeature = (feature: any, layer: L.Layer) => {
      layer.on({
        mouseover: (e) => {
          const l = e.target;
          // Set glow highlights: Blue for yellow boundaries, Yellow for blue boundaries
          l.setStyle({
            color: isProvince ? '#FCD116' : '#00A3E0',
            weight: isProvince ? 3.0 : 2.0,
            opacity: 1.0,
            fillColor: isProvince ? '#FCD116' : '#00A3E0',
            fillOpacity: 0.15
          });
          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            l.bringToFront();
          }
        },
        mouseout: (e) => {
          if (boundaryLayerRef.current) {
            boundaryLayerRef.current.resetStyle(e.target);
          }
        },
        click: (e) => {
          if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          }
          onSelectVillage(feature.properties);
        }
      });

      // Bind dynamic descriptive tooltips
      const props = feature.properties;
      let tooltipContent = '';
      if (isProvince) {
        tooltipContent = `<strong class="text-[#00A3E0] text-xs font-semibold block">${props.province}</strong><span class="text-[9px] text-gray-400 block">Province Level</span>`;
      } else if (isDistrict) {
        tooltipContent = `<strong class="text-[#FCD116] text-xs font-semibold block">${props.district} District</strong><span class="text-[10px] text-gray-300 block">${props.province}</span>`;
      } else if (isSector) {
        tooltipContent = `<strong class="text-[#FCD116] text-xs font-semibold block">${props.sector} Sector</strong><span class="text-[10px] text-gray-300 block">${props.district} District</span>`;
      } else if (isCell) {
        tooltipContent = `<strong class="text-[#FCD116] text-xs font-semibold block">${props.cell} Cell</strong><span class="text-[10px] text-gray-300 block">${props.sector} Sector</span>`;
      } else {
        tooltipContent = `<strong class="text-[#FCD116] text-xs font-semibold block">${props.village}</strong><span class="text-[10px] text-gray-300 block">${props.cell} Cell, ${props.sector} Sector</span>`;
      }

      layer.bindTooltip(
        `<div class="text-left font-sans">${tooltipContent}</div>`,
        { sticky: true, className: 'leaflet-tooltip' }
      );
    };

    // Render GeoJSON to map optimized for Canvas rendering
    boundaryLayerRef.current = L.geoJSON(boundaryGeoJson, {
      style,
      onEachFeature
    }).addTo(map);

    // Keep active layer on top of parent contextual boundaries
    if (boundaryLayerRef.current && parentBoundaryLayerRef.current) {
      boundaryLayerRef.current.bringToFront();
    }

  }, [boundaryGeoJson, isMapReady]);

  // -------------------------------------------------------------
  // RENDER PARENT BOUNDARIES (UPPER OUTLINES FOR CONTEXT)
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Clean up previous parent outline layer
    if (parentBoundaryLayerRef.current) {
      map.removeLayer(parentBoundaryLayerRef.current);
      parentBoundaryLayerRef.current = null;
    }

    if (!parentBoundaryGeoJson || !parentBoundaryGeoJson.features || parentBoundaryGeoJson.features.length === 0) return;

    const sample = parentBoundaryGeoJson.features[0].properties;
    const isProvince = !('district_i' in sample);

    const isSatellite = activeBasemap === 'esri' || activeBasemap === 'sentinel2' || activeBasemap === 'blackmarble';

    // Thicker, bolder Flag Blue outlines for parent boundaries to provide context
    const style = {
      color: '#00A3E0', // Flag Blue
      weight: isSatellite ? 3.0 : 2.5, // Thicker outline
      opacity: isSatellite ? 0.95 : 0.85,
      fillColor: 'none',
      fillOpacity: 0.0,
      dashArray: isProvince ? undefined : '8, 8' // Dashed for sectors/districts
    };

    // Render GeoJSON for non-interactive background vectors
    parentBoundaryLayerRef.current = L.geoJSON(parentBoundaryGeoJson, {
      style,
      interactive: false
    }).addTo(map);

    // Ensure active boundary layer stays on top for interactive events
    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.bringToFront();
    }

  }, [parentBoundaryGeoJson, isMapReady]);

  return (
    <div className="w-full h-full relative z-0">
      {/* Map Container Element */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-full" 
        style={{ background: '#060709' }}
      />
    </div>
  );
}
