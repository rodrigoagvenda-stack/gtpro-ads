from fastapi import APIRouter, Depends, Query
from app.middleware.auth import get_current_tenant
from app.services import meta_ads

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("")
async def get_insights(
    date_preset: str = Query("last_7d", description="today|yesterday|last_7d|last_30d|this_month|last_month"),
    tenant: dict = Depends(get_current_tenant),
):
    return await meta_ads.get_insights(tenant["tenant_id"], date_preset)
