/*
  # Fix tenants INSERT policy for self-registration

  1. Problem
    - There is NO INSERT policy on the tenants table.
    - A new user signing up cannot create an organization.
    - The sign-up flow fails at the tenants.insert() step.

  2. Fix
    - Add an INSERT policy allowing any authenticated user to create a tenant.
    - This is safe because:
      - Only authenticated users can insert
      - The tenant is just a name/slug record with no sensitive data
      - The user must then create a tenant_users entry to actually access it
      - The tenant_users INSERT policy (fixed in 003) controls who can link to the tenant

  3. Security
    - Only authenticated users can create tenants
    - Creating a tenant doesn't grant access to other tenants
    - Access is still controlled by tenant_users membership
*/

CREATE POLICY "Authenticated users can create tenants"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

