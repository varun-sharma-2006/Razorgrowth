from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Merchant, Opportunity
from app.sandbox import current_merchant
from app.schemas import ActionSchema, OpportunitySchema, ScanResponse
from app.services.proposal_service import NothingToRecover, propose_recovery

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


@router.get("", response_model=List[OpportunitySchema])
async def list_opportunities(merchant: Merchant = Depends(current_merchant), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Opportunity)
        .where(Opportunity.merchant_id == merchant.id, Opportunity.status != "SIMULATION")
        .order_by(Opportunity.created_at.desc())
    )
    return result.scalars().all()


@router.post("/scan", response_model=ScanResponse)
async def scan_opportunities(merchant: Merchant = Depends(current_merchant), db: AsyncSession = Depends(get_db)):
    try:
        result = await propose_recovery(db, merchant)
    except NothingToRecover as e:
        raise HTTPException(status_code=409, detail=str(e))
    await db.commit()
    return ScanResponse(
        opportunity=OpportunitySchema.model_validate(result.opportunity),
        action=ActionSchema.model_validate(result.action),
        policy_check=result.policy_check,
        reused_existing=result.reused_existing,
    )
