from typing import Literal
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: Literal["development", "staging", "production"] = "development"

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    anthropic_api_key: str

    meta_app_id: str
    meta_app_secret: str
    meta_redirect_uri: str

    # Dev mode: bypass OAuth while Meta app review is pending
    meta_dev_token: str = ""
    meta_dev_ad_account_id: str = ""

    encryption_key: str
    jwt_secret: str

    app_url: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


settings = Settings()
