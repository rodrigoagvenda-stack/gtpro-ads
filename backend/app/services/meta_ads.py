import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import Optional
from datetime import datetime, timezone, timedelta
from app.database import supabase
from app.services.crypto import decrypt_token
from app.services.platform import get_meta_credentials
from app.config import settings

META_GRAPH_URL = "https://graph.facebook.com/v20.0"


async def _get_tenant_credentials(tenant_id: str) -> tuple[str, str]:
    """Returns (access_token, ad_account_id) in a single DB query."""
    if settings.meta_dev_token and settings.meta_dev_ad_account_id:
        return settings.meta_dev_token, settings.meta_dev_ad_account_id

    result = (
        supabase.table("meta_connections")
        .select("access_token_encrypted, ad_account_id")
        .eq("tenant_id", tenant_id)
        .eq("active", True)
        .single()
        .execute()
    )
    if not result.data:
        raise ValueError(f"Conta Meta não conectada para tenant {tenant_id}")
    return decrypt_token(result.data["access_token_encrypted"]), result.data["ad_account_id"]


# Keep individual helpers for callers that only need one value
async def get_access_token(tenant_id: str) -> str:
    token, _ = await _get_tenant_credentials(tenant_id)
    return token


async def get_ad_account_id(tenant_id: str) -> str:
    _, account_id = await _get_tenant_credentials(tenant_id)
    return account_id


async def check_token_expiry(tenant_id: str) -> dict:
    """Returns expiry status. Creates an alert if token expires within 7 days."""
    if settings.meta_dev_token:
        return {"status": "dev_token", "expires_at": None}

    result = (
        supabase.table("meta_connections")
        .select("expires_at")
        .eq("tenant_id", tenant_id)
        .eq("active", True)
        .maybe_single()
        .execute()
    )
    if not result.data or not result.data.get("expires_at"):
        return {"status": "unknown", "expires_at": None}

    expires_at = datetime.fromisoformat(result.data["expires_at"]).replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    days_remaining = (expires_at - now).days

    if days_remaining <= 7:
        supabase.table("alerts").insert({
            "tenant_id": tenant_id,
            "type": "token_expirando",
            "message": f"Token Meta expira em {days_remaining} dia(s). Reconecte sua conta.",
            "status": "active",
        }).execute()

    return {"status": "ok" if days_remaining > 7 else "expiring", "days_remaining": days_remaining, "expires_at": result.data["expires_at"]}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def get_campaigns(tenant_id: str, fields: Optional[str] = None) -> list:
    token, ad_account_id = await _get_tenant_credentials(tenant_id)
    default_fields = "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time"
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{META_GRAPH_URL}/act_{ad_account_id}/campaigns",
            params={
                "access_token": token,
                "fields": fields or default_fields,
                "limit": 100,
            },
        )
        response.raise_for_status()
        return response.json().get("data", [])


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def get_insights(tenant_id: str, date_preset: str = "last_7d") -> dict:
    token, ad_account_id = await _get_tenant_credentials(tenant_id)
    fields = "impressions,clicks,spend,reach,ctr,cpm,cpc,actions,action_values,roas"
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{META_GRAPH_URL}/act_{ad_account_id}/insights",
            params={
                "access_token": token,
                "fields": fields,
                "date_preset": date_preset,
                "level": "account",
            },
        )
        response.raise_for_status()
        data = response.json().get("data", [])
        return data[0] if data else {}


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def toggle_campaign(tenant_id: str, campaign_id: str, status: str) -> dict:
    token, _ = await _get_tenant_credentials(tenant_id)
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{META_GRAPH_URL}/{campaign_id}",
            params={"access_token": token},
            json={"status": status},
        )
        response.raise_for_status()
        return response.json()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def update_budget(
    tenant_id: str,
    campaign_id: str,
    daily_budget: Optional[float] = None,
    lifetime_budget: Optional[float] = None,
) -> dict:
    token, _ = await _get_tenant_credentials(tenant_id)
    payload = {}
    if daily_budget is not None:
        payload["daily_budget"] = int(daily_budget * 100)  # Meta usa centavos
    if lifetime_budget is not None:
        payload["lifetime_budget"] = int(lifetime_budget * 100)

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{META_GRAPH_URL}/{campaign_id}",
            params={"access_token": token},
            json=payload,
        )
        response.raise_for_status()
        return response.json()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def upload_image_from_url(tenant_id: str, image_url: str) -> str:
    """Downloads an image from a URL and uploads it to the Meta ad account. Returns the image hash."""
    token, ad_account_id = await _get_tenant_credentials(tenant_id)

    async with httpx.AsyncClient() as client:
        img_response = await client.get(image_url)
        img_response.raise_for_status()
        image_bytes = img_response.content
        content_type = img_response.headers.get("content-type", "image/jpeg")

        response = await client.post(
            f"{META_GRAPH_URL}/act_{ad_account_id}/adimages",
            params={"access_token": token},
            files={"filename": ("image", image_bytes, content_type)},
        )
        response.raise_for_status()

    images = response.json().get("images", {})
    for val in images.values():
        image_hash = val.get("hash")
        supabase.table("media_assets").insert({
            "tenant_id": tenant_id,
            "type": "image",
            "meta_hash": image_hash,
            "source_url": image_url,
        }).execute()
        return image_hash

    raise ValueError(f"Resposta inesperada do upload de imagem: {response.json()}")


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def create_ad_creative(
    tenant_id: str,
    name: str,
    page_id: str,
    image_hash: str,
    primary_text: str,
    headline: str,
    link: str,
    description: str = "",
    cta: str = "LEARN_MORE",
) -> str:
    """Creates an ad creative. Returns the creative ID."""
    token, ad_account_id = await _get_tenant_credentials(tenant_id)
    import json

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{META_GRAPH_URL}/act_{ad_account_id}/adcreatives",
            params={
                "access_token": token,
                "name": name,
                "object_story_spec": json.dumps({
                    "link_data": {
                        "image_hash": image_hash,
                        "link": link,
                        "message": primary_text,
                        "name": headline,
                        "description": description,
                        "call_to_action": {
                            "type": cta,
                            "value": {"link": link},
                        },
                    },
                    "page_id": page_id,
                }),
            },
        )
        response.raise_for_status()
        return response.json()["id"]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def create_ad(
    tenant_id: str,
    name: str,
    adset_id: str,
    creative_id: str,
    status: str = "PAUSED",
) -> str:
    """Creates an ad linking a creative to an ad set. Returns the ad ID."""
    token, ad_account_id = await _get_tenant_credentials(tenant_id)
    import json

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{META_GRAPH_URL}/act_{ad_account_id}/ads",
            params={
                "access_token": token,
                "name": name,
                "adset_id": adset_id,
                "creative": json.dumps({"creative_id": creative_id}),
                "status": status,
            },
        )
        response.raise_for_status()
        return response.json()["id"]


async def exchange_code_for_token(code: str, redirect_uri: str) -> dict:
    creds = get_meta_credentials()
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{META_GRAPH_URL}/oauth/access_token",
            params={
                "client_id": creds["app_id"],
                "client_secret": creds["app_secret"],
                "redirect_uri": redirect_uri,
                "code": code,
            },
        )
        response.raise_for_status()
        return response.json()


async def get_long_lived_token(short_token: str) -> dict:
    creds = get_meta_credentials()
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{META_GRAPH_URL}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": creds["app_id"],
                "client_secret": creds["app_secret"],
                "fb_exchange_token": short_token,
            },
        )
        response.raise_for_status()
        return response.json()
