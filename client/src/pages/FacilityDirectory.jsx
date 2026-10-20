import React, { useState, useEffect } from 'react';
import { 
  Building2, PhoneCall, MapPin, Search, Filter, ShieldCheck, 
  Activity, Navigation, ExternalLink, HeartPulse, Flame, Baby, 
  Brain, Zap, Stethoscope, RefreshCw, X, ChevronDown, Check
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiFetch } from '../api';

const govtHospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const privateHospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to handle map zooming to selected hospital
function MapController({ targetPos }) {
  const map = useMap();
  useEffect(() => {
    if (targetPos) {
      map.setView(targetPos, 14, { animate: true });
    }
  }, [targetPos, map]);
  return null;
}

const QUICK_CAPABILITIES = [
  { label: 'All Capabilities', code: '', icon: Stethoscope },
  { label: '24x7 Casualty', code: 'CASUALTY', icon: Zap },
  { label: 'Advanced Trauma', code: 'ADVANCED_TRAUMA', icon: Activity },
  { label: 'Cardiac & Cath Lab', code: 'CATH_LAB', icon: HeartPulse },
  { label: 'Stroke Unit', code: 'STROKE', icon: Brain },
  { label: 'Burns Center', code: 'BURNS', icon: Flame },
  { label: 'Pediatric ICU', code: 'PEDIATRIC', icon: Baby },
];

