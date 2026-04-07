/**
 * Auto-detection engine for Long Tail SEO topic keywords.
 * Parses a keyword string and extracts template, exam, state, department,
 * category, year, language hint, intent, and source candidate.
 */

export interface DetectedMeta {
  template: string;
  templateConfidence: 'high' | 'medium' | 'low';
  exam: string | null;
  state: string | null;
  department: string | null;
  category: string | null;
  year: string | null;
  intent: string;
  languageHint: 'hindi' | 'english' | 'auto';
  sourceCandidate: string | null;
}

// ── Template detection patterns ──
const TEMPLATE_PATTERNS: { pattern: RegExp; template: string }[] = [
  { pattern: /\b(age\s*limit|age\s*criteria|age\s*relaxation|aayu\s*seema)\b/i, template: 'age-limit' },
  { pattern: /\b(salary|in[\s-]hand|pay\s*(scale|matrix|level)|vetan|gross\s*pay|basic\s*pay)\b/i, template: 'salary' },
  { pattern: /\b(eligibility|yogyata|eligible|paatrata)\b/i, template: 'eligibility' },
  { pattern: /\b(syllabus|pathyakram|syllabi)\b/i, template: 'syllabus' },
  { pattern: /\b(exam\s*pattern|paper\s*pattern|marking\s*scheme|pariksha\s*pattern)\b/i, template: 'exam-pattern' },
  { pattern: /\b(selection\s*process|chayan\s*prakriya)\b/i, template: 'selection-process' },
  { pattern: /\b(application\s*fee|avedan\s*shulk|exam\s*fee)\b/i, template: 'application-fee' },
  { pattern: /\b(last\s*date|important\s*date|antim\s*tithi|deadline)\b/i, template: 'dates' },
  { pattern: /\b(admit\s*card|hall\s*ticket|pravesh\s*patra)\b/i, template: 'admit-card' },
  { pattern: /\b(result|pariksha\s*parinam|merit\s*list|cut[\s-]off)\b/i, template: 'result' },
  { pattern: /\b(qualification|shaikshik\s*yogyata|educational\s*qualification)\b/i, template: 'qualification' },
  { pattern: /\b(vs|versus|comparison|difference\s*between|tulna)\b/i, template: 'comparison' },
  { pattern: /\b(how\s*to|step\s*by\s*step|kaise|guide|tutorial)\b/i, template: 'how-to-guide' },
];

