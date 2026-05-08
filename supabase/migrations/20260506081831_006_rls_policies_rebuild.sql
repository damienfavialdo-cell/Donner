/*
  # RLS policies for all new tables

  1. persons table
    - SELECT: tenant members can view
    - INSERT: tenant admins can insert
    - UPDATE: tenant admins can update
    - DELETE: tenant admins can hard-delete

  2. badges table
    - SELECT: tenant members can view
    - INSERT: tenant admins can insert
    - UPDATE: tenant admins can update
    - DELETE: tenant admins can delete

  3. notifications table
    - SELECT: user can view own notifications
    - INSERT: tenant admins can insert
    - UPDATE: user can mark own as read
    - DELETE: user can delete own

  4. reports table
    - SELECT: tenant members can view
    - INSERT: tenant admins can insert
    - UPDATE: tenant admins can update
    - DELETE: tenant admins can delete

  5. event_participants table
    - SELECT: tenant members can view
    - INSERT: tenant admins can insert
    - UPDATE: tenant admins can update
    - DELETE: tenant admins can delete

  6. attendance table - fix existing policies for person_id support
*/

-- Helper function to check if user is tenant member
CREATE OR REPLACE FUNCTION is_tenant_member(tid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = tid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check if user is tenant admin
CREATE OR REPLACE FUNCTION is_tenant_admin(tid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = tid AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== PERSONS =====
CREATE POLICY "Tenant members can view persons" ON persons
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert persons" ON persons
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update persons" ON persons
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete persons" ON persons
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== BADGES =====
CREATE POLICY "Tenant members can view badges" ON badges
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert badges" ON badges
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update badges" ON badges
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete badges" ON badges
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== NOTIFICATIONS =====
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Tenant admins can insert notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===== REPORTS =====
CREATE POLICY "Tenant members can view reports" ON reports
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert reports" ON reports
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update reports" ON reports
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete reports" ON reports
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== EVENT PARTICIPANTS =====
CREATE POLICY "Tenant members can view event participants" ON event_participants
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert event participants" ON event_participants
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete event participants" ON event_participants
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== FIX EXISTING ATTENDANCE POLICIES =====
-- Drop old policies and recreate with helper functions
DROP POLICY IF EXISTS "Tenant users can view attendance" ON attendance;
DROP POLICY IF EXISTS "Tenant admins can insert attendance" ON attendance;
DROP POLICY IF EXISTS "Tenant admins can update attendance" ON attendance;
DROP POLICY IF EXISTS "Tenant admins can delete attendance" ON attendance;

CREATE POLICY "Tenant members can view attendance" ON attendance
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert attendance" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update attendance" ON attendance
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete attendance" ON attendance
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== FIX EXISTING MEMBERS POLICIES =====
DROP POLICY IF EXISTS "Tenant users can view members" ON members;
DROP POLICY IF EXISTS "Tenant admins can insert members" ON members;
DROP POLICY IF EXISTS "Tenant admins can update members" ON members;
DROP POLICY IF EXISTS "Tenant admins can delete members" ON members;

CREATE POLICY "Tenant members can view members" ON members
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert members" ON members
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update members" ON members
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete members" ON members
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== FIX EXISTING EVENTS POLICIES =====
DROP POLICY IF EXISTS "Tenant users can view events" ON events;
DROP POLICY IF EXISTS "Tenant admins can insert events" ON events;
DROP POLICY IF EXISTS "Tenant admins can update events" ON events;
DROP POLICY IF EXISTS "Tenant admins can delete events" ON events;

CREATE POLICY "Tenant members can view events" ON events
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Tenant admins can insert events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can update events" ON events
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete events" ON events
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== FIX TENANT_USERS POLICIES =====
DROP POLICY IF EXISTS "Users can view users in their tenant" ON tenant_users;
DROP POLICY IF EXISTS "Tenant admins can update user roles" ON tenant_users;
DROP POLICY IF EXISTS "Tenant admins can delete users" ON tenant_users;
DROP POLICY IF EXISTS "Users can self-register or admins can insert users" ON tenant_users;

CREATE POLICY "Tenant members can view tenant users" ON tenant_users
  FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id));

CREATE POLICY "Users can self-register or admins can insert" ON tenant_users
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_tenant_admin(tenant_id)
  );

CREATE POLICY "Tenant admins can update tenant users" ON tenant_users
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(tenant_id))
  WITH CHECK (is_tenant_admin(tenant_id));

CREATE POLICY "Tenant admins can delete tenant users" ON tenant_users
  FOR DELETE TO authenticated
  USING (is_tenant_admin(tenant_id));

-- ===== FIX TENANTS POLICIES =====
DROP POLICY IF EXISTS "Tenant users can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Tenant admins can update their tenant" ON tenants;
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON tenants;

CREATE POLICY "Tenant members can view tenant" ON tenants
  FOR SELECT TO authenticated
  USING (is_tenant_member(id));

CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Tenant admins can update tenant" ON tenants
  FOR UPDATE TO authenticated
  USING (is_tenant_admin(id))
  WITH CHECK (is_tenant_admin(id));

