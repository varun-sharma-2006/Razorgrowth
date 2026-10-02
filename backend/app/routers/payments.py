from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.models import Customer, Payment
from app.schemas import CustomerSchema, PaymentSchema

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("", response_model=List[PaymentSchema])
async def list_payments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Payment).where(Payment.merchant_id == settings.MERCHANT_ID).order_by(Payment.created_at.desc())
    )
    return result.scalars().all()


@router.get("/customers", response_model=List[CustomerSchema])
async def list_customers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer).where(Customer.merchant_id == settings.MERCHANT_ID).order_by(Customer.created_at.desc())
    )
    return result.scalars().all()
