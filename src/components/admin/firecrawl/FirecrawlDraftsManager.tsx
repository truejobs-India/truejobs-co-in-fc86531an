/**
 * Firecrawl Admin — thin container rendering 3 source sections + 3 draft sections.
 */
import { FirecrawlSourcesManager } from './FirecrawlSourcesManager';
import { GovtSourcesManager } from './GovtSourcesManager';
import { DraftJobsSection } from './DraftJobsSection';

export function FirecrawlDraftsManager() {
  return (
    <div className="space-y-4">
      {/* Source sections */}
      <GovtSourcesManager />
      <FirecrawlSourcesManager sourceTypeFilter="firecrawl_sitemap" />

      {/* Draft sections */}
      <DraftJobsSection sourceTypeTag="government" />
      <DraftJobsSection sourceTypeTag="firecrawl_sitemap" />
    </div>
  );
}
