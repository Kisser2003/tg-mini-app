-- Storage upsert (x-upsert: true) requires SELECT on existing objects in addition to
-- INSERT/UPDATE. Broad SELECT policies were removed in 20260421153000; without SELECT,
-- uploads fail with "new row violates row-level security policy".
-- Scoped to the app’s public asset buckets only.

BEGIN;

DROP POLICY IF EXISTS storage_select_public_buckets ON storage.objects;

CREATE POLICY storage_select_public_buckets ON storage.objects
  FOR SELECT
  USING (bucket_id IN ('artwork', 'audio', 'releases'));

COMMIT;
