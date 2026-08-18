import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"
import { refreshGoogleToken } from "./google-ads"

const GTM_API = "https://www.googleapis.com/tagmanager/v2"

async function gtmGet(path: string, accessToken: string) {
  const res = await fetch(`${GTM_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const raw = await res.text()
    console.error(`[gtm] GET ${path} FAILED status=${res.status}:`, raw)
    throw new Error(`Erro na API do Tag Manager (${res.status}): ${raw.slice(0, 300)}`)
  }
  return res.json()
}

async function gtmPost(path: string, accessToken: string, body: unknown) {
  const res = await fetch(`${GTM_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const raw = await res.text()
    console.error(`[gtm] POST ${path} FAILED status=${res.status}:`, raw)
    throw new Error(`Erro na API do Tag Manager (${res.status}): ${raw.slice(0, 300)}`)
  }
  return res.json()
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export interface GTMContainer {
  accountId:     string
  accountName:   string
  containerId:   string
  containerName: string
  publicId:      string   // GTM-XXXXXXX, o ID que vai no snippet do site
}

export async function listGTMContainers(accessToken: string): Promise<GTMContainer[]> {
  const accountsRes = await gtmGet("/accounts", accessToken)
  const out: GTMContainer[] = []
  for (const acc of accountsRes.account ?? []) {
    const containersRes = await gtmGet(`/accounts/${acc.accountId}/containers`, accessToken)
    for (const c of containersRes.container ?? []) {
      out.push({
        accountId:     acc.accountId,
        accountName:   acc.name,
        containerId:   c.containerId,
        containerName: c.name,
        publicId:      c.publicId,
      })
    }
  }
  return out
}

async function getDefaultWorkspacePath(accessToken: string, accountId: string, containerId: string): Promise<string> {
  const data = await gtmGet(`/accounts/${accountId}/containers/${containerId}/workspaces`, accessToken)
  const ws = (data.workspace ?? [])[0]
  if (!ws) throw new Error("Nenhum workspace encontrado no container — crie um workspace no GTM primeiro.")
  return ws.path
}

// ─── Connections table ──────────────────────────────────────────────────────────

export async function saveGTMConnections(tenantId: string, accessToken: string, refreshToken: string, containers: GTMContainer[]) {
  const supabase = createServiceClient()
  await supabase.from("gtm_connections").update({ is_active: false }).eq("tenant_id", tenantId)

  for (let i = 0; i < containers.length; i++) {
    const c = containers[i]
    const { data: existing } = await supabase
      .from("gtm_connections")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("container_id", c.containerId)
      .single()

    const row = {
      tenant_id:               tenantId,
      account_id:              c.accountId,
      account_name:            c.accountName,
      container_id:            c.containerId,
      container_name:          c.containerName,
      public_id:               c.publicId,
      access_token_encrypted:  encrypt(accessToken),
      refresh_token_encrypted: encrypt(refreshToken),
      is_active:               i === 0,
      active:                  true,
    }
    if (existing) await supabase.from("gtm_connections").update(row).eq("id", existing.id)
    else await supabase.from("gtm_connections").insert(row)
  }
}

export async function getGTMConnections(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("gtm_connections")
    .select("id, account_name, container_name, public_id, container_id, account_id, is_active, created_at")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("is_active", { ascending: false })
  return data ?? []
}

export async function switchGTMConnection(tenantId: string, id: string) {
  const supabase = createServiceClient()
  await supabase.from("gtm_connections").update({ is_active: false }).eq("tenant_id", tenantId)
  await supabase.from("gtm_connections").update({ is_active: true }).eq("id", id).eq("tenant_id", tenantId)
}

async function getActiveContainer(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("gtm_connections")
    .select("account_id, container_id, public_id, refresh_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("is_active", true)
    .single()
  if (!data) throw new Error("Nenhum container GTM conectado. Conecte em Configurações → Google Ads (mesmo fluxo OAuth).")
  const accessToken = await refreshGoogleToken(decrypt(data.refresh_token_encrypted))
  return { accountId: data.account_id, containerId: data.container_id, publicId: data.public_id, accessToken }
}

// ─── Triggers ────────────────────────────────────────────────────────────────

export type TriggerType = "PAGEVIEW" | "CLICK" | "LINK_CLICK" | "FORM_SUBMISSION" | "CUSTOM_EVENT"

export async function getGTMTriggers(tenantId: string) {
  const { accountId, containerId, accessToken } = await getActiveContainer(tenantId)
  const wsPath = await getDefaultWorkspacePath(accessToken, accountId, containerId)
  const data = await gtmGet(`/${wsPath}/triggers`, accessToken)
  return (data.trigger ?? []).map((t: any) => ({ id: t.triggerId, name: t.name, type: t.type }))
}

// name + type cobrem os gatilhos mais comuns pedidos por quem gerencia campanhas:
// visualização de página, clique, envio de formulário, evento customizado (dataLayer).
export async function createGTMTrigger(tenantId: string, params: {
  name: string
  type: TriggerType
  eventName?: string       // obrigatório para CUSTOM_EVENT
  urlContains?: string     // filtro opcional: só dispara se a URL contiver esse trecho
}) {
  const { accountId, containerId, accessToken } = await getActiveContainer(tenantId)
  const wsPath = await getDefaultWorkspacePath(accessToken, accountId, containerId)

  const body: Record<string, any> = { name: params.name, type: params.type }

  if (params.type === "CUSTOM_EVENT") {
    if (!params.eventName) throw new Error("eventName é obrigatório para gatilho do tipo CUSTOM_EVENT.")
    body.customEventFilter = [{
      type: "equals",
      parameter: [
        { type: "template", key: "arg0", value: "{{_event}}" },
        { type: "template", key: "arg1", value: params.eventName },
      ],
    }]
  }

  if (params.urlContains) {
    body.filter = [{
      type: "contains",
      parameter: [
        { type: "template", key: "arg0", value: "{{Page URL}}" },
        { type: "template", key: "arg1", value: params.urlContains },
      ],
    }]
  }

  const created = await gtmPost(`/${wsPath}/triggers`, accessToken, body)
  return { id: created.triggerId, name: created.name, type: created.type }
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export type GTMTagKind = "google_ads_conversion" | "ga4_event" | "custom_html"

// Cobre os dois tipos de tag que quem gerencia Google Ads mais precisa: conversão
// do Google Ads (awct) e evento GA4 (gaawe). custom_html fica pra scripts avulsos
// (ex: pixel de terceiro que não tem template pronto no GTM).
export async function createGTMTag(tenantId: string, params: {
  name: string
  kind: GTMTagKind
  triggerIds: string[]
  conversionId?: string        // Google Ads: AW-XXXXXXXXX
  conversionLabel?: string     // Google Ads: label da ação de conversão
  conversionValue?: string     // Google Ads: valor (pode ser variável GTM, ex: "{{DLV - value}}")
  measurementId?: string       // GA4: G-XXXXXXXXXX
  eventName?: string           // GA4: nome do evento (ex: "purchase")
  html?: string                // custom_html: script bruto
}) {
  const { accountId, containerId, accessToken } = await getActiveContainer(tenantId)
  const wsPath = await getDefaultWorkspacePath(accessToken, accountId, containerId)

  const body: Record<string, any> = {
    name: params.name,
    firingTriggerId: params.triggerIds,
  }

  if (params.kind === "google_ads_conversion") {
    if (!params.conversionId || !params.conversionLabel)
      throw new Error("conversionId e conversionLabel são obrigatórios para tag de conversão do Google Ads.")
    body.type = "awct"
    body.parameter = [
      { type: "template", key: "conversionId",    value: params.conversionId.replace(/^AW-/, "") },
      { type: "template", key: "conversionLabel", value: params.conversionLabel },
      ...(params.conversionValue ? [{ type: "template", key: "conversionValue", value: params.conversionValue }] : []),
    ]
  } else if (params.kind === "ga4_event") {
    if (!params.measurementId || !params.eventName)
      throw new Error("measurementId e eventName são obrigatórios para tag de evento GA4.")
    body.type = "gaawe"
    body.parameter = [
      { type: "template", key: "measurementId", value: params.measurementId },
      { type: "template", key: "eventName",     value: params.eventName },
    ]
  } else if (params.kind === "custom_html") {
    if (!params.html) throw new Error("html é obrigatório para tag do tipo custom_html.")
    body.type = "html"
    body.parameter = [{ type: "template", key: "html", value: params.html }]
  }

  const created = await gtmPost(`/${wsPath}/tags`, accessToken, body)
  return { id: created.tagId, name: created.name, type: created.type }
}

export async function getGTMTags(tenantId: string) {
  const { accountId, containerId, accessToken } = await getActiveContainer(tenantId)
  const wsPath = await getDefaultWorkspacePath(accessToken, accountId, containerId)
  const data = await gtmGet(`/${wsPath}/tags`, accessToken)
  return (data.tag ?? []).map((t: any) => ({
    id: t.tagId, name: t.name, type: t.type, firingTriggerId: t.firingTriggerId ?? [],
  }))
}

// ─── Publish ─────────────────────────────────────────────────────────────────

// Tags/gatilhos criados ficam só no workspace até publicar — sem isso não
// disparam no site do cliente.
export async function publishGTMWorkspace(tenantId: string, versionName?: string) {
  const { accountId, containerId, accessToken } = await getActiveContainer(tenantId)
  const wsPath = await getDefaultWorkspacePath(accessToken, accountId, containerId)
  const created = await gtmPost(`/${wsPath}:create_version`, accessToken, {
    name: versionName ?? `Publicado via GTPRO em ${new Date().toISOString().slice(0, 10)}`,
  })
  const containerVersion = created.containerVersion
  if (!containerVersion) throw new Error("Falha ao criar versão do GTM — verifique se há mudanças pendentes no workspace.")
  await gtmPost(`/accounts/${accountId}/containers/${containerId}/versions/${containerVersion.containerVersionId}:publish`, accessToken, {})
  return { published: true, versionId: containerVersion.containerVersionId }
}
