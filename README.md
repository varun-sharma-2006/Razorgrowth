# RazorGrowth ⚡

> **Permissioned AI Merchant-Growth Agent for the Razorpay AI Buildathon**  
> *Recovering lost merchant revenue from failed payments with deterministic policy safety, explicit human-in-the-loop approval, idempotent execution, and visual auditability.*

---

## 📌 Problem Statement & Core Value Proposition

Unmonitored payment failures are one of the largest sources of hidden merchant revenue loss. Traditional payment dashboards leave merchants to manually track drop-offs, diagnose failure patterns, and attempt manual recovery.

**RazorGrowth** solves this problem by giving AI the ability to analyze transaction logs and prepare targeted revenue recovery actions—but **never unrestricted financial authority**.

### Key Architectural Principle
> *"RazorGrowth gives AI the ability to identify and prepare merchant-growth actions, but never unrestricted financial authority."*

- **AI Reasoning Layer**: Identifies revenue recovery opportunities (specifically failed payment drop-offs), evaluates customer intent metrics, and structures proposals with verified evidence, decision factors, and confidence scores.
- **Deterministic Policy Safety Engine**: Enforces strict financial rules (e.g., maximum budget caps, allowed action types) BEFORE human review or API execution.
- **Explicit Merchant Approval**: No financial action executes without explicit merchant authorization.
- **Idempotent Razorpay Execution**: All REST API calls reuse a unique `idempotency_key` (`X-Razorpay-Idempotency-Key`) to guarantee zero duplicate financial transactions during network retries.
- **Complete Visual Audit Trail**: Step-by-step trace of every AI scan, policy check, merchant decision, Razorpay API call, and webhook event.

---

## 🏗️ System Architecture

```
                                  RAZORGROWTH
                                       │
                                       ▼
                           React + TypeScript UI
                                       │
                                  REST / HTTP
                                       │
                                       ▼
                               Python FastAPI Backend
                                       │
             ┌─────────────────────────┼─────────────────────────┐
             │                         │                         │
             ▼                         ▼                         ▼
        AI Service               Policy Engine            Razorpay Service
     (Gemini/OpenAI/          (Deterministic Safety       (REST APIs, Webhooks,
      Heuristic Mode)          Rules & Budget Caps)        Razorpay Test Mode)
             │                         │                         │
             └────────────┬────────────┘                         ▼
                          │                            Razorpay Sandbox / Test
                          ▼
                  Action / Approval
                          │
                          ▼
                    Audit Service
                          │
                          ▼
        PostgreSQL Database (SQLite fallback ready)
```

### Critical Execution Flow

```
Transaction Data & Payment Logs
             │
             ▼
AI Analytics & Pattern Detection (Evidence + Decision Factors + Confidence Score)
             │
             ▼
Policy Engine Validation (Deterministic Budget Cap & Safety Checklist)
             │
             ▼
Human-in-the-Loop Approval (Explicit Merchant Review)
             │
             ▼
Razorpay Test Mode REST API Integration (Idempotency Key Guard)
             │
             ▼
Response Verification & Webhook Event Processing (HMAC SHA256 Signature Checked)
             │
             ▼
Visual Audit Trail Update
```

---

## ✨ Key Features

1. **Failed Payment Revenue Recovery**:
   - Automatically analyzes payment telemetry (bank declines, card expirations, network drop-offs, insufficient funds).
   - Generates targeted recovery payment links for eligible customers.
   - Includes explainable methodology:
     $$\text{Estimated Recoverable} = \text{Failed Loss (\text{₹}7,850.00)} \times 70\% \text{ Conversion Rate} = \text{₹}5,495.00$$

2. **Deterministic Safety Policy Engine**:
   - Rejects invalid proposals regardless of AI output.
   - Displays line-by-line **Policy Evaluation Checklist**:
     - `[✓] Action type allowed (failed_payment_recovery)`
     - `[✓] Proposed Budget ₹850.00 ≤ Merchant Cap ₹1,000.00`
     - `[✓] Human Approval Guard active`
     - `[✓] Action Idempotency Key generated`
     - `STATUS: SAFE TO APPROVE`

3. **Fault-Tolerant Idempotent Execution**:
   - Assigns a unique `idempotency_key` (e.g., `RG-ACT-10291`) to every financial proposal.
   - Retries reuse identical idempotency keys to eliminate duplicate transaction risks.

4. **Judges' Live Failure Control Room**:
   - **Demo 1 — Safety Policy Block**: Proposes ₹3,000 budget against ₹1,000 merchant limit → Policy Engine blocks proposal immediately.
   - **Demo 2 — API Timeout Retry & Safe Halt**: Simulates API gateway timeout → Retries with idempotency key → Engages `SAFE HALT` with zero duplicate charges.

