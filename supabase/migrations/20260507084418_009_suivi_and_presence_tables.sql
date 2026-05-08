/*
  # Add suivi (tracking) and presence tables, fix attendance constraints

  1. New Tables
    - `suivi_personnel` - Staff tracking (contract, salary, position)
    - `suivi_mere` - Mother tracking (prenatal, postnatal)
    - `suivi_enfant` - Child tracking (growth, education)
    - `suivi_beneficiaire` - Beneficiary tracking (aid, programs)
    - `suivi_salaire` - Salary tracking (amount, payment date, status)
    - `suivi_medicament` - Medication tracking (drug, dosage, frequency)
    - `suivi_cantine` - Cantine tracking (meal count, nutrition)
    - `suivi_gargote` - Gargote tracking (activity, participation)
    - `presence` - Daily presence (present/absent/retard with date/group)

  2. Modified Tables
    - `attendance` - Make member_id nullable (person_id-only records allowed)
    - `persons` - Add salary, position, contract fields for staff

  3. Security
    - Enable RLS on all new tables
    - Admin-only INSERT/UPDATE/DELETE
    - Tenant member SELECT
*/

-- ============================================
-- Fix attendance: allow person_id-only records
-- ============================================
ALTER TABLE attendance ALTER COLUMN member_id DROP NOT NULL;

-- ============================================
-- Add staff fields to persons
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'persons' AND column_name = 'salary'
  ) THEN
    ALTER TABLE persons ADD COLUMN salary numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'persons' AND column_name = 'position'
  ) THEN
    ALTER TABLE persons ADD COLUMN position text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'persons' AND column_name = 'contract_type'
  ) THEN
    ALTER TABLE persons ADD COLUMN contract_type text DEFAULT '';
  END IF;
END $$;

-- ============================================
-- Suivi Personnel (staff tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  position text DEFAULT '',
  department text DEFAULT '',
  contract_type text DEFAULT '',
  contract_start date,
  contract_end date,
  salary numeric DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_personnel"
  ON suivi_personnel FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_personnel"
  ON suivi_personnel FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_personnel"
  ON suivi_personnel FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_personnel"
  ON suivi_personnel FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Suivi Mere (mother tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_mere (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  prenatal_date date,
  postnatal_date date,
  number_of_children integer DEFAULT 0,
  health_status text DEFAULT '',
  support_type text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_mere ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_mere"
  ON suivi_mere FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_mere"
  ON suivi_mere FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_mere"
  ON suivi_mere FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_mere"
  ON suivi_mere FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Suivi Enfant (child tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_enfant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  school_level text DEFAULT '',
  health_status text DEFAULT '',
  nutrition_status text DEFAULT '',
  guardian_name text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_enfant ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_enfant"
  ON suivi_enfant FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_enfant"
  ON suivi_enfant FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_enfant"
  ON suivi_enfant FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_enfant"
  ON suivi_enfant FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Suivi Beneficiaire (beneficiary tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_beneficiaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  program text DEFAULT '',
  aid_type text DEFAULT '',
  amount numeric DEFAULT 0,
  start_date date,
  end_date date,
  status text DEFAULT 'active',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_beneficiaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_beneficiaire"
  ON suivi_beneficiaire FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_beneficiaire"
  ON suivi_beneficiaire FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_beneficiaire"
  ON suivi_beneficiaire FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_beneficiaire"
  ON suivi_beneficiaire FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Suivi Salaire (salary tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_salaire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  amount numeric DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  status text DEFAULT 'pending',
  month text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_salaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_salaire"
  ON suivi_salaire FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_salaire"
  ON suivi_salaire FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_salaire"
  ON suivi_salaire FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_salaire"
  ON suivi_salaire FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Suivi Medicament (medication tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_medicament (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  medication_name text DEFAULT '',
  dosage text DEFAULT '',
  frequency text DEFAULT '',
  start_date date,
  end_date date,
  prescribed_by text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_medicament ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_medicament"
  ON suivi_medicament FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_medicament"
  ON suivi_medicament FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_medicament"
  ON suivi_medicament FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_medicament"
  ON suivi_medicament FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Suivi Cantine (cantine tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_cantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  meal_count integer DEFAULT 0,
  nutrition_status text DEFAULT '',
  meal_type text DEFAULT 'lunch',
  tracking_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_cantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_cantine"
  ON suivi_cantine FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_cantine"
  ON suivi_cantine FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_cantine"
  ON suivi_cantine FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_cantine"
  ON suivi_cantine FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Suivi Gargote (gargote tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS suivi_gargote (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  activity text DEFAULT '',
  participation_count integer DEFAULT 0,
  tracking_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE suivi_gargote ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view suivi_gargote"
  ON suivi_gargote FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert suivi_gargote"
  ON suivi_gargote FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update suivi_gargote"
  ON suivi_gargote FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete suivi_gargote"
  ON suivi_gargote FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Presence (daily attendance with status)
-- ============================================
CREATE TABLE IF NOT EXISTS presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  event_id uuid REFERENCES events(id),
  status text NOT NULL DEFAULT 'present',
  group_name text DEFAULT '',
  presence_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view presence"
  ON presence FOR SELECT TO authenticated USING (is_tenant_member(tenant_id));
CREATE POLICY "Tenant admins can insert presence"
  ON presence FOR INSERT TO authenticated WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can update presence"
  ON presence FOR UPDATE TO authenticated USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));
CREATE POLICY "Tenant admins can delete presence"
  ON presence FOR DELETE TO authenticated USING (is_tenant_admin(tenant_id));

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suivi_personnel_tenant ON suivi_personnel(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivi_personnel_person ON suivi_personnel(person_id);
CREATE INDEX IF NOT EXISTS idx_suivi_mere_tenant ON suivi_mere(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivi_enfant_tenant ON suivi_enfant(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivi_beneficiaire_tenant ON suivi_beneficiaire(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivi_salaire_tenant ON suivi_salaire(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivi_medicament_tenant ON suivi_medicament(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivi_cantine_tenant ON suivi_cantine(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suivi_gargote_tenant ON suivi_gargote(tenant_id);
CREATE INDEX IF NOT EXISTS idx_presence_tenant ON presence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_presence_date ON presence(presence_date);
CREATE INDEX IF NOT EXISTS idx_presence_person ON presence(person_id);

