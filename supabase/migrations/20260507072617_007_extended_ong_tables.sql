/*
  # Add ONG MADE extended tables

  1. New Tables
    - `cantine_logs` - Cantine meal tracking
      - id, tenant_id, person_id, meal_type, meal_date, notes, created_by, created_at
    - `gargote_logs` - Gargote participation tracking
      - id, tenant_id, person_id, participation_date, notes, created_by, created_at
    - `medical_records` - Medical follow-up records
      - id, tenant_id, person_id, visit_date, diagnosis, treatment, prescription, doctor_name, notes, created_by, created_at
    - `audit_logs` - Audit trail for all data changes
      - id, tenant_id, user_id, action, table_name, record_id, old_data (jsonb), new_data (jsonb), created_at

  2. Security
    - RLS enabled on all tables
    - Tenant-scoped access policies
*/

-- Cantine logs
CREATE TABLE IF NOT EXISTS cantine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  meal_type text NOT NULL DEFAULT 'lunch',
  meal_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Gargote logs
CREATE TABLE IF NOT EXISTS gargote_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  participation_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Medical records
CREATE TABLE IF NOT EXISTS medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  diagnosis text DEFAULT '',
  treatment text DEFAULT '',
  prescription text DEFAULT '',
  doctor_name text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cantine_logs_tenant ON cantine_logs(tenant_id, meal_date DESC);
CREATE INDEX IF NOT EXISTS idx_gargote_logs_tenant ON gargote_logs(tenant_id, participation_date DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_person ON medical_records(person_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE cantine_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gargote_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant members can view cantine" ON cantine_logs FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert cantine" ON cantine_logs FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete cantine" ON cantine_logs FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant members can view gargote" ON gargote_logs FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert gargote" ON gargote_logs FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete gargote" ON gargote_logs FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant members can view medical" ON medical_records FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert medical" ON medical_records FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update medical" ON medical_records FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete medical" ON medical_records FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant members can view audit" ON audit_logs FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert audit" ON audit_logs FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));

