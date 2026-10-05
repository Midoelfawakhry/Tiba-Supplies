import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Truck,
  Building2,
  Mountain,
  Navigation,
  Radio,
  Play,
  Pause,
  Maximize2,
  RefreshCw,
  Info
} from 'lucide-react';
import { Quarry, ClientFactory, FleetTruck, TripLoad } from '../types/fleet';

interface LiveTrackingMapProps {
  quarries: Quarry[];
  clients: ClientFactory[];
  trucks: FleetTruck[];
  trips: TripLoad[];
  onSimulateTick: () => void;
}

export const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  quarries,
  clients,
  trucks,
  trips,
  onSimulateTick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);

  const [isSimulating, setIsSimulating] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'driver' | 'quarry' | 'factory';
    data: any;
  } | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Centered roughly on Eastern Desert / Suez / Sokhna corridor
      const map = L.map(mapContainerRef.current, {
        center: [29.8, 32.1],
        zoom: 9,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Clean dark CartoDB tiles or standard OpenStreetMap
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      routesLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      // Keep map reference across sub-renders if needed, or destroy on full unmount
    };
  }, []);

  // Update Markers & Routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const routesLayer = routesLayerRef.current;
    if (!map || !markersLayer || !routesLayer) return;

    markersLayer.clearLayers();
    routesLayer.clearLayers();

    // 1. Quarries markers (Amber mountain badge)
    quarries.forEach((q) => {
      const quarryIcon = L.divIcon({
        className: 'custom-quarry-pin',
        html: `
          <div style="background-color: #d97706; color: #ffffff; border: 2px solid #78350f; border-radius: 8px; padding: 4px 8px; font-weight: bold; font-size: 11px; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px;">
            <span>⛰️</span>
            <span>${q.name}</span>
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 15]
      });

      const marker = L.marker([q.location.lat, q.location.lng], { icon: quarryIcon })
        .addTo(markersLayer)
        .on('click', () => {
          setSelectedEntity({ type: 'quarry', data: q });
        });

      marker.bindPopup(`
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; text-align: right; min-width: 180px;">
          <h4 style="font-weight: bold; color: #b45309; margin: 0 0 4px 0;">⛰️ ${q.name}</h4>
          <p style="font-size: 12px; margin: 0 0 4px 0; color: #4b5563;">المنطقة: ${q.region}</p>
          <p style="font-size: 12px; margin: 0 0 4px 0; color: #1f2937;"><strong>الخامات:</strong> ${q.materialsAvailable.join('، ')}</p>
          ${q.contactPhone ? `<p style="font-size: 11px; margin: 4px 0 0 0; color: #2563eb;">📞 مسؤول الكسارة: ${q.contactPhone}</p>` : ''}
        </div>
      `);
    });

    // 2. Client Factories markers (Blue factory badge)
    clients.forEach((c) => {
      const factoryIcon = L.divIcon({
        className: 'custom-factory-pin',
        html: `
          <div style="background-color: #2563eb; color: #ffffff; border: 2px solid #1e3a8a; border-radius: 8px; padding: 4px 8px; font-weight: bold; font-size: 11px; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 4px;">
            <span>🏭</span>
            <span>${c.name}</span>
          </div>
        `,
        iconSize: [130, 30],
        iconAnchor: [65, 15]
      });

      const marker = L.marker([c.location.lat, c.location.lng], { icon: factoryIcon })
        .addTo(markersLayer)
        .on('click', () => {
          setSelectedEntity({ type: 'factory', data: c });
        });

      marker.bindPopup(`
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; text-align: right; min-width: 180px;">
          <h4 style="font-weight: bold; color: #1d4ed8; margin: 0 0 4px 0;">🏭 ${c.name}</h4>
          <p style="font-size: 12px; margin: 0 0 4px 0; color: #4b5563;">العميل: ${c.clientName}</p>
          <p style="font-size: 12px; margin: 0 0 4px 0; color: #4b5563;">المنطقة: ${c.industrialZone}</p>
          ${c.unloadingNotes ? `<p style="font-size: 11px; margin: 4px 0 0 0; color: #d97706;">⚠️ ${c.unloadingNotes}</p>` : ''}
        </div>
      `);
    });

    // 3. Active Hauling Trips & Driver Truck Pins
    trips.forEach((trip) => {
      if (trip.status === 'delivered') return;

      const loc = trip.currentLocation;
      const isMoving = trip.status === 'in_transit' || trip.status === 'claimed';

      const truckIcon = L.divIcon({
        className: 'custom-truck-pin',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <div style="background-color: #09090b; color: #f59e0b; border: 2px solid #f59e0b; border-radius: 9999px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4); animation: ${isMoving ? 'pulse 2s infinite' : 'none'};">
              🚛
            </div>
            <div style="background-color: #18181b; color: #fafafa; border: 1px solid #3f3f46; border-radius: 6px; padding: 2px 6px; font-weight: bold; font-size: 10px; white-space: nowrap; margin-top: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">
              ${trip.driverName} (${trip.truckPlate})
            </div>
          </div>
        `,
        iconSize: [110, 50],
        iconAnchor: [55, 17]
      });

      const marker = L.marker([loc.lat, loc.lng], { icon: truckIcon })
        .addTo(markersLayer)
        .on('click', () => {
          setSelectedEntity({ type: 'driver', data: trip });
        });

      // Draw polyline connecting origin quarry, truck, and destination factory
      const routePoints: [number, number][] = [
        [trip.quarryCoords.lat, trip.quarryCoords.lng],
        [loc.lat, loc.lng],
        [trip.factoryCoords.lat, trip.factoryCoords.lng]
      ];

      L.polyline(routePoints, {
        color: '#f59e0b',
        weight: 3,
        opacity: 0.7,
        dashArray: '6, 8'
      }).addTo(routesLayer);

      marker.bindPopup(`
        <div style="direction: rtl; font-family: 'Cairo', sans-serif; text-align: right; min-width: 200px;">
          <h4 style="font-weight: bold; color: #18181b; margin: 0 0 2px 0;">🚛 السائق: ${trip.driverName}</h4>
          <p style="font-size: 11px; margin: 0 0 4px 0; color: #d97706; font-weight: bold;">لوحة: ${trip.truckPlate}</p>
          <div style="font-size: 12px; margin: 4px 0; border-top: 1px solid #e5e7eb; padding-top: 4px;">
            <p style="margin: 2px 0;"><strong>الحمولة:</strong> ${trip.material}</p>
            <p style="margin: 2px 0;"><strong>المحجر:</strong> ${trip.quarryName}</p>
            <p style="margin: 2px 0;"><strong>المصنع:</strong> ${trip.factoryName}</p>
            <p style="margin: 2px 0;"><strong>الحالة:</strong> ${loc.statusText}</p>
            <p style="margin: 2px 0; color: #16a34a;"><strong>السرعة:</strong> ${loc.speedKmH || 0} كم/س</p>
            ${trip.ticketNumber ? `<p style="margin: 2px 0; color: #2563eb;"><strong>بون ميزان:</strong> ${trip.ticketNumber}</p>` : ''}
          </div>
        </div>
      `);
    });

  }, [quarries, clients, trips, trucks]);

  // Real-time position simulation ticker
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      onSimulateTick();
    }, 4000);
    return () => clearInterval(interval);
  }, [isSimulating, onSimulateTick]);

  const activeTripsCount = trips.filter(t => t.status !== 'delivered').length;

  return (
    <div className="space-y-4">
      
      {/* Map Control Bar & Quick Stats */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>تتبع السائقين في الوقت الفعلي (Live GPS Fleet Radar)</span>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">
                مباشر 🟢
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              يبدأ التتبع تلقائياً فور تعيين الحمولة أو قبول السائق لها، مع عرض السرعة ومراحل التحميل والتفريغ
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
              isSimulating
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'bg-zinc-800 text-zinc-300 hover:text-white'
            }`}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulating ? 'إيقاف محاكاة الحركة' : 'تشغيل محاكاة الحركة'}</span>
          </button>

          <button
            onClick={() => {
              if (mapInstanceRef.current) {
                mapInstanceRef.current.setView([29.8, 32.1], 9);
              }
            }}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs transition"
            title="إعادة ضبط زاوية الخريطة"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Frame */}
      <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Overlay Key / Legend */}
        <div className="absolute top-4 right-4 z-10 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 shadow-xl space-y-2 pointer-events-auto max-w-xs">
          <div className="font-bold text-white pb-1 border-b border-zinc-800 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-500" />
            <span>دليل خريطة الأسطول الحية:</span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-amber-600 shrink-0"></span>
              <span><strong>المحاجر:</strong> مواقع استخراج السن والرمل والدبش</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-600 shrink-0"></span>
              <span><strong>المصانع والعملاء:</strong> مواقع التوريد والتفريغ</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0 animate-ping"></span>
              <span><strong>تريلات النقل:</strong> سيارات متحركة مع تتبع حي ومسار النقلة</span>
            </div>
          </div>
        </div>

        {/* Selected Entity Card Overlay */}
        {selectedEntity && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-96 z-10 bg-zinc-900/95 backdrop-blur-md border border-amber-500/60 rounded-xl p-4 shadow-2xl text-zinc-100 animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-amber-400">
                {selectedEntity.type === 'driver' && 'تفاصيل تتبع السائق المباشر'}
                {selectedEntity.type === 'quarry' && 'تفاصيل المحجر وموقع التحميل'}
                {selectedEntity.type === 'factory' && 'تفاصيل المصنع وجهة الاستلام'}
              </span>
              <button
                onClick={() => setSelectedEntity(null)}
                className="text-zinc-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 text-xs space-y-1.5">
              {selectedEntity.type === 'driver' && (
                <>
                  <div className="font-bold text-sm text-white">
                    {selectedEntity.data.driverName} - لوحة: {selectedEntity.data.truckPlate}
                  </div>
                  <div>الحمولة: <span className="text-amber-400 font-bold">{selectedEntity.data.material}</span></div>
                  <div>المحجر: {selectedEntity.data.quarryName}</div>
                  <div>المصنع: {selectedEntity.data.factoryName}</div>
                  <div className="text-emerald-400 font-semibold">{selectedEntity.data.currentLocation.statusText}</div>
                  <div>السرعة المقاسة: {selectedEntity.data.currentLocation.speedKmH} كم/س</div>
                  {selectedEntity.data.notes && (
                    <div className="p-2 bg-zinc-950 rounded text-[11px] text-zinc-300">
                      ملاحظات: {selectedEntity.data.notes}
                    </div>
                  )}
                </>
              )}

              {selectedEntity.type === 'quarry' && (
                <>
                  <div className="font-bold text-sm text-white">
                    {selectedEntity.data.name}
                  </div>
                  <div className="text-zinc-400">{selectedEntity.data.region}</div>
                  <div>الخامات المتاحة: {selectedEntity.data.materialsAvailable.join('، ')}</div>
                  {selectedEntity.data.contactPhone && (
                    <div className="text-amber-400">هاتف الكسارة: {selectedEntity.data.contactPhone}</div>
                  )}
                  {selectedEntity.data.gateNotes && (
                    <div className="p-2 bg-zinc-950 rounded text-[11px] text-amber-300">
                      تعليمات البوابة: {selectedEntity.data.gateNotes}
                    </div>
                  )}
                </>
              )}

              {selectedEntity.type === 'factory' && (
                <>
                  <div className="font-bold text-sm text-white">
                    {selectedEntity.data.name}
                  </div>
                  <div className="text-zinc-400">العميل: {selectedEntity.data.clientName}</div>
                  <div>المنطقة الصناعية: {selectedEntity.data.industrialZone}</div>
                  {selectedEntity.data.unloadingNotes && (
                    <div className="p-2 bg-zinc-950 rounded text-[11px] text-amber-300">
                      تعليمات التفريغ: {selectedEntity.data.unloadingNotes}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
};