export default function FacilityDirectory() {
  const [facilities, setFacilities] = useState([]);
  const [capabilities, setCapabilities] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedCapability, setSelectedCapability] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [facilityType, setFacilityType] = useState('all'); // 'all', 'government', 'private'
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeHospital, setActiveHospital] = useState(null);
  const [mapTarget, setMapTarget] = useState(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/facilities'),
      apiFetch('/facilities/capabilities'),
      apiFetch('/dashboard/zones')
    ])
      .then(([facData, capData, zoneData]) => {
        setFacilities(facData.facilities || []);
        setCapabilities(capData.capabilities || []);
        setZones(zoneData.zones || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const filteredFacilities = facilities.filter((f) => {
    // 1. Zone filter
    if (selectedZone && f.zone_id !== parseInt(selectedZone, 10)) return false;

    // 2. Facility Type filter (Government vs Private)
    const isGovt = f.facility_type?.toLowerCase().includes('government');
    if (facilityType === 'government' && !isGovt) return false;
    if (facilityType === 'private' && isGovt) return false;

    // 3. Capability filter
    if (selectedCapability) {
      const hasCap = f.capabilities.some(c => 
        c.code === selectedCapability || c.code.includes(selectedCapability)
      );
      if (!hasCap) return false;
    }

    // 4. Text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        f.name.toLowerCase().includes(term) ||
        f.address.toLowerCase().includes(term) ||
        f.zone_name?.toLowerCase().includes(term) ||
        f.facility_type?.toLowerCase().includes(term)
      );
    }

    return true;
  });

  const handleFocusHospital = (h) => {
    setActiveHospital(h);
    setMapTarget([h.lat, h.lng]);
  };

  const handleResetFilters = () => {
    setSelectedZone('');
    setSelectedCapability('');
    setFacilityType('all');
    setSearchTerm('');
  };

  const isFiltered = Boolean(selectedZone || selectedCapability || facilityType !== 'all' || searchTerm);
  const govtCount = facilities.filter(f => f.facility_type?.toLowerCase().includes('government')).length;
  const privateCount = facilities.length - govtCount;

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 animate-in fade-in space-y-6">
      
      {/* Page Header & Stats Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-warm-border gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            Hospitals
          </h1>
          <span className="text-[11px] font-semibold text-slate-600 bg-white border border-warm-border px-2.5 py-0.5 rounded-full shadow-xs">
            {filteredFacilities.length} of {facilities.length} available
          </span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="tel:108"
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>108 Ambulance Hotline</span>
          </a>
        </div>
      </div>

      {/* Main Filter & Search Console */}
      <div className="bg-white border border-warm-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
        
        {/* Top Controls: Search Input, Zone Selector & Facility Type Toggles */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-warm-slate absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by hospital name, area, or road address..."
              className="w-full bg-warm-bg/50 border border-warm-border rounded-lg pl-9 pr-3.5 py-2 text-xs text-ink focus:outline-none focus:border-sage focus:bg-white shadow-xs"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-slate hover:text-ink text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Chennai Zone Dropdown */}
          <div className="md:col-span-3">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full bg-warm-bg/50 border border-warm-border rounded-lg px-3 py-2 text-xs text-ink font-medium focus:outline-none focus:border-sage focus:bg-white cursor-pointer shadow-xs"
            >
              <option value="">All Chennai Zones ({zones.length})</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.zone_name} (Zone {z.id})
                </option>
              ))}
            </select>
          </div>

          {/* Facility Type Filter: All / Govt / Private */}
          <div className="md:col-span-4 flex items-center justify-between gap-2">
            <div className="inline-flex rounded-lg border border-warm-border bg-warm-bg/60 p-0.5 text-xs w-full">
              {[
                { id: 'all', label: `All (${facilities.length})` },
                { id: 'government', label: `Govt (${govtCount})` },
                { id: 'private', label: `Private (${privateCount})` }
              ].map((tab) => {
                const isSelected = facilityType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFacilityType(tab.id)}
                    className={`flex-1 py-1.5 px-2 rounded-md font-semibold text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-ink shadow-xs border border-warm-border'
                        : 'text-warm-slate hover:text-ink hover:bg-white/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-md font-medium transition-colors shrink-0 cursor-pointer"
                title="Reset all active filters"
              >
                Reset
              </button>
            )}
          </div>

        </div>

        {/* Specialized Capability Selector Strip (Replacing 38 buttons with 6 primary quick chips + Dropdown) */}
        <div className="pt-3 border-t border-warm-border flex flex-wrap items-center justify-between gap-2">
          
          {/* Quick Life-Threat Priority Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-ink mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-sage" />
              <span>Priority:</span>
            </span>
            
            {QUICK_CAPABILITIES.map((chip) => {
              const Icon = chip.icon;
              const isSelected = selectedCapability === chip.code;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setSelectedCapability(isSelected && chip.code !== '' ? '' : chip.code)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border-2 font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span className={isSelected ? 'text-emerald-800 font-bold' : 'text-slate-700 font-medium'}>
                    {chip.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Full Capability Dropdown for All 38 Specific Specialties */}
          <div className="w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
            <select
              value={selectedCapability}
              onChange={(e) => setSelectedCapability(e.target.value)}
              className="w-full sm:w-60 bg-warm-bg border border-warm-border rounded-md px-2.5 py-1 text-xs text-ink focus:outline-none focus:border-sage cursor-pointer"
            >
              <option value="">More Capabilities ({capabilities.length})...</option>
              {capabilities.map((cap) => (
                <option key={cap.capability_code} value={cap.capability_code}>
                  {cap.capability_name}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>

      {/* Main Split Layout: Left Map (5 cols) & Right Facility Directory Cards (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Interactive Map with Pin Differentiation */}
        <div className="lg:col-span-5 bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs h-[560px] lg:h-[680px] sticky top-20 flex flex-col">
          
          {/* Map Top Bar with Legend */}
          <div className="p-3 border-b border-warm-border bg-warm-bg flex items-center justify-between text-xs">
            <span className="font-bold text-ink flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-sage" />
              <span>Hospital Locations & Coverage</span>
            </span>
            <div className="flex items-center gap-3 text-[11px] font-medium">
              <span className="flex items-center gap-1 text-blue-700">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span>Govt Medical College</span>
              </span>
              <span className="flex items-center gap-1 text-red-700">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                <span>Private Tertiary</span>
              </span>
            </div>
          </div>

          {/* Map Container */}
          <div className="flex-1 relative">
            <MapContainer
              center={[13.0418, 80.2341]}
              zoom={11}
              scrollWheelZoom={true}
              className="w-full h-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController targetPos={mapTarget} />

              {filteredFacilities.map((f) => {
                const isGovt = f.facility_type?.toLowerCase().includes('government');
                return (
                  <Marker
                    key={f.id}
                    position={[f.lat, f.lng]}
                    icon={isGovt ? govtHospitalIcon : privateHospitalIcon}
                    eventHandlers={{ click: () => setActiveHospital(f) }}
                  >
                    <Popup>
                      <div className="p-1 font-sans space-y-1.5 min-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isGovt ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'}`}>
                            {isGovt ? 'GOVT TEACHING' : 'PRIVATE TERTIARY'}
                          </span>
                          <span className="text-[10px] text-warm-slate">Zone: {f.zone_name}</span>
                        </div>
                        <div className="font-bold text-xs text-ink leading-tight">{f.name}</div>
                        <div className="text-[11px] text-warm-slate line-clamp-2">{f.address}</div>
                        
                        <div className="flex items-center gap-2 pt-1 border-t border-warm-border">
                          <a
                            href={`tel:${f.contact_phone}`}
                            className="inline-flex items-center gap-1 text-emerald-800 hover:text-emerald-900 font-bold text-xs"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>{f.contact_phone}</span>
                          </a>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline text-[11px] ml-auto font-medium"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Navigate</span>
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Map Footer Note */}
          <div className="p-2.5 bg-warm-bg border-t border-warm-border text-[11px] text-warm-slate flex items-center justify-between">
            <span>Click any marker to view emergency contact lines & direct route.</span>
            <span className="font-medium text-ink">Chennai Urban Zone</span>
          </div>

        </div>

        {/* Right Column: Hospital Directory Cards List */}
        <div className="lg:col-span-7 space-y-3">
          
          {loading ? (
            <div className="bg-white border border-warm-border rounded-xl p-12 text-center text-xs text-warm-slate space-y-2">
              <RefreshCw className="w-5 h-5 text-sage animate-spin mx-auto" />
              <div>Loading verified hospital infrastructure directory...</div>
            </div>
          ) : filteredFacilities.length === 0 ? (
            <div className="bg-white border border-warm-border rounded-xl p-12 text-center text-xs text-warm-slate space-y-3">
              <Building2 className="w-8 h-8 text-warm-slate/40 mx-auto" />
              <div className="font-semibold text-ink text-sm">No hospitals match your search criteria.</div>
              <p className="max-w-md mx-auto text-[11px] text-warm-slate">
                Try clearing the capability filter or selecting "All Chennai Zones" to view all available emergency care centers.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 bg-ink text-white font-medium px-4 py-2 rounded-lg text-xs hover:bg-ink-light transition-colors cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {filteredFacilities.map((f) => {
                const isActive = activeHospital?.id === f.id;
                const isGovt = f.facility_type?.toLowerCase().includes('government');
                
                return (
                  <div
                    key={f.id}
                    className={`bg-white border rounded-xl p-4 sm:p-5 transition-all shadow-xs ${
                      isActive 
                        ? 'border-emerald-600 ring-2 ring-emerald-600/20 bg-emerald-50/20' 
                        : 'border-warm-border hover:border-slate-300'
                    }`}
                  >
                    {/* Top Row: Badges, Ownership & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Government vs Private Badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${
                            isGovt 
                              ? 'bg-blue-50 text-blue-800 border-blue-200' 
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {isGovt ? 'Government Hospital' : 'Private Tertiary Care'}
                          </span>

                          {/* Zone Badge */}
                          <span className="text-[10px] font-semibold text-warm-slate bg-warm-bg px-2 py-0.5 rounded border border-warm-border">
                            Zone: {f.zone_name}
                          </span>

                          {/* 24x7 Badge */}
                          <span className="text-[10px] font-semibold text-emerald-800 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            <span>24x7 Casualty Active</span>
                          </span>
                        </div>

                        {/* Hospital Name */}
                        <h2 className="text-base font-bold text-ink pt-0.5 leading-snug">
                          {f.name}
                        </h2>

                        {/* Address */}
                        <p className="text-xs text-warm-slate flex items-start gap-1 pt-0.5 leading-relaxed">
                          <MapPin className="w-3.5 h-3.5 text-warm-slate shrink-0 mt-0.5" />
                          <span>{f.address}</span>
                        </p>
                      </div>

                      {/* Direct Action Buttons: Call, Focus Map & Route Navigation */}
                      <div className="flex flex-wrap items-center gap-2 self-start shrink-0 pt-1 sm:pt-0">
                        {/* Call Button */}
                        <a
                          href={`tel:${f.contact_phone}`}
                          className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                          title="Call emergency casualty desk directly"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>{f.contact_phone}</span>
                        </a>

                        {/* View on Map Button */}
                        <button
                          type="button"
                          onClick={() => handleFocusHospital(f)}
                          className="inline-flex items-center gap-1 text-xs font-medium bg-white hover:bg-warm-bg border border-warm-border px-2.5 py-1.5 rounded-lg text-ink transition-colors cursor-pointer"
                          title="Center Map on this hospital"
                        >
                          <Navigation className="w-3.5 h-3.5 text-sage" />
                          <span className="hidden sm:inline">Map</span>
                        </button>

                        {/* Google Maps Directions */}
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors"
                          title="Open GPS driving / ambulance directions"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                          <span className="hidden sm:inline">Directions</span>
                        </a>
                      </div>
                    </div>

                    {/* Verified Capabilities Chips (Clean, readable tags) */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-warm-border/80">
                      <span className="text-[10px] font-bold text-warm-slate uppercase tracking-wider mr-1">
                        Capabilities:
                      </span>
                      {f.capabilities.map((cap, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-ink bg-warm-bg/70 px-2 py-0.5 rounded border border-warm-border/80 font-medium"
                        >
                          {cap.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}


        </div>

      </div>

    </div>
  );
}
