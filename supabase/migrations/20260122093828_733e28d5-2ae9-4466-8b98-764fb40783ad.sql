-- Move extensions out of public schema into a dedicated schema (recommended by linter)
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  ext RECORD;
BEGIN
  FOR ext IN
    SELECT e.extname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE n.nspname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions;', ext.extname);
    EXCEPTION WHEN OTHERS THEN
      -- Some extensions cannot be moved; ignore and continue.
      RAISE NOTICE 'Could not move extension %: %', ext.extname, SQLERRM;
    END;
  END LOOP;
END $$;
