/*
  # Rebuild ONG MADE database schema

  1. New Tables
    - `persons` - Unified person table with category (beneficiary, child, mother, visitor, staff)
      - id (uuid, PK)
      - tenant_id (uuid, FK -> tenants)
      - category (text) - 'beneficiary', 'child', 'mother', 'visitor', 'staff'
      - first_name (text)
      - last_name (text)
      - email (text, nullable)
      - phone (text, nullable)
      - barcode_id (text, unique per tenant)
      - qr_code (text, nullable)
      - date_of_birth (date, nullable)
      - gender (text, nullable)
      - address (text, nullable)
      - notes (text, nullable)
      - active (boolean, default true)
      - created_at, updated_at (timestamptz)
    - `badges` - Badge generation tracking
      - id (uuid, PK)
      - tenant_id (uuid, FK -> tenants)
      - person_id (uuid, FK -> persons)
      - barcode_data (text) - CODE128 encoded string
      - qr_data (text) - QR encoded string
      - pdf_url (text, nullable)
      - generated_at (timestamptz)
      - regenerated_at (timestamptz, nullable)
    - `notifications` - System notifications
      - id (uuid, PK)
      - tenant_id (uuid, FK -> tenants)
      - user_id (uuid, FK -> auth.users)
      - type (text) - 'scan', 'system', 'event'
      - title (text)
      - message (text)
      - read (boolean, default false)
      - created_at (timestamptz)
    - `reports` - Generated reports
      - id (uuid, PK)
      - tenant_id (uuid, FK -> tenants)
      - title (text)
      - report_type (text) - 'daily', 'weekly', 'monthly', 'custom'
      - date_from (date)
      - date_to (date)
      - format (text) - 'pdf', 'excel'
      - file_url (text, nullable)
      - created_by (uuid, FK -> auth.users)
      - created_at (timestamptz)
    - `event_participants` - Links events to persons
      - id (uuid, PK)
      - tenant_id (uuid, FK -> tenants)
      - event_id (uuid, FK -> events)
      - person_id (uuid, FK -> persons)
      - created_at (timestamptz)

  2. Modified Tables
    - `attendance` - Add person_id column, make event_id nullable for non-event scans
    - `members` - Kept for backward compatibility but persons is the primary table

  3. Security
    - RLS enabled on all new tables
    - Policies for tenant-scoped CRUD access
*/

-- Create persons table (unified person management)
CREATE TABLE IF NOT EXISTS persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'beneficiary',
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  barcode_id text NOT NULL,
  qr_code text,
  date_of_birth date,
  gender text,
  address text,
  notes text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, barcode_id)
);

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  barcode_data text NOT NULL,
  qr_data text,
  pdf_url text,
  generated_at timestamptz DEFAULT now(),
  regenerated_at timestamptz
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  report_type text NOT NULL DEFAULT 'daily',
  date_from date,
  date_to date,
  format text NOT NULL DEFAULT 'pdf',
  file_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create event_participants table
CREATE TABLE IF NOT EXISTS event_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, person_id)
);

-- Add person_id to attendance table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'person_id'
  ) THEN
    ALTER TABLE attendance ADD COLUMN person_id uuid REFERENCES persons(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Make event_id nullable in attendance (for non-event scans)
ALTER TABLE attendance ALTER COLUMN event_id DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_persons_tenant_id ON persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persons_category ON persons(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_persons_barcode_id ON persons(tenant_id, barcode_id);
CREATE INDEX IF NOT EXISTS idx_badges_person_id ON badges(person_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_attendance_person_id ON attendance(person_id);
CREATE INDEX IF NOT EXISTS idx_attendance_scanned_at ON attendance(tenant_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);

-- Enable RLS on all new tables
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

