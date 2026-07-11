import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMinutes() * 60;
    
    // Fluctuating aggregate load around 245 MW
    const loadFluctuation = Math.sin(seconds / 20) * 4.5 + (Math.cos(seconds / 150) * 12);
    const nationalLoad = parseFloat((242.8 + loadFluctuation).toFixed(1));
    
    // Generation mix contributions
    const totalCap = nationalLoad;
    const hydroGen = parseFloat((totalCap * 0.38 + Math.sin(seconds / 30) * 1.5).toFixed(1));
    const methaneGen = parseFloat((totalCap * 0.42 + Math.cos(seconds / 40) * 2.0).toFixed(1));
    const solarGen = parseFloat((totalCap * 0.15 + Math.sin(seconds / 10) * 0.8).toFixed(1));
    const peatGen = parseFloat((totalCap - (hydroGen + methaneGen + solarGen)).toFixed(1));

    // Active alerts
    const activeAlerts = now.getMinutes() % 20 === 0 && now.getSeconds() < 15 ? 1 : 0;
    
    return NextResponse.json({
      timestamp: now.toISOString(),
      nationalLoadMw: nationalLoad,
      gridStatus: activeAlerts > 0 ? 'ALERT' : 'STABLE',
      activeAlertsCount: activeAlerts,
      generationMix: {
        methane: { mw: methaneGen, pct: Math.round((methaneGen / totalCap) * 100) },
        hydro: { mw: hydroGen, pct: Math.round((hydroGen / totalCap) * 100) },
        solar: { mw: solarGen, pct: Math.round((solarGen / totalCap) * 100) },
        peatThermal: { mw: peatGen, pct: Math.round((peatGen / totalCap) * 100) },
      },
      dataCenters: {
        count: 4,
        totalCapacityMw: 32.8,
        activeLoadMw: parseFloat((24.2 + Math.sin(seconds / 50) * 0.6).toFixed(1))
      },
      substations: {
        total: 18,
        active: 18
      },
      regions: [
        { name: 'Kigali City', load: parseFloat((nationalLoad * 0.45).toFixed(1)), price: parseFloat((18.2 + Math.sin(seconds / 10) * 0.3).toFixed(2)) },
        { name: 'Western Province', load: parseFloat((nationalLoad * 0.22).toFixed(1)), price: parseFloat((15.4 + Math.sin(seconds / 20) * 0.2).toFixed(2)) },
        { name: 'Eastern Province', load: parseFloat((nationalLoad * 0.18).toFixed(1)), price: parseFloat((21.8 + Math.cos(seconds / 15) * 0.4).toFixed(2)) },
        { name: 'Southern Province', load: parseFloat((nationalLoad * 0.10).toFixed(1)), price: parseFloat((19.5 + Math.sin(seconds / 8) * 0.15).toFixed(2)) },
        { name: 'Northern Province', load: parseFloat((nationalLoad * 0.05).toFixed(1)), price: parseFloat((16.9 + Math.cos(seconds / 12) * 0.25).toFixed(2)) }
      ]
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
