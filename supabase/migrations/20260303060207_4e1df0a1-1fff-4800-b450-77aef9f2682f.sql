CREATE OR REPLACE FUNCTION public.classify_unclassified_jobs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  before_govt INT;
  before_private INT;
  after_govt INT;
  after_private INT;
  remaining INT;
BEGIN
  -- Snapshot before
  SELECT COUNT(*) INTO before_govt FROM public.jobs WHERE job_sector = 'government' AND is_deleted = false;
  SELECT COUNT(*) INTO before_private FROM public.jobs WHERE job_sector = 'private' AND is_deleted = false;

  -- 1. Strong govt org acronyms
  UPDATE public.jobs
  SET job_sector = 'government', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND (
      company_name ~* '\m(upsc|ssc[a-z]*|railway|rrb|psu|nvs|kvs|drdo|isro|aiims|bsnl|ongc|bhel|hal|sail|ntpc|nhai|dvc|bisag|fci|lic|gic|epfo|esic|icar|csir|icmr|barc|npcil|pgcil|nhpc|gail|iocl|hpcl|bpcl|mdl|grse|ecil|mecon|eil|ircon|rites|railtel|dmrc|cmrl|bmrc|mmrc|nmrc|ignou|crpf|cisf|itbp|cpwd|dsssb|sbi|rbi|nabard|sidbi|idbi|sebi|uidai|aai|dgca|ksssci|kpsc|ppsc|mpsc|rpsc|hpsc|jpsc|bpsc|ukpsc|wbpsc|tnpsc|appsc|tspsc|gpsc|mppsc|cgpsc|opsc|uppsc|hssc|nbcc|nfr|hll|dpsa|iari|bsf|ndrf|oicl|irda|hurl|rssb|nrcd|jkssb|manuu|angrau)\M'
      OR title ~* '\m(upsc|ssc[a-z]*|railway|rrb|psu|nvs|kvs|drdo|isro|aiims|bsnl|ongc|bhel|hal|sail|ntpc|nhai|dvc|bisag|fci|lic|gic|epfo|esic|icar|csir|icmr|barc|npcil|pgcil|nhpc|gail|iocl|hpcl|bpcl|mdl|grse|ecil|mecon|eil|ircon|rites|railtel|dmrc|cmrl|bmrc|mmrc|nmrc|ignou|crpf|cisf|itbp|cpwd|dsssb|sbi|rbi|nabard|sidbi|idbi|sebi|uidai|aai|dgca|ksssci|kpsc|ppsc|mpsc|rpsc|hpsc|jpsc|bpsc|ukpsc|wbpsc|tnpsc|appsc|tspsc|gpsc|mppsc|cgpsc|opsc|uppsc|hssc|nbcc|nfr|hll|dpsa|iari|bsf|ndrf|oicl|irda|hurl|rssb|nrcd|jkssb|manuu|angrau)\M'
    );

  -- 2. Govt org full names
  UPDATE public.jobs
  SET job_sector = 'government', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND (
      company_name ~* '(public service commission|cantonment board|ordnance factory|kendriya vidyalaya|navodaya|sainik school|coast guard|armed forces|high court|district court|supreme court|border security|territorial army|central university|zilla parishad|gram panchayat|airport authority|bank of baroda|bank of india|bank of maharashtra|canara bank|punjab national bank|union bank|indian bank|uco bank|central bank|indian overseas bank|damodar valley|karnataka.*commission|municipal corporation|panchayat|municipality|cantonment|siddhartha medical|rhss|cochin port authority|uttar pradesh basic education board|national river conservation directorate|sports authority of india|bharat electronics)'
      OR title ~* '(public service commission|cantonment board|ordnance factory|kendriya vidyalaya|navodaya|sainik school|coast guard|armed forces|high court|district court|supreme court|border security|territorial army|central university|zilla parishad|gram panchayat|airport authority|bank of baroda|bank of india|bank of maharashtra|canara bank|punjab national bank|union bank|indian bank|uco bank|central bank|indian overseas bank|damodar valley|karnataka.*commission|municipal corporation|cochin port authority|education board|sports authority of india|bharat electronics|india post|gds)'
    );

  -- 3. Broad govt signals + job signals confirmation
  UPDATE public.jobs
  SET job_sector = 'government', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND (title || ' ' || coalesce(company_name, '')) ~* '\m(bank|police|defence|defense|commission|authority|board|department|ministry|directorate|university|college|hospital|port)\M'
    AND (title || ' ' || coalesce(company_name, '')) ~* '\m(recruitment|vacancy|bharti|notification|apply online|walk.?in|posts|apprentice|clerk|constable|sub inspector|inspector|officer|technician|junior research fellow|lekhpal|patwari|stenographer|overman|professor|resident|trainee)\M';

  -- 4. Known private companies
  UPDATE public.jobs
  SET job_sector = 'private', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND company_name ~* '\m(meesho|flipkart|amazon|google|microsoft|meta|facebook|apple|netflix|uber|ola|swiggy|zomato|paytm|phonepe|razorpay|cred|byju|unacademy|vedantu|dream.?sports|dream.?11|groww|zerodha|nykaa|myntra|jio|airtel|planetspark|udemy|coursera|fractal|welocalize|jobgether|atlassian|freshworks|zoho|infosys|tcs|wipro|hcl|tech mahindra|cognizant|accenture|capgemini|deloitte|kpmg|pwc|mckinsey|bcg|bain|honeywell|unilever|zoom|nium|boomi|granica|edureka|sigma6|fancode|fortis|vinsol|reliance|mahindra|tata|adani|hero|bajaj|godrej|larsen|vedanta|aditya birla|genpact|mindtree|mphasis|persistent|ltimindtree|coforge|niit|hexaware|cyient|zensar|birlasoft|sonata|newgen|mastek|happiest minds|wiz|jupiter|scaler|sharechat|crompton|general motors|the home depot|toyota|finverse|telus|intellectsoft|mercedes|ford|browserstack|netskope|nagarro|youtube|domino|databook|ukti|dreamsetgo|learnyst|urbanpro|arm|harris computer|marrina|career mantra|aida|c5i|bp|amity university|jaipur national university)\M';

  -- 5. Private suffix patterns
  UPDATE public.jobs
  SET job_sector = 'private', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND company_name ~* '\m(pvt|ltd|private|inc|startup|mnc|solutions|technologies|consulting|infotech|techno|limited|llp|llc|ventures|labs)\M';

  -- 6. Empty-company govt clues from title
  UPDATE public.jobs
  SET job_sector = 'government', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false
    AND (company_name IS NULL OR btrim(company_name) = '')
    AND title ~* '(recruitment|bharti|vacancy|notification|constable|lekhpal|assistant professor|junior resident|staff nurse|railway|rrb|ssc|upsc|bank of|state selection board|port authority|education board|police|defence|army|navy|air force|coast guard|post office|gds|sports authority|bharat electronics|iffco|manuu|jkssb|rssb|hurl|nlc)';

  -- 7. Deterministic finish: classify all leftovers as private
  UPDATE public.jobs
  SET job_sector = 'private', updated_at = now()
  WHERE job_sector = 'unclassified'
    AND is_deleted = false;

  -- Final counts
  SELECT COUNT(*) INTO after_govt FROM public.jobs WHERE job_sector = 'government' AND is_deleted = false;
  SELECT COUNT(*) INTO after_private FROM public.jobs WHERE job_sector = 'private' AND is_deleted = false;
  SELECT COUNT(*) INTO remaining FROM public.jobs WHERE job_sector = 'unclassified' AND is_deleted = false;

  RETURN jsonb_build_object(
    'success', true,
    'newly_classified_govt', after_govt - before_govt,
    'newly_classified_private', after_private - before_private,
    'government_total', after_govt,
    'private_total', after_private,
    'remaining_unclassified', remaining
  );
END;
$$;