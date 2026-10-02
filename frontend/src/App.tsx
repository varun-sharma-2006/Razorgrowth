import { useCallback, useEffect, useRef, useState } from 'react';
import { Landing } from './components/Landing';
import { ControlDock, Speed } from './components/ControlDock';
import { TopNav, Page } from './components/TopNav';
import { LogoMark } from './components/LogoMark';
import { LeaderboardTable } from './components/LeaderboardTable';
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
import { api, errorMessage, isConflict, isNotFound, isUnauthorized } from './services/api';
import { LoginPage } from './components/LoginPage';
import { googleSignOut } from './components/GoogleSignIn';
import {
  ActionItem, AdvanceResponse, AuditEventItem, AuthConfig, DecisionOptions, PaymentItem, Scenario, ScenarioEvent,
  SimState, TickStat, User
} from './types';
import { Info, XCircle, Megaphone, Rocket } from 'lucide-react';

const TICK_INTERVAL_MS = 1000;

export function App() {
  const [view, setView] = useState<'loading' | 'login' | 'landing' | 'sim'>('loading');
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
  const [page, setPage] = useState<Page>('overview');

  const inFlight = useRef(false);
  const pageRef = useRef(page);
  pageRef.current = page;

  const resetRun = useCallback(() => {
    setPlaying(false);
    setSim(null);
    setSeries([]);
    setEvents([]);
    setActions([]);
    setPayments([]);
    setAudit([]);
    setNotice(null);
    setShowResults(false);
    setReviewAction(null);
  }, []);

  const backToLanding = useCallback(() => {
    resetRun();
    setView('landing');
  }, [resetRun]);

  const toLogin = useCallback((message?: string) => {
    resetRun();
    setUser(null);
    setView('login');
    setAuthError(message ?? null);
  }, [resetRun]);

  const handleError = useCallback((err: unknown) => {
    if (isUnauthorized(err)) {
      toLogin('Your session has ended. Please sign in again.');
      return;
    }
    setError(errorMessage(err));
  }, [toLogin]);

  const refreshLists = useCallback(async (withPayments = pageRef.current === 'payments') => {
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
    const state = await api.getState(); // 404 here means "no run yet"; skip the other requests
    const [ser, evs] = await Promise.all([api.getSeries(), api.getEvents()]);
    setSim(state);
    setSeries(ser);
    setEvents(evs);
    await refreshLists(true);
    return state;
  }, [refreshLists]);

  /** After sign-in: resume the account's current run, or offer a new one. */
  const enterApp = useCallback(async () => {
    try {
      const state = await loadSim();
      setView('sim');
      if (state.status === 'FINISHED') setShowResults(true);
    } catch (err) {
      if (isNotFound(err)) setView('landing');
      else throw err;
    }
  }, [loadSim]);

  // Boot: auth config and scenarios, then the signed-in user's run (if any).
  useEffect(() => {
    api.getScenarios().then(setScenarios).catch(() => undefined);
    api.getAuthConfig().then(setAuthConfig).catch(err => setAuthError(errorMessage(err)));
    api.me()
      .then(async me => {
        setUser(me);
        await enterApp();
      })
      .catch(err => {
        if (!isUnauthorized(err)) setAuthError(errorMessage(err));
        setView('login');
      });
  }, [enterApp]);

  const signIn = async (login: () => Promise<User>) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      setUser(await login());
      await enterApp();
    } catch (err) {
      setAuthError(errorMessage(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* the cookie is cleared server-side or already gone */
    }
    googleSignOut();
    toLogin();
  };

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
    if (page === 'payments' && view === 'sim') api.getPayments().then(setPayments).catch(handleError);
  }, [page, view, handleError]);

  const start = async (scenario: string, nickname: string) => {
    setStarting(true);
    setError(null);
    try {
      await api.startSandbox(scenario, nickname);
      setSeries([]);
      setEvents([]);
      setNotice(null);
      setShowResults(false);
      setPage('overview');
      await loadSim();
      setView('sim');
      if (!tourDone()) setShowTour(true);
    } catch (err) {
      handleError(err);
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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-sm tracking-[0.04em] text-slate-400">
        <LogoMark size={56} breathe />
        Opening RazorGrowth…
      </div>
    );
  }

  if (view === 'login' || !user) {
    return (
      <div className="min-h-screen text-slate-100">
        <LoginPage
          config={authConfig}
          busy={authBusy}
          error={authError}
          onCredential={credential => signIn(() => api.googleLogin(credential))}
          onDevLogin={() => signIn(api.devLogin)}
        />
        <Footer />
      </div>
    );
  }

  if (view === 'landing' || !sim) {
    return (
      <div className="min-h-screen text-slate-100">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-4 space-y-3">{banners}</div>
        <Landing
          user={user}
          onLogout={logout}
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
  const header = PAGE_HEADERS[page];

  return (
    <div className="min-h-screen text-slate-100">
      <TopNav
        user={user}
        state={sim}
        page={page}
        playing={playing}
        campaignCount={actions.length}
        onNavigate={setPage}
        onNewRun={() => { setPlaying(false); setView('landing'); }}
        onLogout={logout}
      />

      <div className="max-w-[1400px] mx-auto min-w-0 px-4 sm:px-6 pt-7 pb-36 space-y-7">
        <header key={page} className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">{header.eyebrow === 'scenario' ? `${sim.scenario.name} · ${sim.season}` : header.eyebrow}</span>
            <h1 className="font-display font-bold text-slate-50 leading-[1.05] text-[clamp(2rem,3.6vw,3rem)] mt-3">
              {header.title.split(' ').slice(0, -1).join(' ')} <span className="text-gradient">{header.title.split(' ').slice(-1)}</span>
            </h1>
            <p className="mt-2 text-slate-400 max-w-[62ch]">{header.lede}</p>
          </div>
        </header>

        {banners}

        {page === 'overview' && (
          <div className="space-y-7 animate-in fade-in duration-300">
            {sim.current_tick === 0 && !playing && (
              <div className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-200">
                <Rocket className="w-4 h-4 shrink-0 text-brand-400" />
                Your store is ready. Press <span className="font-semibold text-brand-200">Play</span> (or Space) to start the week.
              </div>
            )}

            <KpiStrip state={sim} series={series} />

            <div className="grid xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8 min-w-0 space-y-6">
                <section className="glass-card rounded-[24px] p-6">
                  <h2 className="font-display text-xl font-bold text-slate-50">Recovered revenue</h2>
                  <p className="text-sm text-slate-500 mb-4">You vs doing nothing. The gap between the lines is your score.</p>
                  <RecoveryRaceChart series={series} runTicks={sim.run_ticks} />
                </section>
                <section className="glass-card rounded-[24px] p-6">
                  <h2 className="font-display text-xl font-bold text-slate-50">Failed payments</h2>
                  <p className="text-sm text-slate-500 mb-4">Every 6 hours, by payment method. Triangles mark store news.</p>
                  <FailuresChart series={series} runTicks={sim.run_ticks} events={events} />
                </section>
              </div>
              <aside className="xl:col-span-4 min-w-0 space-y-4">
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
                  <input type="checkbox" checked={pauseOnProposal} onChange={e => setPauseOnProposal(e.target.checked)} />
                  Pause when the agent proposes something
                </label>
              </aside>
            </div>
          </div>
        )}

        {page === 'campaigns' && <CampaignsTab actions={actions} onReview={openReview} />}
        {page === 'payments' && <FailedPaymentsList payments={payments} />}
        {page === 'audit' && <AuditTimeline events={audit} onRefresh={() => refreshLists()} live={playing || labRunning} />}
        {page === 'lab' && (
          <FailureSimulationPanel
            onRunningChange={setLabRunning}
            onSimulationComplete={() => refreshLists()}
            onError={handleError}
          />
        )}
        {page === 'leaderboard' && (
          <section className="glass-card rounded-[24px] p-6">
            <LeaderboardTable
              key={sim.leaderboard_entry_id ?? 'none'}
              scenarios={scenarios}
              initialScenario={sim.scenario.key}
              highlightEntryId={sim.leaderboard_entry_id}
            />
          </section>
        )}

        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Megaphone className="w-3.5 h-3.5" />
          Simulated customers and a local payment gateway. The agent, policy engine, executor and audit trail are the production code paths.
        </p>
      </div>

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

      <ControlDock
        state={sim}
        playing={playing}
        speed={speed}
        onTogglePlay={() => setPlaying(p => !p)}
        onSpeed={setSpeed}
        onToggleAutoPilot={toggleAutoPilot}
      />

      {showTour && <Tour onDone={() => setShowTour(false)} />}
    </div>
  );
}

const PAGE_HEADERS: Record<Page, { eyebrow: string; title: string; lede: string }> = {
  overview: {
    eyebrow: 'scenario',
    title: 'Aura Store, live',
    lede: 'Watch payments fail in real time, put your AI agent to work, and win back revenue customers would otherwise take elsewhere.'
  },
  campaigns: {
    eyebrow: 'Agent',
    title: 'Recovery campaigns',
    lede: 'Every proposal your agent made, what you decided, and which customers paid their recovery link.'
  },
  payments: {
    eyebrow: 'Telemetry',
    title: 'Failed payments',
    lede: 'Each failure, when it happened, and whether it was recovered, retried by the customer, or lost.'
  },
  audit: {
    eyebrow: 'Governance',
    title: 'Audit trail',
    lede: 'Every analysis, policy check, decision and gateway call, stamped with the simulated hour.'
  },
  lab: {
    eyebrow: 'Safety',
    title: 'Safety lab',
    lede: 'Inject faults into the production policy engine and executor, and watch the guardrails hold.'
  },
  leaderboard: {
    eyebrow: 'Competition',
    title: 'Leaderboard',
    lede: 'Everyone playing a scenario this week faces the same customers, so scores compare directly.'
  }
};

const Footer = () => (
  <footer className="border-t border-slate-800 py-6 mt-6">
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
      <div><span className="font-display text-sm text-slate-300">RazorGrowth</span> · permissioned AI merchant-growth agent</div>
      <div>
        Built by <span className="text-brand-300">Varun Sharma</span> &amp; <span className="text-brand-300">Yashika Garg</span> for <span className="text-brand-300">Razorpay AI Buildathon 2026</span>
      </div>
    </div>
  </footer>
);

export default App;
