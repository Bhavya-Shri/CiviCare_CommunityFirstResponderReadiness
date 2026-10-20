import React, { useState, useEffect } from 'react';
import { 
  Activity, MapPin, RefreshCw, AlertTriangle, ShieldCheck, 
  Users, ShieldAlert, CheckCircle2, PhoneCall, Radio, Eye, EyeOff, 
  ChevronRight, X, HeartPulse, Building2, UserCheck
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiFetch } from '../api';

const volunteerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [22, 36],
  iconAnchor: [11, 36],
  popupAnchor: [1, -30],
  shadowSize: [36, 36]
});

// Dynamic HTML DivIcon for Zones with clear status badges & count
const createZoneLabelIcon = (zoneName, count, status, isSelected) => {
  let bgClass = 'bg-emerald-700 text-white border-white';
  let badgeClass = 'bg-emerald-100 text-emerald-900';
  if (status === 'CRITICAL_ZERO') {
    bgClass = 'bg-red-700 text-white border-white';
    badgeClass = 'bg-red-100 text-red-900';
  } else if (status === 'UNDERSERVED_SINGLE') {
    bgClass = 'bg-amber-700 text-white border-white';
    badgeClass = 'bg-amber-100 text-amber-900';
  } else if (status === 'MODERATE') {
    bgClass = 'bg-teal-700 text-white border-white';
    badgeClass = 'bg-teal-100 text-teal-900';
  }

  const ringStyle = isSelected ? 'ring-4 ring-ink ring-offset-1 scale-110 z-50' : 'hover:scale-105';

  return L.divIcon({
    className: 'custom-zone-label',
    html: `
      <div style="transform: translate(-50%, -50%);" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-md border-2 ${bgClass} text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${ringStyle}">
        <span>${zoneName}</span>
        <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${badgeClass}">${count}</span>
      </div>
    `,
    iconSize: [0, 0]
  });
};

function MapController({ targetPos }) {
  const map = useMap();
  useEffect(() => {
    if (targetPos) {
      map.setView(targetPos, 13, { animate: true });
    }
  }, [targetPos, map]);
  return null;
}

const STATUS_CONFIG = {
  ADEQUATE: { 
    fill: '#28766B', 
    border: '#1E5A52', 
    label: 'Optimal (3+)', 
    textClass: 'text-emerald-700', 
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' 
  },
  MODERATE: { 
    fill: '#318579', 
    border: '#236057', 
    label: 'Moderate (2)', 
    textClass: 'text-teal-700', 
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-300' 
  },
  UNDERSERVED_SINGLE: { 
    fill: '#C58A32', 
    border: '#9E6D24', 
    label: 'Single Defender (1)', 
    textClass: 'text-amber-800', 
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300' 
  },
  CRITICAL_ZERO: { 
    fill: '#C83D43', 
    border: '#9E2A2E', 
    label: 'Zero Coverage (0)', 
    textClass: 'text-red-800', 
    badgeClass: 'bg-red-50 text-red-900 border-red-300' 
  }
};

