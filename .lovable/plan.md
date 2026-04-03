

# Phase 2: Upgrade Article Readability, Structure, and On-Page Engagement

## Key Issues Found

1. **Table of Contents broken for HTML articles**: `extractHeadings()` in `blogUtils.ts` only matches markdown `# heading` syntax. Since Phase 1 fixed the router to correctly identify HTML articles (with `<p>` tags), most articles now bypass the markdown path — meaning their `<h2>`/`<h3>` tags are never extracted, and TOC shows nothing.

2. **TOC buried in sidebar below sticky ad**: Even when headings exist, the TOC renders below the sidebar ad in the sidebar column, making it hard to discover. For long articles, an inline TOC near the top of the article body is more valuable.

3. **Content area is a single unbroken vertical strip**: No visual rhythm — paragraphs, headings, lists, and images all flow without breathing room or section delineation.

4. **Article header area lacks hierarchy**: Back button, category badge, title, meta, tags, and cover image are stacked with uniform spacing — no visual grouping or premium feel.

5. **No intro summary or key-takeaways block**: Long informational articles dump straight into content with no scannable entry point.

6. **FAQ section is visually flat**: Plain bordered divs with no accordion or visual distinction from article body.

---

## Plan

### File 1: `src/lib/blogUtils.ts` — Fix heading extraction for HTML content

**Change**: Update `extractHeadings()` to also parse HTML `<h2>` and `<h3>` tags, not just markdown `#` syntax. Add an HTML heading regex pass that matches `<h2...>text</h2>` and `<h3...>text</h3>`, strips inner HTML tags, and extracts the id (or generates one). Deduplicate results. This makes TOC work for all articles.

### File 2: `src/components/blog/TableOfContents.tsx` — Compact inline TOC variant

**Change**: Add an `inline` prop variant. When `inline={true}`, render as a compact bordered box (not a sticky Card) suitable for embedding inside the article body near the top. Keep the sidebar variant unchanged. The inline version: light background, smaller text, collapsible with a "Show/Hide" toggle for articles with many headings (>8), numbered items for scannability.

### File 3: `src/pages/blog/BlogPost.tsx` — Restructure article layout

**Changes**:

a) **Move TOC inline**: Insert a `<TableOfContents headings={headings} inline />` inside the article body, right after the cover image and before the prose content. Remove it from the sidebar (or keep sidebar TOC only on desktop for very long articles — but the inline version is the primary one).

b) **Add excerpt/intro block**: If `post.excerpt` exists and is substantial (>80 chars), render it as a styled intro summary block with a left border accent, slightly larger text, and muted background — placed between cover image and article body. This gives readers an immediate overview.

c) **Refine header spacing**: 
- Group category badge + title closer together
- Add a subtle separator between header meta (author/date/reading time) and tags
- Reduce back-button prominence (smaller, text-only)
- Tighten the overall header vertical rhythm

d) **Add content section spacing via CSS class**: Wrap the prose div with a `article-content` class that adds enhanced spacing rules (see CSS changes below).

### File 4: `src/index.css` — Article readability and rhythm improvements

**Changes**:

a) **Enhanced content spacing inside `.content-area`**:
```css
/* Section breathing room */
.content-area h2 { margin-top: 2.5rem; margin-bottom: 1.25rem; padding-top: 1.5rem; border-top: 1px solid hsl(214 32% 91%); }
.content-area h2:first-child { border-top: none; padding-top: 0; margin-top: 0; }
.content-area h3 { margin-top: 2rem; margin-bottom: 1rem; }
.content-area p { margin-bottom: 1.25rem; }
.content-area ul, .content-area ol { margin-bottom: 1.5rem; }
.content-area li { margin-bottom: 0.5rem; }
.content-area table { margin: 2rem 0; }
```
This adds visual section breaks at each h2, making long articles scannable without redesigning anything.

b) **Intro summary block styling**:
```css
.article-intro {
  border-left: 4px solid hsl(217 91% 60%);
  background: hsl(217 91% 60% / 0.04);
  padding: 1rem 1.25rem;
  border-radius: 0 0.5rem 0.5rem 0;
  font-size: 1.125rem;
  line-height: 1.7;
  color: #1a1a1a;
  margin-bottom: 2rem;
}
```

c) **FAQ section upgrade**:
```css
.content-area .faq-item {
  background: hsl(210 40% 98%);
  border: 1px solid hsl(214 32% 91%);
  border-radius: 0.75rem;
  padding: 1.25rem;
  transition: box-shadow 0.2s;
}
.content-area .faq-item:hover {
  box-shadow: 0 2px 8px hsl(217 91% 60% / 0.08);
}
```

d) **Dark mode counterparts** for all new styles.

### File 5: `src/pages/blog/BlogPost.tsx` — FAQ visual upgrade

**Change**: Update FAQ section to use the `faq-item` class, add a subtle FAQ icon or number, and ensure answer text uses proper `text-foreground` instead of `text-muted-foreground` for readability.

---

## What Is NOT Changed
- No ads removed, repositioned, or weakened
- Header banner ad stays at the same position
- In-content ad stays in the same position
- Sidebar ad stays sticky at top
- No new components beyond the inline TOC variant
- No sidebar/end-of-article optimization (that's a later phase)
- Cover image aspect-ratio hardening already done in prior phase

## Ad-Safety Decisions
- The inline TOC adds ~100-150px of engaging content above the fold, which **improves** scroll depth and time-on-page — favorable for AdSense
- The intro summary block keeps readers engaged longer before they bounce — improves viewability
- Section borders at h2 tags create natural scroll pause points — favorable for in-content ad viewability
- No content is pushed below the fold that was previously above it

## Remaining Gaps
- Sidebar layout optimization (later phase)
- End-of-article engagement modules (later phase)
- Key Takeaways / Exam Relevance callout boxes require structured data in the DB — can only render if articles store this metadata; for now, the excerpt/intro block covers the "scannable entry point" need

## Manual Verification Checklist
1. Open a long Hindi article — verify h2 sections have top borders and breathing room
2. Open any article with 3+ headings — verify inline TOC appears after cover image
3. Open an article with an excerpt — verify intro block renders with left blue border
4. Open the UPI article — verify FAQ items have upgraded card styling
5. Verify header area feels tighter and more intentional
6. Verify no ads moved or became less visible
7. Check mobile (375px) — inline TOC should be compact and not overwhelming

