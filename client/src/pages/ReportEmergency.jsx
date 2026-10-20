import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, MapPin, Users, HeartPulse, 
  Send, ShieldCheck, CheckCircle2, Clock, Navigation, Search, RefreshCw, 
  Droplet, Wind, AlertCircle, Activity, Locate, ArrowRight, ShieldAlert, Check,
  Copy, Radio, ChevronRight, AlertTriangle, Sparkles
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { apiFetch } from '../api';

const incidentPinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map click & pan controller
function LocationPickerMap({ lat, lng, onLocationSelect }) {
  const map = useMap();
  
  useMapEvents({
    click(e) {
      const newLat = Math.round(e.latlng.lat * 10000) / 10000;
      const newLng = Math.round(e.latlng.lng * 10000) / 10000;
      onLocationSelect(newLat, newLng);
    }
  });

  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);

  return (
    <>
      <Marker 
        position={[lat, lng]} 
        icon={incidentPinIcon}
        draggable={true}
        eventHandlers={{
          dragend: (e) => {
            const marker = e.target;
            const position = marker.getLatLng();
            const newLat = Math.round(position.lat * 10000) / 10000;
            const newLng = Math.round(position.lng * 10000) / 10000;
            onLocationSelect(newLat, newLng);
          }
        }}
      />
      <Circle
        center={[lat, lng]}
        radius={3000}
        pathOptions={{
          color: '#28766B',
          fillColor: '#28766B',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '6, 6'
        }}
      />
    </>
  );
}

function findClosestZone(targetLat, targetLng, zoneList) {
  if (!zoneList || zoneList.length === 0) return null;
  let closest = null;
  let minDist = Infinity;
  for (const z of zoneList) {
    if (z.center_lat == null || z.center_lng == null) continue;
    const dLat = targetLat - z.center_lat;
    const dLng = targetLng - z.center_lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDist) {
      minDist = distSq;
      closest = z;
    }
  }
  return closest;
}

