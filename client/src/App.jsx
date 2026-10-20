import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ReportEmergency from './pages/ReportEmergency';
import FacilityDirectory from './pages/FacilityDirectory';
import ReadinessDashboard from './pages/ReadinessDashboard';
import ExperimentLab from './pages/ExperimentLab';
import ResponderPortal from './pages/ResponderPortal';
import AdminCenter from './pages/AdminCenter';
import { apiFetch, setStoredToken, getStoredToken } from './api';
import { Sparkles, User, ShieldAlert, HeartPulse, UserCheck, FlaskConical, ChevronDown, ChevronUp, X } from 'lucide-react';

const DEMO_PERSONAS = [
  { id: 'guest', label: 'Guest Citizen', icon: ShieldAlert, tab: 'report' },
  { id: 'arun', label: 'Dr. Arun (T. Nagar - CPR)', icon: HeartPulse, tab: 'responder', creds: { email: 'dr.arun@civicare.in', password: 'resp123' } },
  { id: 'revathi', label: 'Revathi Mohan (Kodambakkam - Trauma)', icon: HeartPulse, tab: 'responder', creds: { email: 'revathi.m@civicare.in', password: 'resp123' } },
  { id: 'karthik', label: 'Karthik Subbaraj (T. Nagar - Trauma)', icon: HeartPulse, tab: 'responder', creds: { email: 'karthik.s@civicare.in', password: 'resp123' } },
  { id: 'suresh', label: 'Suresh Mani (Ambattur - Sole)', icon: HeartPulse, tab: 'responder', creds: { email: 'suresh.m@civicare.in', password: 'resp123' } },
  { id: 'admin', label: 'Admin Verifier', icon: UserCheck, tab: 'admin', creds: { email: 'admin@civicare.in', password: 'admin123' } },
  { id: 'eval', label: 'Algorithm Lab', icon: FlaskConical, tab: 'experiments' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('report');
  const [currentUser, setCurrentUser] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [demoExpanded, setDemoExpanded] = useState(false);

  // Check existing session
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      apiFetch('/auth/me')
        .then((res) => {
          if (res?.user) setCurrentUser(res.user);
        })
        .catch(() => {
          setStoredToken(null);
        })
        .finally(() => {
          setInitialLoading(false);
        });
    } else {
      setInitialLoading(false);
    }
  }, []);

  const handleLogout = () => {
    setStoredToken(null);
    setCurrentUser(null);
    setActiveTab('report');
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'admin' || user.role === 'evaluator') {
      setActiveTab('admin');
    } else {
      setActiveTab('responder');
    }
  };

  const handleSwitchPersona = async (persona) => {
    if (persona.creds) {
      try {
        const res = await apiFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify(persona.creds)
        });
        setStoredToken(res.token);
        setCurrentUser(res.user);
        setActiveTab(persona.tab);
      } catch (err) {
        console.error('Persona switch failed', err);
      }
    } else if (persona.id === 'guest') {
      handleLogout();
    } else {
      setActiveTab(persona.tab);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-warm-bg text-ink font-sans selection:bg-sage-tint selection:text-ink">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <main className="flex-grow">
        <div className={activeTab === 'report' ? 'block' : 'hidden'}>
          <ReportEmergency />
        </div>
        {activeTab === 'facilities' && <FacilityDirectory />}
        {activeTab === 'readiness' && <ReadinessDashboard />}
        {activeTab === 'experiments' && <ExperimentLab />}
        {activeTab === 'responder' && (
          <ResponderPortal
            currentUser={currentUser}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
        {activeTab === 'admin' && (
          <AdminCenter
            currentUser={currentUser}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
      </main>

      <Footer />

      {/* Collapsible Demo Persona Widget (Discreet bottom-right corner) */}
      <aside aria-label="Development Demo Persona Switcher" className="fixed bottom-4 right-6 z-30">
        {!demoExpanded ? (
          <button
            onClick={() => setDemoExpanded(true)}
            className="flex items-center gap-1.5 bg-white hover:bg-warm-muted text-warm-slate hover:text-ink text-xs font-semibold px-3 py-1.5 rounded-md border border-warm-border shadow-sm transition-colors cursor-pointer"
            title="Open Demo Persona Switcher"
          >
            <Sparkles className="w-3.5 h-3.5 text-sage" />
            <span>Demo Roles</span>
            <ChevronUp className="w-3.5 h-3.5 text-warm-slate" />
          </button>
        ) : (
          <div className="bg-white border border-warm-border rounded-lg shadow-md p-3 space-y-2 w-64 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-warm-border">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                <Sparkles className="w-3.5 h-3.5 text-sage" />
                <span>Demo Switcher</span>
              </div>
              <button
                onClick={() => setDemoExpanded(false)}
                className="text-warm-slate hover:text-ink p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {DEMO_PERSONAS.map((p) => {
                const isCurrent = 
                  (p.id === 'guest' && !currentUser && activeTab === 'report') ||
                  (p.id === 'admin' && currentUser?.role === 'admin' && activeTab === 'admin') ||
                  (p.id === 'arun' && currentUser?.email === 'dr.arun@civicare.in') ||
                  (p.id === 'revathi' && currentUser?.email === 'revathi.m@civicare.in') ||
                  (p.id === 'karthik' && currentUser?.email === 'karthik.s@civicare.in') ||
                  (p.id === 'suresh' && currentUser?.email === 'suresh.m@civicare.in') ||
                  (p.id === 'eval' && activeTab === 'experiments');

                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      handleSwitchPersona(p);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors text-left ${
                      isCurrent
                        ? 'bg-sage-tint text-ink font-semibold'
                        : 'text-warm-slate hover:bg-warm-bg hover:text-ink'
                    }`}
                  >
                    <span>{p.label}</span>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-sage"></span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
