from pydantic import BaseModel, UUID4
from typing import Optional, Any, List
from enum import Enum
from datetime import datetime


class AgentContext(str, Enum):
    weekly_review = "weekly_review"
    daily_check = "daily_check"
    alert_response = "alert_response"
    manual_query = "manual_query"


class AgentQueryRequest(BaseModel):
    message: str
    context: AgentContext = AgentContext.manual_query


class AgentActionRequest(BaseModel):
    action: str  # toggle_campaign, update_budget, etc
    params: dict[str, Any]


class AgentActionLog(BaseModel):
    id: UUID4
    tenant_id: UUID4
    action: str
    params: dict[str, Any]
    result: Optional[dict[str, Any]] = None
    justification: str
    status: str  # success, failed, pending_approval
    created_at: datetime


class AgentQueryResponse(BaseModel):
    message: str
    reasoning: Optional[str] = None
    actions_taken: List[AgentActionLog] = []
    metrics_referenced: Optional[dict[str, Any]] = None