// ── Exam name detection ──
const KNOWN_EXAMS: { pattern: RegExp; name: string; source: string }[] = [
  { pattern: /\bssc\s*cgl\b/i, name: 'SSC CGL', source: 'ssc.gov.in' },
  { pattern: /\bssc\s*chsl\b/i, name: 'SSC CHSL', source: 'ssc.gov.in' },
  { pattern: /\bssc\s*gd\b/i, name: 'SSC GD', source: 'ssc.gov.in' },
  { pattern: /\bssc\s*mts\b/i, name: 'SSC MTS', source: 'ssc.gov.in' },
  { pattern: /\bssc\s*je\b/i, name: 'SSC JE', source: 'ssc.gov.in' },
  { pattern: /\bssc\s*cpo\b/i, name: 'SSC CPO', source: 'ssc.gov.in' },
  { pattern: /\bssc\s*stenographer\b/i, name: 'SSC Stenographer', source: 'ssc.gov.in' },
  { pattern: /\bupsc\s*cse\b/i, name: 'UPSC CSE', source: 'upsc.gov.in' },
  { pattern: /\bupsc\s*nda\b/i, name: 'UPSC NDA', source: 'upsc.gov.in' },
  { pattern: /\bupsc\s*cds\b/i, name: 'UPSC CDS', source: 'upsc.gov.in' },
  { pattern: /\bupsc\s*capf\b/i, name: 'UPSC CAPF', source: 'upsc.gov.in' },
  { pattern: /\bupsc\s*ese\b/i, name: 'UPSC ESE', source: 'upsc.gov.in' },
  { pattern: /\bupsc\s*(prelims|mains)\b/i, name: 'UPSC CSE', source: 'upsc.gov.in' },
  { pattern: /\bupsc\b/i, name: 'UPSC', source: 'upsc.gov.in' },
  { pattern: /\bibps\s*po\b/i, name: 'IBPS PO', source: 'ibps.in' },
  { pattern: /\bibps\s*clerk\b/i, name: 'IBPS Clerk', source: 'ibps.in' },
  { pattern: /\bibps\s*so\b/i, name: 'IBPS SO', source: 'ibps.in' },
  { pattern: /\bibps\s*rrb\b/i, name: 'IBPS RRB', source: 'ibps.in' },
  { pattern: /\bsbi\s*po\b/i, name: 'SBI PO', source: 'sbi.co.in' },
  { pattern: /\bsbi\s*clerk\b/i, name: 'SBI Clerk', source: 'sbi.co.in' },
  { pattern: /\brbi\s*grade\s*b\b/i, name: 'RBI Grade B', source: 'rbi.org.in' },
  { pattern: /\brbi\s*assistant\b/i, name: 'RBI Assistant', source: 'rbi.org.in' },
  { pattern: /\bctet\b/i, name: 'CTET', source: 'ctet.nic.in' },
  { pattern: /\brailway\s*group\s*d\b/i, name: 'Railway Group D', source: 'rrbcdg.gov.in' },
  { pattern: /\brrb\s*ntpc\b/i, name: 'RRB NTPC', source: 'rrbcdg.gov.in' },
  { pattern: /\brrb\s*je\b/i, name: 'RRB JE', source: 'rrbcdg.gov.in' },
  { pattern: /\brrb\s*alp\b/i, name: 'RRB ALP', source: 'rrbcdg.gov.in' },
  { pattern: /\bup\s*police\s*constable\b/i, name: 'UP Police Constable', source: 'uppbpb.gov.in' },
  { pattern: /\bup\s*si\b/i, name: 'UP SI', source: 'uppbpb.gov.in' },
  { pattern: /\bup\s*police\b/i, name: 'UP Police', source: 'uppbpb.gov.in' },
  { pattern: /\bbihar\s*police\b/i, name: 'Bihar Police', source: 'csbc.bih.nic.in' },
  { pattern: /\bbpsc\b/i, name: 'BPSC', source: 'bpsc.bih.nic.in' },
  { pattern: /\buppsc\b/i, name: 'UPPSC', source: 'uppsc.up.nic.in' },
  { pattern: /\bmppsc\b/i, name: 'MPPSC', source: 'mppsc.mp.gov.in' },
  { pattern: /\brpsc\b/i, name: 'RPSC', source: 'rpsc.rajasthan.gov.in' },
  { pattern: /\bjpsc\b/i, name: 'JPSC', source: 'jpsc.gov.in' },
  { pattern: /\bappsc\b/i, name: 'APPSC', source: 'psc.ap.gov.in' },
  { pattern: /\btspsc\b/i, name: 'TSPSC', source: 'tspsc.gov.in' },
  { pattern: /\bmpsc\b/i, name: 'MPSC', source: 'mpsc.gov.in' },
  { pattern: /\bwbpsc\b/i, name: 'WBPSC', source: 'pscwbapplication.in' },
  { pattern: /\barmy\s*agniveer\b/i, name: 'Army Agniveer', source: 'joinindianarmy.nic.in' },
  { pattern: /\bnavy\s*agniveer\b/i, name: 'Navy Agniveer', source: 'joinindiannavy.gov.in' },
  { pattern: /\bairforce\s*agniveer\b/i, name: 'Air Force Agniveer', source: 'agnipathvayu.cdac.in' },
  { pattern: /\bagniveer\b/i, name: 'Agniveer', source: 'joinindianarmy.nic.in' },
  { pattern: /\bbank\s*clerk\b/i, name: 'Bank Clerk', source: 'ibps.in' },
  { pattern: /\bbank\s*po\b/i, name: 'Bank PO', source: 'ibps.in' },
  { pattern: /\bneet\b/i, name: 'NEET', source: 'neet.nta.nic.in' },
  { pattern: /\bjee\s*main\b/i, name: 'JEE Main', source: 'jeemain.nta.nic.in' },
  { pattern: /\bjee\s*advanced\b/i, name: 'JEE Advanced', source: 'jeeadv.ac.in' },
  { pattern: /\bgate\b/i, name: 'GATE', source: 'gate2025.iitr.ac.in' },
  { pattern: /\bnet\s*jrf\b|ugc\s*net\b/i, name: 'UGC NET', source: 'ugcnet.nta.ac.in' },
  { pattern: /\bdsssb\b/i, name: 'DSSSB', source: 'dsssb.delhi.gov.in' },
];