const CATEGORIES = [
  { 
    id: 'Cardiac Arrest / CPR Needed', 
    label: 'Cardiac Arrest / CPR', 
    icon: HeartPulse, 
    urgencyTag: 'CRITICAL < 2 MIN',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    selectedBorder: 'border-red-500 bg-red-50/50 shadow-sm',
    accentColor: 'text-red-600',
    guidance: {
      headline: 'Immediate Bystander CPR Guidance',
      steps: [
        'Check responsiveness and normal breathing. Shout for someone nearby to fetch an AED immediately.',
        'Place heel of one hand in the center of the patient\'s chest; place other hand on top and interlock fingers.',
        'Push HARD & FAST: 100–120 compressions/min (to the rhythm of "Stayin\' Alive") at least 2 inches (5 cm) deep.',
        'Do NOT interrupt compressions until the dispatched first responder or 108 ambulance arrives.'
      ]
    }
  },
  { 
    id: 'Severe Bleeding / Deep Laceration', 
    label: 'Severe Bleeding', 
    icon: Droplet, 
    urgencyTag: 'URGENT < 3 MIN',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    selectedBorder: 'border-rose-500 bg-rose-50/50 shadow-sm',
    accentColor: 'text-rose-600',
    guidance: {
      headline: 'Hemorrhage Control Guidance',
      steps: [
        'Expose the wound completely to pinpoint the exact site of active blood flow.',
        'Apply FIRM, CONTINUOUS DIRECT PRESSURE with a clean cloth, sterile gauze, or your bare hands.',
        'Do NOT remove soaked cloth; add further layers directly on top and press harder.',
        'If bleeding is from an arm or leg and uncontrollable with direct pressure, prepare a tourniquet 2-3 inches above the wound.'
      ]
    }
  },
  { 
    id: 'Choking / Airway Obstruction', 
    label: 'Choking / Airway', 
    icon: Wind, 
    urgencyTag: 'RAPID AIRWAY',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    selectedBorder: 'border-amber-500 bg-amber-50/50 shadow-sm',
    accentColor: 'text-amber-600',
    guidance: {
      headline: 'Airway Clearance Guidance',
      steps: [
        'Ask: "Are you choking?" If victim can speak or cough loudly, encourage forceful coughing.',
        'If victim CANNOT speak or breathe: Lean them forward and deliver 5 sharp back blows between shoulder blades.',
        'Follow with 5 rapid abdominal thrusts (Heimlich maneuver) placed just above the navel.',
        'If the patient goes unconscious, lower them safely to the floor and immediately begin chest compressions.'
      ]
    }
  },
  { 
    id: 'Fracture & Sprain Stabilization', 
    label: 'Trauma & Fracture', 
    icon: Activity, 
    urgencyTag: 'STABILIZATION',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    selectedBorder: 'border-blue-500 bg-blue-50/50 shadow-sm',
    accentColor: 'text-blue-600',
    guidance: {
      headline: 'Trauma & Fracture Guidance',
      steps: [
        'Do NOT attempt to push back, straighten, or realign injured limbs or exposed bones.',
        'Keep the victim still. If neck or back injury is possible, manually immobilize head in-line and prevent movement.',
        'Support the injured zone with towels, folded blankets, or rolled magazines placed above and below the injury.',
        'Apply cold compress wrapped in cloth to reduce swelling. Monitor circulation in extremities.'
      ]
    }
  },
  { 
    id: 'Anaphylaxis Emergency Assistance', 
    label: 'Anaphylaxis Shock', 
    icon: AlertCircle, 
    urgencyTag: 'EPIPEN IMMEDIATE',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    selectedBorder: 'border-purple-500 bg-purple-50/50 shadow-sm',
    accentColor: 'text-purple-600',
    guidance: {
      headline: 'Anaphylactic Reaction Guidance',
      steps: [
        'Check if patient carries an Epinephrine Auto-Injector (EpiPen, Adrenaline auto-injector).',
        'Help inject into outer middle thigh (can be administered through clothing). Hold firmly in place for 3 seconds.',
        'Keep person lying flat on back with legs raised ~12 inches (unless breathing is labored, then allow upright sitting).',
        'Do NOT give food or drink. Dial 112 immediately as a repeat dose may be required after 5–15 minutes.'
      ]
    }
  },
  { 
    id: 'Basic First Aid & Triage', 
    label: 'Basic First Aid & Triage', 
    icon: ShieldCheck, 
    urgencyTag: 'GENERAL SUPPORT',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    selectedBorder: 'border-emerald-600 bg-emerald-50/50 shadow-sm',
    accentColor: 'text-emerald-600',
    guidance: {
      headline: 'General First Aid & Triage Guidance',
      steps: [
        'Ensure the scene is safe for both you and the patient before stepping in.',
        'For thermal burns: Cool immediately under gentle, cool running water for at least 10–20 minutes. Do not pop blisters.',
        'For fainting/heat exhaustion: Move to shade, loosen tight clothing, elevate legs, give small sips of water if conscious.',
        'Reassure the patient and monitor breathing constantly while the dispatched volunteer is en route.'
      ]
    }
  },
];

const CHENNAI_QUICK_LANDMARKS = [
  { name: 'Chennai Central', zoneId: 5, lat: 13.0827, lng: 80.2707, notes: 'Puratchi Thalaivar Dr. MGR Central Railway Station, Gate 1' },
  { name: 'T. Nagar (Panagal Park)', zoneId: 1, lat: 13.0418, lng: 80.2341, notes: 'Near Panagal Park, Usman Road intersection' },
  { name: 'Anna Nagar (Roundtana)', zoneId: 2, lat: 13.0850, lng: 80.2100, notes: 'Anna Nagar Roundtana / 2nd Avenue' },
  { name: 'Adyar (Signal)', zoneId: 3, lat: 13.0067, lng: 80.2575, notes: 'Adyar Depot Junction / LB Road' },
  { name: 'Marina Beach (Lighthouse)', zoneId: 4, lat: 13.0396, lng: 80.2785, notes: 'Kamarajar Salai, Near Chennai Lighthouse' },
  { name: 'Velachery (Vijayanagar)', zoneId: 7, lat: 12.9750, lng: 80.2210, notes: 'Vijayanagar Bus Terminus, 100 Feet Bypass Rd' },
  { name: 'Ambattur (OT)', zoneId: 10, lat: 13.1143, lng: 80.1548, notes: 'Ambattur Old Terminus, MTH Road' },
  { name: 'Tambaram (Station)', zoneId: 14, lat: 12.9249, lng: 80.1274, notes: 'Tambaram Railway Station West Gate' },
];

