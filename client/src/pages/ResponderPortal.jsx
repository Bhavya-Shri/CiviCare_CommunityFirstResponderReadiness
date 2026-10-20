import React, { useState, useEffect } from 'react';
import { 
  HeartPulse, ShieldCheck, Clock, CheckCircle2, XCircle, 
  AlertCircle, Award, Calendar, Navigation, LogIn, UserPlus, RefreshCw, 
  PhoneCall, ShieldAlert, Check, Plus, Radio, Zap, AlertTriangle, ChevronRight,
  MapPin, Bell, CheckCircle
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../api';

export default function ResponderPortal({ currentUser, onLoginSuccess }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auth Form State (if not logged in)
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('dr.arun@civicare.in');
  const [password, setPassword] = useState('resp123');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [baseZoneId, setBaseZoneId] = useState(1);
  const [zones, setZones] = useState([]);

  // Submit Certification Modal State
  const [showCertModal, setShowCertModal] = useState(false);
  const [certSkillId, setCertSkillId] = useState(1);
  const [certNumber, setCertNumber] = useState('');
  const [certIssuer, setCertIssuer] = useState('Indian Red Cross Society');
  const [certFrom, setCertFrom] = useState(new Date().toISOString().split('T')[0]);
  const [certUntil, setCertUntil] = useState(new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0]);

  // Load Zones
  useEffect(() => {
    apiFetch('/dashboard/zones')
      .then(d => setZones(d.zones || []))
      .catch(console.error);
  }, []);

  // Load Responder Profile if authenticated
  const loadProfile = () => {
    if (!currentUser) return;
    setLoading(true);
    apiFetch('/responders/me')
      .then(data => {
        setProfileData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (currentUser) {
      loadProfile();
      // Periodically refresh profile every 8 seconds to pick up new dispatches
      const interval = setInterval(loadProfile, 8000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone,
          baseZoneId: parseInt(baseZoneId, 10),
          role: 'responder'
        })
      });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Fixed: Sending availabilityStatus as expected by backend route
  const handleToggleAvailability = async () => {
    if (!profileData?.responder) return;
    const current = profileData.responder.availability_status;
    const nextStatus = current === 'available' ? 'unavailable' : 'available';
    try {
      await apiFetch('/responders/me/availability', {
        method: 'PATCH',
        body: JSON.stringify({ availabilityStatus: nextStatus })
      });
      loadProfile();
    } catch (err) {
      alert('Failed to update availability status: ' + err.message);
    }
  };

  // Fixed: Sending { hours } as expected by backend shifts route
  const handleStartShift = async (hours = 4) => {
    try {
      await apiFetch('/responders/me/shifts', {
        method: 'POST',
        body: JSON.stringify({ hours })
      });
      loadProfile();
    } catch (err) {
      alert('Failed to register active shift: ' + err.message);
    }
  };

  const handleAssignmentResponse = async (assignmentId, action) => {
    try {
      await apiFetch(`/assignments/${assignmentId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      loadProfile();
    } catch (err) {
      alert(`Failed to ${action} assignment: ` + err.message);
    }
  };

  const handleAssignmentEvent = async (assignmentId, eventType) => {
    try {
      await apiFetch(`/assignments/${assignmentId}/events`, {
        method: 'POST',
        body: JSON.stringify({ eventType })
      });
      loadProfile();
    } catch (err) {
      alert('Failed to transition state: ' + err.message);
    }
  };

  const handleCertSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/responders/me/certifications', {
        method: 'POST',
        body: JSON.stringify({
          skillId: parseInt(certSkillId, 10),
          certificationNumber: certNumber,
          issuerLabel: certIssuer,
          validFrom: certFrom,
          validUntil: certUntil
        })
      });
      setShowCertModal(false);
      setCertNumber('');
      loadProfile();
      alert('Certification successfully submitted. It is now in the administrative verification queue.');
    } catch (err) {
      alert('Failed to submit certification: ' + err.message);
    }
  };

  // Instant simulation helper to test live emergency dispatch
  const handleSimulateAlert = async () => {
    setLoading(true);
    try {
      const responder = profileData?.responder;
      const zoneId = responder?.base_zone_id || 1;
      const zoneName = responder?.zone_name || 'T. Nagar';
      const lat = responder?.current_lat || 13.0425;
      const lng = responder?.current_lng || 80.2335;

      await apiFetch('/incidents', {
        method: 'POST',
        body: JSON.stringify({
          incidentType: 'Cardiac Arrest / CPR Needed',
          lat: lat + (Math.random() - 0.5) * 0.005,
          lng: lng + (Math.random() - 0.5) * 0.005,
          zoneId: zoneId,
          locationNotes: `Simulated Incident near ${zoneName} Panagal Park`,
          reporterRole: 'bystander',
          reporterContact: '+91 98401 99999',
          allocationPolicy: 'coverage_aware_allocation'
        })
      });
      
      // Reload profile immediately to pick up the new assignment offer!
      loadProfile();
    } catch (err) {
      alert('Simulation error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // AUTHENTICATION SCREEN (if not logged in)
  // ==========================================
  if (!currentUser) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-12 animate-in fade-in">
        <div className="bg-white border border-warm-border rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
          
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
              {isLoginMode ? 'Sign In to Portal' : 'Register as Volunteer'}
            </h1>
          </div>

          {/* Login / Register Tab Toggle */}
          <div className="flex border-b border-warm-border">
            <button
              type="button"
              onClick={() => { setIsLoginMode(true); setError(null); }}
              className={`pb-2.5 text-xs font-bold border-b-2 mr-6 transition-colors cursor-pointer ${
                isLoginMode ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-warm-slate hover:text-ink'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLoginMode(false); setError(null); }}
              className={`pb-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                !isLoginMode ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-warm-slate hover:text-ink'
              }`}
            >
              Register New Volunteer
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-800 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="space-y-4">
            {!isLoginMode && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Karthik Subbaraj"
                    className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-sage shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g., 98401 23456"
                    className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-sage shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Base Chennai Zone</label>
                  <select
                    value={baseZoneId}
                    onChange={(e) => setBaseZoneId(e.target.value)}
                    className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-sage cursor-pointer shadow-xs"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>{z.zone_name} (Zone {z.id})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@civicare.in"
                className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-sage shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-sage shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : isLoginMode ? 'Sign In to Portal' : 'Register Responder Profile'}
            </button>
          </form>

          {/* Test Account Helpers */}
          <div className="pt-4 border-t border-warm-border text-xs text-warm-slate space-y-2">
            <div className="font-bold text-ink text-[11px] uppercase tracking-wider">
              Quick Test Volunteers (Click to Fill):
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setEmail('dr.arun@civicare.in'); setPassword('resp123'); setIsLoginMode(true); }}
                className="text-xs bg-warm-bg hover:bg-emerald-50 hover:border-emerald-300 text-ink px-3 py-1.5 rounded-md border border-warm-border font-medium transition-colors cursor-pointer"
              >
                Dr. Arun (T. Nagar)
              </button>
              <button
                type="button"
                onClick={() => { setEmail('suresh.m@civicare.in'); setPassword('resp123'); setIsLoginMode(true); }}
                className="text-xs bg-warm-bg hover:bg-emerald-50 hover:border-emerald-300 text-ink px-3 py-1.5 rounded-md border border-warm-border font-medium transition-colors cursor-pointer"
              >
                Suresh Mani (Ambattur)
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // LOGGED-IN RESPONDER DASHBOARD
  // ==========================================
  // Correctly bound to backend response properties!
  const { responder, certifications = [], activeShift, activeAssignments = [], networkAssignments = [] } = profileData || {};
  const isAvailable = responder?.availability_status === 'available';
  const hasActiveAssignment = activeAssignments.length > 0;
  const currentAssignment = activeAssignments[0];

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 animate-in fade-in space-y-6">
      
      {/* Top Profile Header & Duty Switch Bar */}
      <div className="bg-white border border-warm-border rounded-xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Responder Identity */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-600">
              {responder?.zone_name || 'T. Nagar'} • {responder?.organisation_name || 'Volunteer Corps'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            {currentUser.full_name || currentUser.fullName || responder?.full_name}
          </h1>
          <p className="text-xs text-warm-slate mt-0.5">
            {currentUser.email} • ID #{responder?.id}
          </p>
        </div>

        {/* Tactile Operational Duty Switch */}
        <div className={`flex items-center gap-3.5 p-3 rounded-xl border-2 transition-all ${
          isAvailable 
            ? 'bg-emerald-50/80 border-emerald-500 shadow-xs' 
            : 'bg-warm-bg border-warm-border'
        }`}>
          <div>
            <div className="text-[10px] uppercase font-bold text-warm-slate tracking-wider">
              Duty Status
            </div>
            <div className="text-xs font-bold text-ink flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>{isAvailable ? 'Available on Duty' : 'Off Duty / Standby'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleAvailability}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isAvailable
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-white hover:bg-warm-bg text-ink border border-warm-border'
            }`}
          >
            {isAvailable ? 'Go Off Duty' : 'Go On Duty'}
          </button>
        </div>

      </div>

      {/* Live Emergency Dispatch Radar (Active Incident Alert or Standby Scanner) */}
      {hasActiveAssignment ? (
        <div className="bg-red-50 border-2 border-red-500 rounded-xl p-5 sm:p-6 shadow-md space-y-4 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-red-200">
            <div className="flex items-center gap-2 text-red-900 font-extrabold text-xs uppercase tracking-wider">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <span>LIVE EMERGENCY DISPATCH ASSIGNMENT</span>
            </div>
            <span className="text-xs font-mono font-bold text-ink bg-white px-2.5 py-1 rounded border border-red-200">
              Ref: {currentAssignment.reference_code}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase text-red-700 bg-red-100 px-2 py-0.5 rounded border border-red-200">
                Priority: {currentAssignment.priority_label || 'CRITICAL'}
              </span>
              <h2 className="text-xl font-extrabold text-ink mt-1.5">
                {currentAssignment.incident_type}
              </h2>
              <div className="text-xs text-warm-slate flex items-start gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                <span className="text-ink font-medium">{currentAssignment.location_notes || 'Coordinates on Map'}</span>
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-red-200 text-xs self-start sm:self-auto shrink-0 space-y-1">
              <div>Est. Distance: <strong className="text-ink">{currentAssignment.estimated_distance_km ? parseFloat(currentAssignment.estimated_distance_km).toFixed(2) + ' km' : 'Nearby'}</strong></div>
              <div>Est. Arrival: <strong className="text-ink">~{currentAssignment.estimated_travel_minutes || 4} mins</strong></div>
              <div>Assignment Status: <strong className="text-red-700 uppercase">{currentAssignment.status}</strong></div>
            </div>
          </div>

          {/* Sequential Mission Actions */}
          <div className="pt-2 border-t border-red-200 flex flex-wrap items-center gap-3">
            {currentAssignment.status === 'offered' && (
              <>
                <button
                  type="button"
                  onClick={() => handleAssignmentResponse(currentAssignment.id, 'accept')}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept Emergency Dispatch</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAssignmentResponse(currentAssignment.id, 'decline')}
                  className="bg-white hover:bg-warm-bg text-red-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-red-300 transition-colors cursor-pointer"
                >
                  Decline & Reroute to Next Responder
                </button>
              </>
            )}

            {(currentAssignment.status === 'accepted' || currentAssignment.status === 'assigned') && (
              <button
                type="button"
                onClick={() => handleAssignmentEvent(currentAssignment.id, 'EN_ROUTE')}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Navigation className="w-4 h-4" />
                <span>Confirm En Route to Patient</span>
              </button>
            )}

            {currentAssignment.status === 'en_route' && (
              <button
                type="button"
                onClick={() => handleAssignmentEvent(currentAssignment.id, 'ARRIVED')}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <MapPin className="w-4 h-4" />
                <span>Confirm Arrival on Scene</span>
              </button>
            )}

            {currentAssignment.status === 'arrived' && (
              <button
                type="button"
                onClick={() => handleAssignmentEvent(currentAssignment.id, 'COMPLETED')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-colors shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Complete Call & Transfer to 108 Ambulance</span>
              </button>
            )}

            {currentAssignment.status === 'completed' && (
              <div className="flex items-center justify-between w-full p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Mission Completed • Patient safely transferred to 108 Ambulance</span>
                </div>
                <button
                  type="button"
                  onClick={loadProfile}
                  className="text-xs text-ink hover:underline font-semibold cursor-pointer"
                >
                  Return to Standby Radar
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Standby Radar Card with Simulate Button + Network Dispatches */
        <div className="space-y-4">
          <div className="bg-white border border-warm-border rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 animate-pulse text-emerald-600" />
              </div>
              <div>
                <div className="text-xs font-bold text-ink flex items-center gap-2">
                  <span>Dispatch Radar Scanning Active Sector</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-900 px-2 py-0.2 rounded-full font-bold">STANDBY</span>
                </div>
                <p className="text-xs text-warm-slate mt-0.5 leading-relaxed">
                  Listening for emergency bystander broadcasts within a 3 km perimeter in {responder?.zone_name || 'T. Nagar'}. You will receive immediate audio & visual alerts when matched.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSimulateAlert}
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-ink hover:bg-ink-light text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-xs whitespace-nowrap self-start sm:self-auto cursor-pointer"
              title="Create a test incident in this zone to test the live responder alert workflow"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Test Emergency Alert</span>
            </button>
          </div>

          {/* Active Calls in City Network (Mutual Aid / Coordination) */}
          {networkAssignments.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Ongoing City Dispatches ({networkAssignments.length} Active in Network)</span>
                </div>
                <span className="text-[11px] text-amber-800 font-medium">Mutual Aid Network</span>
              </div>
              <div className="space-y-2">
                {networkAssignments.map((netCall) => (
                  <div key={netCall.id} className="bg-white p-3 rounded-lg border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-ink flex items-center gap-2">
                        <span>{netCall.incident_type}</span>
                        <span className="font-mono text-[10px] bg-warm-bg px-1.5 py-0.5 rounded text-warm-slate border border-warm-border">
                          {netCall.reference_code}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                          {netCall.status}
                        </span>
                      </div>
                      <div className="text-warm-slate text-[11px] mt-0.5">
                        Location: {netCall.location_notes || netCall.incident_zone} • Assigned Volunteer: <strong className="text-ink">{netCall.allocated_responder_name}</strong>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAssignmentResponse(netCall.id, 'accept')}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded transition-colors cursor-pointer"
                      >
                        Accept / Assist On Dispatch
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Active Shift Window & Medical Certifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Active Shift Windows */}
        <div className="lg:col-span-6 bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-warm-border bg-warm-bg/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">Active Shift Windows</h3>
              <p className="text-xs text-warm-slate mt-0.5">Volunteers receive dispatch alerts while shifts are active</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStartShift(4)}
                className="bg-white hover:bg-warm-bg text-ink border border-warm-border px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                + 4h Shift
              </button>
              <button
                type="button"
                onClick={() => handleStartShift(8)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                + 8h Shift
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {activeShift ? (
              <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">Current Shift Active</span>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                    ON DUTY
                  </span>
                </div>
                <div className="text-xs text-ink">
                  <div><strong>Start:</strong> {new Date(activeShift.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div><strong>End:</strong> {new Date(activeShift.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(activeShift.end_at).toLocaleDateString()})</div>
                </div>
                <div className="text-[11px] text-emerald-800 pt-1 border-t border-emerald-200">
                  ● Enforced in database table <code>shifts</code>. Responders in active shifts are prioritized by the coverage-aware allocation engine.
                </div>
              </div>
            ) : (
              <div className="p-5 text-center text-xs text-warm-slate border border-dashed border-warm-border rounded-lg space-y-2">
                <Clock className="w-6 h-6 text-warm-slate/40 mx-auto" />
                <div className="font-semibold text-ink">No active shift registered right now.</div>
                <p className="text-[11px] max-w-xs mx-auto">
                  Click "+ 4h Shift" or "+ 8h Shift" above to open your duty window and become eligible for dispatch calls.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Medical Certifications & Credentials */}
        <div className="lg:col-span-6 bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-warm-border bg-warm-bg/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink">Verified Medical Qualifications</h3>
              <p className="text-xs text-warm-slate mt-0.5">Dispatches are matched against unexpired verified skills</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCertModal(true)}
              className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-md transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Certificate</span>
            </button>
          </div>

          <div className="p-4 space-y-2.5">
            {certifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-warm-slate border border-dashed border-warm-border rounded-lg">
                No credentials submitted yet. Click "Submit Certificate" to upload qualifications.
              </div>
            ) : (
              certifications.map((cert) => {
                const isExpired = new Date(cert.valid_until) < new Date();
                const isVerified = cert.verified_status === 'verified';
                return (
                  <div key={cert.id} className="p-3.5 rounded-lg border border-warm-border flex items-center justify-between text-xs hover:bg-warm-bg/40 transition-colors">
                    <div>
                      <div className="font-bold text-ink text-xs">{cert.skill_name}</div>
                      <div className="text-[11px] text-warm-slate mt-0.5">
                        {cert.issuer_label} • #{cert.certification_number}
                      </div>
                      <div className="text-[10px] text-warm-slate mt-0.5">
                        Valid through: <strong>{new Date(cert.valid_until).toLocaleDateString()}</strong>
                      </div>
                    </div>
                    
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md border tracking-wider ${
                      isExpired 
                        ? 'bg-red-50 text-red-800 border-red-300' 
                        : isVerified
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-amber-50 text-amber-800 border-amber-300'
                    }`}>
                      {isExpired ? 'EXPIRED' : cert.verified_status || 'VERIFIED'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Submit New Credential Modal */}
      {showCertModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl border border-warm-border max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-warm-border">
              <h3 className="text-base font-bold text-ink">Submit First Aid Credential</h3>
              <button 
                type="button" 
                onClick={() => setShowCertModal(false)}
                className="text-warm-slate hover:text-ink text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCertSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-ink mb-1">Emergency Skill</label>
                <select
                  value={certSkillId}
                  onChange={(e) => setCertSkillId(e.target.value)}
                  className="w-full bg-warm-bg border border-warm-border rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-sage cursor-pointer"
                >
                  <option value={1}>Cardiopulmonary Resuscitation (CPR) & AED</option>
                  <option value={2}>Severe Bleeding Control & Hemorrhage Care</option>
                  <option value={3}>Basic First Aid & Triage</option>
                  <option value={4}>Airway Obstruction & Choking Clearance</option>
                  <option value={5}>Fracture & Trauma Splinting</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Certification Number</label>
                <input
                  type="text"
                  required
                  value={certNumber}
                  onChange={(e) => setCertNumber(e.target.value)}
                  placeholder="e.g. CERT-TN-2026-442"
                  className="w-full bg-white border border-warm-border rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-sage"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink mb-1">Issuing Authority</label>
                <input
                  type="text"
                  required
                  value={certIssuer}
                  onChange={(e) => setCertIssuer(e.target.value)}
                  placeholder="e.g. Indian Red Cross Society / St John Ambulance"
                  className="w-full bg-white border border-warm-border rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-sage"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Valid From</label>
                  <input
                    type="date"
                    required
                    value={certFrom}
                    onChange={(e) => setCertFrom(e.target.value)}
                    className="w-full bg-white border border-warm-border rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-sage"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink mb-1">Valid Until</label>
                  <input
                    type="date"
                    required
                    value={certUntil}
                    onChange={(e) => setCertUntil(e.target.value)}
                    className="w-full bg-white border border-warm-border rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-sage"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-warm-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCertModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-warm-border text-xs text-warm-slate hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                >
                  Submit for Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
