# ADR 0010 — Restore Esri imagery as explicitly requested

2026-11-15. User instruction: keep Esri because its higher-resolution imagery is
useful. This supersedes the earlier open-data-only/blanket-resolution exclusion
for this specific basemap. It does not authorize other proprietary/keyed layers.

Compare leaving Esri removed (violates the latest user request) with restoring
the original anonymous World_Imagery tile endpoint as an additional visual option.
Choose restoration, preserving dated Sentinel-2 and its A/B workflow. Esri is a
rolling multiscale mosaic, not an arbitrary-date source; never label it with the
selected Sentinel period or manufacture a 2025/2026 swipe. Building analysis
still uses selected dates and open mapped footprints, independently of basemap.

Live service metadata/tile requests work without tokens. Copyright now names
Esri, Vantor, Earthstar Geographics and the GIS User Community. Native resolution
varies by source and scale (including lower-resolution overview content); do not
revive the baseline's unsupported universal "Sub-metre" badge. Display "High-res"
with a variable-resolution/date note. Source is Esri-licensed, not open data.
Use the same canvas/export flow with Esri attribution burned into static PNGs;
no tile-package export, bulk harvesting, ML derivation or claimed validation
rights are added. Source date/history remain unavailable in this tile endpoint.

Sources accessed2026-11-15:
- https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson — current source credit, multiscale layers and public service.
- https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=pjson — World Imagery item, Esri Master License Agreement, no offline tile export.
- https://doc.arcgis.com/en/data-appliance/latest/imagery-elevation/world-imagery.htm — resolution variation and citation layer.
