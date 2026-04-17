import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import Optional
from app.database import supabase
from app.services.crypto import decrypt_token
from app.services.platform import get_meta_credentials

META_GRAPH_URL = "https://graph.facebook.com/v20.0"


async def get_access_token(tenant_id: str) -> str:
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
    return decrypt_token(result.data["access_token_encrypted"])


async def get_ad_account_id(tenant_id: str) -> str:
    result = (
        supabase.table("meta_connections")
        .select("ad_account_id")
        .eq("tenant_id", tenant_id)
        .eq("active", True)
        .single()
        .execute()
    )
    if not result.data:
        raise ValueError(f"Conta Meta não conectada para tenant {tenant_id}")
    return result.data["ad_account_id"]


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def get_campaigns(tenant_id: str, fields: Optional[str] = None) -> list:
    token = await get_access_token(tenant_id)
    ad_account_id = await get_ad_account_id(tenant_id)

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
    token = await get_access_token(tenant_id)
    ad_account_id = await get_ad_account_id(tenant_id)

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
    token = await get_access_token(tenant_id)
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
    token = await get_access_token(tenant_id)
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
