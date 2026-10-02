from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Customer, Merchant, Payment
from app.sandbox import current_merchant
from app.schemas import CustomerSchema, PaymentSchema

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("", response_model=List[PaymentSchema])
async def list_payments(
    limit: int = Query(default=300, ge=1, le=1000),
    merchant: Merchant = Depends(current_merchant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment).where(Payment.merchant_id == merchant.id)
        .order_by(Payment.created_at.desc(), Payment.id.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/customers", response_model=List[CustomerSchema])
async def list_customers(merchant: Merchant = Depends(current_merchant), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer).where(Customer.merchant_id == merchant.id).order_by(Customer.id)
    )
    return result.scalars().all()
