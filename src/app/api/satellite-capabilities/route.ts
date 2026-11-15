// Backwards-compatible annual discovery; dated scene availability is queried
// per period and is never inferred from an advertised list of years.
export async function GET() {
  const current = new Date().getUTCFullYear();
  return Response.json(
    {
      years: Array.from({ length: current - 2018 }, (_, i) => String(2019 + i)),
      source: 'Copernicus Sentinel-2 L2A / Earth Search',
      nativeResolutionM: 10,
      periodComparison: true,
      availability:
        'Query /api/imagery/scenes for actual acquisition dates; a listed year does not guarantee cloud-free imagery.'
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } }
  );
}
