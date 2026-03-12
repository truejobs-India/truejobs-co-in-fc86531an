import { JobPostingWizard } from '@/components/employer/job-posting/JobPostingWizard';
import { SEO } from '@/components/SEO';

export default function PostJob() {
  return (
    <>
      <SEO title="Post a Job" noindex />
      <JobPostingWizard />
    </>
  );
}
