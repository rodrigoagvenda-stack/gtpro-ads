from pydantic import BaseModel, UUID4
from typing import Optional


class MetaOAuthCallback(BaseModel):
    code: str
    state: Optional[str] = None


class MetaConnectionStatus(BaseModel):
    connected: bool
    ad_account_id: Optional[str] = None
    expires_at: Optional[str] = None


class APIKeyCreate(BaseModel):
    name: str
    scope: str = "read"  # read | read_write


class APIKeyResponse(BaseModel):
    id: UUID4
    name: str
    key: str  # só retornado na criação
    scope: str
    created_at: str
