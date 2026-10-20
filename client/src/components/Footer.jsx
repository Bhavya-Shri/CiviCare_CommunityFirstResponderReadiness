import React from 'react';
import { HeartPulse, PhoneCall, ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-warm-border text-warm-slate text-xs mt-16 py-6">
      <div className="w-full max-w-[1600px] mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Brand context */}
        <div className="flex items-center gap-2 text-ink font-semibold">
          <HeartPulse className="w-4 h-4 text-sage" />
          <span>CiviCare</span>
          <span className="text-warm-slate font-normal">| Community First Responder Coordination System (Chennai)</span>
        </div>

        {/* Official emergency services fallback notice */}
        <div className="flex items-center gap-3 text-ink text-xs">
          <span className="text-warm-slate">Official Lifelines:</span>
          <a href="tel:112" className="text-civicred hover:underline font-bold">112 National Emergency</a>
          <span className="text-warm-border">•</span>
          <a href="tel:108" className="hover:underline font-medium">108 Ambulance</a>
          <span className="text-warm-border">•</span>
          <a href="tel:102" className="hover:underline font-medium">102 Health</a>
        </div>

        {/* Data provenance & disclaimer */}
        <div className="text-warm-slate text-[11px]">
          OpenStreetMap & Tamil Nadu Health Systems Directory • DBMS Prototype
        </div>

      </div>
    </footer>
  );
}
