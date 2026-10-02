import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, Play, Lock, Clock, Copy, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { SimulationResult } from '../types';
import { formatINR } from '../utils/format';

interface FailureSimulationPanelProps {
  onRunningChange: (running: boolean) => void;
  onSimulationComplete: () => void;
  onError: (err: unknown) => void;
}

type DemoId = 'policy' | 'timeout' | 'lost';

interface DemoDef {
  id: DemoId;
  label: string;
  badge: string;
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  run: () => Promise<SimulationResult>;
  button: string;
  running: string;
  expected: SimulationResult['status'];
}

const DEMOS: DemoDef[] = [
  {
    id: 'policy',
    label: 'Demo Scenario 1',
    badge: 'Safety Engine Test',
    title: 'Safety Policy Limit Block',
    description: <>The AI proposes a budget of <span className="text-rose-300 font-bold">3× the merchant's current cap</span>. The Policy Engine blocks it before human approval or any Razorpay call.</>,
    icon: <Lock className="w-3.5 h-3.5" />,
    run: api.simulatePolicyBlock,
    button: 'Run Demo 1: Policy Limit Block',
    running: 'Evaluating Policy Engine...',
    expected: 'POLICY_BLOCKED'
  },
  {
    id: 'timeout',
    label: 'Demo Scenario 2',
    badge: 'Retry & Safe Halt',
    title: 'Razorpay API Timeout & Safe Halt',
    description: <>Every gateway call times out. The real executor retries with backoff, reusing the same <span className="font-mono text-cyan-300">reference_id</span>, then engages <span className="text-amber-300 font-bold">SAFE HALT</span>.</>,
    icon: <Clock className="w-3.5 h-3.5" />,
    run: api.simulateApiTimeout,
    button: 'Run Demo 2: Timeout & Safe Halt',
    running: 'Retrying with backoff...',
    expected: 'HALTED'
  },
  {
    id: 'lost',
    label: 'Demo Scenario 3',
    badge: 'Idempotency Guard',
    title: 'Lost Response Deduplication',
    description: <>The first request <span className="text-white font-bold">does</span> create the link, but its response is lost. The retry is recognised by <span className="font-mono text-cyan-300">reference_id</span> and adopts the existing link: no duplicate.</>,
    icon: <Copy className="w-3.5 h-3.5" />,
    run: api.simulateLostResponse,
    button: 'Run Demo 3: Lost Response',
    running: 'Retrying after lost response...',
    expected: 'COMPLETED'
  }
];

export const FailureSimulationPanel: React.FC<FailureSimulationPanelProps> = ({
  onRunningChange,
  onSimulationComplete,
  onError
}) => {
  const [running, setRunning] = useState<DemoId | null>(null);
  const [results, setResults] = useState<Partial<Record<DemoId, SimulationResult>>>({});

  const runDemo = async (demo: DemoDef) => {
    setRunning(demo.id);
    onRunningChange(true);
    setResults(prev => ({ ...prev, [demo.id]: undefined }));
    try {
      const res = await demo.run();
      setResults(prev => ({ ...prev, [demo.id]: res }));
      onSimulationComplete();
    } catch (err) {
      onError(err);
    } finally {
      setRunning(null);
      onRunningChange(false);
    }
  };

  return (
    <div className="glass-card rounded-[24px] p-6">

      <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm mb-1">
        <ShieldAlert className="w-5 h-5" />
        <span>Judges' Demonstration Room — Failure & Safety Scenarios</span>
      </div>
      <p className="text-xs text-slate-400 mb-6">
        Each scenario runs the production policy engine and payment-link executor with injected faults. Simulations never call real Razorpay and never touch real failed payments.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {DEMOS.map(demo => {
          const result = results[demo.id];
          const asExpected = result?.status === demo.expected;
          const policy = result?.policy_result;
          return (
            <div key={demo.id} className="bg-slate-950/80 rounded-xl p-5 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center space-x-1">
                    {demo.icon}
                    <span>{demo.label}</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                    {demo.badge}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mb-1">{demo.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{demo.description}</p>

                {result && (
                  <div className={`mb-4 p-3 rounded-lg border text-xs space-y-1 animate-in fade-in duration-200 ${
                    asExpected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'
                  }`}>
                    <div className={`font-bold flex items-center space-x-1 ${asExpected ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {asExpected ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      <span>Result: {result.status.replace(/_/g, ' ')}</span>
                    </div>
                    {policy && (
                      <div className="text-slate-300">
                        Proposed <span className="text-rose-300 font-bold">{formatINR(policy.proposed_budget)}</span> vs cap{' '}
                        <span className="text-cyan-300 font-bold">{formatINR(policy.max_allowed_budget)}</span>
                      </div>
                    )}
                    {demo.id !== 'policy' && (
                      <div className="text-slate-300 font-mono text-[11px]">
                        Attempts: {result.attempts} · Links at gateway: {result.links_at_gateway}
                      </div>
                    )}
                    <div className="text-slate-400 font-mono text-[11px] break-all">Action: {result.action.id}</div>
                    <div className="text-slate-300 text-[11px]">{result.message}</div>
                  </div>
                )}
              </div>

              <button
                onClick={() => runDemo(demo)}
                disabled={running !== null}
                className="btn-ghost w-full px-4 py-2.5 text-xs"
              >
                <Play className="w-3.5 h-3.5 fill-amber-300" />
                <span>{running === demo.id ? demo.running : demo.button}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