5. **Visual Audit Trail & Timeline**:
   - Step-by-step visual timeline log (`DATA_ANALYSIS` → `PATTERN_DETECTION` → `POLICY_EVALUATION` → `MERCHANT_APPROVAL` → `RAZORPAY_API_CALL` → `WEBHOOK_RECEIVED`).
   - Includes expandable sanitized JSON payloads for full evidence auditability.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Axios.
- **Backend**: Python 3.13, FastAPI, Pydantic V2, SQLAlchemy (Async).
- **Database**: PostgreSQL (Primary) / SQLite (Local Async Development).
- **AI Integration**: Modular `AIService` supporting Gemini 2.5 Flash, OpenAI GPT-4o-mini, or zero-config Demo Heuristic Mode.
- **Payment Integration**: Razorpay REST API (`/v1/payment_links`), HMAC SHA256 Webhook Verification (`X-Razorpay-Signature`), Razorpay Test Mode & Local Demo Adapter.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm

### 1. Backend Setup

```bash
cd backend

# Create virtual environment (optional)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server (auto-seeds database with 9 failed payments totaling ₹7,850)
python -m uvicorn app.main:app --reload --port 8000
```
- Server live at: `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`

### 2. Frontend Setup

Open a second terminal window:

```bash
cd frontend

# Install dependencies
npm.cmd install

# Start Vite dev server
npm.cmd run dev
```
- Open application in browser at: `http://localhost:5173`

---

## 🧪 Running Automated Tests

The backend includes 11 focused unit test functions covering all critical subsystems:

```bash
cd backend
python -m pytest tests/test_backend.py
```

### Verified Test Suite
- `test_health_status_endpoint`: API root & merchant integration status
- `test_merchant_metrics_calculation`: Metric calculations (₹7,850 loss, ₹5,495 recoverable)
- `test_ai_opportunity_generation`: AI analysis & confidence score evaluation
- `test_policy_engine_allowed_budget`: Validates proposed ₹850 <= ₹1,000 passes policy
- `test_policy_engine_blocked_budget`: Validates proposed ₹3,000 > ₹1,000 is blocked by Policy Engine
- `test_merchant_approval_flow`: End-to-end human approval & Razorpay API execution
- `test_merchant_rejection_flow`: Merchant proposal rejection handling
- `test_action_idempotency_key_uniqueness`: Idempotency key uniqueness
- `test_api_timeout_and_retry_safe_halt`: API timeout simulation & safe halt verification
- `test_razorpay_webhook_signature_verification`: Webhook HMAC SHA256 signature verification
- `test_audit_event_sanitized_logging`: Audit log creation & payload sanitization

---

## 📂 Project Directory Structure

```
genraz/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entrypoint
│   │   ├── config.py            # Pydantic settings & environment config
│   │   ├── database.py          # SQLAlchemy async database setup
│   │   ├── models.py            # 7 SQLAlchemy entities
│   │   ├── schemas.py           # Pydantic request/response schemas
│   │   ├── seed.py              # Database seeder (10 customers, 9 failed payments)
│   │   ├── services/
│   │   │   ├── ai_service.py        # LLM Reasoning & Heuristic Fallback
│   │   │   ├── policy_engine.py     # Deterministic Safety Rules & Policy Checklist
│   │   │   ├── razorpay_service.py  # Razorpay REST client & Webhook HMAC Verification
│   │   │   └── audit_service.py     # Sanitized Audit Logger
│   │   └── routers/
│   │       ├── merchant.py          # Metrics & settings endpoints
│   │       ├── payments.py          # Payment & customer telemetry
│   │       ├── opportunities.py     # AI Scan & proposal generation
│   │       ├── actions.py           # Merchant approval state machine
│   │       ├── webhooks.py          # Razorpay webhook listener
│   │       ├── simulation.py        # Demo Control Room endpoints
│   │       └── audit.py             # Audit timeline endpoint
│   ├── tests/
│   │   └── test_backend.py      # 11 unit test suite
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx                # Status badges & header
│   │   │   ├── MetricsOverview.tsx       # KPI cards & methodology explanation
│   │   │   ├── FailedPaymentsList.tsx    # Payment failure telemetry table
│   │   │   ├── OpportunityCard.tsx       # AI recommendation card
│   │   │   ├── ApprovalModal.tsx         # Human approval screen & Policy Checklist
│   │   │   ├── AuditTimeline.tsx         # Visual audit trail & timeline
│   │   │   └── FailureSimulationPanel.tsx# Judges' demo control room
│   │   ├── services/
│   │   │   └── api.ts                    # Axios API client
│   │   ├── types/                        # TypeScript interfaces
│   │   ├── App.tsx                       # Main dashboard view
│   │   └── index.css                     # Tailwind CSS & custom styling
│   ├── package.json
│   └── vite.config.ts
├── README.md
└── .gitignore
```

---

## 📜 License

Built for the **Razorpay AI Buildathon 2026**.
