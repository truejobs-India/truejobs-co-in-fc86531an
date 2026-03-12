import { PageValidationReport } from './cacheTypes';

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportValidationCSV(reports: PageValidationReport[], filename = 'seo-validation-report.csv') {
  const headers = ['Slug', 'Page Type', 'Severity', 'Category', 'Check', 'Detail', 'Recommended Fix'];
  const rows: string[][] = [];
  for (const r of reports) {
    for (const c of r.checks) {
      if (c.severity === 'pass') continue;
      rows.push([
        r.slug,
        r.pageType,
        c.severity,
        c.category,
        `"${c.label.replace(/"/g, '""')}"`,
        `"${c.detail.replace(/"/g, '""')}"`,
        `"${c.fix.replace(/"/g, '""')}"`,
      ]);
    }
  }
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  downloadBlob(csv, filename, 'text/csv');
}

export function exportValidationJSON(reports: PageValidationReport[], filename = 'seo-validation-report.json') {
  const data = reports
    .filter(r => r.worstSeverity !== 'pass')
    .map(r => ({
      slug: r.slug,
      pageType: r.pageType,
      worstSeverity: r.worstSeverity,
      failCount: r.failCount,
      warnCount: r.warnCount,
      checks: r.checks.filter(c => c.severity !== 'pass'),
    }));
  downloadBlob(JSON.stringify(data, null, 2), filename, 'application/json');
}
