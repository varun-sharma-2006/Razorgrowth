import React, { useState } from 'react';
import { History, CheckCircle, ShieldAlert, Cpu, ShieldCheck, UserCheck, Zap, RefreshCw, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { AuditEventItem } from '../types';

interface AuditTimelineProps {
  events: AuditEventItem[];
  onRefresh: () => void;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events, onRefresh }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStepIcon = (component: string, status: string) => {
    if (status === 'BLOCKED' || status === 'FAILED' || status === 'HALTED') {
      return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    }
    switch (component) {
      case 'AIService':
        return <Cpu className="w-4 h-4 text-indigo-400" />;
      case 'PolicyEngine':
        return <ShieldCheck className="w-4 h-4 text-cyan-400" />;
      case 'MerchantAdmin':
        return <UserCheck className="w-4 h-4 text-emerald-400" />;
      case 'RazorpayService':
        return <Zap className="w-4 h-4 text-purple-400" />;
      case 'WebhookHandler':
        return <Terminal className="w-4 h-4 text-amber-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SUCCESS</span>;
      case 'BLOCKED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">POLICY BLOCKED</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">FAILED</span>;
      case 'HALTED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">SAFE HALT</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">PENDING</span>;
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-slate-800 bg-slate-900/60">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-indigo-400" />
            <span>Visual Audit Trail & Action Timeline</span>
          </h2>
          <p className="text-xs text-slate-400">
            End-to-end evidence log detailing AI analysis, deterministic policy evaluation, merchant decisions, and Razorpay API calls.
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Timeline List */}
      {events.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-xs">
          No audit events recorded yet. Perform an AI scan or action decision above.
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {events.map((evt) => {
            const isExpanded = expandedId === evt.id;
            const hasPayload = evt.sanitized_payload && Object.keys(evt.sanitized_payload).length > 0;

            return (
              <div key={evt.id} className="relative group">
                
                {/* Timeline Node Point */}
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center">
                  {getStepIcon(evt.component, evt.status)}
                </div>

                {/* Event Card */}
                <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-mono font-semibold text-slate-400">{evt.step}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-indigo-400 font-semibold">{evt.component}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(evt.status)}
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 mt-1.5 leading-relaxed font-medium">
                    {evt.message}
                  </p>

                  {/* Sanitized Payload Accordion */}
                  {hasPayload && (
                    <div className="mt-2 pt-2 border-t border-slate-800/60">
                      <button
                        onClick={() => toggleExpand(evt.id)}
                        className="inline-flex items-center space-x-1 text-[11px] text-slate-400 hover:text-indigo-400 font-mono transition"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span>Sanitized Event Payload Metadata</span>
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
                          {JSON.stringify(evt.sanitized_payload, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
