import { createServiceClient } from "./supabase"
import { getSetting } from "./platform"

async function getAsaasConfig() {
  const [apiKey, sandboxRaw] = await Promise.all([
    getSetting("asaas_api_key"),
    getSetting("asaas_sandbox"),
  ])
  const sandbox  = sandboxRaw === "true"
  const baseUrl  = sandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3"
  return { apiKey, baseUrl }
}

async function asaasRequest(path: string, method: string, body?: unknown) {
  const { apiKey, baseUrl } = await getAsaasConfig()
  if (!apiKey) throw new Error("Asaas API key não configurada. Adicione em Configurações → Plataforma.")
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.errors?.[0]?.description ?? data?.description ?? `Asaas error ${res.status}`)
  return data
}

export interface AsaasChargeInput {
  customer_name:   string
  customer_phone:  string
  customer_cpf?:   string
  description:     string
  value:           number
  due_date:        string   // YYYY-MM-DD
  billing_type?:   "BOLETO" | "PIX" | "CREDIT_CARD"
  external_ref?:   string
}

export async function createAsaasCharge(tenantId: string, input: AsaasChargeInput) {
  const supabase = createServiceClient()
  const billingType = input.billing_type ?? "BOLETO"

  // Upsert customer
  const customers = await asaasRequest(
    `/customers?name=${encodeURIComponent(input.customer_name)}&mobilePhone=${encodeURIComponent(input.customer_phone.replace(/\D/g, ""))}`,
    "GET"
  )
  let customerId: string

  if (customers?.data?.length) {
    customerId = customers.data[0].id
  } else {
    const newCustomer = await asaasRequest("/customers", "POST", {
      name:        input.customer_name,
      mobilePhone: input.customer_phone.replace(/\D/g, ""),
      cpfCnpj:     input.customer_cpf?.replace(/\D/g, "") ?? undefined,
    })
    customerId = newCustomer.id
  }

  // Create charge
  const charge = await asaasRequest("/payments", "POST", {
    customer:    customerId,
    billingType,
    value:       input.value,
    dueDate:     input.due_date,
    description: input.description,
    externalReference: input.external_ref ?? undefined,
  })

  // Persist to DB
  const row: any = {
    tenant_id:      tenantId,
    asaas_id:       charge.id,
    customer_name:  input.customer_name,
    customer_phone: input.customer_phone,
    description:    input.description,
    value:          input.value,
    due_date:       input.due_date,
    billing_type:   billingType,
    status:         charge.status ?? "PENDING",
    payment_link:   charge.invoiceUrl ?? null,
    barcode:        charge.bankSlipUrl ?? charge.pixQrCodeUrl ?? null,
  }
  await supabase.from("asaas_charges").insert(row)

  return {
    id:           charge.id,
    status:       charge.status,
    billing_type: billingType,
    value:        input.value,
    due_date:     input.due_date,
    invoice_url:  charge.invoiceUrl ?? null,
    barcode_url:  charge.bankSlipUrl ?? null,
    pix_url:      charge.pixQrCodeUrl ?? null,
    message: billingType === "PIX"
      ? `Cobrança PIX criada. Link: ${charge.invoiceUrl ?? charge.pixQrCodeUrl}`
      : `Boleto criado. Link: ${charge.invoiceUrl ?? charge.bankSlipUrl}`,
  }
}

export async function getAsaasCharges(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("asaas_charges")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50)
  return data ?? []
}
