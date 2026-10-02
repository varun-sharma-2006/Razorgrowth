"""LLM output is validated before it can become a proposal."""
import json
import pytest
from app.config import settings
from app.services.ai_service import AIService


@pytest.fixture
def fake_llm(monkeypatch):
    """Pretends Gemini is configured and returns whatever the test sets."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "fake-key")
    response = {"raw": ""}

    async def _call_llm(prompt):
        assert "Unrecovered failed payments: 9" in prompt
        return "Gemini 2.5 Flash", response["raw"]

    monkeypatch.setattr(AIService, "_call_llm", staticmethod(_call_llm))
    return response


def _valid(**overrides):
    data = {
        "title": "Recover lost checkouts",
        "evidence": ["9 failed payments"],
        "decision_factors": ["Customers are repeat buyers"],
        "recommendation_reason": "Send recovery links",
        "confidence_score": 81.5,
        "proposed_budget": 600,
        "risk_score": "LOW",
    }
    data.update(overrides)
    return json.dumps(data)


def test_valid_llm_output_is_used(client, fake_llm):
    fake_llm["raw"] = "```json\n" + _valid() + "\n```"
    action = client.post("/api/v1/opportunities/scan").json()["action"]
    assert action["ai_provider"] == "Gemini 2.5 Flash"
    assert action["proposed_budget"] == 600.0
    assert action["confidence_score"] == 81.5
    assert action["status"] == "PENDING_APPROVAL"


def test_over_budget_llm_proposal_is_blocked_by_policy(client, fake_llm):
    fake_llm["raw"] = _valid(proposed_budget=5000)
    action = client.post("/api/v1/opportunities/scan").json()["action"]
    assert action["ai_provider"] == "Gemini 2.5 Flash"
    assert action["status"] == "POLICY_BLOCKED"


@pytest.mark.parametrize("raw", [
    "not json at all",
    _valid(proposed_budget=-50),
    _valid(proposed_budget=0),
    _valid(evidence="a single string"),
    _valid(risk_score="NONE"),
    _valid(confidence_score=140),
    json.dumps({"title": "missing everything else"}),
])
def test_invalid_llm_output_falls_back_to_heuristic(client, fake_llm, raw):
    fake_llm["raw"] = raw
    res = client.post("/api/v1/opportunities/scan")
    assert res.status_code == 200
    action = res.json()["action"]
    assert action["ai_provider"] == "Demo Heuristic Mode (fallback from Gemini 2.5 Flash)"
    assert action["proposed_budget"] == 800.0
    failed = [e for e in client.get("/api/v1/audit").json()
              if e["step"] == "PATTERN_DETECTION" and e["status"] == "FAILED"]
    assert failed


def test_llm_exception_falls_back(client, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "fake-key")

    async def boom(prompt):
        raise TimeoutError("provider unavailable")

    monkeypatch.setattr(AIService, "_call_llm", staticmethod(boom))
    action = client.post("/api/v1/opportunities/scan").json()["action"]
    assert action["ai_provider"] == "Demo Heuristic Mode (fallback from OpenAI GPT-4o-mini)"
