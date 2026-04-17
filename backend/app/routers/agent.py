from fastapi import APIRouter, Depends
from app.schemas.agent import AgentQueryRequest, AgentQueryResponse
from app.middleware.auth import get_current_tenant
from app.agent.runner import run_agent
from app.database import supabase

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/query", response_model=AgentQueryResponse)
async def query_agent(
    body: AgentQueryRequest,
    tenant: dict = Depends(get_current_tenant),
):
    tenant_id = tenant["tenant_id"]

    # Busca configurações do tenant para passar ao agente
    config_result = (
        supabase.table("agent_configs")
        .select("*")
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    tenant_config = config_result.data or {}

    result = await run_agent(tenant_id, body.message, tenant_config)
    return AgentQueryResponse(
        message=result["message"],
        actions_taken=result.get("actions_taken", []),
    )


@router.get("/logs")
async def get_agent_logs(
    limit: int = 50,
    tenant: dict = Depends(get_current_tenant),
):
    result = (
        supabase.table("agent_logs")
        .select("*")
        .eq("tenant_id", tenant["tenant_id"])
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data
