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
  cpc_conv?: number
  frequency?: number
  conversations?: number
  messaging_conversations?: number
  // Extended Meta API metrics
  cpp?: number
  unique_clicks?: number
  unique_ctr?: number
  outbound_clicks?: number
  outbound_clicks_ctr?: number
  inline_link_clicks?: number
  inline_link_click_ctr?: number
  cost_per_unique_click?: number
  video_p25_watched?: number
  video_p50_watched?: number
  video_p75_watched?: number
  video_p100_watched?: number
  video_avg_time_watched?: number
  post_engagement?: number
  page_engagement?: number
  page_likes?: number
  follows?: number
  website_purchases?: number
  website_purchase_value?: number
  social_spend?: number
  canvas_avg_view_time?: number
  canvas_avg_view_percent?: number
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
