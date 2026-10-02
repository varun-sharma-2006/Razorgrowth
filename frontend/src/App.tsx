import { useCallback, useEffect, useRef, useState } from 'react';
import { Landing } from './components/Landing';
import { SimTopBar, Speed } from './components/SimTopBar';
import { KpiStrip } from './components/KpiStrip';
import { AgentPanel } from './components/AgentPanel';
import { RecoveryRaceChart } from './components/charts/RecoveryRaceChart';
import { FailuresChart } from './components/charts/FailuresChart';
import { CampaignsTab } from './components/CampaignsTab';
import { FailedPaymentsList } from './components/FailedPaymentsList';
import { AuditTimeline } from './components/AuditTimeline';
import { FailureSimulationPanel } from './components/FailureSimulationPanel';
import { ApprovalModal } from './components/ApprovalModal';
import { EndOfRunModal } from './components/EndOfRunModal';
import { Tour, tourDone } from './components/Tour';
import { api, errorMessage, isConflict, isUnauthorized, sandboxToken } from './services/api';
import {
  ActionItem, AdvanceResponse, AuditEventItem, DecisionOptions, PaymentItem, Scenario, ScenarioEvent, SimState, TickStat
} from './types';
import { Info, XCircle, Megaphone, Rocket, ListChecks, History, FlaskConical, CreditCard } from 'lucide-react';

type Tab = 'campaigns' | 'payments' | 'audit' | 'lab';
const TICK_INTERVAL_MS = 1000;

