# RazorGrowth ⚡

> **A permissioned AI merchant-growth agent, playable as a simulator. Built for the Razorpay AI Buildathon 2026.**  
> *Run a store for a simulated week. Payments fail. Your AI agent proposes Razorpay recovery campaigns, but it can't spend a rupee without your approval, and a deterministic policy engine blocks anything unsafe. Win back as much lost revenue as you can.*

🎮 **Play**: [razorgrowth.vercel.app](https://razorgrowth.vercel.app) | 🔗 **Repo**: [github.com/varun-sharma-2006/Razorgrowth](https://github.com/varun-sharma-2006/Razorgrowth) | 📜 **License**: [MIT](LICENSE)  
👥 **Team**: [Varun Sharma](https://github.com/varun-sharma-2006) and [Yashika Garg](https://github.com/yashikagarg16).

---

## 🎬 What it is

![RazorGrowth Demo](./docs/demo.svg)

Players **sign in with Google**: no passwords, no keys. Each account gets a private store, and the run follows you to any device.

| | |
|---|---|
| ⏯️ **Play / pause / 1× 2× 5× 10×** | One simulated week in hourly ticks: about 3 minutes at 1×. Space toggles play. |
| 💰 **Starting balance** | A ₹20,000 incentive wallet. Discounts are reserved when a link is sent and only *spent* when a customer pays. |
| 🤖 **AI agent** | Proposes recovery campaigns on demand or every 12 hours on auto-pilot. You approve, reject, or **approve with changes** (resize the incentive, skip failure types). |
| 🛡️ **Policy engine** | Checks every proposal against your safety cap (a slider) and remaining wallet, at proposal time and again at approval. |
| 📈 **Live charts** | Recovered revenue *with the agent vs without it*, and failures every 6 hours by payment method, with scenario events marked. |
| 🏆 **Weekly leaderboard** | Everyone playing a scenario in the same ISO week faces the **same customers and failures**, so scores are directly comparable. |
| 🧪 **Safety lab** | Policy block, API timeout → safe halt, and lost response → deduplication, all run through the production executor with injected faults. |

### Scenarios

| Scenario | Difficulty | What happens |
|---|---|---|
| Steady Week | Easy | A normal week; learn the rhythm of failures and recovery. |
| Festive Sale | Medium | Days 3–5: traffic ×2.6, bigger baskets, banks under load. |
| UPI Outage | Hard | Day 3, 10:00–18:00: UPI failures spike ×7 (mostly timeouts). |
| Card Expiry Wave | Hard | An issuer reissued cards: expired-card declines all week, and they rarely convert. |
| Classic Demo | Practice | The original fixed demo: 9 failed payments worth ₹7,850. Not ranked. |

---

## 🧮 How scoring works

Your score is **incremental revenue: what came back beyond what would have come back with no agent at all.**

```
score = (paid through recovery links + customers who retried on their own) − (what would have come back with no agent)
```

Every failed payment has a pre-rolled, hidden fate, deterministic per scenario and week:

- **Some customers would retry on their own** (35% of network timeouts, 10% of expired cards, more for loyal customers). A passive player scores exactly **₹0**.
- **Customers pay a recovery link** with a probability that rises with the discount (√ of the discount share) and loyalty, and **decays as the failure gets older** (half-life ≈ 1 day). Scanning promptly pays.
- **Cannibalisation:** a customer who would have retried anyway uses your discounted link instead, so the discount is wasted. Over-generous campaigns score worse.
- Links expire after 48h (releasing their reserved incentive); unrecovered failures are lost after 72h.

Future outcomes are never sent to the browser, so players can't cheat by reading the API.

We tuned the model by simulating strategies. On Steady Week, *no discount* < *half the AI's budget* < *the AI's default* < *scanning every 4 hours*, and doubling the budget mostly runs into the cap and wallet limits.

---

## 📌 Core architectural principles

1. **Controlled autonomy.** The LLM proposes; deterministic code enforces limits and executes. LLM output must pass a strict schema (`AIRecommendation`) or it is discarded for a data-derived heuristic. The agent is *told* the cap and wallet but never *trusted* with them.
2. **Deterministic policy engine.** It checks action type, a positive budget, the safety cap, the remaining wallet, the human-approval guard and the idempotency key, and produces a "Why was this allowed?" checklist. The cap slider is bounded and every change is audited.
3. **Idempotent execution.** Approval is an atomic state transition, so concurrent approvals execute once. Each link gets a deterministic Razorpay `reference_id`. Timeouts, 429s and 5xx responses are retried with backoff; 4xx errors are not. Exhausted retries trigger a **safe halt**, and re-running is safe.
4. **One code path.** Simulated customer payments settle links through the same function as real signed `payment_link.paid` webhooks.
5. **Transparent audit trail.** Every step (`DATA_ANALYSIS → PATTERN_DETECTION → POLICY_EVALUATION → MERCHANT_APPROVAL → RAZORPAY_API_CALL / RETRY_ATTEMPT / SAFE_HALT → WEBHOOK_RECEIVED`) is stamped with the simulated hour. Emails are masked and secrets redacted.

---

## 🏗️ Architecture

![RazorGrowth Architecture](./docs/architecture.svg)

```
 React + TypeScript simulator ── Google sign-in, session cookie ──► FastAPI (FastAPI Cloud)
   live SVG charts, game loop                          │
                                                       ├─ Simulation engine   (orders, failures, customer behaviour per tick)
                                                       ├─ AI service          (Gemini / OpenAI / heuristic, schema-validated)
                                                       ├─ Policy engine       (cap, wallet, approval guard)
                                                       ├─ Recovery executor   (Razorpay Payment Links, retries, safe halt)
                                                       ├─ Link outcomes       (simulated customers + signed webhooks)
                                                       └─ Audit service
                                                       ▼
                                          SQLite / PostgreSQL (Alembic migrations)
```

---

## 🛠️ Tech stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, hand-built accessible SVG charts (crosshair tooltips, keyboard navigation, table view; colour-blind-validated palette).
- **Backend**: Python 3.13, FastAPI, Pydantic v2, async SQLAlchemy 2, Alembic. Money is stored as integer paise.
- **AI**: Gemini 2.5 Flash or OpenAI GPT-4o-mini (JSON mode), or a zero-config heuristic.
- **Payments**: Razorpay Payment Links with `reference_id` deduplication, HMAC-SHA256 webhooks. The simulator uses a local gateway that mimics Razorpay's uniqueness rule.

---

## 🚀 Run it locally

Prerequisites: Python 3.13 and Node.js 18+.

```bash
# Terminal 1: backend
cd backend
python -m venv venv
venv\Scripts\activate          # macOS/Linux: source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: frontend
cd frontend
npm install
npm run dev                    # http://localhost:5173 (API proxied to :8000)
```

Interactive API docs: `http://localhost:8000/docs`.

Locally, the example `.env` turns on `ENABLE_DEV_LOGIN`, so the sign-in page shows a **Continue as developer** button and you don't need Google.

### Setting up Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type **Web application**.
2. Under **Authorized JavaScript origins**, add every address the site is served from, e.g. `http://localhost:5173` and `https://razorgrowth.vercel.app`. No redirect URIs are needed (the popup flow is used).
3. Put the client ID in `GOOGLE_CLIENT_ID` on the backend. The frontend reads it from `/api/v1/auth/config`, so nothing needs rebuilding.

---

## 🔌 API overview

| Public | |
|---|---|
| `GET /api/v1/scenarios` | Scenario catalogue |
| `GET /api/v1/auth/config` · `POST /api/v1/auth/google {credential}` · `POST /api/v1/auth/logout` · `GET /api/v1/auth/me` | Sign in with Google (sets an httpOnly session cookie), sign out, current user |
| `GET /api/v1/leaderboard?scenario=&entry_id=` | Weekly top 20 + your rank |
| `POST /api/v1/webhooks/razorpay` | Signed Razorpay webhooks |

| Signed in (session cookie) | |
|---|---|
| `POST /sandboxes {scenario, nickname?}` | Start a run (replaces your previous run; rate-limited per user) |
| `GET /sim/state` · `POST /sim/advance {ticks≤24}` · `GET /sim/series` · `GET /sim/events` | Clock, score and charts |
| `PUT /sim/settings {auto_propose}` · `POST /sim/leaderboard {nickname}` | Auto-pilot, submit score |
| `POST /opportunities/scan` · `POST /actions/{id}/decision` | Ask the agent; approve (optionally with `budget_override`, `exclude_reasons`) or reject |
| `PUT /merchant/policy` · `GET /payments` · `GET /audit` · `POST /simulation/*` | Cap, telemetry, audit trail, safety lab |

Admins are Google accounts listed in `ADMIN_EMAILS` (no admin key): `GET /admin/stats`, `DELETE /admin/leaderboard/{id}`, `POST /admin/cleanup`. Runs untouched for 30 days are cleaned up; leaderboard entries are kept.

---

## 🧪 Tests

```bash
cd backend
python -m pytest -q
```

69 tests, each on a fresh migrated database:

- **Simulator** (`test_sim.py`): identical streams for the same scenario and week, scenario events on time (the UPI spike), wallet reservation and settlement, simulated customers paying or expiring, approve-with-changes, the wallet limit, auto-pilot never executing on its own, a full run to the leaderboard (a passive run scores exactly 0), unranked practice mode, nickname validation, and future outcomes never exposed.
- **Security** (`test_security.py`): Google sign-in (verified, rejected and unverified tokens), httpOnly session cookie, logout invalidating the session, sign-in required everywhere, users isolated from each other, runs following the account across devices, per-user rate limiting, admin by email, dev login off by default, webhook signatures, redelivery dedup.
- **Flows** (`test_backend.py`): evidence matches the data, re-scan reuse, one link per payment, rejection, invalid decisions, double and **concurrent** approval, bounded and audited policy, the secondary policy check, audit sanitisation.
- **Execution / AI** (`test_execution.py`, `test_ai.py`): real retries → safe halt, lost-response dedup, permanent errors not retried, incentive allocation; LLM output validation and fallback.

CI runs the backend tests and the frontend build on every push.

---

## 🌐 Deployment

- **Frontend**: Vercel (root `frontend`). `frontend/vercel.json` rewrites `/api/*` to the backend.
- **Backend**: [FastAPI Cloud](https://fastapicloud.com) (no credit card needed): `cd backend && fastapi deploy`. Environment: `GOOGLE_CLIENT_ID`, `DATABASE_URL`, `RAZORPAY_WEBHOOK_SECRET`, optional `ADMIN_EMAILS`, AI keys and Razorpay test keys. Never set `ENABLE_DEV_LOGIN` in production. Migrations run on startup.

---

## 📂 Project structure

```
backend/app/
  main.py, config.py, database.py, models.py, schemas.py, money.py, simclock.py
  sandbox.py, security.py     # signed-in user → their current run; admin by email
  ratelimit.py                # per-user run creation limiter
  sim/        scenarios.py · behavior.py (customer model) · engine.py (ticks) · state.py (score)
  services/   ai_service · policy_engine · proposal_service · recovery_service ·
              razorpay_service · link_outcomes · sandbox_service · audit_service
  routers/    sim · merchant · payments · opportunities · actions · webhooks · simulation · audit · admin
backend/migrations/           # Alembic (0001 initial, 0002 simulator)
backend/tests/                # 69 tests
frontend/src/
  App.tsx                     # game loop, views, keyboard shortcuts
  components/ Landing · SimTopBar · KpiStrip · AgentPanel · ApprovalModal · CampaignsTab ·
              EndOfRunModal · LeaderboardTable · Tour · FailedPaymentsList · AuditTimeline ·
              FailureSimulationPanel · OpportunityCard · charts/{RecoveryRaceChart, FailuresChart}
```

---

## 📜 License

[MIT](LICENSE). Built by **[Varun Sharma](https://github.com/varun-sharma-2006)** and **[Yashika Garg](https://github.com/yashikagarg16)** for the **Razorpay AI Buildathon 2026**.
