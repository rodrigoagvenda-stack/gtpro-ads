from fastapi import APIRouter, Depends, HTTPException
from app.schemas.auth import MetaOAuthCallback, MetaConnectionStatus, APIKeyCreate, APIKeyResponse
from app.middleware.auth import get_current_tenant
from app.services.meta_ads import exchange_code_for_token, get_long_lived_token, check_token_expiry
from app.services.crypto import encrypt_token
from app.database import supabase
from app.config import settings
from pydantic import BaseModel
import hashlib, secrets, httpx
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup")
async def signup(email: str, password: str, nome: str, segmento: str):
    # 1. Cria o tenant
    tenant_result = supabase.table("tenants").insert({
        "nome": nome,
        "segmento": segmento,
    }).execute()
    tenant_id = tenant_result.data[0]["id"]

    # 2. Cria o usuário no Supabase Auth
    user_result = supabase.auth.admin.create_user({
        "email": email,
        "password": password,
        "app_metadata": {"tenant_id": tenant_id},  # Injeta no JWT
        "email_confirm": True,
    })
    user_id = user_result.user.id

    # 3. Cria o perfil vinculando user ao tenant
    supabase.table("tenant_members").insert({
        "id": user_id,
        "tenant_id": tenant_id,
        "role": "owner",
    }).execute()

    # 4. Cria configuração padrão do agente
    supabase.table("agent_configs").insert({
        "tenant_id": tenant_id,
    }).execute()

    return {"tenant_id": tenant_id, "user_id": user_id}


@router.get("/meta/url")
async def get_meta_oauth_url(tenant: dict = Depends(get_current_tenant)):
    scopes = "ads_management,ads_read,business_management"
    url = (
        f"https://www.facebook.com/v20.0/dialog/oauth"
        f"?client_id={settings.meta_app_id}"
        f"&redirect_uri={settings.meta_redirect_uri}"
        f"&scope={scopes}"
        f"&state={tenant['tenant_id']}"
    )
    return {"url": url}


@router.get("/meta/callback")
async def meta_oauth_callback(code: str, state: str):
    tenant_id = state

    # Troca code por short-lived token
    token_data = await exchange_code_for_token(code)
    short_token = token_data["access_token"]

    # Troca por long-lived token (60 dias)
    long_token_data = await get_long_lived_token(short_token)
    access_token = long_token_data["access_token"]
    expires_in = long_token_data.get("expires_in", 5184000)  # 60 dias default

    expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    supabase.table("meta_connections").upsert({
        "tenant_id": tenant_id,
        "access_token_encrypted": encrypt_token(access_token),
        "expires_at": expires_at.isoformat(),
        "active": True,
    }, on_conflict="tenant_id").execute()

    return {"success": True, "message": "Conta Meta conectada com sucesso"}


class DevConnectBody(BaseModel):
    access_token: str
    ad_account_id: str


@router.post("/meta/dev-connect")
async def meta_dev_connect(body: DevConnectBody, tenant: dict = Depends(get_current_tenant)):
    """Connect via System User token — dev/internal use while Meta app review is pending."""
    if settings.environment == "production":
        raise HTTPException(status_code=403, detail="Dev connect não disponível em produção")

    # Validate token against Meta before saving
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://graph.facebook.com/v20.0/me",
            params={"access_token": body.access_token, "fields": "id,name"},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Token inválido: {resp.json().get('error', {}).get('message', 'erro desconhecido')}")

    supabase.table("meta_connections").upsert({
        "tenant_id": tenant["tenant_id"],
        "access_token_encrypted": encrypt_token(body.access_token),
        "ad_account_id": body.ad_account_id,
        "expires_at": None,
        "active": True,
    }, on_conflict="tenant_id").execute()

    return {"success": True, "message": "Conta Meta conectada via token de desenvolvimento"}


@router.get("/meta/status", response_model=MetaConnectionStatus)
async def meta_connection_status(tenant: dict = Depends(get_current_tenant)):
    result = (
        supabase.table("meta_connections")
        .select("ad_account_id, expires_at, active")
        .eq("tenant_id", tenant["tenant_id"])
        .maybe_single()
        .execute()
    )
    if not result.data:
        return MetaConnectionStatus(connected=False)

    await check_token_expiry(tenant["tenant_id"])

    return MetaConnectionStatus(
        connected=result.data["active"],
        ad_account_id=result.data.get("ad_account_id"),
        expires_at=result.data.get("expires_at"),
    )


@router.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(body: APIKeyCreate, tenant: dict = Depends(get_current_tenant)):
    raw_key = f"gtpro_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    result = (
        supabase.table("api_keys")
        .insert({
            "tenant_id": tenant["tenant_id"],
            "name": body.name,
            "key_hash": key_hash,
            "scope": body.scope,
            "active": True,
        })
        .execute()
    )
    row = result.data[0]
    return APIKeyResponse(
        id=row["id"],
        name=row["name"],
        key=raw_key,  # Retornado apenas uma vez
        scope=row["scope"],
        created_at=row["created_at"],
    )
