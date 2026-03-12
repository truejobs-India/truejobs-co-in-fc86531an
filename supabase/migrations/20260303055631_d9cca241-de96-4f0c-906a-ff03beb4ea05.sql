
CREATE OR REPLACE FUNCTION public.classify_unclassified_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  govt_count INT := 0;
  private_count INT := 0;
  remaining INT := 0;
BEGIN
  -- 1. Strong govt org acronyms in company_name or title
  UPDATE public.jobs
  SET job_sector = 'government', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND (
      company_name ~* '\m(upsc|ssc|railway|rrb|psu|nvs|kvs|drdo|isro|aiims|bsnl|ongc|bhel|hal|sail|ntpc|nhai|dvc|bisag|fci|lic|gic|epfo|esic|icar|csir|icmr|barc|npcil|pgcil|nhpc|gail|iocl|hpcl|bpcl|mdl|grse|ecil|mecon|eil|ircon|rites|railtel|dmrc|cmrl|bmrc|mmrc|nmrc|ignou|crpf|cisf|itbp|cpwd|dsssb|sbi|rbi|nabard|sidbi|idbi|sebi|uidai|aai|dgca|ksssci|kpsc|ppsc|mpsc|rpsc|hpsc|jpsc|bpsc|ukpsc|wbpsc|tnpsc|appsc|tspsc|gpsc|mppsc|cgpsc|opsc|uppsc)\M'
      OR title ~* '\m(upsc|ssc|railway|rrb|psu|nvs|kvs|drdo|isro|aiims|bsnl|ongc|bhel|hal|sail|ntpc|nhai|dvc|bisag|fci|lic|gic|epfo|esic|icar|csir|icmr|barc|npcil|pgcil|nhpc|gail|iocl|hpcl|bpcl|mdl|grse|ecil|mecon|eil|ircon|rites|railtel|dmrc|cmrl|bmrc|mmrc|nmrc|ignou|crpf|cisf|itbp|cpwd|dsssb|sbi|rbi|nabard|sidbi|idbi|sebi|uidai|aai|dgca|ksssci|kpsc|ppsc|mpsc|rpsc|hpsc|jpsc|bpsc|ukpsc|wbpsc|tnpsc|appsc|tspsc|gpsc|mppsc|cgpsc|opsc|uppsc)\M'
    );
  GET DIAGNOSTICS govt_count = ROW_COUNT;

  -- 2. Govt org full names in company_name or title
  UPDATE public.jobs
  SET job_sector = 'government', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND (
      company_name ~* '(public service commission|cantonment board|ordnance factory|kendriya vidyalaya|navodaya|sainik school|coast guard|armed forces|high court|district court|supreme court|border security|territorial army|central university|zilla parishad|gram panchayat|airport authority|bank of baroda|bank of india|bank of maharashtra|canara bank|punjab national bank|union bank|indian bank|uco bank|central bank|indian overseas bank|damodar valley|karnataka.*commission|municipal corporation|panchayat|municipality|cantonment)'
      OR title ~* '(public service commission|cantonment board|ordnance factory|kendriya vidyalaya|navodaya|sainik school|coast guard|armed forces|high court|district court|supreme court|border security|territorial army|central university|zilla parishad|gram panchayat|airport authority|bank of baroda|bank of india|bank of maharashtra|canara bank|punjab national bank|union bank|indian bank|uco bank|central bank|indian overseas bank|damodar valley|karnataka.*commission|municipal corporation)'
    );
  govt_count := govt_count + (SELECT ROW_COUNT FROM (SELECT 1) x WHERE false IS NOT true);
  -- Postgres resets ROW_COUNT so we accumulate via a workaround:
  -- Actually, let's just get the final counts at the end.

  -- 3. Broad govt signals (bank/police/authority etc.) + job signals (recruitment/vacancy/posts etc.)
  UPDATE public.jobs
  SET job_sector = 'government', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND (title || ' ' || coalesce(company_name, '')) ~* '\m(bank|police|defence|defense|commission|authority|board|department|ministry|directorate|university|college|hospital)\M'
    AND (title || ' ' || coalesce(company_name, '')) ~* '\m(recruitment|vacancy|bharti|notification|apply online|walk.?in|posts|apprentice|clerk|constable|sub inspector|inspector|officer|technician|junior research fellow|lekhpal|patwari|stenographer|overman)\M';

  -- 4. Known private companies by name
  UPDATE public.jobs
  SET job_sector = 'private', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND company_name ~* '\m(meesho|flipkart|amazon|google|microsoft|meta|facebook|apple|netflix|uber|ola|swiggy|zomato|paytm|phonepe|razorpay|cred|byju|unacademy|vedantu|dream.?sports|dream.?11|groww|zerodha|nykaa|myntra|jio|airtel|planetspark|udemy|coursera|fractal|welocalize|jobgether|atlassian|freshworks|zoho|infosys|tcs|wipro|hcl|tech mahindra|cognizant|accenture|capgemini|deloitte|kpmg|pwc|mckinsey|bcg|bain|honeywell|unilever|zoom|nium|boomi|granica|edureka|sigma6|fancode|fortis|vinsol|reliance|mahindra|tata|adani|hero|bajaj|godrej|larsen|vedanta|aditya birla|genpact|mindtree|mphasis|persistent|ltimindtree|coforge|niit|hexaware|cyient|zensar|birlasoft|sonata|newgen|mastek|happiest minds|bristlecone)\M';

  -- 5. Private suffix patterns in company_name
  UPDATE public.jobs
  SET job_sector = 'private', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND company_name ~* '\m(pvt|ltd|private|inc|startup|mnc|solutions|technologies|consulting|infotech|techno|limited|llp|llc|ventures|labs)\M';

  -- Get final counts
  SELECT COUNT(*) INTO remaining FROM public.jobs WHERE job_sector = 'unclassified' AND is_deleted = false;
  
  -- Calculate what we classified
  SELECT 
    COUNT(*) FILTER (WHERE job_sector = 'government') INTO govt_count 
  FROM public.jobs WHERE is_deleted = false;
  
  SELECT 
    COUNT(*) FILTER (WHERE job_sector = 'private') INTO private_count 
  FROM public.jobs WHERE is_deleted = false;

  RETURN jsonb_build_object(
    'success', true,
    'government_total', govt_count,
    'private_total', private_count,
    'remaining_unclassified', remaining
  );
END;
$$;