// ── State detection ──
const STATE_MAP: { pattern: RegExp; name: string }[] = [
  { pattern: /\b(uttar\s*pradesh|up\s+(?!si\b|police\b))\b/i, name: 'Uttar Pradesh' },
  { pattern: /\b(madhya\s*pradesh|mp\b)/i, name: 'Madhya Pradesh' },
  { pattern: /\b(andhra\s*pradesh|ap\b)/i, name: 'Andhra Pradesh' },
  { pattern: /\b(arunachal\s*pradesh)\b/i, name: 'Arunachal Pradesh' },
  { pattern: /\b(himachal\s*pradesh|hp\b)/i, name: 'Himachal Pradesh' },
  { pattern: /\bbihar\b/i, name: 'Bihar' },
  { pattern: /\b(rajasthan|rj\b)/i, name: 'Rajasthan' },
  { pattern: /\b(maharashtra|mh\b)/i, name: 'Maharashtra' },
  { pattern: /\b(karnataka)\b/i, name: 'Karnataka' },
  { pattern: /\b(tamil\s*nadu|tn\b)/i, name: 'Tamil Nadu' },
  { pattern: /\b(west\s*bengal|wb\b)/i, name: 'West Bengal' },
  { pattern: /\b(telangana|ts\b)/i, name: 'Telangana' },
  { pattern: /\b(gujarat|gj\b)/i, name: 'Gujarat' },
  { pattern: /\b(kerala|kl\b)/i, name: 'Kerala' },
  { pattern: /\b(odisha|orissa)\b/i, name: 'Odisha' },
  { pattern: /\b(punjab|pb\b)/i, name: 'Punjab' },
  { pattern: /\b(haryana|hr\b)/i, name: 'Haryana' },
  { pattern: /\b(chhattisgarh|cg\b)/i, name: 'Chhattisgarh' },
  { pattern: /\b(jharkhand|jh\b)/i, name: 'Jharkhand' },
  { pattern: /\b(uttarakhand|uk\b)/i, name: 'Uttarakhand' },
  { pattern: /\b(assam)\b/i, name: 'Assam' },
  { pattern: /\b(goa)\b/i, name: 'Goa' },
  { pattern: /\b(delhi)\b/i, name: 'Delhi' },
  { pattern: /\b(jammu|kashmir|j&k)\b/i, name: 'Jammu & Kashmir' },
];

// ── Department detection ──
const DEPT_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /\b(railway|rail|indian\s*railway)\b/i, name: 'Indian Railways' },
  { pattern: /\b(defence|army|navy|airforce|air\s*force|military)\b/i, name: 'Defence' },
  { pattern: /\b(police|constable|si\b|sub\s*inspector)\b/i, name: 'Police' },
  { pattern: /\b(bank|banking|reserve\s*bank)\b/i, name: 'Banking' },
  { pattern: /\b(teaching|teacher|shikshak)\b/i, name: 'Teaching' },
  { pattern: /\b(ministry)\b/i, name: 'Government Ministry' },
  { pattern: /\b(postal|post\s*office|india\s*post)\b/i, name: 'India Post' },
  { pattern: /\b(income\s*tax|it\s*department)\b/i, name: 'Income Tax' },
  { pattern: /\b(customs|excise)\b/i, name: 'Customs & Excise' },
];

