from app.database import supabase
from app.services.crypto import encrypt_token, decrypt_token
from functools import lru_cache
import time

_cache: dict = {}
_cache_ttl = 300  # 5 minutos


def get_setting(key: str) -> str:
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < _cache_ttl:
        return _cache[key]["value"]

    result = supabase.table("platform_settings").select("value_encrypted").eq("key", key).single().execute()
    raw = result.data["value_encrypted"] if result.data else ""
    value = decrypt_token(raw) if raw else ""
    _cache[key] = {"value": value, "ts": now}
    return value


def set_setting(key: str, value: str):
    encrypted = encrypt_token(value) if value else ""
    supabase.table("platform_settings").upsert({
        "key": key,
        "value_encrypted": encrypted,
        "updated_at": "now()",
    }, on_conflict="key").execute()
    _cache.pop(key, None)


def get_anthropic_key() -> str:
    return get_setting("anthropic_api_key")


def get_meta_credentials() -> dict:
    return {
        "app_id": get_setting("meta_app_id"),
        "app_secret": get_setting("meta_app_secret"),
    }
