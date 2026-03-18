// RSS Feed Parser — supports RSS 2.0 and Atom
// Parses feed XML into typed items with normalized URLs

export interface FeedMeta {
  title: string;
  link: string;
  description: string;
  language: string;
  feedType: 'rss' | 'atom' | 'unknown';
  lastBuildDate: string | null;
}

export interface ParsedFeedItem {
  guid: string | null;
  title: string;
  link: string | null;
  canonicalLink: string | null;
  publishedAt: string | null;
  author: string | null;
  summary: string | null;
  content: string | null;
  categories: string[];
  enclosureUrls: string[];
  rawPayload: Record<string, unknown>;
}

export interface ParseResult {
  meta: FeedMeta;
  items: ParsedFeedItem[];
  errors: string[];
}

/**
 * Parse RSS 2.0 or Atom XML into structured data
 */
export function parseFeed(xml: string, feedBaseUrl: string): ParseResult {
  const errors: string[] = [];
  const feedType = detectFeedType(xml);

  if (feedType === 'unknown') {
    return {
      meta: { title: '', link: '', description: '', language: '', feedType: 'unknown', lastBuildDate: null },
      items: [],
      errors: ['Unable to detect feed type (not RSS 2.0 or Atom)'],
    };
  }

  try {
    if (feedType === 'rss') {
      return parseRss20(xml, feedBaseUrl, errors);
    } else {
      return parseAtom(xml, feedBaseUrl, errors);
    }
  } catch (e) {
    errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
    return {
      meta: { title: '', link: feedBaseUrl, description: '', language: '', feedType, lastBuildDate: null },
      items: [],
      errors,
    };
  }
}

function detectFeedType(xml: string): 'rss' | 'atom' | 'unknown' {
  const trimmed = xml.trim().substring(0, 500);
  if (/<rss[\s>]/i.test(trimmed)) return 'rss';
  if (/<feed[\s>]/i.test(trimmed) && /xmlns.*atom/i.test(trimmed)) return 'atom';
  if (/<feed[\s>]/i.test(trimmed)) return 'atom';
  if (/<rdf:RDF/i.test(trimmed)) return 'rss'; // RSS 1.0 treated as RSS
  return 'unknown';
}

// ---- Simple XML helpers (no external deps in Deno edge functions) ----

function getTagContent(xml: string, tag: string): string {
  // Match tag with optional namespace prefix
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return decodeEntities(m[1].trim());
}

function getTagContentRaw(xml: string, tag: string): string {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[a-zA-Z0-9]+:)?${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return m[1].trim();
}

function getAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*\\s${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const m = xml.match(re);
  return m ? decodeEntities(m[1]) : '';
}

function getAllElements(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[\\s>][\\s\\S]*?</(?:[a-zA-Z0-9]+:)?${tag}>|<(?:[a-zA-Z0-9]+:)?${tag}[^>]*/>`, 'gi');
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

// ---- RSS 2.0 Parser ----

function parseRss20(xml: string, baseUrl: string, errors: string[]): ParseResult {
  const channelMatch = xml.match(/<channel[\s>][\s\S]*<\/channel>/i);
  const channelXml = channelMatch ? channelMatch[0] : xml;

  const meta: FeedMeta = {
    title: stripCdata(getTagContent(channelXml, 'title')),
    link: resolveUrl(stripCdata(getTagContent(channelXml, 'link')), baseUrl),
    description: stripCdata(getTagContent(channelXml, 'description')),
    language: getTagContent(channelXml, 'language'),
    feedType: 'rss',
    lastBuildDate: getTagContent(channelXml, 'lastBuildDate') || null,
  };

  const itemElements = getAllElements(channelXml, 'item');
  const items: ParsedFeedItem[] = [];

  for (const itemXml of itemElements) {
    try {
      const title = stripCdata(getTagContent(itemXml, 'title'));
      if (!title) continue;

      const link = resolveUrl(stripCdata(getTagContent(itemXml, 'link')), baseUrl);
      const guid = stripCdata(getTagContent(itemXml, 'guid')) || null;
      const pubDate = getTagContent(itemXml, 'pubDate') || null;
      const author = getTagContent(itemXml, 'author') || getTagContent(itemXml, 'creator') || null;
      const description = stripCdata(getTagContentRaw(itemXml, 'description'));
      const contentEncoded = stripCdata(getTagContentRaw(itemXml, 'encoded'));

      const categories: string[] = [];
      const catElements = getAllElements(itemXml, 'category');
      for (const cat of catElements) {
        const val = stripCdata(getTagContent(cat, 'category'));
        if (val) categories.push(val);
      }

      // Enclosure URLs
      const enclosureUrls: string[] = [];
      const enclosureUrl = getAttr(itemXml, 'enclosure', 'url');
      if (enclosureUrl) enclosureUrls.push(resolveUrl(enclosureUrl, baseUrl));

      items.push({
        guid,
        title,
        link: link || null,
        canonicalLink: link || null,
        publishedAt: pubDate,
        author,
        summary: description || null,
        content: contentEncoded || description || null,
        categories,
        enclosureUrls,
        rawPayload: { title, link, guid, pubDate, author, description: description?.substring(0, 500), categories },
      });
    } catch (e) {
      errors.push(`Failed to parse RSS item: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { meta, items, errors };
}

