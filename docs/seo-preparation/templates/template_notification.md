# Content Template — Notification Page

## Meta Title Formula
```
{Exam Name} {Year} Notification — Vacancies, Dates & Apply Online | TrueJobs
```
Example: `SSC CGL 2026 Notification — 12,000+ Vacancies, Dates & Apply Online | TrueJobs`

## Meta Description Formula
```
{Exam Name} {Year} Notification out. {Total Vacancies} vacancies announced. Application dates: {Start} to {End}. Check eligibility, fee, syllabus & apply online.
```

## H1 Formula
```
{Exam Name} {Year} Notification — Complete Details, Eligibility & How to Apply
```

## Page Structure

### 1. Overview (100-150 words)
{Conducting Body} has released the {Exam Name} {Year} notification for {Total Vacancies} vacancies. The online application window is open from {Start Date} to {End Date}. This recruitment drive covers {Post Names}. Candidates meeting the eligibility criteria can apply through the official website.

### 2. Key Highlights Table
```html
<table>
  <tr><th>Detail</th><th>Information</th></tr>
  <tr><td>Conducting Body</td><td>{Body}</td></tr>
  <tr><td>Exam Name</td><td>{Name}</td></tr>
  <tr><td>Total Vacancies</td><td>{Count}</td></tr>
  <tr><td>Application Start</td><td>{Date}</td></tr>
  <tr><td>Application End</td><td>{Date}</td></tr>
  <tr><td>Exam Date</td><td>{Date / To be announced}</td></tr>
  <tr><td>Official Website</td><td>{URL}</td></tr>
</table>
```

### 3. Important Dates Table
| Event | Date |
|-------|------|
| Notification Release | {date} |
| Application Start | {date} |
| Application End | {date} |
| Admit Card | {date} |
| Exam Date | {date} |
| Result Date | {date} |

### 4. Vacancy Details
Category-wise vacancy breakdown table (UR, OBC, SC, ST, EWS, PwBD)

### 5. Eligibility Criteria
- **Age Limit:** {Min} to {Max} years (as on {cut-off date})
- **Age Relaxation:** OBC: {X} years, SC/ST: {Y} years, PwBD: {Z} years
- **Educational Qualification:** {Qualification}
- **Nationality:** Indian citizen

### 6. Application Fee
| Category | Fee |
|----------|-----|
| General / OBC | ₹{fee} |
| SC / ST | ₹{fee} |
| Female | ₹{fee} |
| PwBD | ₹{fee} |

### 7. Selection Process
Step-by-step selection stages with brief description of each

### 8. How to Apply (Step-by-Step)
1. Visit official website
2. Click on "Apply Online"
3. Register with email/mobile
4. Fill application form
5. Upload photo & signature
6. Pay application fee
7. Submit and download confirmation

### 9. Important Links
| Link | URL |
|------|-----|
| Official Notification PDF | {URL} |
| Apply Online | {URL} |
| Syllabus | Internal link to /exam-syllabus |
| Previous Year Papers | Internal link |

### 10. FAQ Section (Minimum 3)
Use `<details><summary>` for FAQ accordion

### 11. Related Exams
Links to 3-5 related exam notification pages

## JSON-LD Schemas

### WebPage Schema
```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "{Exam} {Year} Notification",
  "url": "https://truejobs.co.in/{slug}",
  "description": "{meta description}",
  "datePublished": "{ISO date}",
  "dateModified": "{ISO date}"
}
```

### FAQPage Schema
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "{question}",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "{answer}"
      }
    }
  ]
}
```

### BreadcrumbList Schema
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://truejobs.co.in"},
    {"@type": "ListItem", "position": 2, "name": "{Cluster} Jobs", "item": "https://truejobs.co.in/{cluster}-jobs"},
    {"@type": "ListItem", "position": 3, "name": "{Exam} Notification", "item": "https://truejobs.co.in/{slug}"}
  ]
}
```
