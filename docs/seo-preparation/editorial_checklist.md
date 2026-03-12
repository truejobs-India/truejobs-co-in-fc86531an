# Editorial Checklist — Government Jobs SEO Content

## Word Count Requirements

| Page Type | Minimum Words | Target Words | Maximum Words |
|-----------|--------------|-------------|--------------|
| Notification | 800 | 1,200 | 2,000 |
| Syllabus | 1,000 | 1,500 | 2,500 |
| Exam Pattern | 800 | 1,200 | 1,800 |
| Cutoff | 600 | 1,000 | 1,500 |
| Salary | 800 | 1,200 | 1,800 |
| Previous Papers | 600 | 900 | 1,200 |
| Hub Page | 1,500 | 2,000 | 3,000 |
| Without Exam Landing | 800 | 1,200 | 1,800 |

## Mandatory Sections by Page Type

### Notification Pages
- [ ] Overview paragraph (who, what, when, where)
- [ ] Key highlights table (vacancies, dates, eligibility)
- [ ] Important dates table
- [ ] Vacancy details (category-wise breakdown)
- [ ] Eligibility criteria (age, qualification, nationality)
- [ ] Application fee table
- [ ] How to apply (step-by-step)
- [ ] Selection process overview
- [ ] Official links (notification PDF, apply online)
- [ ] FAQ section (3-5 questions)
- [ ] Related exams links

### Syllabus Pages
- [ ] Exam overview (1 paragraph)
- [ ] Complete syllabus for each stage/tier
- [ ] Subject-wise topic list
- [ ] Important topics to focus on
- [ ] Preparation tips
- [ ] Recommended books
- [ ] Download syllabus PDF link
- [ ] FAQ section (3-5 questions)

### Exam Pattern Pages
- [ ] Exam overview
- [ ] Exam pattern table (subjects, questions, marks, time)
- [ ] Stage-wise breakdown
- [ ] Marking scheme (positive/negative marks)
- [ ] Qualifying criteria
- [ ] Tips for time management
- [ ] FAQ section (3 questions)

### Cutoff Pages
- [ ] Latest year cutoff (category-wise table)
- [ ] Previous year cutoffs (2-3 years comparison)
- [ ] State-wise cutoff (if applicable)
- [ ] Factors affecting cutoff
- [ ] Expected cutoff analysis
- [ ] FAQ section (3 questions)

### Salary Pages
- [ ] Basic pay and grade pay
- [ ] Pay scale (7th CPC)
- [ ] In-hand salary (after deductions)
- [ ] Allowances breakdown (DA, HRA, TA, etc.)
- [ ] Perks and benefits
- [ ] Career growth / promotion ladder
- [ ] Salary comparison table (with similar posts)
- [ ] FAQ section (3-5 questions)

### Previous Papers Pages
- [ ] Exam overview
- [ ] Year-wise paper links (PDF)
- [ ] Subject-wise paper availability
- [ ] How to use previous papers for preparation
- [ ] Answer keys (if available)
- [ ] FAQ section (3 questions)

## On-Page SEO Rules

### Title Tag
- Format: `{Exam} {Type} 2026 — {Unique Selling Point} | TrueJobs`
- Example: `SSC CGL Syllabus 2026 — Complete Tier 1 & Tier 2 Syllabus PDF | TrueJobs`
- Max length: 60 characters
- Primary keyword in first 30 characters

### Meta Description
- Max length: 155 characters
- Include primary keyword + call-to-action
- Example: `Download SSC CGL Syllabus 2026 for Tier 1 & Tier 2. Subject-wise topics, exam pattern & free PDF. Last updated March 2026.`

### H1 Tag
- Exactly one H1 per page
- Must contain primary keyword
- Different from title tag (add context)
- Example: `SSC CGL Syllabus 2026 — Complete Subject-Wise Syllabus for Tier 1 & Tier 2`

### Heading Hierarchy
- H1 → H2 → H3 (no skipping levels)
- Each H2 represents a major section
- H3 for subsections within H2
- Use keywords naturally in H2/H3 headings

### Images
- Alt text required for every image
- Alt text must describe the image AND include keyword
- Example: `alt="SSC CGL Syllabus 2026 Tier 1 Subject List"`
- Use WebP format, max 100KB per image
- Lazy load all images below the fold

### Internal Links
- Minimum 6 internal links per page (see internal_linking_map.md)
- First link within first 100 words
- Use descriptive anchor text (not "click here")
- Maximum 1 link per 100 words in body content

### Tables
- Use HTML `<table>` with `<thead>` and `<tbody>`
- Include scope attributes for accessibility
- Every table must have a caption or preceding heading

## Schema Validation

Every page MUST include these JSON-LD schemas:

1. **WebPage** — name, url, description, datePublished, dateModified
2. **BreadcrumbList** — Home → Cluster Hub → Authority → Current
3. **FAQPage** — minimum 3 FAQ items per page
4. **ItemList** (for listing pages) — structured list of exams/jobs

### Schema Testing
- Validate with Google Rich Results Test before publishing
- Validate with Schema.org validator
- Check for warnings (not just errors)

## Content Quality Standards

- [ ] No grammatical errors
- [ ] No placeholder text
- [ ] All dates are current (within 30 days)
- [ ] All links are working (no 404s)
- [ ] Official source URLs are correct
- [ ] Salary figures are verified from 7th CPC
- [ ] Vacancy numbers match official notification
- [ ] Age limits include relaxation details
- [ ] Application fee includes all categories
- [ ] No copied content from competitors (min 90% unique)

## Publishing Workflow

1. **Draft** → Content writer creates page using template
2. **Review** → Editor checks against this checklist
3. **Schema** → Validate all JSON-LD
4. **Links** → Verify all internal links resolve
5. **Mobile** → Preview on mobile viewport
6. **Publish** → Set `datePublished` and `dateModified`
7. **Index** → Submit to Google via Indexing API
8. **Monitor** → Check GSC within 48 hours for indexing
