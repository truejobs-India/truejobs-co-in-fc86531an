import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link2, Copy, CheckCircle } from 'lucide-react';
import { BLOG_THRESHOLDS } from '@/lib/blogArticleAnalyzer';

interface Suggestion {
  path: string;
  label: string;
  reason: string;
}

interface InternalLinkSuggesterProps {
  content: string;
  currentInternalLinks: number;
  category?: string;
  tags?: string[];
}

const EXAM_KEYWORDS: [string, string, string][] = [
  ['ssc', '/govt-exam/ssc-cgl', 'SSC CGL page'],
  ['upsc', '/govt-exam/upsc-civil-services', 'UPSC page'],
  ['rrb', '/govt-exam/rrb-ntpc', 'RRB NTPC page'],
  ['railway', '/sarkari-naukri/railway', 'Railway jobs'],
  ['bank', '/sarkari-naukri/banking', 'Banking jobs'],
  ['police', '/sarkari-naukri/police', 'Police jobs'],
  ['neet', '/govt-exam/neet', 'NEET page'],
  ['jee', '/govt-exam/jee-main', 'JEE Main page'],
];

const STATE_KEYWORDS: [string, string][] = [
  ['uttar pradesh', 'uttar-pradesh'], ['bihar', 'bihar'], ['rajasthan', 'rajasthan'],
  ['madhya pradesh', 'madhya-pradesh'], ['delhi', 'delhi'], ['maharashtra', 'maharashtra'],
  ['tamil nadu', 'tamil-nadu'], ['karnataka', 'karnataka'], ['west bengal', 'west-bengal'],
];

export function InternalLinkSuggester({ content, currentInternalLinks, category, tags }: InternalLinkSuggesterProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<Suggestion[]>([]);

  useEffect(() => {
    generateSuggestions();
    fetchRelatedPosts();
  }, [content, category, tags]);

  const generateSuggestions = () => {
    const textContent = content.replace(/<[^>]+>/g, '').toLowerCase();
    const found: Suggestion[] = [];

    // Check exam keywords
    for (const [keyword, path, label] of EXAM_KEYWORDS) {
      if (textContent.includes(keyword)) {
        found.push({ path, label, reason: `Mentions "${keyword}"` });
      }
    }

    // Check state keywords
    for (const [stateName, stateSlug] of STATE_KEYWORDS) {
      if (textContent.includes(stateName)) {
        found.push({
          path: `/govt-jobs-${stateSlug}`,
          label: `${stateName.charAt(0).toUpperCase() + stateName.slice(1)} Govt Jobs`,
          reason: `Mentions "${stateName}"`,
        });
      }
    }

    // Hub pages
    if (textContent.includes('sarkari') || textContent.includes('सरकारी')) {
      found.push({ path: '/sarkari-naukri', label: 'Sarkari Naukri hub', reason: 'Mentions sarkari/सरकारी' });
    }
    if (textContent.includes('result') || textContent.includes('रिजल्ट')) {
      found.push({ path: '/sarkari-result', label: 'Sarkari Result hub', reason: 'Mentions result/रिजल्ट' });
    }

    // Deduplicate by path
    const unique = found.filter((s, i, arr) => arr.findIndex(x => x.path === s.path) === i);
    setSuggestions(unique.slice(0, 8));
  };

  const fetchRelatedPosts = async () => {
    if (!category) return;
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, title')
      .eq('is_published', true)
      .eq('category', category)
      .limit(5);
    if (data) {
      setRelatedPosts(data.map(p => ({
        path: `/blog/${p.slug}`,
        label: p.title.substring(0, 50),
        reason: 'Same category',
      })));
    }
  };

  const handleCopy = (path: string, idx: number) => {
    navigator.clipboard.writeText(`https://truejobs.co.in${path}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const sufficient = currentInternalLinks >= BLOG_THRESHOLDS.INTERNAL_LINKS_GOOD;
  const allSuggestions = [...suggestions, ...relatedPosts];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-1">
          <Link2 className="h-4 w-4" /> Internal Links
        </span>
        <Badge variant={sufficient ? 'default' : 'secondary'}>
          {currentInternalLinks} link{currentInternalLinks !== 1 ? 's' : ''}
          {sufficient ? ' ✓' : ' — add more'}
        </Badge>
      </div>

      {allSuggestions.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Suggested links (click to copy URL):</p>
          {allSuggestions.map((s, i) => (
            <div key={`${s.path}-${i}`} className="flex items-center gap-2 text-xs group">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 gap-1 text-xs"
                onClick={() => handleCopy(s.path, i)}
              >
                {copiedIdx === i ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
              <span className="font-mono text-muted-foreground truncate">{s.path}</span>
              <span className="text-muted-foreground ml-auto text-[10px] truncate max-w-[120px]">{s.reason}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No link suggestions available for this content.</p>
      )}
    </div>
  );
}