export function App() {
  const [view, setView] = useState<'loading' | 'landing' | 'sim'>('loading');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [starting, setStarting] = useState(false);

  const [sim, setSim] = useState<SimState | null>(null);
  const [series, setSeries] = useState<TickStat[]>([]);
  const [events, setEvents] = useState<ScenarioEvent[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [audit, setAudit] = useState<AuditEventItem[]>([]);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [pauseOnProposal, setPauseOnProposal] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [labRunning, setLabRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<ActionItem | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tab, setTab] = useState<Tab>('campaigns');

  const inFlight = useRef(false);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const backToLanding = useCallback((message?: string) => {
    sandboxToken.clear();
    setPlaying(false);
    setSim(null);
    setView('landing');
    if (message) setError(message);
  }, []);

  const handleError = useCallback((err: unknown) => {
    if (isUnauthorized(err)) {
      backToLanding('That simulation no longer exists. Start a new one.');
      return;
    }
    setError(errorMessage(err));
  }, [backToLanding]);

  const refreshLists = useCallback(async (withPayments = tabRef.current === 'payments') => {
    const [acts, aud, pays] = await Promise.all([
      api.getActions(),
      api.getAuditEvents(),
      withPayments ? api.getPayments() : Promise.resolve(null)
    ]);
    setActions(acts);
    setAudit(aud);
    if (pays) setPayments(pays);
  }, []);

  const loadSim = useCallback(async () => {
    const [state, ser, evs] = await Promise.all([api.getState(), api.getSeries(), api.getEvents()]);
    setSim(state);
    setSeries(ser);
    setEvents(evs);
    await refreshLists(true);
    return state;
  }, [refreshLists]);

  // Boot: scenarios for the landing page; resume an existing run if this browser has one.
  useEffect(() => {
    api.getScenarios().then(setScenarios).catch(handleError);
    if (!sandboxToken.get()) {
      setView('landing');
      return;
    }
    loadSim()
      .then(state => {
        setView('sim');
        if (state.status === 'FINISHED') setShowResults(true);
      })
      .catch(err => {
        if (isUnauthorized(err)) sandboxToken.clear();
        else setError(errorMessage(err));
        setView('landing');
      });
  }, [handleError, loadSim]);

  const applyAdvance = useCallback((res: AdvanceResponse) => {
    setSim(res.state);
    if (res.stats.length) {
      const first = res.stats[0].tick;
      setSeries(prev => [...prev.filter(s => s.tick < first), ...res.stats]);
    }
    if (res.events.length) {
      setEvents(prev => {
        const seen = new Set(prev.map(e => `${e.tick}:${e.message}`));
        return [...prev, ...res.events.filter(e => !seen.has(`${e.tick}:${e.message}`))];
      });
    }
    if (res.new_proposal_id) {
      setNotice('Your agent has a new recovery proposal waiting for approval.');
      if (pauseOnProposal) setPlaying(false);
    }
    if (res.state.status === 'FINISHED') {
      setPlaying(false);
      setShowResults(true);
    }
  }, [pauseOnProposal]);

  // The game loop: one request per second, never overlapping.
  useEffect(() => {
    if (!playing || view !== 'sim') return;
    const timer = window.setInterval(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        applyAdvance(await api.advance(speed));
        await refreshLists();
      } catch (err) {
        if (isConflict(err)) {
          await loadSim().catch(handleError); // another tab moved the clock
        } else {
          setPlaying(false);
          handleError(err);
        }
      } finally {
        inFlight.current = false;
      }
    }, TICK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [playing, speed, view, applyAdvance, refreshLists, loadSim, handleError]);

  // Space toggles play/pause (like a trading terminal), unless typing.
  useEffect(() => {
    if (view !== 'sim') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== 'Space' || ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(el.tagName) || reviewAction || showResults) return;
      e.preventDefault();
      setPlaying(p => (sim?.status === 'FINISHED' ? false : !p));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, sim?.status, reviewAction, showResults]);

  useEffect(() => {
    if (tab === 'payments' && view === 'sim') api.getPayments().then(setPayments).catch(handleError);
  }, [tab, view, handleError]);

  const start = async (scenario: string, nickname: string) => {
    setStarting(true);
    setError(null);
    try {
      const res = await api.startSandbox(scenario, nickname);
      sandboxToken.set(res.token);
      setSeries([]);
      setEvents([]);
      setNotice(null);
      setShowResults(false);
      setTab('campaigns');
      await loadSim();
      setView('sim');
      if (!tourDone()) setShowTour(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const openReview = async (action: ActionItem) => {
    setPlaying(false);
    try {
      setPayments(await api.getPayments());
    } catch {
      /* the modal still works without per-reason counts */
    }
    setReviewAction(action);
  };

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await api.scanForOpportunities();
      if (res.reused_existing) setNotice('A proposal is already waiting for your decision.');
      await refreshLists();
      setSim(await api.getState());
      await openReview(res.action);
    } catch (err) {
      handleError(err);
    } finally {
      setScanning(false);
    }
  };

  /** Throws so the approval modal can show the backend's reason. */
  const decide = async (decision: 'APPROVE' | 'REJECT', options?: DecisionOptions) => {
    if (!reviewAction) return;
    try {
      await api.decideAction(reviewAction.id, decision, options);
      setNotice(null);
    } finally {
      await Promise.all([refreshLists(true), api.getState().then(setSim)]).catch(handleError);
    }
  };

  const changeCap = async (cap: number) => {
    try {
      await api.updatePolicyBudget(cap);
      setSim(await api.getState());
      await refreshLists();
    } catch (err) {
      handleError(err);
    }
  };

  const toggleAutoPilot = async () => {
    if (!sim) return;
    try {
      setSim(await api.setAutoPropose(!sim.auto_propose));
      await refreshLists();
    } catch (err) {
      handleError(err);
    }
  };

  const banners = (
    <>
      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <div className="flex items-start gap-2"><XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" /><span>{error}</span></div>
          <button onClick={() => setError(null)} className="text-rose-300 hover:text-white font-semibold">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-100">
          <div className="flex items-start gap-2"><Info className="w-4 h-4 mt-0.5 shrink-0" /><span>{notice}</span></div>
          <button onClick={() => setNotice(null)} className="text-indigo-300 hover:text-white font-semibold">Dismiss</button>
        </div>
      )}
    </>
  );

  if (view === 'loading') {
    return <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-sm text-slate-400">Opening RazorGrowth…</div>;
  }

  if (view === 'landing' || !sim) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 space-y-3">{banners}</div>
        <Landing
          scenarios={scenarios}
          resumable={sim && sim.status === 'RUNNING' ? sim : null}
          starting={starting}
          onStart={start}
          onResume={() => setView('sim')}
        />
        <Footer />
      </div>
    );
  }

  const latestAction = actions[0] ?? null;
  const tabs: { key: Tab; label: string; icon: JSX.Element }[] = [
    { key: 'campaigns', label: `Campaigns (${actions.length})`, icon: <ListChecks className="w-4 h-4" /> },
    { key: 'payments', label: `Failed payments (${sim.open_failed_count} open)`, icon: <CreditCard className="w-4 h-4" /> },
    { key: 'audit', label: 'Audit trail', icon: <History className="w-4 h-4" /> },
    { key: 'lab', label: 'Safety lab', icon: <FlaskConical className="w-4 h-4" /> }
  ];

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      <SimTopBar
        state={sim}
        playing={playing}
        speed={speed}
        onTogglePlay={() => setPlaying(p => !p)}
        onSpeed={setSpeed}
        onToggleAutoPilot={toggleAutoPilot}
        onExit={() => { setPlaying(false); setView('landing'); }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {banners}

        {sim.current_tick === 0 && !playing && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            <Rocket className="w-4 h-4 shrink-0" />
            Your store is ready. Press <span className="font-bold">Play</span> (or Space) to start the week.
          </div>
        )}

        <KpiStrip state={sim} />

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 min-w-0 space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-sm font-bold text-white">Recovered revenue: you vs doing nothing</h2>
              <p className="text-xs text-slate-400 mb-3">The gap between the lines is your score.</p>
              <RecoveryRaceChart series={series} runTicks={sim.run_ticks} />
            </section>
            <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <h2 className="text-sm font-bold text-white">Failed payments every 6 hours</h2>
              <p className="text-xs text-slate-400 mb-3">By payment method. Triangles mark store news.</p>
              <FailuresChart series={series} runTicks={sim.run_ticks} events={events} />
            </section>
          </div>
          <aside className="lg:col-span-4 min-w-0 space-y-4">
            <AgentPanel
              state={sim}
              latestAction={latestAction}
              events={events}
              scanning={scanning}
              onScan={scan}
              onReview={() => latestAction && openReview(latestAction)}
              onCapChange={changeCap}
            />
            <label className="flex items-center gap-2 px-1 text-xs text-slate-400">
              <input type="checkbox" checked={pauseOnProposal} onChange={e => setPauseOnProposal(e.target.checked)} className="accent-indigo-500" />
              Pause when the agent proposes something
            </label>
          </aside>
        </div>

        <section>
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3 mb-4" role="tablist">
            {tabs.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition ${
                  tab === t.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          {tab === 'campaigns' && <CampaignsTab actions={actions} onReview={openReview} />}
          {tab === 'payments' && <FailedPaymentsList payments={payments} />}
          {tab === 'audit' && <AuditTimeline events={audit} onRefresh={() => refreshLists()} live={playing || labRunning} />}
          {tab === 'lab' && (
            <FailureSimulationPanel
              onRunningChange={setLabRunning}
              onSimulationComplete={() => refreshLists()}
              onError={handleError}
            />
          )}
        </section>

        <p className="flex items-center gap-2 text-[11px] text-slate-500">
          <Megaphone className="w-3.5 h-3.5" />
          Simulated customers and a local payment gateway. The agent, policy engine, executor and audit trail are the production code paths.
        </p>
      </main>

      <ApprovalModal
        action={reviewAction ? actions.find(a => a.id === reviewAction.id) ?? reviewAction : null}
        payments={payments}
        isOpen={!!reviewAction}
        onClose={() => setReviewAction(null)}
        onDecide={decide}
      />

      {showResults && sim.status === 'FINISHED' && (
        <EndOfRunModal
          state={sim}
          scenarios={scenarios}
          onClose={() => setShowResults(false)}
          onPlayAgain={() => { setShowResults(false); backToLanding(); }}
          onSubmitted={() => api.getState().then(setSim).catch(handleError)}
        />
      )}

      {showTour && <Tour onDone={() => setShowTour(false)} />}

      <Footer />
    </div>
  );
}

const Footer = () => (
  <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-12">
    <div className="max-w-7xl mx-auto px-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
      <div><span className="font-semibold text-slate-300">RazorGrowth</span>: permissioned AI merchant-growth agent</div>
      <div>
        Built by <span className="text-indigo-400 font-semibold">Varun Sharma</span> & <span className="text-indigo-400 font-semibold">Yashika Garg</span> for <span className="text-indigo-400 font-semibold">Razorpay AI Buildathon 2026</span>
      </div>
    </div>
  </footer>
);

export default App;
