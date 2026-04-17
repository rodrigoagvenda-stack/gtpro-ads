# Endpoints públicos da API GTPRO — para integração com agentes externos (MAX, etc)
from fastapi import APIRouter, Depends
from app.schemas.agent import AgentQueryRequest, AgentQueryResponse, AgentActionRequest
from app.middleware.auth import get_current_tenant, require_write_scope
from app.routers.agent import query_agent
from app.routers.campaigns import list_campaigns
from app.routers.insights import get_insights
from app.routers.alerts import list_alerts
from app.database import supabase

router = APIRouter(prefix="/gtpro", tags=["gtpro-api"])


@router.post("/query", response_model=AgentQueryResponse)
async def gtpro_query(body: AgentQueryRequest, tenant: dict = Depends(get_current_tenant)):
    return await query_agent(body, tenant)


@router.get("/campaigns")
async def gtpro_campaigns(tenant: dict = Depends(get_current_tenant)):
    return await list_campaigns(tenant=tenant)


@router.get("/insights")
async def gtpro_insights(date_preset: str = "last_7d", tenant: dict = Depends(get_current_tenant)):
    return await get_insights(date_preset=date_preset, tenant=tenant)


@router.get("/alerts")
async def gtpro_alerts(tenant: dict = Depends(get_current_tenant)):
    return await list_alerts(tenant=tenant)


@router.get("/status")
async def gtpro_status(tenant: dict = Depends(get_current_tenant)):
    meta = (
        supabase.table("meta_connections")
        .select("active, expires_at")
        .eq("tenant_id", tenant["tenant_id"])
        .maybe_single()
        .execute()
    )
    return {
        "meta_connected": bool(meta.data and meta.data.get("active")),
        "meta_expires_at": meta.data.get("expires_at") if meta.data else None,
        "agent_status": "online",
    }
