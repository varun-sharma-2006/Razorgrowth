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

    # Security
    # When set, every /api/v1 endpoint except /merchant/status and /webhooks requires
    # the `X-Admin-Key` header. Leave blank only for local demos.
    ADMIN_API_KEY: str = ""
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
    MERCHANT_ID: str = "merch_razorgrowth_01"
    DEFAULT_MAX_BUDGET: float = 1000.0  # INR ₹1,000 max single action limit
    MAX_POLICY_BUDGET_CEILING: float = 100000.0  # hard upper bound for policy updates
    ALLOWED_ACTION_TYPES: str = "failed_payment_recovery,checkout_recovery"

    # Recovery model assumptions
    RECOVERY_CONVERSION_RATE: float = 0.70
    HEURISTIC_PROPOSED_BUDGET: float = 850.0  # incentive pool proposed in heuristic mode
    HEURISTIC_MAX_BUDGET_SHARE: float = 0.15  # never propose more than 15% of the lost amount

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
    def auth_required(self) -> bool:
        return bool(self.ADMIN_API_KEY)

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
