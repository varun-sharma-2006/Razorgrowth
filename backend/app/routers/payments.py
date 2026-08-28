from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.config import settings
from app.models import Payment, Customer
from app.schemas import PaymentSchema, CustomerSchema

router = APIRouter(prefix="/payments", tags=["Payments"])

@router.get("", response_model=List[PaymentSchema])
async def list_payments(db: AsyncSession = Depends(get_db)):
    merchant_id = settings.MERCHANT_ID
    result = await db.execute(
        select(Payment).where(Payment.merchant_id == merchant_id).order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()
    return [
        PaymentSchema(
            id=p.id,
            customer_id=p.customer_id,
            customer_name=p.customer_name,
            customer_email=p.customer_email,
            amount=p.amount,
            currency=p.currency,
            status=p.status,
            failure_reason=p.failure_reason,
            payment_method=p.payment_method,
            created_at=p.created_at
        )
        for p in payments
    ]

@router.get("/customers", response_model=List[CustomerSchema])
async def list_customers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).order_by(Customer.created_at.desc()))
    customers = result.scalars().all()
    return [
        CustomerSchema(
            id=c.id,
            name=c.name,
            email=c.email,
            total_orders=c.total_orders,
            successful_payments=c.successful_payments,
            failed_payments=c.failed_payments,
            last_product_info=c.last_product_info
        )
        for c in customers
    ]
