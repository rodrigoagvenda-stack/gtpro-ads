from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_tenant
from app.services.platform import get_setting, set_setting
from app.database import supabase
import hashlib, secrets

router = APIRouter(prefix="/settings", tags=["settings"])


class PlatformSettingsUpdate(BaseModel):
    anthropic_api_key: str | None = None
    meta_app_id: str | None = None
    meta_app_secret: str | None = None


@router.get("/platform")
async def get_platform_settings(tenant: dict = Depends(get_current_tenant)):
    return {
        "anthropic_api_key_set": bool(get_setting("anthropic_api_key")),
        "meta_app_id": get_setting("meta_app_id"),
        "meta_app_secret_set": bool(get_setting("meta_app_secret")),
    }


@router.put("/platform")
async def update_platform_settings(
    body: PlatformSettingsUpdate,
    tenant: dict = Depends(get_current_tenant),
):
    if body.anthropic_api_key is not None:
        set_setting("anthropic_api_key", body.anthropic_api_key)
    if body.meta_app_id is not None:
        set_setting("meta_app_id", body.meta_app_id)
    if body.meta_app_secret is not None:
        set_setting("meta_app_secret", body.meta_app_secret)
    return {"success": True}


@router.get("/api-keys")
async def list_api_keys(tenant: dict = Depends(get_current_tenant)):
    result = (
        supabase.table("api_keys")
        .select("id, name, scope, active, created_at")
        .eq("tenant_id", tenant["tenant_id"])
        .execute()
    )
    return result.data


@router.post("/api-keys")
async def create_api_key(name: str, scope: str = "read", tenant: dict = Depends(get_current_tenant)):
    raw_key = f"gtpro_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    result = (
        supabase.table("api_keys")
        .insert({
            "tenant_id": tenant["tenant_id"],
            "name": name,
            "key_hash": key_hash,
            "scope": scope,
            "active": True,
        })
        .execute()
    )
    return {**result.data[0], "key": raw_key}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, tenant: dict = Depends(get_current_tenant)):
    supabase.table("api_keys").update({"active": False}).eq("id", key_id).eq(
        "tenant_id", tenant["tenant_id"]
    ).execute()
    return {"success": True}
