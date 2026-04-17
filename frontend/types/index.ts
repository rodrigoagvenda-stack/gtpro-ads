export type CampaignStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | "IN_PROCESS" | "WITH_ISSUES"

export interface Metrics {
  impressions: number
  clicks: number
  spend: number
  reach: number
  ctr: number
  cpm: number
  cpc: number
  roas?: number
  cpl?: number
  cpa?: number
  conversions?: number
  leads?: number
}

export interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  objective: string
  daily_budget?: number
  lifetime_budget?: number
  metrics: Metrics
  start_time?: string
  stop_time?: string
}

export interface AgentLog {
  id: string
  tenant_id: string
  action: string
  params: Record<string, unknown>
  result?: Record<string, unknown>
  justification: string
  status: "success" | "failed" | "pending_approval"
  created_at: string
}

export interface Alert {
  id: string
  tenant_id: string
  type: string
  message: string
  campaign_id?: string
  status: "active" | "resolved"
  created_at: string
}

export interface TenantConfig {
  objetivo_principal: string
  roas_minimo?: number
  cpl_maximo?: number
  budget_mensal?: number
  modo_supervisionado: boolean
  limite_budget_sem_aprovacao: number
}
