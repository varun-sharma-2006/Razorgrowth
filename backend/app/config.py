import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PROJECT_NAME: str = "RazorGrowth Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./razorgrowth.db"

    # Razorpay Test Mode
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = "razorgrowth_wh_secret_123"

    # AI Keys
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Default Merchant Safety Policy
    MERCHANT_ID: str = "merch_razorgrowth_01"
    DEFAULT_MAX_BUDGET: float = 1000.0  # INR ₹1,000 max single action limit
    ALLOWED_ACTION_TYPES: str = "failed_payment_recovery,checkout_recovery"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def is_razorpay_live_test_mode(self) -> bool:
        return bool(self.RAZORPAY_KEY_ID and self.RAZORPAY_KEY_SECRET)

    @property
    def ai_provider_mode(self) -> str:
        if self.GEMINI_API_KEY:
            return "Gemini 2.5 Flash"
        elif self.OPENAI_API_KEY:
            return "OpenAI GPT-4o-mini"
        return "Demo Heuristic Mode"

settings = Settings()
