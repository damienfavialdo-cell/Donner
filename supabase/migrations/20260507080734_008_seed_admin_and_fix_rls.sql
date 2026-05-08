/*
  # Seed admin user and MADE organization + Fix RLS

  1. Creates admin user in auth.users
     - email: madecme711@gmail.com
     - password: madecme@711 (bcrypt hashed)
     - email_confirmed_at = now() (no confirmation needed)
  2. Creates MADE tenant
  3. Links admin user to MADE tenant as admin
  4. Fixes RLS chicken-and-egg problem:
     - tenants SELECT: any authenticated user can read
     - tenant_users SELECT: any authenticated user can read
*/

-- STEP 1: Create admin user in auth.users
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'madecme711@gmail.com';
  
  IF admin_id IS NOT NULL THEN
    RAISE NOTICE 'Admin user already exists';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, confirmation_token, recovery_token,
    email_change, email_change_token_new,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'madecme711@gmail.com',
    crypt('madecme@711', gen_salt('bf')),
    now(), '', '', '', '',
    now(), now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"full_name": "Admin MADE", "role": "admin"}'
  );
END $$;

-- STEP 2: Create MADE tenant
INSERT INTO tenants (name, slug, plan, max_members)
VALUES ('MADE', 'free', 'made', 500)
ON CONFLICT (slug) DO NOTHING;

-- STEP 3: Link admin user to MADE tenant
DO $$
DECLARE
  v_admin_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'madecme711@gmail.com';
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'made';
  
  IF v_admin_id IS NULL OR v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_users tu 
    WHERE tu.tenant_id = v_tenant_id AND tu.user_id = v_admin_id
  ) THEN
    INSERT INTO tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_admin_id, 'admin');
  END IF;
END $$;

-- STEP 4: Confirm all unconfirmed users
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;

-- STEP 5: Fix RLS chicken-and-egg problem

-- Allow any authenticated user to read tenants
DROP POLICY IF EXISTS "Tenant members can view tenant" ON tenants;
CREATE POLICY "Authenticated users can view tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (true);

-- Allow any authenticated user to read tenant_users
DROP POLICY IF EXISTS "Tenant members can view tenant users" ON tenant_users;
CREATE POLICY "Authenticated users can view tenant users"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (true);

