import React, { useState } from 'react';
import { ShieldAlert, RefreshCw, AlertTriangle, CheckCircle2, Play, Lock, Clock } from 'lucide-react';
import { api } from '../services/api';

interface FailureSimulationPanelProps {
  onSimulationComplete: () => void;
}

export const FailureSimulationPanel: React.FC<FailureSimulationPanelProps> = ({ onSimulationComplete }) => {
  const [runningDemo1, setRunningDemo1] = useState(false);
  const [runningDemo2, setRunningDemo2] = useState(false);
  const [demo1Result, setDemo1Result] = useState<any>(null);
  const [demo2Result, setDemo2Result] = useState<any>(null);

  const handleRunDemo1 = async () => {
    setRunningDemo1(true);
    setDemo1Result(null);
    try {
      const res = await api.simulatePolicyBlock();
      setDemo1Result(res);
      onSimulationComplete();
    } catch (e: any) {
      setDemo1Result({ error: e.message });
    } finally {
      setRunningDemo1(false);
    }
  };

  const handleRunDemo2 = async () => {
    setRunningDemo2(true);
    setDemo2Result(null);
    try {
      const res = await api.simulateApiTimeout();
      setDemo2Result(res);
      onSimulationComplete();
    } catch (e: any) {
      setDemo2Result({ error: e.message });
    } finally {
      setRunningDemo2(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-amber-500/20 bg-amber-950/10">
      
      <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm mb-1">
        <ShieldAlert className="w-5 h-5" />
        <span>Judges' Demonstration Room — Failure & Safety Scenarios</span>
      </div>
      <p className="text-xs text-slate-400 mb-6">
        Test RazorGrowth's deterministic safety checks and idempotent fault tolerance under failure conditions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Demo 1 Card */}
        <div className="bg-slate-950/80 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5" />
                <span>Demo Scenario 1</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold border border-rose-500/20">
                Safety Engine Test
              </span>
            </div>

            <h3 className="text-sm font-bold text-white mb-1">Safety Policy Limit Block</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              AI proposes a <span className="text-rose-300 font-bold">₹3,000</span> budget action while the Merchant Limit is strictly set to <span className="text-cyan-300 font-bold">₹1,000</span>. The Policy Engine blocks it immediately before human approval or Razorpay execution.
            </p>

            {demo1Result && (
              <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs space-y-1">
                <div className="font-bold text-rose-300 flex items-center space-x-1">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Result: POLICY BLOCKED</span>
                </div>
                <div className="text-slate-300">
                  Proposed: ₹{demo1Result.proposed_budget} | Limit: ₹{demo1Result.merchant_max_limit}
                </div>
                <div className="text-rose-400 text-[11px]">
                  {demo1Result.message}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRunDemo1}
            disabled={runningDemo1}
            className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-300 font-bold text-xs border border-slate-700 hover:border-rose-500/40 transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-rose-300" />
            <span>{runningDemo1 ? 'Evaluating Policy Engine...' : 'Run Demo 1: Policy Limit Block'}</span>
          </button>
        </div>

        {/* Demo 2 Card */}
        <div className="bg-slate-950/80 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Demo Scenario 2</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                Idempotency Guard
              </span>
            </div>

            <h3 className="text-sm font-bold text-white mb-1">Razorpay API Timeout & Safe Halt</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Simulates HTTP network timeout during Razorpay API call. System executes controlled retries reusing the identical <span className="font-mono text-cyan-300">idempotency_key</span>, detects persistent failure, engages <span className="text-amber-300 font-bold">SAFE HALT</span>, and prevents duplicate financial operations.
            </p>

            {demo2Result && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                <div className="font-bold text-amber-300 flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Result: SAFE HALT ENGAGED</span>
                </div>
                <div className="text-slate-300 font-mono text-[11px]">
                  Idempotency Key: {demo2Result.idempotency_key}
                </div>
                <div className="text-amber-300/90 text-[11px]">
                  {demo2Result.message}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRunDemo2}
            disabled={runningDemo2}
            className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-amber-500/20 text-amber-300 font-bold text-xs border border-slate-700 hover:border-amber-500/40 transition disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-amber-300" />
            <span>{runningDemo2 ? 'Simulating Retry & Safe Halt...' : 'Run Demo 2: API Timeout Retry Safe Halt'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
