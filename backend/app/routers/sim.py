import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import LeaderboardEntry, Merchant, TickStat
from app.money import to_rupees, utc_now
from app.ratelimit import client_ip, sandbox_creation_limiter
from app.sandbox import current_merchant
from app.schemas import (
    AdvanceRequestSchema, AdvanceResponseSchema, LeaderboardEntrySchema, LeaderboardSchema, LeaderboardSubmitSchema,
    SandboxCreatedSchema, SandboxCreateSchema, ScenarioEventSchema, ScenarioSchema, ScoreSchema, SimSettingsSchema,
    SimStateSchema, TickStatSchema,
)
from app.services.audit_service import AuditService
from app.services.sandbox_service import cleanup_stale_sandboxes, create_sandbox, current_season
from app.sim.engine import SimulationConflict, advance
from app.sim.scenarios import SCENARIOS, Scenario, get_scenario
from app.sim.state import snapshot
from app.simclock import sim_label

public_router = APIRouter(tags=["Simulator"])
router = APIRouter(prefix="/sim", tags=["Simulator"])

LEADERBOARD_SIZE = 20


def scenario_schema(s: Scenario) -> ScenarioSchema:
    return ScenarioSchema(key=s.key, name=s.name, difficulty=s.difficulty, description=s.description,
                          ranked=s.ranked, default_cap=s.default_cap_rupees)


async def build_state(db: AsyncSession, merchant: Merchant) -> SimStateSchema:
    snap = await snapshot(db, merchant)
    score = snap["score"]
    counts = snap["counts"]
    return SimStateSchema(
        merchant_id=merchant.id,
        nickname=merchant.nickname,
        scenario=scenario_schema(get_scenario(merchant.scenario)),
        season=merchant.season,
        current_tick=merchant.current_tick,
        run_ticks=merchant.run_ticks,
        clock=sim_label(merchant.current_tick),
        status=merchant.status,
        auto_propose=merchant.auto_propose,
        wallet_start=to_rupees(merchant.wallet_start_paise),
        wallet_available=to_rupees(snap["wallet_available_paise"]),
        policy_cap=to_rupees(snap["policy_cap_paise"]),
        score=ScoreSchema(
            lift=to_rupees(score.lift_paise),
            link_recovered=to_rupees(score.link_recovered_paise),
            organic_recovered=to_rupees(score.organic_recovered_paise),
            baseline_recovered=to_rupees(score.baseline_recovered_paise),
            lost=to_rupees(score.lost_paise),
            captured=to_rupees(score.captured_paise),
            failed=to_rupees(score.failed_paise),
            incentive_spent=to_rupees(score.incentive_spent_paise),
            roi=round(score.lift_paise / score.incentive_spent_paise, 2) if score.incentive_spent_paise else None,
        ),
        approvals=counts["approvals"],
        rejections=counts["rejections"],
        blocked=counts["blocked"],
        open_failed_count=snap["open_failed_count"],
        open_failed_amount=to_rupees(snap["open_failed_paise"]),
        links_in_flight=snap["links_in_flight"],
        pending_action_id=snap["pending_action_id"],
        leaderboard_entry_id=merchant.leaderboard_entry_id,
    )


# ------------------------------------------------------------------ public

@public_router.get("/scenarios", response_model=List[ScenarioSchema])
async def list_scenarios():
    return [scenario_schema(s) for s in SCENARIOS.values()]


@public_router.post("/sandboxes", response_model=SandboxCreatedSchema, status_code=201)
async def start_sandbox(body: SandboxCreateSchema, request: Request, db: AsyncSession = Depends(get_db)):
    scenario = get_scenario(body.scenario)
    if scenario is None:
        raise HTTPException(status_code=422, detail=f"Unknown scenario '{body.scenario}'")
    sandbox_creation_limiter.check(client_ip(request))
    await cleanup_stale_sandboxes(db)
    nickname = body.nickname.strip() if body.nickname and body.nickname.strip() else None
    merchant, token = await create_sandbox(db, scenario, nickname)
    return SandboxCreatedSchema(token=token, state=await build_state(db, merchant))


