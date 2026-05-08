/*
  # ONG MADE SaaS - RLS Policies

  1. Security
    - All tables have restrictive RLS policies
    - Access is scoped to authenticated users within the same tenant
    - Admin/owner roles get elevated permissions (insert, update, delete)
    - Scanner role can insert attendance and members
    - Regular members can only read

  2. Policy Design
    - SELECT: Any authenticated user in the tenant can read
    - INSERT: Only owner/admin/scanner roles (or owner/admin for events, members)
    - UPDATE: Only owner/admin roles
    - DELETE: Only owner/admin roles
    - All policies check tenant membership via tenant_users table
*/

-- ============================================
-- TENANTS policies
-- ============================================
CREATE POLICY "Tenant users can view their tenant"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = tenants.id
      AND tenant_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can update their tenant"
  ON tenants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = tenants.id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = tenants.id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- TENANT_USERS policies
-- ============================================
CREATE POLICY "Users can view users in their tenant"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
      AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can insert users"
  ON tenant_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can update user roles"
  ON tenant_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can delete users"
  ON tenant_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- MEMBERS policies
-- ============================================
CREATE POLICY "Tenant users can view members"
  ON members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = members.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins and scanners can insert members"
  ON members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = members.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin', 'scanner')
    )
  );

CREATE POLICY "Tenant admins can update members"
  ON members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = members.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = members.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can delete members"
  ON members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = members.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- EVENTS policies
-- ============================================
CREATE POLICY "Tenant users can view events"
  ON events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = events.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = events.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = events.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = events.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = events.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- ATTENDANCE policies
-- ============================================
CREATE POLICY "Tenant users can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = attendance.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant users can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = attendance.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin', 'scanner')
    )
  );

CREATE POLICY "Tenant admins can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = attendance.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = attendance.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = attendance.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- SUBSCRIPTIONS policies
-- ============================================
CREATE POLICY "Tenant users can view subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = subscriptions.tenant_id
      AND tenant_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Tenant admins can insert subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = subscriptions.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Tenant admins can update subscriptions"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = subscriptions.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenant_users
      WHERE tenant_users.tenant_id = subscriptions.tenant_id
      AND tenant_users.user_id = auth.uid()
      AND tenant_users.role IN ('owner', 'admin')
    )
  );

