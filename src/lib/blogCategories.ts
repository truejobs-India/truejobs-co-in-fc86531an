import iconJobSearch from '@/assets/icon-blog-job-search.png';
import iconCareerAdvice from '@/assets/icon-blog-career-advice.png';
import iconResume from '@/assets/icon-blog-resume.png';
import iconInterview from '@/assets/icon-blog-interview.png';
import iconHrRecruitment from '@/assets/icon-blog-hr-recruitment.png';
import iconHiringTrends from '@/assets/icon-blog-hiring-trends.png';
import iconAiRecruitment from '@/assets/icon-blog-ai-recruitment.png';

export interface BlogCategoryEntry {
  slug: string;
  name: string;
  image: string | null;
}

export const BLOG_CATEGORIES: BlogCategoryEntry[] = [
  { slug: 'job-search', name: 'Job Search', image: iconJobSearch },
  { slug: 'career-advice', name: 'Career Advice', image: iconCareerAdvice },
  { slug: 'resume', name: 'Resume', image: iconResume },
  { slug: 'interview', name: 'Interview', image: iconInterview },
  { slug: 'hr-recruitment', name: 'HR & Recruitment', image: iconHrRecruitment },
  { slug: 'hiring-trends', name: 'Hiring Trends', image: iconHiringTrends },
  { slug: 'ai-in-recruitment', name: 'AI in Recruitment', image: iconAiRecruitment },
  { slug: 'results-admit-cards', name: 'Results & Admit Cards', image: null },
  { slug: 'exam-preparation', name: 'Exam Preparation', image: null },
  { slug: 'sarkari-naukri-basics', name: 'Sarkari Naukri Basics', image: null },
  { slug: 'career-guides-tips', name: 'Career Guides & Tips', image: null },
  { slug: 'job-information', name: 'Job Information', image: null },
  { slug: 'government-jobs', name: 'Government Jobs', image: null },
  { slug: 'syllabus', name: 'Syllabus', image: null },
  { slug: 'current-affairs', name: 'Current Affairs', image: null },
  { slug: 'admit-cards', name: 'Admit Cards', image: null },
];
