import createDOMPurify from 'dompurify';
import { useMemo } from 'react';

// Lazy singleton — created on first use inside browser only
let _purifier: ReturnType<typeof createDOMPurify> | null = null;

function getPurifier() {
  if (_purifier) return _purifier;
  if (typeof window === 'undefined') return null;
  _purifier = createDOMPurify(window);
  _purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      const href = node.getAttribute('href') || '';
      if (href && !href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('/')) {
        node.removeAttribute('href');
      }
    }
  });
  return _purifier;
}

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h3', 'h4', 'a', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
};

function sanitizeHtml(dirty: string): string {
  const purifier = getPurifier();
  if (!purifier) return '';
  return purifier.sanitize(dirty, PURIFY_CONFIG) as string;
}

interface Props {
  title: string;
  content: string;
  type?: 'text' | 'html';
}

export function EnrichedSection({ title, content, type = 'text' }: Props) {
  const safeHtml = useMemo(
    () => (type === 'html' && content?.trim() ? sanitizeHtml(content) : null),
    [content, type]
  );

  if (!content?.trim()) return null;

  if (type === 'html' && safeHtml) {
    return (
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-foreground mb-4">{title}</h2>
        <div
          className="prose prose-neutral max-w-none text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </section>
    );
  }

  const paragraphs = content.split(/\n\n+/).filter(Boolean);
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold text-foreground mb-4">{title}</h2>
      <div className="space-y-3 text-muted-foreground">
        {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </section>
  );
}
