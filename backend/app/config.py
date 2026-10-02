from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "RazorGrowth Backend"
    VERSION: str = "1.1.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./razorgrowth.db"
    AUTO_MIGRATE: bool = True  # run `alembic upgrade head` on startup

    # Sign in with Google: the Web OAuth client ID from console.cloud.google.com.
    GOOGLE_CLIENT_ID: str = ""
    # Comma-separated Google account emails allowed to use /api/v1/admin.
    ADMIN_EMAILS: str = ""
    SESSION_TTL_DAYS: int = 30
    # Local development and tests only: lets you sign in without Google. Never enable in production.
    ENABLE_DEV_LOGIN: bool = False
    CORS_ORIGINS: str = "http://localhost:5173"

    # Razorpay Test Mode
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""  # required: webhooks are rejected until this is set
    RAZORPAY_API_BASE: str = "https://api.razorpay.com/v1"
    RAZORPAY_TIMEOUT_SECONDS: float = 10.0
    RAZORPAY_MAX_ATTEMPTS: int = 3
    RAZORPAY_RETRY_BACKOFF_SECONDS: float = 0.5

    # AI Keys
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Default Merchant Safety Policy
    DEFAULT_MAX_BUDGET: float = 1000.0  # INR ₹1,000 max single action limit
    MAX_POLICY_BUDGET_CEILING: float = 100000.0  # hard upper bound for policy updates
    ALLOWED_ACTION_TYPES: str = "failed_payment_recovery,checkout_recovery"

    # Recovery model assumptions
    RECOVERY_CONVERSION_RATE: float = 0.70
    HEURISTIC_BUDGET_SHARE: float = 0.10  # heuristic mode proposes ~10% of the lost revenue as incentive

    @property
    def is_razorpay_live_test_mode(self) -> bool:
        return bool(self.RAZORPAY_KEY_ID and self.RAZORPAY_KEY_SECRET)

    @property
    def razorpay_mode(self) -> str:
        return "RAZORPAY TEST MODE" if self.is_razorpay_live_test_mode else "LOCAL DEMO MODE"

    @property
    def ai_provider_mode(self) -> str:
        if self.GEMINI_API_KEY:
            return "Gemini 2.5 Flash"
        if self.OPENAI_API_KEY:
            return "OpenAI GPT-4o-mini"
        return "Demo Heuristic Mode"

    @property
    def admin_emails(self) -> List[str]:
        return [e.strip().lower() for e in self.ADMIN_EMAILS.split(",") if e.strip()]

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
