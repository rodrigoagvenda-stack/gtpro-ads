from fastapi import APIRouter, Depends, Query
from typing import List
from app.schemas.campaign import CampaignResponse, CampaignToggleRequest, BudgetUpdateRequest
from app.middleware.auth import get_current_tenant, require_write_scope
from app.services import meta_ads

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=List[dict])
async def list_campaigns(
    date_preset: str = Query("last_7d"),
    tenant: dict = Depends(get_current_tenant),
):
    return await meta_ads.get_campaigns(tenant["tenant_id"])


@router.post("/toggle")
async def toggle_campaign(
    body: CampaignToggleRequest,
    tenant: dict = Depends(require_write_scope),
):
    return await meta_ads.toggle_campaign(
        tenant["tenant_id"], body.campaign_id, body.status
    )


@router.post("/budget")
async def update_budget(
    body: BudgetUpdateRequest,
    tenant: dict = Depends(require_write_scope),
):
    return await meta_ads.update_budget(
        tenant["tenant_id"],
        body.campaign_id,
        daily_budget=body.daily_budget,
        lifetime_budget=body.lifetime_budget,
    )
