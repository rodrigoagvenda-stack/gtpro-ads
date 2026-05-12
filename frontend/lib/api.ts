async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const { createClient } = await import("./supabase")
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.error || error.detail || "Erro na requisição")
  }

  return res.json()
}

export const api = {
  get: (path: string) => fetchWithAuth(path),
  post: (path: string, body: unknown) =>
    fetchWithAuth(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path: string, body?: unknown) =>
    fetchWithAuth(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => fetchWithAuth(path, { method: "DELETE" }),

  home: {
    get: () => fetchWithAuth("/home"),
  },

  campaigns: {
    list: (datePreset = "last_7d") => fetchWithAuth(`/campaigns?date_preset=${datePreset}`),
    toggle: (campaignId: string, status: string) =>
      fetchWithAuth("/campaigns/toggle", { method: "POST", body: JSON.stringify({ campaign_id: campaignId, status }) }),
    detail: (id: string, datePreset = "last_7d") => fetchWithAuth(`/campaigns/${id}?date_preset=${datePreset}`),
  },

  insights: {
    get: (datePreset = "last_7d", since?: string, until?: string) => {
      const params = new URLSearchParams({ date_preset: datePreset })
      if (since) params.set("since", since)
      if (until) params.set("until", until)
      return fetchWithAuth(`/insights?${params}`)
    },
  },

  agent: {
    query: (message: string, model?: string, history?: { role: string; content: string }[]) =>
      fetchWithAuth("/agent/query", { method: "POST", body: JSON.stringify({ message, model, history }) }),
    logs: (limit = 50) => fetchWithAuth(`/agent/logs?limit=${limit}`),
    messages: () => fetchWithAuth("/agent/messages"),
    clearMessages: () => fetchWithAuth("/agent/messages", { method: "DELETE" }),
  },

  alerts: {
    list: (status = "active") => fetchWithAuth(`/alerts?status=${status}`),
    resolve: (id: string) => fetchWithAuth(`/alerts/${id}/resolve`, { method: "PATCH" }),
  },

  creative: {
    videoSource: (videoId: string) => fetchWithAuth(`/creative/video?video_id=${videoId}`),
  },

  account: {
    get: () => fetchWithAuth("/account"),
  },

  audiences: {
    list:   () => fetchWithAuth("/audiences"),
    create: (body: Record<string, any>) => fetchWithAuth("/audiences", { method: "POST", body: JSON.stringify(body) }),
  },

  pixels: {
    list: () => fetchWithAuth("/pixels"),
  },

  breakdowns: {
    get: (campaignId: string, breakdown: string, datePreset = "last_7d") =>
      fetchWithAuth(`/campaigns/${campaignId}/breakdowns?breakdown=${breakdown}&date_preset=${datePreset}`),
  },

  meta: {
    status: () => fetchWithAuth("/meta/status"),
    connect: () => fetchWithAuth("/meta/connect"),
    disconnect: () => fetchWithAuth("/meta/status", { method: "DELETE" }),
    saveToken: (access_token: string, ad_account_id: string) =>
      fetchWithAuth("/meta/token", { method: "POST", body: JSON.stringify({ access_token, ad_account_id }) }),
    accounts: () => fetchWithAuth("/meta/accounts"),
    switchAccount: (id: string) => fetchWithAuth("/meta/accounts", { method: "PATCH", body: JSON.stringify({ id }) }),
    renameAccount: (id: string, name: string) => fetchWithAuth(`/meta/accounts/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  },

  tenant: {
    get: () => fetchWithAuth("/settings/tenant"),
    save: (body: Record<string, unknown>) =>
      fetchWithAuth("/settings/tenant", { method: "POST", body: JSON.stringify(body) }),
  },

  reports: {
    list: () => fetchWithAuth("/reports"),
    generate: (skills: string[], objective?: string) => fetchWithAuth("/reports/generate", { method: "POST", body: JSON.stringify({ skills, objective }) }),
    downloadUrl: (id: string) => `/api/reports/${id}/download`,
    getSchedule: () => fetchWithAuth("/reports/schedule"),
    saveSchedule: (schedule: string, whatsapp: boolean) => fetchWithAuth("/reports/schedule", { method: "POST", body: JSON.stringify({ schedule, whatsapp }) }),
  },

  gtpro: {
    status: () => fetchWithAuth("/gtpro/status"),
  },

  leads: {
    list: (datePreset = "last_30d") => fetchWithAuth(`/leads?date_preset=${datePreset}`),
    convert: (id: string, value?: number) =>
      fetchWithAuth(`/leads/${id}/convert`, { method: "POST", body: JSON.stringify({ value }) }),
  },

  alertsConfig: {
    get: () => fetchWithAuth("/settings/alerts-config"),
    save: (body: unknown) => fetchWithAuth("/settings/alerts-config", { method: "POST", body: JSON.stringify(body) }),
  },

  webhook: {
    get: () => fetchWithAuth("/settings/webhook"),
    regenerate: () => fetchWithAuth("/settings/webhook", { method: "POST" }),
  },

  skills: {
    list: () => fetchWithAuth("/skills"),
    create: (body: Record<string, unknown>) => fetchWithAuth("/skills", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) => fetchWithAuth(`/skills/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) => fetchWithAuth(`/skills/${id}`, { method: "DELETE" }),
  },

  team: {
    members: () => fetchWithAuth("/team/members"),
    invite: (email: string, role: string) =>
      fetchWithAuth("/team/invite", { method: "POST", body: JSON.stringify({ email, role }) }),
    removeMember: (userId: string) => fetchWithAuth(`/team/members/${userId}`, { method: "DELETE" }),
    updateRole: (userId: string, role: string) =>
      fetchWithAuth(`/team/members/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) }),
  },
}
