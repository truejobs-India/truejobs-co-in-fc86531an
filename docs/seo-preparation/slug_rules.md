# Slug Rules — Government Jobs SEO Pages

## Canonical Slug Formats

### Format Rules

1. **Max length:** 60 characters
2. **Separator:** Hyphen (`-`) only
3. **Case:** All lowercase
4. **No trailing slashes**
5. **No year suffix** unless the page is year-specific (e.g., notifications)
6. **No abbreviations** for states (use `uttar-pradesh` not `up`)
7. **State abbreviations allowed** only for exam names (e.g., `uptet` for UP Teacher Eligibility Test)

### Slug Patterns by Page Type

| Page Type | Pattern | Example |
|-----------|---------|---------|
| Hub | `/{cluster}-jobs` | `/ssc-jobs`, `/railway-jobs`, `/banking-jobs` |
| Notification | `/{exam}-notification` | `/ssc-cgl-notification` |
| Notification (yearly) | `/{exam}-{year}-notification` | `/ssc-cgl-2026-notification` |
| Syllabus | `/{exam}-syllabus` | `/ssc-cgl-syllabus` |
| Exam Pattern | `/{exam}-exam-pattern` | `/ssc-cgl-exam-pattern` |
| Cutoff | `/{exam}-cutoff` | `/ssc-cgl-cutoff` |
| Salary | `/{exam}-salary` | `/ssc-cgl-salary` |
| Previous Papers | `/{exam}-previous-year-papers` | `/ssc-cgl-previous-year-papers` |
| State Filter | `/govt-jobs-{state}` | `/govt-jobs-uttar-pradesh` |
| Qualification | `/{qual}-govt-jobs` | `/graduate-govt-jobs` |
| Without Exam | `/govt-jobs-without-exam` | `/govt-jobs-without-exam` |
| Without Exam + Qual | `/{qual}-govt-jobs-without-exam` | `/10th-pass-govt-jobs-without-exam` |
| Without Exam + State | `/govt-jobs-without-exam-{state}` | `/govt-jobs-without-exam-bihar` |
| Dept + State | `/{dept}-jobs-{state}` | `/ssc-jobs-uttar-pradesh` |
| Deadline | `/govt-jobs-last-date-{period}` | `/govt-jobs-last-date-today` |
| Deadline Monthly | `/govt-jobs-last-date-{month}-{year}` | `/govt-jobs-last-date-july-2026` |

### Collision Resolution

1. If two exams produce the same slug, append the conducting body: `/je-notification` → `/ssc-je-notification` vs `/rrb-je-notification`
2. If a state and exam share a name, the exam takes priority. State pages always start with `govt-jobs-`
3. Year-specific pages: notification pages MAY include year; evergreen content (syllabus, salary) MUST NOT include year in slug
4. If slug exceeds 60 chars, drop less critical qualifiers: `/railway-jobs-without-exam-uttar-pradesh` → `/railway-jobs-no-exam-up` (exception to no-abbreviation rule for length)

### Canonical Tag Rules

- Every page has exactly one `<link rel="canonical" href="...">` pointing to itself
- Year-variant pages (e.g., `/ssc-cgl-2025-notification`) canonical to the latest year (`/ssc-cgl-2026-notification`)
- Archived year pages redirect (301) to current year after 6 months
- No canonical pointing to external domains

### State Name Mapping

| State | Slug Component |
|-------|---------------|
| Uttar Pradesh | `uttar-pradesh` |
| Madhya Pradesh | `madhya-pradesh` |
| Andhra Pradesh | `andhra-pradesh` |
| Arunachal Pradesh | `arunachal-pradesh` |
| Himachal Pradesh | `himachal-pradesh` |
| West Bengal | `west-bengal` |
| Tamil Nadu | `tamil-nadu` |
| Jammu & Kashmir | `jammu-kashmir` |
| Bihar | `bihar` |
| Rajasthan | `rajasthan` |
| Gujarat | `gujarat` |
| Maharashtra | `maharashtra` |
| Karnataka | `karnataka` |
| Kerala | `kerala` |
| Punjab | `punjab` |
| Haryana | `haryana` |
| Uttarakhand | `uttarakhand` |
| Jharkhand | `jharkhand` |
| Chhattisgarh | `chhattisgarh` |
| Odisha | `odisha` |
| Assam | `assam` |
| Telangana | `telangana` |
| Goa | `goa` |
| Delhi | `delhi` |

### Qualification Mapping

| Qualification | Slug Component |
|--------------|---------------|
| 8th Pass | `8th-pass` |
| 10th Pass | `10th-pass` |
| 12th Pass | `12th-pass` |
| ITI | `iti` |
| Diploma | `diploma` |
| Graduate | `graduate` |
| Post Graduate | `post-graduate` |
| Engineering | `engineering` |
| B.Ed | `bed` |
| MBBS | `mbbs` |
| LLB | `llb` |
