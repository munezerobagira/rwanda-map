# ADR 0003 — Reduce mobile raster transfer without changing source resolution

Date: 2026-11-14. Accepted for implementation after a local benchmark.

A Kigali 256×256 native-10m-derived display tile is 206,273 bytes as lossless PNG.
Measured with the same sharp encoder/input:

| Format | Bytes | Encode time |
| --- | ---: | ---: |
| PNG | 206,273 | 11ms |
| 256-color PNG | 63,913 | 208ms |
| Lossless WebP | 147,910 | 127ms |
| WebP quality 90 | 39,176 | 13ms |

Choose WebP90 for presentation tiles: ~81% less transfer in this sample, negligible
extra CPU, full alpha support for missing coverage and no 256-color quantization.
The source remains Copernicus 10m RGB; no finer-resolution claim is introduced.
Quantitative analysis must read original data, never compressed basemap pixels.
PNG remains the user's output format for map and selected-area image exports.
Leaflet and canvas can draw WebP images in supported modern Android browsers.
Browsers below the framework's support baseline are not a reason to transfer
five times the data to all users. Inspected the compressed tile visually.

Test policy: this is an encoder/HTTP content-type change; verify actual bytes,
correct content-type, alpha and existing export code compatibility. Do not add a
test merely asserting the chosen encoder's option mirrors its implementation.

Source accessed 2026-11-14: https://sharp.pixelplumbing.com/api-output/#webp