// ── Category detection ──
const CATEGORY_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /\b(obc|other\s*backward\s*class)\b/i, name: 'OBC' },
  { pattern: /\b(sc|scheduled\s*caste)\b/i, name: 'SC' },
  { pattern: /\b(st|scheduled\s*tribe)\b/i, name: 'ST' },
  { pattern: /\b(general|gen|ur)\b/i, name: 'General' },
  { pattern: /\b(ews)\b/i, name: 'EWS' },
  { pattern: /\b(female|women|mahila)\b/i, name: 'Female' },
  { pattern: /\b(pwd|divyang|disabled|handicapped)\b/i, name: 'PwD' },
  { pattern: /\b(ex[\s-]servicem[ae]n)\b/i, name: 'Ex-Servicemen' },
];

// ── Hindi tokens ──
const HINDI_TOKENS = /\b(ke|ki|ka|mein|kaise|pathyakram|vetan|aayu|seema|yogyata|pariksha|naukri|bharti|prakriya|shulk|patra|tithi)\b/i;

// ── Intent map ──
const INTENT_MAP: Record<string, string> = {
  'age-limit': 'factual-answer',
  'salary': 'factual-breakdown',
  'eligibility': 'factual-answer',
  'syllabus': 'reference-list',
  'exam-pattern': 'reference-structure',
  'selection-process': 'stepwise-guide',
  'application-fee': 'factual-answer',
  'dates': 'factual-answer',
  'admit-card': 'how-to-download',
  'result': 'status-check',
  'qualification': 'factual-answer',
  'comparison': 'comparative-analysis',
  'how-to-guide': 'stepwise-guide',
  'keyword-answer': 'direct-answer',
  'state-landing': 'overview',
  'category-landing': 'overview',
  'department-landing': 'overview',
};

/**
 * Auto-detect metadata from a raw keyword string.
 */
export function autoDetectMeta(keyword: string): DetectedMeta {
  const kw = keyword.trim();

  // Template
  let template = 'keyword-answer';
  let templateMatched = false;
  for (const tp of TEMPLATE_PATTERNS) {
    if (tp.pattern.test(kw)) {
      template = tp.template;
      templateMatched = true;
      break;
    }
  }

  // Exam
  let exam: string | null = null;
  let sourceCandidate: string | null = null;
  for (const ex of KNOWN_EXAMS) {
    if (ex.pattern.test(kw)) {
      exam = ex.name;
      sourceCandidate = ex.source;
      break;
    }
  }

  // State — try explicit state names first, then infer from exam name prefix
  let state: string | null = null;
  for (const st of STATE_MAP) {
    if (st.pattern.test(kw)) {
      state = st.name;
      break;
    }
  }
  // Infer state from exam prefix if not explicitly found
  if (!state && exam) {
    if (/^UP\s/i.test(exam)) state = 'Uttar Pradesh';
    else if (/^Bihar/i.test(exam)) state = 'Bihar';
  }

  // Department
  let department: string | null = null;
  for (const dp of DEPT_PATTERNS) {
    if (dp.pattern.test(kw)) {
      department = dp.name;
      break;
    }
  }

  // Category
  let category: string | null = null;
  for (const cp of CATEGORY_PATTERNS) {
    if (cp.pattern.test(kw)) {
      category = cp.name;
      break;
    }
  }

  // Year
  const yearMatch = kw.match(/\b(20[2-3]\d)\b/);
  const year = yearMatch ? yearMatch[1] : null;

  // Language hint
  const languageHint: DetectedMeta['languageHint'] = HINDI_TOKENS.test(kw) ? 'hindi' : 'auto';

  // Confidence
  let templateConfidence: DetectedMeta['templateConfidence'] = 'low';
  if (templateMatched && exam) templateConfidence = 'high';
  else if (templateMatched) templateConfidence = 'medium';

  // Intent
  const intent = INTENT_MAP[template] || 'direct-answer';

  return {
    template,
    templateConfidence,
    exam,
    state,
    department,
    category,
    year,
    intent,
    languageHint,
    sourceCandidate,
  };
}
