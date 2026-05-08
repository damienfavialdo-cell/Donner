/*
  # Fix tenant_users INSERT policy for self-registration

  1. Problem
    - The current INSERT policy on tenant_users requires the user to already be an admin
      in the tenant, which makes self-registration impossible.
    - A new user signing up has no tenant_users entry, so they can't insert their own row.

  2. Fix
    - Drop the restrictive INSERT policy
    - Add a new policy that allows:
      a) Existing admins to insert any user into their tenant
      b) A user to insert their own row (self-registration) if they are the one creating it
    - The WITH CHECK ensures:
      - user_id matches auth.uid() (can only add yourself during registration)
      - OR the user is already an admin/owner in the tenant

  3. Security
    - A user can only add themselves, not arbitrary users
    - Existing admins can still add other users
    - No unauthenticated access
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Tenant admins can insert users" ON tenant_users;

-- New policy: allow self-registration OR admin insertion
CREATE POLICY "Users can self-register or admins can insert users"
  ON tenant_users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Self-registration: user can only insert a row where user_id is their own
    user_id = auth.uid()
    OR
    -- Admin insertion: existing admin can add other users to their tenant
    EXISTS (
      SELECT 1 FROM tenant_users tu
      WHERE tu.tenant_id = tenant_users.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('owner', 'admin')
    )
  );

