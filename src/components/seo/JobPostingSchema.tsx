import { Helmet } from 'react-helmet-async';
import { Job } from '@/types/database';

interface JobPostingSchemaProps {
  job: Job;
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
}

const SITE_URL = 'https://truejobs.co.in';
const SITE_NAME = 'TrueJobs';

/**
 * Maps internal job types to Schema.org EmploymentType values
 * @see https://schema.org/EmploymentType
 */
const mapEmploymentType = (jobType: string, isRemote?: boolean): string[] => {
  const types: string[] = [];
  
  switch (jobType) {
    case 'full_time':
      types.push('FULL_TIME');
      break;
    case 'part_time':
      types.push('PART_TIME');
      break;
    case 'contract':
      types.push('CONTRACTOR');
      break;
    case 'internship':
      types.push('INTERN');
      break;
    case 'remote':
      types.push('FULL_TIME'); // Remote is a location type, not employment type
      break;
    default:
      types.push('FULL_TIME');
  }
  
  return types;
};

/**
 * Generates Google Jobs-compatible JSON-LD structured data
 * @see https://developers.google.com/search/docs/appearance/structured-data/job-posting
 */
export function JobPostingSchema({ job, companyName, companyLogo, companyWebsite }: JobPostingSchemaProps) {
  // Calculate valid through date (30 days from posting if not set)
  const validThrough = job.expires_at 
    ? new Date(job.expires_at).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Parse location into components
  const locationParts = job.location?.split(',').map(s => s.trim()) || [];
  const cityName = locationParts[0] || 'India';
  const stateName = locationParts[1] || '';
  const countryName = locationParts[2] || 'IN';

  // Build location object
  const jobLocation: any = {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressLocality: cityName,
      addressRegion: stateName,
      addressCountry: countryName,
    },
  };

  // Build salary specification if available
  const baseSalary = job.is_salary_visible && (job.salary_min || job.salary_max) ? {
    '@type': 'MonetaryAmount',
    currency: job.salary_currency || 'INR',
    value: {
      '@type': 'QuantitativeValue',
      ...(job.salary_min && job.salary_max ? {
        minValue: job.salary_min,
        maxValue: job.salary_max,
      } : job.salary_min ? {
        value: job.salary_min,
      } : {
        value: job.salary_max,
      }),
      unitText: 'YEAR', // Default to yearly
    },
  } : undefined;

  // Build the complete JobPosting schema
  const jobPostingSchema = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    
    // Required fields
    title: job.title,
    description: job.description,
    datePosted: new Date(job.created_at).toISOString(),
    validThrough: validThrough,
    
    // Hiring organization
    hiringOrganization: {
      '@type': 'Organization',
      name: companyName,
      sameAs: companyWebsite || undefined,
      logo: companyLogo || `${SITE_URL}/favicon.png`,
    },
    
    // Job location
    jobLocation: jobLocation,
    
    // Location requirements for remote jobs
    ...(job.is_remote ? {
      jobLocationType: 'TELECOMMUTE',
      applicantLocationRequirements: {
        '@type': 'Country',
        name: 'India',
      },
    } : {}),
    
    // Employment type
    employmentType: mapEmploymentType(job.job_type, job.is_remote),
    
    // Salary (if visible)
    ...(baseSalary ? { baseSalary } : {}),
    
    // Identifier
    identifier: {
      '@type': 'PropertyValue',
      name: SITE_NAME,
      value: job.id,
    },
    
    // Additional recommended fields
    directApply: true,
    
    // Experience requirements
    ...(job.experience_years_min !== null || job.experience_years_max !== null ? {
      experienceRequirements: {
        '@type': 'OccupationalExperienceRequirements',
        monthsOfExperience: (job.experience_years_min || 0) * 12,
      },
    } : {}),
    
    // Skills if available
    ...(job.skills_required && job.skills_required.length > 0 ? {
      skills: job.skills_required.join(', '),
    } : {}),
    
    // Industry if available
    ...(job.company?.industry ? {
      industry: job.company.industry,
    } : {}),
    
    // Job benefits if available
    ...(job.benefits && job.benefits.length > 0 ? {
      jobBenefits: job.benefits.join(', '),
    } : {}),
    
    // Responsibilities if available
    ...(job.responsibilities ? {
      responsibilities: job.responsibilities,
    } : {}),
    
    // Qualifications if available
    ...(job.requirements ? {
      qualifications: job.requirements,
    } : {}),
  };

  return (
    <Helmet>
      {/* Canonical tag: for duplicates, point to canonical; for others, point to self */}
      {/* Canonical is handled by CanonicalJobMeta in JobDetail.tsx for duplicates */}
      {!job.is_duplicate && (
        <link rel="canonical" href={`${SITE_URL}/jobs/${job.slug}`} />
      )}
      
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(jobPostingSchema)}
      </script>
    </Helmet>
  );
}

/**
 * Generates a breadcrumb schema for job pages
 */
export function JobBreadcrumbSchema({ job }: { job: Job }) {
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Jobs',
        item: `${SITE_URL}/jobs`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: job.title,
        item: `${SITE_URL}/jobs/${job.slug}`,
      },
    ],
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
    </Helmet>
  );
}
