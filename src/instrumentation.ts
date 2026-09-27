// Runs once when a server instance starts. Warms the boundary data in the
// background (not awaited - the server starts accepting requests right away;
// anything requested before warm-up finishes just loads on demand as before).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { warmSpatialStore } = await import('@/lib/spatialStore');
    warmSpatialStore().catch((err) => console.error('SpatialStore warm-up failed', err));
  }
}
