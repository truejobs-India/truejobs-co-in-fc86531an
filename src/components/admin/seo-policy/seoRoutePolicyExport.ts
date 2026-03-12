import { EvaluatedRoute } from './seoRoutePolicyTypes';

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPolicyCSV(routes: EvaluatedRoute[], filename = 'seo-route-policy.csv') {
  const headers = [
    'Slug', 'Title', 'Page Type', 'Category', 'Policy Source',
    'Indexability', 'In Sitemap', 'Cache Served', 'Canonical',
    'Reason Summary', 'Evidence Passed', 'Evidence Failed', 'Conflict Count',
  ];

  const rows = routes.map(r => [
    r.slug,
    `"${(r.title || '').replace(/"/g, '""')}"`,
    r.pageType,
    r.policy.category,
    r.policy.policySource,
    r.policy.expectedIndexability,
    r.policy.includeInSitemap ? 'yes' : 'no',
    r.policy.isCacheServed ? 'yes' : 'no',
    r.policy.canonicalUrl,
    `"${r.reasonSummary.replace(/"/g, '""')}"`,
    r.evidencePassed,
    r.evidenceFailed,
    r.conflicts.length,
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csv, filename, 'text/csv');
}

export function exportPolicyJSON(routes: EvaluatedRoute[], filename = 'seo-route-policy.json') {
  downloadBlob(JSON.stringify(routes, null, 2), filename, 'application/json');
}
