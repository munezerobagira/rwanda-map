import type { NextConfig } from 'next';
import RWANDA from './src/lib/regions/rwanda.json';
const rawBoundaryInputs = [...RWANDA.boundaries.rawInputs.map((file) => `./data/raw-boundaries/${file}`), './data/archived-building-indexes/**/*', './public/data/footprints/objects/**/*'];
const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/data/footprints/objects/:file', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
  // Startup instrumentation is a non-route entry and needs its own matcher.
  // Required precomputed assets are validated before every build.
  outputFileTracingExcludes: {
    '/*': rawBoundaryInputs,
    instrumentation: rawBoundaryInputs,
    'next-server': rawBoundaryInputs
  }
};
export default nextConfig;
