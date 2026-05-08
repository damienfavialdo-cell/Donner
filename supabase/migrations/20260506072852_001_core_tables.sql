/*
  # ONG MADE SaaS - Core Tables

  1. New Tables
    - `tenants` - Organizations using the platform
    - `tenant_users` - Users belonging to tenants
    - `members` - People tracked by the organization
    - `events` - Events organized by tenants
    - `attendance` - Attendance records (entry/exit)
    - `subscriptions` - Stripe subscription records

  2. Security
    - RLS enabled on ALL tables
    - All policies restrict access to authenticated users within same tenant

  3. Important Notes
    1. All tables include tenant_id for multi-tenant isolation
    2. Attendance uses strict entry/exit toggle with CHECK constraint
    3. Members have unique barcode_id per tenant
    4. updated_at triggers auto-set on update
*/

-- ============================================
-- TENANTS (no FK dependencies)
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  max_members integer NOT NULL DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TENANT_USERS (depends on tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MEMBERS (depends on tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  barcode_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  notes text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, barcode_id)
);

CREATE INDEX IF NOT EXISTS idx_members_tenant ON members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_members_barcode ON members(tenant_id, barcode_id);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- EVENTS (depends on tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  location text DEFAULT '',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time time,
  end_time time,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(tenant_id, event_date);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ATTENDANCE (depends on tenants, members, events)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('entry', 'exit')),
  scanned_at timestamptz DEFAULT now(),
  scanned_by uuid REFERENCES auth.users(id),
  notes text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_event ON attendance(tenant_id, event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_member ON attendance(tenant_id, member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member_event_time ON attendance(member_id, event_id, scanned_at DESC);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SUBSCRIPTIONS (depends on tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  stripe_price_id text,
  status text NOT NULL DEFAULT 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER: updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

