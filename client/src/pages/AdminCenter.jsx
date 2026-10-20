import React, { useState, useEffect } from 'react';
import { 
  UserCheck, ShieldCheck, CheckCircle2, XCircle, FileText, 
  Search, RefreshCw, AlertCircle, Eye, History, Database, LogIn, Check, X,
  ShieldAlert, Award, Calendar, Phone, MapPin, Building, Scale, ArrowRight,
  Filter, CheckCircle, Clock
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../api';

function formatRejectionReason(code) {
  if (!code) return 'Did not meet criteria';
  if (code.startsWith('EXCEEDS_MAX_RADIUS')) return 'Beyond max dispatch radius';
  if (code === 'CERTIFICATION_EXPIRED') return 'CPR / AED credential expired';
  if (code === 'LACKS_REQUIRED_SKILL_CPR_AED') return 'Missing CPR / AED credential';
  if (code === 'LACKS_REQUIRED_SKILL_BLEEDING_CTRL') return 'Missing Bleeding Control credential';
  if (code === 'LACKS_REQUIRED_SKILL_PEDIATRIC_FIRST_AID') return 'Missing Pediatric First Aid credential';
  if (code.startsWith('LACKS_REQUIRED_SKILL')) return 'Missing required clinical skill';
  if (code.startsWith('NO_CERTIFICATION_FOR')) return 'No verified credential on file';
  if (code === 'AVAILABILITY_STATUS_NOT_AVAILABLE') return 'Responder is off duty';
  if (code === 'NO_ACTIVE_SHIFT') return 'No active shift logged';
  if (code === 'ACCOUNT_NOT_ACTIVE') return 'Profile pending verification';
  if (code === 'ALREADY_ASSIGNED_CONFLICT') return 'On active emergency mission';
  return code.toLowerCase().replace(/_/g, ' ');
}

export default function AdminCenter({ currentUser, onLoginSuccess }) {
  const [activeTab, setActiveTab] = useState('certifications'); // 'certifications', 'decisions', 'responders', 'audit', 'database'
  const [pendingCerts, setPendingCerts] = useState([]);
  const [responders, setResponders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [decisionLogs, setDecisionLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Modals & Inspection State
  const [inspectDecision, setInspectDecision] = useState(null);
  const [reviewModalCert, setReviewModalCert] = useState(null); // cert object when reviewing
  const [reviewAction, setReviewAction] = useState('verified'); // 'verified' | 'rejected'
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState(null);

  // Search & Filter State
  const [certSearch, setCertSearch] = useState('');
  const [responderSearch, setResponderSearch] = useState('');
  const [responderZoneFilter, setResponderZoneFilter] = useState('all');
  const [decisionSearch, setDecisionSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  // Admin login credentials
  const [adminEmail, setAdminEmail] = useState('admin@civicare.in');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [loginError, setLoginError] = useState(null);

  const isAdminOrEval = currentUser && (currentUser.role === 'admin' || currentUser.role === 'evaluator');

  const loadData = () => {
    if (!isAdminOrEval) return;
    setLoading(true);
    Promise.all([
      apiFetch('/admin/certifications?status=pending'),
      apiFetch('/admin/responders'),
      apiFetch('/admin/audit-logs'),
      apiFetch('/admin/decision-logs')
    ])
      .then(([certsData, respData, auditData, decisionData]) => {
        setPendingCerts(certsData.certifications || []);
        setResponders(respData.responders || []);
        setAuditLogs(auditData.auditLogs || []);
        setDecisionLogs(decisionData.decisionLogs || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (isAdminOrEval) {
      loadData();
    }
  }, [isAdminOrEval]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: adminEmail, password: adminPassword })
      });
      setStoredToken(res.token);
      onLoginSuccess(res.user);
    } catch (err) {
      setLoginError(err.message || 'Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (cert, action) => {
    setReviewModalCert(cert);
    setReviewAction(action);
    setReviewNotes(
      action === 'verified'
        ? 'Verified against official institutional roster. Identity and credentials confirmed.'
        : 'Credential documentation could not be verified against official roster.'
    );
  };

  const handleConfirmReview = async () => {
    if (!reviewModalCert) return;
    try {
      await apiFetch(`/admin/certifications/${reviewModalCert.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: reviewAction, reviewNotes })
      });
      setReviewModalCert(null);
      setActionSuccess(`Certification for ${reviewModalCert.responder_name} marked as ${reviewAction}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadData();
    } catch (err) {
      alert('Verification action failed: ' + err.message);
    }
  };

  // Filtered lists
  const filteredCerts = pendingCerts.filter(c => 
    c.responder_name?.toLowerCase().includes(certSearch.toLowerCase()) ||
    c.skill_name?.toLowerCase().includes(certSearch.toLowerCase()) ||
    c.certification_number?.toLowerCase().includes(certSearch.toLowerCase())
  );

  const filteredResponders = responders.filter(r => {
    const matchesSearch = 
      r.full_name?.toLowerCase().includes(responderSearch.toLowerCase()) ||
      r.zone_name?.toLowerCase().includes(responderSearch.toLowerCase()) ||
      r.organisation_name?.toLowerCase().includes(responderSearch.toLowerCase());
    const matchesZone = responderZoneFilter === 'all' || r.zone_name === responderZoneFilter;
    return matchesSearch && matchesZone;
  });

  const filteredDecisions = decisionLogs.filter(d => 
    d.reference_code?.toLowerCase().includes(decisionSearch.toLowerCase()) ||
    d.incident_type?.toLowerCase().includes(decisionSearch.toLowerCase()) ||
    d.selected_responder_name?.toLowerCase().includes(decisionSearch.toLowerCase())
  );

  const filteredAudit = auditLogs.filter(a => 
    a.action?.toLowerCase().includes(auditSearch.toLowerCase()) ||
    a.actor_email?.toLowerCase().includes(auditSearch.toLowerCase()) ||
    a.entity_type?.toLowerCase().includes(auditSearch.toLowerCase())
  );

  // Unique zones for filter
  const zonesList = Array.from(new Set(responders.map(r => r.zone_name))).filter(Boolean).sort();

  // Narrow Admin Sign-In Screen (if not logged in)
  if (!isAdminOrEval) {
    return (
      <div className="w-full max-w-md mx-auto px-6 py-12 animate-in fade-in">
        <div className="bg-white border border-warm-border rounded-xl p-8 space-y-6 shadow-sm">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">Admin Sign In</h1>
          </div>

          {loginError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Administrator Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Password</label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                className="w-full bg-white border border-warm-border rounded-lg px-3.5 py-2 text-xs text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 px-4 rounded-lg text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Admin Workspace'}
            </button>
          </form>

          {/* Quick Demo Fill Helper */}
          <div className="pt-4 border-t border-warm-border text-xs text-warm-slate flex items-center justify-between">
            <span className="text-[11px]">Test Admin Credential:</span>
            <button
              type="button"
              onClick={() => { setAdminEmail('admin@civicare.in'); setAdminPassword('admin123'); }}
              className="text-[11px] font-mono bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold cursor-pointer"
            >
              admin@civicare.in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-10 py-8 animate-in fade-in space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-warm-border gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
            Admin Console
          </h1>
          <span className="text-[11px] font-semibold text-slate-600 bg-white border border-warm-border px-2.5 py-0.5 rounded-full shadow-xs">
            Governance & Audit
          </span>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-warm-border px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Workspace Tabs */}
      <div className="flex flex-wrap border-b border-warm-border gap-y-2 gap-x-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('certifications')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'certifications'
              ? 'border-emerald-600 text-emerald-950 font-bold'
              : 'border-transparent text-warm-slate hover:text-ink'
          }`}
        >
          <span>Pending Verifications</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
            pendingCerts.length > 0 
              ? 'bg-amber-50 text-amber-800 border-amber-200' 
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            {pendingCerts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('decisions')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'decisions'
              ? 'border-emerald-600 text-emerald-950 font-bold'
              : 'border-transparent text-warm-slate hover:text-ink'
          }`}
        >
          <span>Allocation Decision Logs</span>
          <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200">
            {decisionLogs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('responders')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'responders'
              ? 'border-emerald-600 text-emerald-950 font-bold'
              : 'border-transparent text-warm-slate hover:text-ink'
          }`}
        >
          <span>Responder Corps Directory</span>
          <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200">
            {responders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'audit'
              ? 'border-emerald-600 text-emerald-950 font-bold'
              : 'border-transparent text-warm-slate hover:text-ink'
          }`}
        >
          <span>Security Audit Trail</span>
          <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold border border-slate-200">
            {auditLogs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: PENDING CERTIFICATIONS REVIEW */}
      {activeTab === 'certifications' && (
        <div className="bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs space-y-4">
          <div className="p-4 sm:p-5 border-b border-warm-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Volunteer Credential Verification Queue</h2>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search volunteer or skill..."
                value={certSearch}
                onChange={e => setCertSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-warm-border rounded-lg text-ink focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {filteredCerts.length === 0 ? (
            <div className="p-16 text-center text-xs text-warm-slate space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="text-sm font-bold text-ink">Verification Queue Clear</div>
              <p>All volunteer clinical credentials have been audited and verified.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-warm-border">
                  <tr>
                    <th className="py-3 px-4">Volunteer</th>
                    <th className="py-3 px-4">Skill Type</th>
                    <th className="py-3 px-4">Certificate #</th>
                    <th className="py-3 px-4">Issuing Body</th>
                    <th className="py-3 px-4">Validity Range</th>
                    <th className="py-3 px-4 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-border">
                  {filteredCerts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-ink">
                        <div>{c.responder_name}</div>
                        <div className="text-[10px] text-slate-500 font-normal flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{c.zone_name}</span>
                          {c.responder_phone && (
                            <>
                              <span>•</span>
                              <span>{c.responder_phone}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-ink">
                        <span className="font-semibold">{c.skill_name}</span>
                        <div className="text-[10px] text-slate-500 max-w-xs truncate" title={c.permitted_scope}>
                          {c.permitted_scope}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {c.certification_number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {c.issuer_label}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600">
                        <div className="font-mono">
                          {new Date(c.valid_from).toLocaleDateString()} – {new Date(c.valid_until).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-emerald-800 font-medium">
                          Non-expired
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => openReviewModal(c, 'verified')}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs"
                        >
                          Approve & Verify
                        </button>
                        <button
                          onClick={() => openReviewModal(c, 'rejected')}
                          className="bg-white hover:bg-rose-50 text-rose-700 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-rose-200 transition-all cursor-pointer"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALLOCATION DECISION LOGS */}
      {activeTab === 'decisions' && (
        <div className="bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs space-y-4">
          <div className="p-4 sm:p-5 border-b border-warm-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Allocation Decision Logs</h2>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search incident or responder..."
                value={decisionSearch}
                onChange={e => setDecisionSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-warm-border rounded-lg text-ink focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-warm-border">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Incident Reference</th>
                  <th className="py-3 px-4">Emergency Type</th>
                  <th className="py-3 px-4">Dispatched Responder</th>
                  <th className="py-3 px-4">Proximity & Travel</th>
                  <th className="py-3 px-4">Policy Used</th>
                  <th className="py-3 px-4 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border">
                {filteredDecisions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-warm-slate">
                      No matching allocation decision logs found.
                    </td>
                  </tr>
                ) : (
                  filteredDecisions.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {new Date(d.created_at || d.decided_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-ink">
                        {d.reference_code || 'CIVI-CHN-...'}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {d.incident_type}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {d.selected_responder_name || 'No Candidate Found'}
                        {d.score_details?.base_zone && (
                          <div className="text-[10px] text-slate-500 font-normal">
                            Home: {d.score_details.base_zone}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {d.score_details?.selected_distance_km !== undefined ? (
                          <>
                            <span className="font-mono font-semibold">{d.score_details.selected_distance_km.toFixed(2)} km</span>
                            <span className="text-[10px] text-slate-500 ml-1">({d.score_details.selected_travel_minutes?.toFixed(1)} mins)</span>
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          d.policy_version === 'coverage_aware_allocation'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {d.policy_version === 'coverage_aware_allocation' ? 'Coverage-Aware' : 'Nearest Baseline'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setInspectDecision(d)}
                          className="text-emerald-800 hover:text-emerald-950 font-bold hover:underline cursor-pointer"
                        >
                          Inspect Tree
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RESPONDER DIRECTORY */}
      {activeTab === 'responders' && (
        <div className="bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs space-y-4">
          <div className="p-4 sm:p-5 border-b border-warm-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Volunteer Directory</h2>
            </div>

            {/* Search & Zone Dropdown Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={responderZoneFilter}
                onChange={e => setResponderZoneFilter(e.target.value)}
                className="bg-white border border-warm-border rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="all">All Zones ({responders.length})</option>
                {zonesList.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter responders..."
                  value={responderSearch}
                  onChange={e => setResponderSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-warm-border rounded-lg text-ink focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-warm-border">
                <tr>
                  <th className="py-3 px-4">Volunteer Name</th>
                  <th className="py-3 px-4">Base Zone</th>
                  <th className="py-3 px-4">Affiliated Organization</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Operational Availability</th>
                  <th className="py-3 px-4 text-right">Verified Skills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border">
                {filteredResponders.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div>{r.full_name}</div>
                      {r.phone && <div className="text-[10px] text-slate-500 font-normal">{r.phone}</div>}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {r.zone_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {r.organisation_name || 'Independent Community Volunteer'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        r.responder_status === 'active' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {r.responder_status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        r.availability_status === 'available'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {r.availability_status === 'available' ? '● Available on Duty' : '○ Off Duty'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        {r.verified_certs_count || 0} Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-warm-border rounded-xl overflow-hidden shadow-xs space-y-4">
          <div className="p-4 sm:p-5 border-b border-warm-border bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">Security Audit Logs</h2>
            </div>

            {/* Quick Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search audit actions..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-warm-border rounded-lg text-ink focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-warm-border">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Audit Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-border">
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-warm-slate">
                      No security audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {new Date(a.timestamp || a.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {a.actor_email || 'System / Evaluator'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {a.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 uppercase text-[10px] font-semibold">
                        {a.entity_type}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        #{a.entity_id}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600 max-w-xs truncate" title={JSON.stringify(a.metadata)}>
                        {a.metadata ? JSON.stringify(a.metadata) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modern In-App Credential Review Modal */}
      {reviewModalCert && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-warm-border shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-warm-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`w-5 h-5 ${reviewAction === 'verified' ? 'text-emerald-600' : 'text-rose-600'}`} />
                <h3 className="text-sm font-bold text-ink">
                  {reviewAction === 'verified' ? 'Approve & Verify Credential' : 'Reject Credential Submission'}
                </h3>
              </div>
              <button
                onClick={() => setReviewModalCert(null)}
                className="text-warm-slate hover:text-ink p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cert Details Summary */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-warm-border space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Volunteer:</span>
                <span className="font-bold text-slate-900">{reviewModalCert.responder_name} ({reviewModalCert.zone_name})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clinical Skill:</span>
                <span className="font-semibold text-slate-800">{reviewModalCert.skill_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Certificate #:</span>
                <span className="font-mono font-bold text-slate-900">{reviewModalCert.certification_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Issuing Body:</span>
                <span className="text-slate-700">{reviewModalCert.issuer_label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Validity:</span>
                <span className="font-mono text-slate-700">
                  {new Date(reviewModalCert.valid_from).toLocaleDateString()} to {new Date(reviewModalCert.valid_until).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Quick Note Presets */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">Quick Verification Audit Notes:</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Verified against official Red Cross roster.',
                  'St. John Ambulance certification confirmed.',
                  'License active on Tamil Nadu state registry.',
                  'Unverified certificate format / unreadable.',
                  'Expired credential or incomplete training.'
                ].map(note => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setReviewNotes(note)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded border border-slate-200 cursor-pointer"
                  >
                    {note}
                  </button>
                ))}
              </div>
            </div>

            {/* Review Notes Textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Log Review Note</label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className="w-full bg-white border border-warm-border rounded-lg p-2.5 text-xs text-ink focus:outline-none focus:border-emerald-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-warm-border">
              <button
                type="button"
                onClick={() => setReviewModalCert(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReview}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all cursor-pointer ${
                  reviewAction === 'verified'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {reviewAction === 'verified' ? 'Confirm Approval & Verify' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visual Explainable Decision Inspector Modal */}
      {inspectDecision && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-warm-border shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-warm-border">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-ink">Explainable Allocation Decision Tree</h3>
              </div>
              <button
                onClick={() => setInspectDecision(null)}
                className="text-warm-slate hover:text-ink p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Header Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-warm-border">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Incident Code</span>
                <span className="font-mono font-bold text-slate-900">{inspectDecision.reference_code}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-warm-border">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Emergency Type</span>
                <span className="font-semibold text-slate-900 truncate block">{inspectDecision.incident_type}</span>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block">Selected Responder</span>
                <span className="font-bold text-emerald-950 truncate block">{inspectDecision.selected_responder_name}</span>
              </div>
            </div>

            {/* Score & Proximity Details */}
            {inspectDecision.score_details && (
              <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-950">Optimal Dispatch Formulation:</span>
                  <span className="font-mono text-emerald-800 font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                    Combined Score: {inspectDecision.score_details.combined_score?.toFixed(3) || 'Optimal'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">Travel Distance:</span>
                    <strong className="text-slate-800">{inspectDecision.score_details.selected_distance_km?.toFixed(2)} km</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Est. Arrival Time:</span>
                    <strong className="text-slate-800">{inspectDecision.score_details.selected_travel_minutes?.toFixed(1)} mins</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Home Zone:</span>
                    <strong className="text-slate-800">{inspectDecision.score_details.base_zone}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Residual Volunteers:</span>
                    <strong className="text-slate-800">{inspectDecision.score_details.residual_zone_count} remaining</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Candidate Summary Evaluation List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Evaluated Candidates ({inspectDecision.candidate_summary?.length || 0})</span>
                <span className="text-[10px] font-mono text-slate-500">
                  {inspectDecision.candidate_summary?.filter(c => c.is_eligible).length || 0} Eligible Candidates Considered
                </span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {inspectDecision.candidate_summary?.map((cand, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs gap-2 ${
                      cand.name === inspectDecision.selected_responder_name
                        ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-bold shadow-xs'
                        : cand.is_eligible
                        ? 'bg-emerald-50/20 border-emerald-200 text-slate-800'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{cand.name}</span>
                      <span className="text-[10px] text-slate-500">({cand.base_zone || 'Chennai'})</span>
                    </div>

                    {cand.is_eligible ? (
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span>{cand.distance_km?.toFixed(2)} km</span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/60 px-1.5 py-0.5 rounded">
                          Score: {cand.combined_score?.toFixed(3) || 'Eligible'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {formatRejectionReason(cand.rejection_reason)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-warm-border">
              <button
                type="button"
                onClick={() => setInspectDecision(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