export default function ReadinessDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showVolunteers, setShowVolunteers] = useState(true);
  const [mapTarget, setMapTarget] = useState(null);

  const fetchReadiness = () => {
    setLoading(true);
    setError(null);
    apiFetch('/dashboard/readiness')
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to retrieve live readiness telemetry.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  const { zones = [], summary = {}, activeResponders = [] } = data || {};

  const filteredZones = zones.filter((z) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'OPTIMAL') return z.readiness_status === 'ADEQUATE' || z.readiness_status === 'MODERATE';
    return z.readiness_status === statusFilter;
  });

  const handleSelectZone = (zone) => {
    setSelectedZone(zone);
    setMapTarget([zone.center_lat, zone.center_lng]);
  };

  // Find active volunteers assigned to the selected zone
  const selectedZoneVolunteers = selectedZone
    ? activeResponders.filter(r => r.base_zone_id === selectedZone.zone_id)
    : [];

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 animate-in fade-in space-y-6">
      
      {/* Page Header Bar */}
      {/* Page Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-warm-border gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            Zone Readiness
          </h1>
          <span className="text-[11px] font-semibold text-slate-600 bg-white border border-warm-border px-2.5 py-0.5 rounded-full shadow-xs">
            15 Chennai Zones
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReadiness}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-warm-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs">
          {error}
        </div>
      )}

      {/* Top High-Contrast Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Monitored Zones */}
        <div className="bg-white border-2 border-warm-border rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-warm-slate tracking-wider">
            Monitored Zones
          </div>
          <div className="text-3xl font-extrabold text-ink mt-1">
            {summary.totalZones || 15}
          </div>
        </div>

        {/* Volunteers on Active Shift */}
        <div className="bg-white border-2 border-emerald-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-emerald-800 tracking-wider flex items-center justify-between">
            <span>Volunteers on Shift</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-3xl font-extrabold text-emerald-950 mt-1">
            {summary.totalEligibleFreeResponders ?? 15}
          </div>
        </div>

        {/* Single Defender Zones */}
        <div className="bg-white border-2 border-amber-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-amber-800 tracking-wider">
            Single Defender Zones
          </div>
          <div className="text-3xl font-extrabold text-amber-950 mt-1">
            {summary.underservedSingleZones ?? 7}
          </div>
        </div>

        {/* Zero Coverage Deserts */}
        <div className="bg-white border-2 border-red-200 rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold uppercase text-red-800 tracking-wider">
            Zero Coverage Deserts
          </div>
          <div className="text-3xl font-extrabold text-red-950 mt-1">
            {summary.criticalZeroZones ?? 4}
          </div>
        </div>

      </div>

      {/* Main Split Layout: Spatial Map on Left (6 cols), Zone Registry Table on Right (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Spatial Readiness Map */}
        <div className="lg:col-span-6 bg-white border border-warm-border rounded-xl overflow-hidden flex flex-col h-[580px] lg:h-[680px] sticky top-20 shadow-xs">
          
          {/* Map Top Bar */}
          <div className="p-3.5 border-b border-warm-border bg-warm-bg flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sage" />
              <span className="font-bold text-ink">Spatial Telemetry Map</span>
            </div>

            {/* Toggle Active Volunteer GPS Pins */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowVolunteers(!showVolunteers)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                  showVolunteers
                    ? 'bg-purple-50 text-purple-900 border-purple-300'
                    : 'bg-white text-warm-slate border-warm-border hover:text-ink'
                }`}
              >
                {showVolunteers ? <Eye className="w-3.5 h-3.5 text-purple-700" /> : <EyeOff className="w-3.5 h-3.5 text-warm-slate" />}
                <span>Active Volunteers ({activeResponders.length})</span>
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Map */}
          <div className="flex-1 relative">
            <MapContainer
              center={[13.0450, 80.2200]}
              zoom={11}
              scrollWheelZoom={true}
              className="w-full h-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController targetPos={mapTarget} />

              {/* Selected Zone Boundary Circle Only (Avoids Muddy Multi-Circle Overlap) */}
              {selectedZone && (
                <Circle
                  center={[selectedZone.center_lat, selectedZone.center_lng]}
                  radius={3500}
                  pathOptions={{
                    fillColor: STATUS_CONFIG[selectedZone.readiness_status]?.fill || '#28766B',
                    fillOpacity: 0.16,
                    color: STATUS_CONFIG[selectedZone.readiness_status]?.border || '#1E5A52',
                    weight: 2,
                    dashArray: '5, 5'
                  }}
                />
              )}

              {/* 15 Clean Custom Zone Badges with live counts */}
              {zones.map((z) => {
                const count = parseInt(z.eligible_free_responders, 10) || 0;
                const isSelected = selectedZone?.zone_id === z.zone_id;
                const icon = createZoneLabelIcon(z.zone_name, count, z.readiness_status, isSelected);

                return (
                  <Marker
                    key={z.zone_id}
                    position={[z.center_lat, z.center_lng]}
                    icon={icon}
                    eventHandlers={{
                      click: () => handleSelectZone(z)
                    }}
                  >
                    <Popup>
                      <div className="p-1 font-sans space-y-1.5 min-w-[190px]">
                        <div className="font-bold text-xs text-ink">
                          Zone {z.zone_id}: {z.zone_name}
                        </div>
                        <div className="text-xs font-semibold text-emerald-800">
                          {count} Certified Volunteers on Shift
                        </div>
                        <div className="text-[11px] text-warm-slate">
                          Population: ~{z.population_estimate ? z.population_estimate.toLocaleString() : 'N/A'}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectZone(z)}
                          className="w-full mt-1 bg-ink hover:bg-ink-light text-white text-[11px] font-bold py-1 px-2 rounded transition-colors text-center"
                        >
                          Inspect Zone Details
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* Optional Active Volunteer GPS Pins */}
              {showVolunteers && activeResponders.map((r) => (
                <Marker
                  key={r.responder_id}
                  position={[r.current_lat, r.current_lng]}
                  icon={volunteerIcon}
                >
                  <Popup>
                    <div className="p-1 font-sans space-y-1">
                      <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                        VOLUNTEER ON SHIFT
                      </span>
                      <div className="font-bold text-xs text-ink">{r.full_name}</div>
                      <div className="text-[10px] text-warm-slate">{r.organisation_name}</div>
                      <div className="text-[10px] text-warm-slate">Base: Zone {r.base_zone_id} ({r.zone_name})</div>
                      <a
                        href={`tel:${r.phone}`}
                        className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs mt-1"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>{r.phone}</span>
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}

            </MapContainer>
          </div>

          {/* Map Footer Note */}
          <div className="p-3 bg-warm-bg border-t border-warm-border text-[11px] text-warm-slate flex items-center justify-between">
            <span>Tap any zone pill to inspect coverage health. Violet markers denote volunteers on active shift.</span>
            {selectedZone && (
              <span className="font-bold text-ink">
                Zone {selectedZone.zone_id}: {selectedZone.zone_name}
              </span>
            )}
          </div>

        </div>

        {/* Right Column: Zone Readiness Registry Table & Inspector Drawer */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* Selected Zone Inspector Card (Opens when a zone is clicked) */}
          {selectedZone && (
            <div className="bg-white border-2 border-emerald-600 rounded-xl p-5 shadow-sm space-y-4 animate-in fade-in">
              <div className="flex items-start justify-between pb-3 border-b border-warm-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                      ZONE {selectedZone.zone_id} • {selectedZone.zone_code}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${STATUS_CONFIG[selectedZone.readiness_status]?.badgeClass}`}>
                      {STATUS_CONFIG[selectedZone.readiness_status]?.label}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-ink mt-1">
                    {selectedZone.zone_name} Administrative Sector
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedZone(null)}
                  className="p-1 text-warm-slate hover:text-ink hover:bg-warm-bg rounded-md"
                  title="Close Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Zone Health Metrics */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 bg-warm-bg/70 rounded-lg border border-warm-border">
                  <div className="text-[10px] font-bold uppercase text-warm-slate">Active Volunteers</div>
                  <div className="text-base font-extrabold text-ink mt-0.5">
                    {selectedZone.eligible_free_responders} on duty
                  </div>
                </div>
                <div className="p-2.5 bg-warm-bg/70 rounded-lg border border-warm-border">
                  <div className="text-[10px] font-bold uppercase text-warm-slate">Zone Population</div>
                  <div className="text-base font-extrabold text-ink mt-0.5">
                    ~{selectedZone.population_estimate ? selectedZone.population_estimate.toLocaleString() : '150,000'}
                  </div>
                </div>
                <div className="p-2.5 bg-warm-bg/70 rounded-lg border border-warm-border">
                  <div className="text-[10px] font-bold uppercase text-warm-slate">Total Enrolled</div>
                  <div className="text-base font-extrabold text-ink mt-0.5">
                    {selectedZone.total_registered_responders || selectedZone.eligible_free_responders} citizens
                  </div>
                </div>
              </div>

              {/* Responders on Duty in this Zone */}
              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Volunteers Currently On Duty in Zone</span>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    {selectedZoneVolunteers.length} Active
                  </span>
                </h4>

                {selectedZoneVolunteers.length > 0 ? (
                  <div className="space-y-2">
                    {selectedZoneVolunteers.map(vol => (
                      <div key={vol.responder_id} className="p-2.5 bg-warm-bg/50 rounded-lg border border-warm-border flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-ink">{vol.full_name}</div>
                          <div className="text-[11px] text-warm-slate">{vol.organisation_name}</div>
                        </div>
                        <a
                          href={`tel:${vol.phone}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Call</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Zero Coverage Alert: No active volunteers in this zone</span>
                    </div>
                    <p className="text-[11px] text-red-800 leading-relaxed">
                      If an emergency occurs in {selectedZone.zone_name}, the coverage-aware algorithm will automatically pull verified mutual-aid responders from adjacent Chennai zones.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Table Container Card */}
          <div className="bg-white border border-warm-border rounded-xl shadow-xs overflow-hidden flex flex-col">
            
            {/* Table Filter Tabs */}
            <div className="p-4 border-b border-warm-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-ink">
                Zone Readiness Registry (15 Zones)
              </h3>

              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: `All (15)` },
                  { id: 'OPTIMAL', label: `Optimal (4)` },
                  { id: 'UNDERSERVED_SINGLE', label: `Single Defender (7)` },
                  { id: 'CRITICAL_ZERO', label: `Zero Desert (4)` }
                ].map((tab) => {
                  const isSelected = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-2.5 py-1 text-xs rounded-lg border-2 font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3.5">Zone & Sector</th>
                    <th className="py-2.5 px-3.5">Active on Shift</th>
                    <th className="py-2.5 px-3.5">Population</th>
                    <th className="py-2.5 px-3.5">Readiness Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-border">
                  {filteredZones.map((z) => {
                    const cfg = STATUS_CONFIG[z.readiness_status] || STATUS_CONFIG.CRITICAL_ZERO;
                    const isSelected = selectedZone?.zone_id === z.zone_id;
                    const activeCount = parseInt(z.eligible_free_responders, 10) || 0;

                    return (
                      <tr
                        key={z.zone_id}
                        onClick={() => handleSelectZone(z)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600' 
                            : 'hover:bg-warm-bg/70'
                        }`}
                      >
                        <td className="py-3 px-3.5 font-bold text-ink">
                          <span>{z.zone_name}</span>
                          <span className="text-[10px] text-warm-slate font-medium block">
                            Zone {z.zone_id} • {z.zone_code}
                          </span>
                        </td>

                        <td className="py-3 px-3.5 font-semibold text-ink">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${activeCount > 1 ? 'bg-emerald-600' : activeCount === 1 ? 'bg-amber-500' : 'bg-red-600'}`} />
                            <span>{activeCount} on duty</span>
                          </span>
                        </td>

                        <td className="py-3 px-3.5 text-warm-slate">
                          ~{z.population_estimate ? z.population_estimate.toLocaleString() : '150,000'}
                        </td>

                        <td className="py-3 px-3.5">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${cfg.badgeClass}`}>
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-warm-bg border-t border-warm-border text-[11px] text-warm-slate flex items-center justify-between">
              <span>All 15 Chennai administrative sectors</span>
              <span>Updated: {summary.timestamp ? new Date(summary.timestamp).toLocaleTimeString() : 'Live'}</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