// ---- Atom Parser ----

function parseAtom(xml: string, baseUrl: string, errors: string[]): ParseResult {
  const meta: FeedMeta = {
    title: stripCdata(getTagContent(xml, 'title')),
    link: getAtomLink(xml, baseUrl, 'alternate') || getAtomLink(xml, baseUrl, '') || baseUrl,
    description: stripCdata(getTagContent(xml, 'subtitle')),
    language: getAttr(xml, 'feed', 'xml:lang') || '',
    feedType: 'atom',
    lastBuildDate: getTagContent(xml, 'updated') || null,
  };

  const entryElements = getAllElements(xml, 'entry');
  const items: ParsedFeedItem[] = [];

  for (const entryXml of entryElements) {
    try {
      const title = stripCdata(getTagContent(entryXml, 'title'));
      if (!title) continue;

      const link = getAtomLink(entryXml, baseUrl, 'alternate') || getAtomLink(entryXml, baseUrl, '');
      const id = getTagContent(entryXml, 'id') || null;
      const updated = getTagContent(entryXml, 'updated') || null;
      const published = getTagContent(entryXml, 'published') || updated;
      const authorName = getTagContent(getTagContentRaw(entryXml, 'author'), 'name') || null;
      const summary = stripCdata(getTagContentRaw(entryXml, 'summary'));
      const content = stripCdata(getTagContentRaw(entryXml, 'content'));

      const categories: string[] = [];
      const catMatches = entryXml.match(/<category[^>]*term\s*=\s*["']([^"']*)["']/gi);
      if (catMatches) {
        for (const cat of catMatches) {
          const termMatch = cat.match(/term\s*=\s*["']([^"']*)["']/i);
          if (termMatch?.[1]) categories.push(decodeEntities(termMatch[1]));
        }
      }

      // Enclosure-like links
      const enclosureUrls: string[] = [];
      const encLink = getAtomLink(entryXml, baseUrl, 'enclosure');
      if (encLink) enclosureUrls.push(encLink);

      items.push({
        guid: id,
        title,
        link: link || null,
        canonicalLink: link || null,
        publishedAt: published,
        author: authorName,
        summary: summary || null,
        content: content || summary || null,
        categories,
        enclosureUrls,
        rawPayload: { title, link, id, published, authorName, summary: summary?.substring(0, 500), categories },
      });
    } catch (e) {
      errors.push(`Failed to parse Atom entry: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { meta, items, errors };
}

function getAtomLink(xml: string, baseUrl: string, rel: string): string {
  const linkMatches = xml.match(/<link[^>]*>/gi) || [];
  for (const linkTag of linkMatches) {
    const tagRel = linkTag.match(/rel\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    const href = linkTag.match(/href\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    if (!href) continue;
    if (rel === '' && !tagRel) return resolveUrl(decodeEntities(href), baseUrl);
    if (tagRel === rel) return resolveUrl(decodeEntities(href), baseUrl);
  }
  return '';
}

export function resolveUrl(url: string, base: string): string {
  if (!url) return '';
  url = url.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}
