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

  campaigns: {
    list: (datePreset = "last_7d") => fetchWithAuth(`/campaigns?date_preset=${datePreset}`),
    toggle: (campaignId: string, status: string) =>
      fetchWithAuth("/campaigns/toggle", { method: "POST", body: JSON.stringify({ campaign_id: campaignId, status }) }),
    detail: (id: string, datePreset = "last_7d") => fetchWithAuth(`/campaigns/${id}?date_preset=${datePreset}`),
  },

  insights: {
    get: (datePreset = "last_7d") => fetchWithAuth(`/insights?date_preset=${datePreset}`),
  },

  agent: {
    query: (message: string, model?: string, history?: { role: string; content: string }[]) =>
      fetchWithAuth("/agent/query", { method: "POST", body: JSON.stringify({ message, model, history }) }),
    logs: (limit = 50) => fetchWithAuth(`/agent/logs?limit=${limit}`),
  },

  alerts: {
    list: (status = "active") => fetchWithAuth(`/alerts?status=${status}`),
    resolve: (id: string) => fetchWithAuth(`/alerts/${id}/resolve`, { method: "PATCH" }),
  },

  meta: {
    status: () => fetchWithAuth("/meta/status"),
    connect: () => fetchWithAuth("/meta/connect"),
    disconnect: () => fetchWithAuth("/meta/status", { method: "DELETE" }),
    saveToken: (access_token: string, ad_account_id: string) =>
      fetchWithAuth("/meta/token", { method: "POST", body: JSON.stringify({ access_token, ad_account_id }) }),
  },

  tenant: {
    get: () => fetchWithAuth("/settings/tenant"),
    save: (body: Record<string, unknown>) =>
      fetchWithAuth("/settings/tenant", { method: "POST", body: JSON.stringify(body) }),
  },

  reports: {
    list: () => fetchWithAuth("/reports"),
    generate: () => fetchWithAuth("/reports/generate", { method: "POST", body: JSON.stringify({}) }),
    downloadUrl: (id: string) => `/api/reports/${id}/download`,
  },

  gtpro: {
    status: () => fetchWithAuth("/gtpro/status"),
  },
}