export default function ReportEmergency() {
  const [role, setRole] = useState('bystander');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [zones, setZones] = useState([]);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [lat, setLat] = useState(13.0418);
  const [lng, setLng] = useState(80.2341);
  const [locationNotes, setLocationNotes] = useState('Near Panagal Park, Usman Road, T. Nagar');
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [reporterContact, setReporterContact] = useState('');
  const [policy, setPolicy] = useState('coverage_aware_allocation');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submittedIncident, setSubmittedIncident] = useState(null);
  const [trackingLookupCode, setTrackingLookupCode] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [copiedRefCode, setCopiedRefCode] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const ACTIVE_INCIDENT_STORAGE_KEY = 'civicare_active_incident_code';

  const updateSubmittedIncident = (data) => {
    setSubmittedIncident(data);
    if (data?.incident?.referenceCode) {
      localStorage.setItem(ACTIVE_INCIDENT_STORAGE_KEY, data.incident.referenceCode);
    }
  };

  const handleClearActiveIncident = () => {
    localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
    setSubmittedIncident(null);
    setError(null);
  };

  // Restore active incident tracking across tab navigations and page reloads
  useEffect(() => {
    const savedCode = localStorage.getItem(ACTIVE_INCIDENT_STORAGE_KEY);
    if (savedCode && !submittedIncident) {
      setTrackingLoading(true);
      apiFetch(`/incidents/${savedCode}/status`)
        .then(res => {
          if (res?.incident?.referenceCode) {
            setSubmittedIncident(res);
          } else {
            localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
          }
        })
        .catch(err => {
          console.warn('Failed to restore active incident:', err);
        })
        .finally(() => {
          setTrackingLoading(false);
        });
    }
  }, []);

  // Load zones on mount
  useEffect(() => {
    apiFetch('/dashboard/zones')
      .then(data => {
        setZones(data.zones || []);
        if (data.zones?.length > 0) {
          // Default to Zone 1 (T. Nagar) if found, else first zone
          const tNagar = data.zones.find(z => z.id === 1) || data.zones[0];
          setSelectedZoneId(tNagar.id.toString());
          setLat(tNagar.center_lat);
          setLng(tNagar.center_lng);
        }
      })
      .catch(console.error);
  }, []);

  // Periodic polling for status when incident is active
  useEffect(() => {
    const activeCode = submittedIncident?.incident?.referenceCode || localStorage.getItem(ACTIVE_INCIDENT_STORAGE_KEY);
    if (!activeCode || !autoRefresh) return;

    const interval = setInterval(() => {
      apiFetch(`/incidents/${activeCode}/status`)
        .then(res => {
          if (res?.incident) {
            setSubmittedIncident(res);
            localStorage.setItem(ACTIVE_INCIDENT_STORAGE_KEY, res.incident.referenceCode);
          }
        })
        .catch(err => console.error('Status refresh error:', err));
    }, 3000);

    return () => clearInterval(interval);
  }, [submittedIncident?.incident?.referenceCode, autoRefresh]);

  // Reverse geocoding helper that wires address into the landmark field
  const fetchAddressForLocation = async (latitude, longitude, zoneName) => {
    setIsResolvingAddress(true);
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      if (resp.ok) {
        const data = await resp.json();
        const addr = data.address || {};
        const pointOfInterest = addr.amenity || addr.building || addr.shop || addr.office || addr.tourism || addr.leisure || addr.historic;
        const road = addr.road || addr.pedestrian || addr.street || addr.footway;
        const area = addr.suburb || addr.neighbourhood || addr.residential || addr.subdivision;
        const cityDistrict = addr.city_district || addr.zone || addr.quarter;

        const addressParts = [pointOfInterest, road, area, cityDistrict].filter(Boolean);
        if (addressParts.length > 0) {
          setLocationNotes(addressParts.join(', '));
          setIsResolvingAddress(false);
          return;
        } else if (data.display_name) {
          const shortName = data.display_name.split(',').slice(0, 3).join(', ').trim();
          if (shortName) {
            setLocationNotes(shortName);
            setIsResolvingAddress(false);
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Reverse geocode error:', err);
    }
    
    // Fallback if offline or reverse geocoding is unavailable
    setLocationNotes(`Near ${zoneName || 'Chennai'} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
    setIsResolvingAddress(false);
  };

  const handleZoneChange = (zoneId) => {
    setSelectedZoneId(zoneId);
    const z = zones.find(item => item.id === parseInt(zoneId, 10));
    if (z) {
      setLat(z.center_lat);
      setLng(z.center_lng);
      fetchAddressForLocation(z.center_lat, z.center_lng, z.zone_name);
    }
  };

  const handleSelectLandmark = (lm) => {
    setLat(lm.lat);
    setLng(lm.lng);
    setSelectedZoneId(lm.zoneId.toString());
    setLocationNotes(lm.notes);
  };

  // Wired to map clicks and marker drags
  const handleMapLocationSelect = (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);

    // Auto-detect closest zone from map touch
    const closest = findClosestZone(newLat, newLng, zones);
    if (closest) {
      setSelectedZoneId(closest.id.toString());
    }

    // Auto-wire landmark field with reverse geocoded street address
    fetchAddressForLocation(newLat, newLng, closest?.zone_name);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = Math.round(pos.coords.latitude * 10000) / 10000;
        const newLng = Math.round(pos.coords.longitude * 10000) / 10000;
        setLat(newLat);
        setLng(newLng);
        const closest = findClosestZone(newLat, newLng, zones);
        if (closest) {
          setSelectedZoneId(closest.id.toString());
        }
        fetchAddressForLocation(newLat, newLng, closest?.zone_name);
      },
      () => alert('Could not access device location. You can pick any landmark or position the pin directly on the map.')
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      incidentType: category,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      zoneId: selectedZoneId ? parseInt(selectedZoneId, 10) : undefined,
      locationNotes: locationNotes.trim() || undefined,
      reporterRole: role,
      reporterContact: reporterContact.trim() || undefined,
      allocationPolicy: policy
    };

    try {
      const res = await apiFetch('/incidents', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      // Fetch full tracking details so coordinates and assignment status are instantly ready
      if (res?.incident?.referenceCode) {
        try {
          const detailed = await apiFetch(`/incidents/${res.incident.referenceCode}/status`);
          updateSubmittedIncident(detailed);
        } catch {
          updateSubmittedIncident(res);
        }
      } else {
        updateSubmittedIncident(res);
      }
    } catch (err) {
      setError(err.message || 'Dispatch request failed. If this is an urgent life threat, dial 112 directly.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!trackingLookupCode.trim()) return;
    setTrackingLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/incidents/${trackingLookupCode.trim().toUpperCase()}/status`);
      updateSubmittedIncident(res);
    } catch (err) {
      setError('Incident reference code not found. Please verify the code.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const refreshStatus = async () => {
    const activeCode = submittedIncident?.incident?.referenceCode || localStorage.getItem(ACTIVE_INCIDENT_STORAGE_KEY);
    if (!activeCode) return;
    try {
      const res = await apiFetch(`/incidents/${activeCode}/status`);
      updateSubmittedIncident(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedRefCode(true);
    setTimeout(() => setCopiedRefCode(false), 2000);
  };

  const activeZoneObj = zones.find(z => z.id === parseInt(selectedZoneId, 10));
  const activeRespondersCount = activeZoneObj ? parseInt(activeZoneObj.eligible_free_responders || 0, 10) : 0;
  const currentCategoryObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];

  // ==========================================
  // ACTIVE INCIDENT TRACKING SCREEN
  // ==========================================
  if (submittedIncident) {
    const inc = submittedIncident.incident || {};
    const assign = submittedIncident.assignment;
    const catObj = CATEGORIES.find(c => c.id === inc.incidentType) || currentCategoryObj;

    const isMatched = ['assigned', 'en_route', 'arrived', 'completed'].includes(inc.status) || Boolean(assign?.responderName);
    const isEnRoute = ['en_route', 'arrived', 'completed'].includes(inc.status) || ['en_route', 'arrived', 'completed'].includes(assign?.status);
    const isArrived = ['arrived', 'completed'].includes(inc.status) || ['arrived', 'completed'].includes(assign?.status);

    const steps = [
      { id: 'reported', label: 'Reported', active: true, desc: 'Incident broadcasted to network' },
      { id: 'assigned', label: 'Volunteer Matched', active: isMatched, desc: assign?.responderName ? `${assign.responderName} confirmed` : 'Searching certified volunteers' },
      { id: 'en_route', label: 'En Route', active: isEnRoute, desc: assign?.estimatedTravelMinutes ? `ETA ~${assign.estimatedTravelMinutes} mins` : 'Responder navigating to location' },
      { id: 'arrived', label: 'Arrived On Scene', active: isArrived, desc: 'Direct interim care being provided' },
    ];

    const handleQuickAdvance = async (targetEvent) => {
      if (!assign?.id) return;
      try {
        if (targetEvent === 'accept') {
          await apiFetch(`/assignments/${assign.id}/respond`, {
            method: 'POST',
            body: JSON.stringify({ action: 'accept' })
          });
        } else {
          await apiFetch(`/assignments/${assign.id}/events`, {
            method: 'POST',
            body: JSON.stringify({ eventType: targetEvent })
          });
        }
        refreshStatus();
      } catch (err) {
        console.warn('Simulation event note:', err.message);
        refreshStatus();
      }
    };

    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 animate-in fade-in space-y-6">
        
        {/* Urgent Emergency Lifeline Banner */}
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold text-red-950 flex items-center gap-2">
                <span>Official National Emergency Services</span>
                <span className="text-[10px] bg-red-200 text-red-900 font-bold px-2 py-0.5 rounded-full">DIAL 112 / 108</span>
              </div>
              <p className="text-xs text-red-800 mt-1 max-w-3xl leading-relaxed">
                CiviCare coordinates community first responders for immediate pre-ambulance interim stabilization. If life or airway is critically compromised, ensure someone dials official emergency services (112 or 108) immediately.
              </p>
            </div>
          </div>
          <a
            href="tel:112"
            className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-2.5 rounded-md shadow transition-colors whitespace-nowrap self-start md:self-auto"
          >
            <PhoneCall className="w-4 h-4" />
            <span>CALL 112 NOW</span>
          </a>
        </div>

        {/* Tracking Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Status, Stepper & Volunteer Info (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Incident Header Card */}
            <div className="bg-white border border-warm-border rounded-xl p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-warm-border gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-warm-slate uppercase bg-warm-bg px-2.5 py-1 rounded border border-warm-border">
                      {inc.referenceCode || 'REF-PENDING'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(inc.referenceCode)}
                      className="text-xs text-warm-slate hover:text-ink flex items-center gap-1 font-medium bg-warm-bg/60 hover:bg-warm-bg px-2 py-1 rounded transition-colors cursor-pointer"
                      title="Copy reference code"
                    >
                      {copiedRefCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold text-[11px]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <h1 className="text-xl font-bold text-ink mt-2 flex items-center gap-2">
                    <span>{inc.incidentType || 'Emergency Incident'}</span>
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshStatus}
                    className="flex items-center gap-1.5 text-xs text-ink bg-warm-bg hover:bg-warm-muted px-3 py-1.5 rounded-md border border-warm-border font-medium transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-warm-slate" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={handleClearActiveIncident}
                    className="text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                  >
                    + New Request
                  </button>
                </div>
              </div>

              {/* Live Status Stepper */}
              <div className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-ink uppercase tracking-wider">
                    Dispatch Progression
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-warm-slate">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Live telemetry auto-polling</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {steps.map((st, idx) => (
                    <div 
                      key={idx}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        st.active 
                          ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                          : 'bg-warm-bg/40 border-warm-border opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase text-warm-slate">Step {idx + 1}</span>
                        {st.active ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <Clock className="w-4 h-4 text-warm-slate/40" />
                        )}
                      </div>
                      <div className="text-xs font-bold text-ink">{st.label}</div>
                      <div className="text-[11px] text-warm-slate mt-0.5 leading-snug line-clamp-2">{st.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Direct Simulation / Progression Controls */}
                {assign && (
                  <div className="mt-3.5 p-3 bg-warm-bg/70 border border-warm-border rounded-lg flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2 text-ink font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-sage shrink-0" />
                      <span>Live Dispatch Controls:</span>
                      <span className="text-[11px] text-warm-slate font-normal">Step through events or manage in Responder Portal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {assign.status === 'offered' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdvance('accept')}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simulate Accept ({assign.responderName})</span>
                        </button>
                      )}
                      {(assign.status === 'accepted' || (assign.status === 'assigned' && inc.status !== 'en_route')) && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdvance('EN_ROUTE')}
                          className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Simulate En Route (Step 3)</span>
                        </button>
                      )}
                      {assign.status === 'en_route' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdvance('ARRIVED')}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Simulate Arrival on Scene (Step 4)</span>
                        </button>
                      )}
                      {assign.status === 'arrived' && (
                        <button
                          type="button"
                          onClick={() => handleQuickAdvance('COMPLETED')}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Simulate Complete Call</span>
                        </button>
                      )}
                      {assign.status === 'completed' && (
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mission Completed</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Matched Responder Section */}
              <div className="mt-6 pt-5 border-t border-warm-border">
                {assign ? (
                  <div className="bg-emerald-50/60 border border-emerald-300 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                        <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        <span>Assigned Certified Community Responder</span>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded-full uppercase">
                        {assign.status || 'Active'}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div>
                        <div className="text-lg font-bold text-ink">{assign.responderName}</div>
                        <div className="text-xs text-warm-slate">
                          {assign.responderOrg || 'Chennai Community First Responder Network'}
                        </div>
                        <div className="flex items-center gap-4 text-xs font-medium text-ink mt-2">
                          {assign.estimatedDistanceKm && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-sage" />
                              <span>{parseFloat(assign.estimatedDistanceKm).toFixed(2)} km away</span>
                            </span>
                          )}
                          {assign.estimatedTravelMinutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-sage" />
                              <span>Est. arrival: ~{assign.estimatedTravelMinutes} mins</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {assign.responderPhone && (
                        <a
                          href={`tel:${assign.responderPhone}`}
                          className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2.5 rounded-md shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
                        >
                          <PhoneCall className="w-3.5 h-3.5" />
                          <span>Direct Call: {assign.responderPhone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
                    <RefreshCw className="w-4 h-4 text-amber-700 animate-spin shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-950">
                      <div className="font-bold">Locating Nearest Available Certified Volunteer in Chennai...</div>
                      <div className="text-amber-800 mt-0.5">
                        Alert dispatched through the coverage-aware allocation engine. Stand by while a nearby responder accepts.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Incident Details Summary */}
              <div className="mt-6 pt-5 border-t border-warm-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-warm-bg/50 rounded-lg border border-warm-border">
                  <div className="text-[11px] font-bold text-warm-slate uppercase">Location / Landmark</div>
                  <div className="text-ink font-medium mt-1">
                    {inc.locationNotes || 'Coordinates selected on map'}
                  </div>
                  {inc.zoneName && (
                    <div className="text-warm-slate text-[11px] mt-0.5">Zone: {inc.zoneName}</div>
                  )}
                </div>

                <div className="p-3 bg-warm-bg/50 rounded-lg border border-warm-border">
                  <div className="text-[11px] font-bold text-warm-slate uppercase">Reported Timestamp</div>
                  <div className="text-ink font-medium mt-1">
                    {inc.createdAt ? new Date(inc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                  </div>
                  <div className="text-warm-slate text-[11px] mt-0.5">Priority: {inc.priorityLabel || 'High'}</div>
                </div>
              </div>

            </div>

            {/* On-Scene First Aid Guidance Card */}
            <div className="bg-white border border-warm-border rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <h3 className="text-sm font-bold text-ink">
                  {catObj.guidance.headline} (Immediate Actions)
                </h3>
              </div>

              <div className="space-y-2.5">
                {catObj.guidance.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-ink bg-warm-bg/40 p-3 rounded-lg border border-warm-border/60">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-900 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Embedded Map showing Incident & 3km Radius (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs flex flex-col">
            <div className="p-3.5 border-b border-warm-border bg-warm-bg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-ink">Incident Geolocation & Dispatch Zone</span>
              </div>
              <span className="text-[11px] font-mono text-warm-slate">
                {Number(inc.lat || lat).toFixed(4)}, {Number(inc.lng || lng).toFixed(4)}
              </span>
            </div>

            <div className="h-[480px] lg:h-[560px] relative">
              <MapContainer
                center={[Number(inc.lat || lat), Number(inc.lng || lng)]}
                zoom={13}
                scrollWheelZoom={true}
                className="w-full h-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[Number(inc.lat || lat), Number(inc.lng || lng)]} icon={incidentPinIcon} />
                <Circle
                  center={[Number(inc.lat || lat), Number(inc.lng || lng)]}
                  radius={3000}
                  pathOptions={{
                    color: '#28766B',
                    fillColor: '#28766B',
                    fillOpacity: 0.12,
                    weight: 2,
                    dashArray: '6, 6'
                  }}
                />
              </MapContainer>
            </div>

            <div className="p-3 bg-warm-bg border-t border-warm-border text-xs text-warm-slate flex items-center justify-between">
              <span>● Dashed circle indicates the 3 km volunteer response perimeter</span>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // ==========================================
  // INITIAL INTAKE SCREEN (Full Form & Map)
  // ==========================================
  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 animate-in fade-in space-y-6">
      
      {/* Top Header Bar & Incident Tracker Input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-warm-border gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            Report Emergency
          </h1>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            Chennai Dispatch Active
          </span>
        </div>

        {/* Existing Reference Lookup Form */}
        <form onSubmit={handleLookup} className="flex gap-2 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-warm-slate absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={trackingLookupCode}
              onChange={(e) => setTrackingLookupCode(e.target.value)}
              placeholder="Track code (e.g. CIVI-CHN-...)"
              className="bg-white border border-warm-border rounded-lg pl-8 pr-3 py-2 text-xs text-ink focus:outline-none focus:border-sage w-full shadow-xs"
            />
          </div>
          <button
            type="submit"
            disabled={trackingLoading}
            className="bg-ink hover:bg-ink-light text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shadow-xs cursor-pointer disabled:opacity-50"
          >
            {trackingLoading ? 'Checking...' : 'Track'}
          </button>
        </form>
      </div>

      {/* Lifeline Notice Banner */}
      <div className="bg-red-50 border border-red-300 rounded-lg p-3 sm:p-4 flex items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-2.5 text-red-950 font-medium">
          <PhoneCall className="w-4 h-4 text-red-600 shrink-0" />
          <span>
            <strong>Official Lifeline Advisory:</strong> For severe life threats, ensure someone directly dials <strong>112</strong> or <strong>108</strong> immediately. CiviCare works in parallel to bridge response minutes.
          </span>
        </div>
        <a
          href="tel:112"
          className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-1.5 rounded transition-colors whitespace-nowrap shadow-xs"
        >
          CALL 112
        </a>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Two-Column Layout: Form (Left ~46%) and Map (Right ~54%) */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Triage Category, Context, Reporter & Dispatch */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* Emergency Category Selector Cards */}
          <div className="bg-white border border-warm-border rounded-xl p-5 sm:p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
                  1. Select Emergency Type
                </h2>
              </div>
              <span className="text-[11px] font-mono text-warm-slate">
                {CATEGORIES.length} Categories
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-3.5 rounded-lg border-2 text-left flex flex-col justify-between transition-all cursor-pointer relative ${
                      isSelected
                        ? cat.selectedBorder
                        : 'bg-white border-warm-border/80 text-ink hover:border-warm-slate/40 hover:bg-warm-bg/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${isSelected ? 'bg-white shadow-xs' : 'bg-warm-bg'} ${cat.accentColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cat.badgeClass}`}>
                        {cat.urgencyTag}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-ink leading-tight flex items-center justify-between">
                        <span>{cat.label}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Incident Context & Reporter Info */}
          <div className="bg-white border border-warm-border rounded-xl p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="text-xs font-bold text-ink uppercase tracking-wider">
              2. Incident Context & Coordinates
            </div>

            {/* Reporter Role with Hover Effect & Clear Selection */}
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-2">
                Who is reporting this incident?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'bystander', label: 'Bystander on Scene' },
                  { id: 'self', label: 'Patient / Direct Victim' }
                ].map((item) => {
                  const isSelected = role === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRole(item.id)}
                      className={`py-2.5 px-3.5 rounded-lg border-2 text-xs text-center transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-600 text-slate-900 font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 font-medium'
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                      )}
                      <span className="text-slate-900 font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Address / Landmark (Wired with Map Touch & Reverse Geocoding) */}
            <div>
              <label className="block text-xs font-medium text-warm-slate mb-1">
                Landmark or Street Address in Chennai
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={locationNotes}
                  onChange={(e) => setLocationNotes(e.target.value)}
                  placeholder={isResolvingAddress ? "Resolving street address from map pin..." : "e.g., Near Panagal Park, Gate 2, South Usman Road"}
                  className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:border-sage shadow-xs pr-9"
                />
                {isResolvingAddress && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="w-3.5 h-3.5 text-sage animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Reporter Phone & Dispatch Policy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1">
                  Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={reporterContact}
                  onChange={(e) => setReporterContact(e.target.value)}
                  placeholder="e.g., 98401 23456"
                  className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-sage shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-warm-slate mb-1">
                  Allocation Engine Policy
                </label>
                <select
                  value={policy}
                  onChange={(e) => setPolicy(e.target.value)}
                  className="w-full bg-white border border-warm-border rounded-lg px-3 py-2 text-xs text-ink font-medium focus:outline-none focus:border-sage cursor-pointer shadow-xs"
                >
                  <option value="coverage_aware_allocation">
                    Coverage-Aware (Recommended)
                  </option>
                  <option value="proximity_greedy">
                    Proximity-Greedy (Baseline)
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Dispatch Button */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-3.5 px-6 rounded-lg font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Alerting & Matching Nearest Certified Volunteers...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  <span>Dispatch Nearest Community First Responder</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Column: Quick Chennai Landmarks & Leaflet Map with Radius */}
        <div className="lg:col-span-6 bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs flex flex-col">
          
          {/* Quick Chennai Landmark Pills */}
          <div className="p-4 border-b border-warm-border bg-warm-bg/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sage" />
                <span>Quick Chennai Landmarks</span>
              </span>
              <span className="text-[11px] text-warm-slate">Click to snap pin & zone</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              {CHENNAI_QUICK_LANDMARKS.map((lm, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectLandmark(lm)}
                  className="text-xs font-medium bg-white hover:bg-sage-tint hover:border-sage border border-warm-border rounded-md px-2.5 py-1 text-ink transition-colors cursor-pointer shadow-xs"
                >
                  {lm.name}
                </button>
              ))}
            </div>
          </div>

          {/* Map Top Bar Controls */}
          <div className="p-3 border-b border-warm-border bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink">Chennai Zone:</span>
              <select
                value={selectedZoneId}
                onChange={(e) => handleZoneChange(e.target.value)}
                className="bg-warm-bg border border-warm-border text-ink text-xs font-medium py-1 px-2.5 rounded-md focus:outline-none focus:border-sage cursor-pointer"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.zone_name} (Zone {z.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleUseGps}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1 rounded-md transition-colors cursor-pointer"
              >
                <Locate className="w-3.5 h-3.5 text-emerald-700" />
                <span>Use My GPS</span>
              </button>
              <span className="text-[11px] font-mono text-warm-slate bg-warm-bg px-2 py-0.5 rounded border border-warm-border">
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Interactive Leaflet Map with Floating Telemetry Badge */}
          <div className="h-[520px] lg:h-[620px] relative">
            
            {/* Floating Live Telemetry Badge */}
            <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-sm border border-warm-border shadow-md rounded-lg p-2.5 text-xs max-w-xs pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeRespondersCount > 0 ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeRespondersCount > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="font-bold text-ink">
                  {activeZoneObj?.zone_name || 'Selected Chennai Zone'}
                </span>
              </div>
              <div className="text-[11px] text-warm-slate mt-1 pl-4">
                {activeRespondersCount > 0 ? (
                  <span className="text-emerald-700 font-semibold">
                    {activeRespondersCount} Verified Volunteers on Active Shift
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold">
                    0 direct local volunteers; adjacent zone dispatch active
                  </span>
                )}
              </div>
            </div>

            <MapContainer
              center={[lat, lng]}
              zoom={13}
              scrollWheelZoom={true}
              className="w-full h-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationPickerMap
                lat={lat}
                lng={lng}
                onLocationSelect={handleMapLocationSelect}
              />
            </MapContainer>
          </div>

          {/* Map Footer Info */}
          <div className="p-3 bg-warm-bg border-t border-warm-border text-[11px] text-warm-slate flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-sage" />
              <span>Tap anywhere on the map or drag pin to update incident coordinates & address. Green circle marks 3 km radius.</span>
            </span>
            {activeZoneObj && (
              <span className="font-semibold text-ink hidden sm:inline">
                Zone {activeZoneObj.id}: {activeZoneObj.zone_name}
              </span>
            )}
          </div>

        </div>

      </form>

    </div>
  );
}
