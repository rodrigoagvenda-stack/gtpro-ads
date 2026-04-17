from fastapi import APIRouter, Depends, Query
from app.middleware.auth import get_current_tenant
from app.database import supabase

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    status: str = Query("active"),
    tenant: dict = Depends(get_current_tenant),
):
    result = (
        supabase.table("alerts")
        .select("*")
        .eq("tenant_id", tenant["tenant_id"])
        .eq("status", status)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.patch("/{alert_id}/resolve")
async def resolve_alert(alert_id: str, tenant: dict = Depends(get_current_tenant)):
    supabase.table("alerts").update({"status": "resolved"}).eq("id", alert_id).eq(
        "tenant_id", tenant["tenant_id"]
    ).execute()
    return {"success": True}
