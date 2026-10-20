import React, { useState } from 'react';
import { 
  PhoneCall, ShieldAlert, Activity, Building2, 
  FlaskConical, UserCheck, LogOut, HeartPulse, Menu, X, ChevronDown
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, currentUser, onLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCall112Modal, setShowCall112Modal] = useState(false);

  const navGroups = [
    {
      name: 'Operations',
      items: [
        { id: 'report', label: 'Report Emergency', icon: ShieldAlert },
        { id: 'facilities', label: 'Hospital Directory', icon: Building2 },
      ]
    },
    {
      name: 'Readiness',
      items: [
        { id: 'readiness', label: 'Zone Readiness', icon: Activity },
        { id: 'responder', label: 'Responder Portal', icon: HeartPulse },
      ]
    },
    {
      name: 'Governance',
      items: [
        { id: 'experiments', label: 'Algorithm Lab', icon: FlaskConical },
        { id: 'admin', label: 'Admin & Verification', icon: UserCheck },
      ]
    }
  ];

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-white border-b border-warm-border sticky top-0 z-40 transition-colors">
        <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-10">
          <div className="flex justify-between items-center h-16">
            
            {/* Brand Logo & Civic Context */}
            <div 
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => handleNavClick('report')}
            >
              <div className="w-9 h-9 rounded-md bg-sage text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <HeartPulse className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-ink tracking-tight">CiviCare</span>
                  <span className="text-[11px] font-semibold text-sage-dark bg-sage-tint px-2 py-0.5 rounded border border-sage/20 uppercase tracking-wider">
                    Chennai
                  </span>
                </div>
                <div className="text-[11px] text-warm-slate hidden sm:block leading-none mt-0.5">
                  Community First Responder Coordination
                </div>
              </div>
            </div>

            {/* Desktop Navigation Grouped */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navGroups.map((group, gIdx) => (
                <div key={group.name} className="flex items-center">
                  {gIdx > 0 && <span className="h-4 w-px bg-warm-border mx-2"></span>}
                  <div className="flex items-center space-x-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            isActive
                              ? 'bg-sage-tint text-ink font-semibold border border-sage/30'
                              : 'text-warm-slate hover:text-ink hover:bg-warm-bg'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sage-dark' : 'text-warm-slate'}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Right Actions: Restrained CALL 112 & Account Info */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCall112Modal(true)}
                className="flex items-center gap-1.5 bg-civicred hover:bg-civicred-hover text-white text-xs font-semibold px-3.5 py-1.5 rounded-md shadow-xs transition-colors"
                title="Dial 112 Emergency Lifeline"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>CALL 112</span>
              </button>

              {currentUser ? (
                <div className="flex items-center gap-2 pl-3 border-l border-warm-border">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-semibold text-ink leading-tight">
                      {currentUser.fullName || currentUser.email}
                    </div>
                    <div className="text-[10px] text-warm-slate capitalize">
                      {currentUser.role}
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    title="Sign Out"
                    className="p-1.5 text-warm-slate hover:text-civicred hover:bg-warm-bg rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : null}

              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-warm-slate hover:text-ink rounded-md hover:bg-warm-bg"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>

          {/* Mobile Navigation Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-3 border-t border-warm-border space-y-4 animate-in fade-in">
              {navGroups.map((group) => (
                <div key={group.name} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-warm-slate px-2">
                    {group.name}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleNavClick(item.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md text-left transition-colors ${
                            isActive
                              ? 'bg-sage-tint text-ink font-semibold'
                              : 'text-warm-slate hover:bg-warm-bg hover:text-ink'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </header>

      {/* CALL 112 Lifeline Modal */}
      {showCall112Modal && (
        <div className="fixed inset-0 bg-ink/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-warm-border shadow-md max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-civicred">
              <PhoneCall className="w-5 h-5" />
              <h3 className="text-base font-bold text-ink">Emergency Lifeline (112 / 108)</h3>
            </div>
            <p className="text-xs text-warm-slate leading-relaxed">
              CiviCare is an academic first-responder coordination prototype. It coordinates community volunteers during the critical initial minutes, but <strong>does not replace official government emergency response</strong>.
            </p>
            <div className="p-3 bg-civicred-light rounded-md border border-civicred-border text-xs text-ink space-y-1">
              <div>• <strong>112</strong>: National Unified Emergency Lifeline</div>
              <div>• <strong>108</strong>: Tamil Nadu Ambulance Emergency Service</div>
              <div>• <strong>102</strong>: Maternity & Child Emergency Health Transport</div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCall112Modal(false)}
                className="flex-1 bg-warm-bg hover:bg-warm-muted text-warm-slate font-medium py-2 rounded-md text-xs border border-warm-border transition-colors"
              >
                Close
              </button>
              <a
                href="tel:112"
                className="flex-1 bg-civicred hover:bg-civicred-hover text-white font-bold py-2 rounded-md text-xs text-center transition-colors shadow-xs"
              >
                Dial 112 Now
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
