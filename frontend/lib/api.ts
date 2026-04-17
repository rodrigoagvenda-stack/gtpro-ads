const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.vendai.pro"

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const { createClient } = await import("./supabase")
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || "Erro na requisição")
  }

  return res.json()
}

export const api = {
  get: (path: string) => fetchWithAuth(path),
  post: (path: string, body: unknown) =>
    fetchWithAuth(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path: string, body?: unknown) =>
    fetchWithAuth(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),

  campaigns: {
    list: (datePreset = "last_7d") => fetchWithAuth(`/campaigns?date_preset=${datePreset}`),
    toggle: (campaignId: string, status: string) =>
      fetchWithAuth("/campaigns/toggle", { method: "POST", body: JSON.stringify({ campaign_id: campaignId, status }) }),
  },

  insights: {
    get: (datePreset = "last_7d") => fetchWithAuth(`/insights?date_preset=${datePreset}`),
  },

  agent: {
    query: (message: string, context = "manual_query") =>
      fetchWithAuth("/agent/query", { method: "POST", body: JSON.stringify({ message, context }) }),
    logs: (limit = 50) => fetchWithAuth(`/agent/logs?limit=${limit}`),
  },

  alerts: {
    list: (status = "active") => fetchWithAuth(`/alerts?status=${status}`),
    resolve: (id: string) => fetchWithAuth(`/alerts/${id}/resolve`, { method: "PATCH" }),
  },

  gtpro: {
    status: () => fetchWithAuth("/gtpro/status"),
  },
}
