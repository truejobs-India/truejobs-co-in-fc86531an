import { ValidationCheck, GlobalAuditResult, CachePage, SITE_URL } from './cacheTypes';

export function validateCachedPage(
  headHtml: string | null,
  bodyHtml: string | null,
  slug: string,
  pageType: string
): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const head = headHtml || '';
  const body = bodyHtml || '';

  // Title
  const titleMatch = head.match(/<title[^>]*>([^<]*)<\/title>/i);
  checks.push({
    label: 'Title exists',
    passed: !!titleMatch && titleMatch[1].trim().length > 0,
    detail: titleMatch ? titleMatch[1].trim().substring(0, 80) : 'No <title> tag found',
  });

  // Meta description
  const descMatch = head.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || head.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const descLen = descMatch ? descMatch[1].length : 0;
  checks.push({
    label: 'Meta description exists',
    passed: !!descMatch && descLen > 0,
    detail: descMatch ? `${descLen} chars` : 'No meta description found',
  });

  // Canonical
  const canonMatch = head.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  checks.push({
    label: 'Canonical exists',
    passed: !!canonMatch,
    detail: canonMatch ? canonMatch[1] : 'No canonical tag',
  });

  // Canonical matches route
  if (canonMatch) {
    const expectedCanonical = slug ? `${SITE_URL}/${slug}` : SITE_URL;
    checks.push({
      label: 'Canonical matches expected route',
      passed: canonMatch[1] === expectedCanonical || canonMatch[1] === `${expectedCanonical}/`,
      detail: `Expected: ${expectedCanonical}`,
    });
  }

  // Robots
  const robotsMatch = head.match(/<meta[^>]*name=["']robots["'][^>]*/i);
  checks.push({
    label: 'Robots meta exists',
    passed: !!robotsMatch,
    detail: robotsMatch ? 'Found' : 'No robots meta tag',
  });

  // H1
  const h1Match = body.match(/<h1[^>]*>/i);
  checks.push({
    label: 'H1 exists in body',
    passed: !!h1Match,
  });

  // Body content length
  const textContent = body.replace(/<[^>]*>/g, '').trim();
  checks.push({
    label: 'Body content exists (>200 chars)',
    passed: textContent.length > 200,
    detail: `${textContent.length} chars`,
  });

  // Breadcrumb schema
  const hasBreadcrumb = head.includes('BreadcrumbList') || body.includes('BreadcrumbList');
  if (hasBreadcrumb) {
    const valid = isJsonLdParseable(head + body, 'BreadcrumbList');
    checks.push({ label: 'Breadcrumb schema valid', passed: valid });
  }

  // FAQ schema
  const hasFaq = head.includes('FAQPage') || body.includes('FAQPage');
  if (hasFaq) {
    const valid = isJsonLdParseable(head + body, 'FAQPage');
    checks.push({ label: 'FAQ schema valid', passed: valid });
  }

  // WebPage schema
  const hasWebPage = head.includes('"WebPage"') || body.includes('"WebPage"');
  if (hasWebPage) {
    checks.push({ label: 'WebPage schema valid', passed: isJsonLdParseable(head + body, 'WebPage') });
  }

  // JobPosting only on job detail
  const hasJobPosting = head.includes('JobPosting') || body.includes('JobPosting');
  const isJobDetail = pageType === 'job-detail';
  if (hasJobPosting && !isJobDetail) {
    checks.push({
      label: 'JobPosting schema only on job detail pages',
      passed: false,
      detail: `Found on page type: ${pageType}`,
    });
  } else if (hasJobPosting && isJobDetail) {
    checks.push({ label: 'JobPosting schema only on job detail pages', passed: true });
  }

  // Internal link format valid
  const linkMatches = body.match(/<a[^>]*href=["']([^"']*)["']/gi) || [];
  const hrefs = linkMatches.map(m => {
    const hrefMatch = m.match(/href=["']([^"']*)/);
    return hrefMatch ? hrefMatch[1] : '';
  }).filter(Boolean);
  const internalHrefs = hrefs.filter(h => h.startsWith('/') || h.startsWith(SITE_URL));
  const badFormatLinks = hrefs.filter(h =>
    !h.startsWith('/') && !h.startsWith(SITE_URL) && !h.startsWith('http') && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('tel:')
  );
  checks.push({
    label: 'Internal link format valid',
    passed: badFormatLinks.length === 0,
    detail: badFormatLinks.length > 0 ? `${badFormatLinks.length} malformed links` : `${internalHrefs.length} internal links`,
  });

  // Crawlable internal links present
  checks.push({
    label: 'Crawlable internal links present',
    passed: internalHrefs.length > 0,
    detail: `${internalHrefs.length} internal links found`,
  });

  // Minimum content quality
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  checks.push({
    label: 'Minimum content quality (>100 words)',
    passed: wordCount > 100,
    detail: `${wordCount} words`,
  });

  return checks;
}

function isJsonLdParseable(html: string, targetType: string): boolean {
  const scriptMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of scriptMatches) {
    const content = script.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    try {
      const parsed = JSON.parse(content);
      const type = parsed['@type'] || (Array.isArray(parsed['@graph']) ? parsed['@graph'].map((g: any) => g['@type']).join(',') : '');
      if (type.includes(targetType)) return true;
    } catch {
      // not valid JSON
    }
  }
  return false;
}

export function extractMetadata(headHtml: string) {
  const extract = (regex: RegExp) => {
    const m = headHtml.match(regex);
    return m ? m[1] : null;
  };
  const extractAll = (regex: RegExp) => {
    const results: { name: string; content: string }[] = [];
    let m;
    const r = new RegExp(regex.source, 'gi');
    while ((m = r.exec(headHtml)) !== null) {
      results.push({ name: m[1], content: m[2] });
    }
    return results;
  };

  const title = extract(/<title[^>]*>([^<]*)<\/title>/i);
  const description = extract(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || extract(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const canonical = extract(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const robots = extract(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);

  const ogTags = extractAll(/<meta[^>]*property=["'](og:[^"']*)["'][^>]*content=["']([^"']*)["']/i);
  const twitterTags = extractAll(/<meta[^>]*name=["'](twitter:[^"']*)["'][^>]*content=["']([^"']*)["']/i);

  const jsonLdBlocks: any[] = [];
  const scriptMatches = headHtml.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const s of scriptMatches) {
    const content = s.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    try { jsonLdBlocks.push(JSON.parse(content)); } catch { /* skip */ }
  }

  return { title, description, canonical, robots, ogTags, twitterTags, jsonLdBlocks };
}

export function runGlobalAudit(
  cachedPages: CachePage[],
  inventorySlugs: Set<string>,
  allCachedSlugs: Set<string>
): GlobalAuditResult[] {
  const results: GlobalAuditResult[] = [];

  // Duplicate canonical URLs
  const canonicals = new Map<string, string[]>();
  for (const page of cachedPages) {
    if (!page.headHtml) continue;
    const m = page.headHtml.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    if (m) {
      const canon = m[1];
      if (!canonicals.has(canon)) canonicals.set(canon, []);
      canonicals.get(canon)!.push(page.slug);
    }
  }
  for (const [canon, slugs] of canonicals) {
    if (slugs.length > 1) {
      results.push({
        severity: 'error',
        category: 'Duplicate Canonical',
        message: `Canonical URL "${canon}" is shared by ${slugs.length} pages`,
        slugs,
      });
    }
  }

  // Orphaned cache rows
  const orphaned = [...allCachedSlugs].filter(s => !inventorySlugs.has(s));
  if (orphaned.length > 0) {
    results.push({
      severity: 'error',
      category: 'Orphaned Cache',
      message: `${orphaned.length} cached page(s) not in expected inventory`,
      slugs: orphaned,
    });
  }

  // Missing from cache
  const missing = [...inventorySlugs].filter(s => !allCachedSlugs.has(s));
  if (missing.length > 0) {
    results.push({
      severity: 'warning',
      category: 'Missing from Cache',
      message: `${missing.length} expected page(s) not yet cached`,
      slugs: missing,
    });
  }

  // Noindex but cached
  const noindexCached: string[] = [];
  for (const page of cachedPages) {
    if (!page.headHtml) continue;
    const robotsMatch = page.headHtml.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']*)["']/i);
    if (robotsMatch && robotsMatch[1].includes('noindex')) {
      noindexCached.push(page.slug);
    }
  }
  if (noindexCached.length > 0) {
    results.push({
      severity: 'info',
      category: 'Noindex + Cached',
      message: `${noindexCached.length} page(s) have noindex but are cached`,
      slugs: noindexCached,
    });
  }

  return results;
}
