-- Asaas API key in platform_settings
INSERT INTO platform_settings (key, value_encrypted) VALUES
  ('asaas_api_key', ''),
  ('asaas_sandbox', 'false')
ON CONFLICT (key) DO NOTHING;

-- Boletos/charges gerados via agente
CREATE TABLE IF NOT EXISTS asaas_charges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  asaas_id        text NOT NULL,
  customer_name   text,
  customer_phone  text,
  description     text,
  value           numeric(12, 2) NOT NULL,
  due_date        date NOT NULL,
  billing_type    text NOT NULL DEFAULT 'BOLETO',
  status          text NOT NULL DEFAULT 'PENDING',
  payment_link    text,
  barcode         text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS asaas_charges_tenant ON asaas_charges(tenant_id);

ALTER TABLE asaas_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY asaas_charges_tenant ON asaas_charges
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
  ));
