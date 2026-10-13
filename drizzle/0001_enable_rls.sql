-- Defense in depth for Supabase: its auto-generated public REST API uses the
-- "anon" and "authenticated" roles. Enabling RLS with no policies means those
-- roles can read nothing. The app connects as the database owner over
-- DATABASE_URL (which bypasses RLS) and enforces tenant isolation in code.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
