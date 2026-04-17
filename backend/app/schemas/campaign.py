from pydantic import BaseModel, UUID4
from typing import Optional, List
from enum import Enum


class CampaignStatus(str, Enum):
    active = "ACTIVE"
    paused = "PAUSED"
    deleted = "DELETED"
    archived = "ARCHIVED"
    in_process = "IN_PROCESS"
    with_issues = "WITH_ISSUES"


class CampaignObjective(str, Enum):
    outcome_leads = "OUTCOME_LEADS"
    outcome_sales = "OUTCOME_SALES"
    outcome_traffic = "OUTCOME_TRAFFIC"
    outcome_awareness = "OUTCOME_AWARENESS"
    outcome_engagement = "OUTCOME_ENGAGEMENT"


class MetricsSnapshot(BaseModel):
    impressions: int = 0
    clicks: int = 0
    spend: float = 0.0
    reach: int = 0
    ctr: float = 0.0
    cpm: float = 0.0
    cpc: float = 0.0
    roas: Optional[float] = None
    cpl: Optional[float] = None
    cpa: Optional[float] = None
    conversions: Optional[int] = None
    leads: Optional[int] = None


class CampaignResponse(BaseModel):
    id: str
    name: str
    status: CampaignStatus
    objective: CampaignObjective
    daily_budget: Optional[float] = None
    lifetime_budget: Optional[float] = None
    metrics: MetricsSnapshot
    start_time: Optional[str] = None
    stop_time: Optional[str] = None


class CampaignToggleRequest(BaseModel):
    campaign_id: str
    status: CampaignStatus


class BudgetUpdateRequest(BaseModel):
    campaign_id: str
    daily_budget: Optional[float] = None
    lifetime_budget: Optional[float] = None
