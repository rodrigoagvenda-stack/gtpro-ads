from pydantic import BaseModel, EmailStr, UUID4
from typing import Optional
from enum import Enum


class TenantSegment(str, Enum):
    ecommerce = "ecommerce"
    infoproduto = "infoproduto"
    servicos_locais = "servicos_locais"
    agro = "agro"
    outro = "outro"


class TenantObjective(str, Enum):
    conversoes = "conversoes"
    leads = "leads"
    trafego = "trafego"
    reconhecimento = "reconhecimento"
    engajamento = "engajamento"


class TenantConfig(BaseModel):
    roas_minimo: Optional[float] = None
    cpl_maximo: Optional[float] = None
    cpa_maximo: Optional[float] = None
    budget_mensal: Optional[float] = None
    objetivo_principal: TenantObjective = TenantObjective.conversoes
    agente_horario_inicio: str = "08:00"
    agente_horario_fim: str = "22:00"
    limite_budget_sem_aprovacao: float = 50.0
    modo_supervisionado: bool = True


class TenantOnboarding(BaseModel):
    nome: str
    email: EmailStr
    segmento: TenantSegment
    config: TenantConfig


class TenantResponse(BaseModel):
    id: UUID4
    nome: str
    segmento: TenantSegment
    config: TenantConfig
    meta_conectado: bool
