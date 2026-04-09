CREATE OR REPLACE FUNCTION public.block_orphan_scraped_inserts()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.source = 'scraped' AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Scraped jobs must have a company_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_orphan_scraped ON public.jobs;
CREATE TRIGGER trg_block_orphan_scraped
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.block_orphan_scraped_inserts();