import React from 'react';
import { ShieldAlert, Cpu, Database, Zap, RefreshCw } from 'lucide-react';
import { SystemStatus } from '../types';

interface NavbarProps {
  status: SystemStatus | null;
  onRefresh: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ status, onRefresh, loading }) => {
  const isRazorpayTestMode = status?.razorpay_mode === "RAZORPAY TEST MODE";
  const isHeuristicMode = status?.ai_provider_mode === "Demo Heuristic Mode";

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-[2px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight text-white">RazorGrowth</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                AI Agent
              </span>
            </div>
            <p className="text-xs text-slate-400">Permissioned Merchant Revenue Recovery</p>
          </div>
        </div>

        {/* Integration Status Badges */}
        <div className="hidden md:flex items-center space-x-3 text-xs">
          
          {/* Razorpay Integration Badge */}
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-medium ${
            isRazorpayTestMode
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isRazorpayTestMode ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{status?.razorpay_mode || "RAZORPAY ADAPTER"}</span>
          </div>

          {/* AI Provider Badge */}
          <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border font-medium ${
            isHeuristicMode
              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
              : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
          }`}>
            <Cpu className="w-3.5 h-3.5" />
            <span>AI: {status?.ai_provider_mode || "Detecting..."}</span>
          </div>

          {/* Database Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-medium">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>{status?.database_type || "PostgreSQL / SQLite"}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition border border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