@public_router.get("/leaderboard", response_model=LeaderboardSchema)
async def get_leaderboard(
    scenario: str = Query(default="steady"),
    season: Optional[str] = None,
    entry_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    season = season or current_season()
    order = (LeaderboardEntry.score_paise.desc(), LeaderboardEntry.created_at.asc())
    rows = (await db.execute(
        select(LeaderboardEntry)
        .where(LeaderboardEntry.scenario == scenario, LeaderboardEntry.season == season)
        .order_by(*order).limit(LEADERBOARD_SIZE)
    )).scalars().all()
    entries = []
    for rank, row in enumerate(rows, start=1):
        e = LeaderboardEntrySchema.model_validate(row)
        e.rank = rank
        entries.append(e)

    you = None
    if entry_id:
        mine = await db.get(LeaderboardEntry, entry_id)
        if mine is not None and mine.scenario == scenario and mine.season == season:
            better = (await db.execute(
                select(func.count(LeaderboardEntry.id)).where(
                    LeaderboardEntry.scenario == scenario, LeaderboardEntry.season == season,
                    (LeaderboardEntry.score_paise > mine.score_paise)
                    | ((LeaderboardEntry.score_paise == mine.score_paise)
                       & (LeaderboardEntry.created_at < mine.created_at)),
                )
            )).scalar_one()
            you = LeaderboardEntrySchema.model_validate(mine)
            you.rank = better + 1
    return LeaderboardSchema(scenario=scenario, season=season, entries=entries, you=you)


# ------------------------------------------------------------------ per sandbox

@router.get("/state", response_model=SimStateSchema)
async def get_state(merchant: Merchant = Depends(current_merchant), db: AsyncSession = Depends(get_db)):
    return await build_state(db, merchant)


@router.post("/advance", response_model=AdvanceResponseSchema)
async def advance_simulation(
    body: AdvanceRequestSchema,
    merchant: Merchant = Depends(current_merchant),
    db: AsyncSession = Depends(get_db),
):
    merchant.last_active_at = utc_now()
    try:
        result = await advance(db, merchant, body.ticks)
    except SimulationConflict:
        raise HTTPException(status_code=409, detail="The simulation was advanced from another tab. Refreshing.")
    if result.to_tick == result.from_tick:
        await db.commit()  # persist last_active_at for finished runs too
    return AdvanceResponseSchema(
        state=await build_state(db, merchant),
        stats=[TickStatSchema.model_validate(s) for s in result.stats],
        events=[ScenarioEventSchema(tick=e.tick, level=e.level, message=e.message) for e in result.events],
        new_proposal_id=result.new_proposal_id,
    )


@router.get("/series", response_model=List[TickStatSchema])
async def get_series(
    since: int = Query(default=0, ge=0),
    merchant: Merchant = Depends(current_merchant),
    db: AsyncSession = Depends(get_db),
):
    return (await db.execute(
        select(TickStat).where(TickStat.merchant_id == merchant.id, TickStat.tick >= since).order_by(TickStat.tick)
    )).scalars().all()


@router.get("/events", response_model=List[ScenarioEventSchema])
async def get_events(merchant: Merchant = Depends(current_merchant)):
    """Scenario news for hours already simulated (never future events)."""
    scenario = get_scenario(merchant.scenario)
    return [ScenarioEventSchema(tick=e.tick, level=e.level, message=e.message)
            for e in scenario.events_between(0, merchant.current_tick)]


@router.put("/settings", response_model=SimStateSchema)
async def update_settings(
    body: SimSettingsSchema,
    merchant: Merchant = Depends(current_merchant),
    db: AsyncSession = Depends(get_db),
):
    if body.auto_propose is not None and body.auto_propose != merchant.auto_propose:
        merchant.auto_propose = body.auto_propose
        AuditService.log_event(
            db=db,
            merchant_id=merchant.id,
            step="POLICY_UPDATE",
            status="SUCCESS",
            component="MerchantAdmin",
            message=(f"AI auto-pilot {'enabled' if body.auto_propose else 'disabled'}: the agent "
                     f"{'will propose campaigns every 12 hours (approval still required)' if body.auto_propose else 'only proposes when asked'}."),
            sanitized_payload={"auto_propose": body.auto_propose},
        )
    await db.commit()
    return await build_state(db, merchant)


@router.post("/leaderboard", response_model=LeaderboardEntrySchema, status_code=201)
async def submit_score(
    body: LeaderboardSubmitSchema,
    merchant: Merchant = Depends(current_merchant),
    db: AsyncSession = Depends(get_db),
):
    scenario = get_scenario(merchant.scenario)
    if not scenario.ranked:
        raise HTTPException(status_code=409, detail="The Classic demo is not ranked. Pick a live scenario to compete.")
    if merchant.status != "FINISHED":
        raise HTTPException(status_code=409, detail="Finish the simulated week before submitting a score.")
    if merchant.leaderboard_entry_id:
        raise HTTPException(status_code=409, detail="This run has already been submitted.")

    snap = await snapshot(db, merchant)
    score, counts = snap["score"], snap["counts"]
    entry = LeaderboardEntry(
        id=f"lb_{uuid.uuid4().hex[:12]}",
        merchant_id=merchant.id,
        nickname=body.nickname.strip(),
        scenario=merchant.scenario,
        season=merchant.season,
        score_paise=score.lift_paise,
        recovered_paise=score.link_recovered_paise,
        incentive_paise=score.incentive_spent_paise,
        approvals=counts["approvals"],
        rejections=counts["rejections"],
        blocked=counts["blocked"],
    )
    db.add(entry)
    merchant.leaderboard_entry_id = entry.id
    merchant.nickname = entry.nickname
    await db.commit()
    return LeaderboardEntrySchema.model_validate(entry)
