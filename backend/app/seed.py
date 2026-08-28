import asyncio
from datetime import datetime, timedelta
from app.database import engine, Base, AsyncSessionLocal
from app.models import Merchant, Customer, Payment, Opportunity, PolicyRule, AuditEvent, Action
from app.config import settings

async def seed_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Check if merchant exists
        existing = await db.get(Merchant, settings.MERCHANT_ID)
        if existing:
            print("[Seed] Database already seeded.")
            return

        print("[Seed] Seeding database with realistic transaction history...")

        # 1. Merchant
        merchant = Merchant(
            id=settings.MERCHANT_ID,
            name="Aura Store",
            email="admin@aurastore.in",
            created_at=datetime.utcnow() - timedelta(days=30)
        )
        db.add(merchant)

        # 2. Policy Rule
        policy = PolicyRule(
            id="pol_01",
            merchant_id=merchant.id,
            max_single_action_budget=1000.0, # ₹1,000 INR
            allowed_action_types="failed_payment_recovery,checkout_recovery",
            requires_human_approval=True
        )
        db.add(policy)

        # 3. Customers
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
            c = Customer(
                id=cid,
                name=name,
                email=email,
                total_orders=tot,
                successful_payments=succ,
                failed_payments=fail,
                last_product_info=prod
            )
            db.add(c)

        # 4. Captured Payments (Total ~₹2,45,000)
        captured_data = [
            ("pay_cap_01", "cust_110", "Amit Roy", "amit.r@example.com", 245000.0, "captured", None, "upi")
        ]
        for pid, cid, name, email, amt, status, reason, method in captured_data:
            p = Payment(
                id=pid,
                merchant_id=merchant.id,
                customer_id=cid,
                customer_name=name,
                customer_email=email,
                amount=amt,
                status=status,
                failure_reason=reason,
                payment_method=method,
                created_at=datetime.utcnow() - timedelta(hours=48)
            )
            db.add(p)

        # 5. The 9 Failed Payments totaling EXACTLY ₹7,850
        # 850 + 1299 + 2499 + 649 + 499 + 799 + 550 + 400 + 306 = 7850
        failed_data = [
            ("pay_fail_01", "cust_104", "Vikram Patel", "vikram.p@example.com", 850.0, "bank_decline", "upi"),
            ("pay_fail_02", "cust_102", "Priya Sharma", "priya.s@example.com", 1299.0, "insufficient_funds", "card"),
            ("pay_fail_03", "cust_101", "Rohan Verma", "rohan.v@example.com", 2499.0, "card_expired", "card"),
            ("pay_fail_04", "cust_105", "Sneha Gupta", "sneha.g@example.com", 649.0, "network_timeout", "netbanking"),
            ("pay_fail_05", "cust_107", "Riya Sen", "riya.s@example.com", 499.0, "bank_decline", "upi"),
            ("pay_fail_06", "cust_109", "Neha Kapoor", "neha.k@example.com", 799.0, "card_expired", "card"),
            ("pay_fail_07", "cust_103", "Ananya Mehta", "ananya.m@example.com", 550.0, "insufficient_funds", "upi"),
            ("pay_fail_08", "cust_106", "Karan Malhotra", "karan.m@example.com", 400.0, "network_timeout", "netbanking"),
            ("pay_fail_09", "cust_108", "Aditya Nair", "aditya.n@example.com", 305.0, "bank_decline", "upi")
        ]

        for pid, cid, name, email, amt, reason, method in failed_data:
            p = Payment(
                id=pid,
                merchant_id=merchant.id,
                customer_id=cid,
                customer_name=name,
                customer_email=email,
                amount=amt,
                status="failed",
                failure_reason=reason,
                payment_method=method,
                created_at=datetime.utcnow() - timedelta(hours=12)
            )
            db.add(p)

        # 6. Initial Audit Event
        evt = AuditEvent(
            id="evt_init_01",
            merchant_id=merchant.id,
            step="DATA_ANALYSIS",
            status="SUCCESS",
            component="SystemInit",
            message="RazorGrowth system initialized with 10 customer accounts and 9 failed payment records (Total lost: ₹7,850.00).",
            sanitized_payload={"initial_failed_count": 9, "initial_failed_amount": 7850.0},
            timestamp=datetime.utcnow() - timedelta(minutes=5)
        )
        db.add(evt)

        await db.commit()
        print("[Seed] Successfully seeded merchant, customers, and failed payments!")

if __name__ == "__main__":
    asyncio.run(seed_db())
