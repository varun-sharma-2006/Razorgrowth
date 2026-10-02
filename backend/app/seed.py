import asyncio
import logging
from datetime import timedelta
from app.database import AsyncSessionLocal
from app.models import Merchant, Customer, Payment, PolicyRule, AuditEvent
from app.config import settings
from app.money import to_paise, utc_now

logger = logging.getLogger(__name__)


async def seed_db():
    """Inserts demo data once. The schema itself is created by Alembic migrations."""
    async with AsyncSessionLocal() as db:
        if await db.get(Merchant, settings.MERCHANT_ID):
            logger.info("[Seed] Database already seeded.")
            return

        logger.info("[Seed] Seeding database with demo transaction history...")
        now = utc_now()

        merchant = Merchant(
            id=settings.MERCHANT_ID,
            name="Aura Store",
            email="admin@aurastore.in",
            created_at=now - timedelta(days=30)
        )
        db.add(merchant)

        db.add(PolicyRule(
            id=f"pol_{merchant.id}",
            merchant_id=merchant.id,
            max_single_action_budget_paise=to_paise(settings.DEFAULT_MAX_BUDGET),
            allowed_action_types=settings.ALLOWED_ACTION_TYPES,
            requires_human_approval=True
        ))
        await db.flush()  # foreign keys are enforced: parents must exist before children

        customers_data = [
            ("cust_101", "Rohan Verma", "rohan.v@example.com", 12, 11, 1, "Leather Backpack (₹2,499)"),
            ("cust_102", "Priya Sharma", "priya.s@example.com", 8, 7, 1, "Wireless Earbuds Pro (₹1,299)"),
            ("cust_103", "Ananya Mehta", "ananya.m@example.com", 5, 4, 1, "Smart Fitness Watch (₹3,499)"),
            ("cust_104", "Vikram Patel", "vikram.p@example.com", 15, 14, 1, "Premium Coffee Beans 1kg (₹850)"),
            ("cust_105", "Sneha Gupta", "sneha.g@example.com", 3, 2, 1, "Ergonomic Desk Mat (₹649)"),
            ("cust_106", "Karan Malhotra", "karan.m@example.com", 6, 5, 1, "Mechanical Keyboard (₹4,199)"),
            ("cust_107", "Riya Sen", "riya.s@example.com", 4, 3, 1, "Ceramic Mug Set (₹499)"),
            ("cust_108", "Aditya Nair", "aditya.n@example.com", 9, 8, 1, "USB-C Fast Charger 65W (₹1,199)"),
            ("cust_109", "Neha Kapoor", "neha.k@example.com", 7, 6, 1, "Blue Light Glasses (₹799)"),
            ("cust_110", "Amit Roy", "amit.r@example.com", 20, 20, 0, "Laptop Sleeve (₹999)")
        ]
        for cid, name, email, tot, succ, fail, prod in customers_data:
            db.add(Customer(
                id=cid,
                merchant_id=merchant.id,
                name=name,
                email=email,
                total_orders=tot,
                successful_payments=succ,
                failed_payments=fail,
                last_product_info=prod
            ))
        await db.flush()

        # Captured revenue (₹2,45,000)
        db.add(Payment(
            id="pay_cap_01",
            merchant_id=merchant.id,
            customer_id="cust_110",
            customer_name="Amit Roy",
            customer_email="amit.r@example.com",
            amount_paise=to_paise(245000),
            status="captured",
            payment_method="upi",
            created_at=now - timedelta(hours=48)
        ))

        # 9 failed payments totalling exactly ₹7,850:
        # 850 + 1299 + 2499 + 649 + 499 + 799 + 550 + 400 + 305 = 7850
        failed_data = [
            ("pay_fail_01", "cust_104", "Vikram Patel", "vikram.p@example.com", 850, "bank_decline", "upi"),
            ("pay_fail_02", "cust_102", "Priya Sharma", "priya.s@example.com", 1299, "insufficient_funds", "card"),
            ("pay_fail_03", "cust_101", "Rohan Verma", "rohan.v@example.com", 2499, "card_expired", "card"),
            ("pay_fail_04", "cust_105", "Sneha Gupta", "sneha.g@example.com", 649, "network_timeout", "netbanking"),
            ("pay_fail_05", "cust_107", "Riya Sen", "riya.s@example.com", 499, "bank_decline", "upi"),
            ("pay_fail_06", "cust_109", "Neha Kapoor", "neha.k@example.com", 799, "card_expired", "card"),
            ("pay_fail_07", "cust_103", "Ananya Mehta", "ananya.m@example.com", 550, "insufficient_funds", "upi"),
            ("pay_fail_08", "cust_106", "Karan Malhotra", "karan.m@example.com", 400, "network_timeout", "netbanking"),
            ("pay_fail_09", "cust_108", "Aditya Nair", "aditya.n@example.com", 305, "bank_decline", "upi")
        ]
        for pid, cid, name, email, amt, reason, method in failed_data:
            db.add(Payment(
                id=pid,
                merchant_id=merchant.id,
                customer_id=cid,
                customer_name=name,
                customer_email=email,
                amount_paise=to_paise(amt),
                status="failed",
                failure_reason=reason,
                payment_method=method,
                created_at=now - timedelta(hours=12)
            ))

        db.add(AuditEvent(
            id="evt_init_01",
            merchant_id=merchant.id,
            step="DATA_ANALYSIS",
            status="SUCCESS",
            component="SystemInit",
            message="RazorGrowth system initialized with 10 customer accounts and 9 failed payment records (Total lost: ₹7,850.00).",
            sanitized_payload={"initial_failed_count": 9, "initial_failed_amount": 7850.0},
            timestamp=now - timedelta(minutes=5)
        ))

        await db.commit()
        logger.info("[Seed] Seeded merchant, customers, and failed payments.")


if __name__ == "__main__":
    asyncio.run(seed_db())
