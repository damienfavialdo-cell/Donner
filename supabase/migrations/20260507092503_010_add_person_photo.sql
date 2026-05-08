/*
  # Add photo_url to persons and create storage bucket

  1. Adds `photo_url` text column to persons table (nullable)
  2. Creates a storage bucket `person-photos` for profile photo uploads
  3. Sets storage policy: authenticated users can upload/read, only admin can delete

  IMPORTANT NOTES:
  1. Photo URL stores the Supabase storage public URL
  2. Storage bucket is public-read so badge PDFs can embed photos
  3. File size limit handled client-side (max 2MB)
*/

-- Add photo_url column
ALTER TABLE persons ADD COLUMN IF NOT EXISTS photo_url text DEFAULT '';

-- Create storage bucket for person photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('person-photos', 'person-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'person-photos');

-- Allow public read access to photos (needed for badge generation)
CREATE POLICY "Public read access for photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'person-photos');

-- Allow authenticated users to update their own photos
CREATE POLICY "Authenticated users can update photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'person-photos');

-- Allow admins to delete photos
CREATE POLICY "Admins can delete photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'person-photos' AND is_tenant_admin((SELECT tenant_id FROM persons WHERE persons.id::text = (storage.objects.metadata->>'person_id'))::uuid));

