/**
 * AI-Free Job Matching Algorithm
 * Computes match scores between user profiles and job listings
 * using weighted similarity across multiple dimensions
 */

import { Profile, Job, JobType, ExperienceLevel } from '@/types/database';

export interface MatchResult {
  job: Job;
  score: number;
  breakdown: {
    skills: number;
    jobType: number;
    experience: number;
    location: number;
    salary: number;
  };
}

interface MatchingConfig {
  weights: {
    skills: number;
    jobType: number;
    experience: number;
    location: number;
    salary: number;
  };
}

const DEFAULT_CONFIG: MatchingConfig = {
  weights: {
    skills: 0.40,      // Most important - 40%
    jobType: 0.15,     // Job type preference - 15%
    experience: 0.20,  // Experience level match - 20%
    location: 0.15,    // Location preference - 15%
    salary: 0.10,      // Salary expectations - 10%
  },
};

/**
 * Normalize text for comparison (lowercase, trim, remove special chars)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

/**
 * Enhanced skill matching with partial matching support
 * E.g., "React" matches "React.js", "ReactJS", "React Native"
 */
function computeSkillScore(userSkills: string[], jobSkills: string[]): number {
  if (jobSkills.length === 0) return 1; // No skills required = perfect match
  if (userSkills.length === 0) return 0;
  
  const normalizedUserSkills = userSkills.map(normalizeText);
  const normalizedJobSkills = jobSkills.map(normalizeText);
  
  let matchedSkills = 0;
  
  for (const jobSkill of normalizedJobSkills) {
    // Exact match
    if (normalizedUserSkills.includes(jobSkill)) {
      matchedSkills += 1;
      continue;
    }
    
    // Partial match (user skill contains job skill or vice versa)
    const hasPartialMatch = normalizedUserSkills.some(userSkill => 
      userSkill.includes(jobSkill) || jobSkill.includes(userSkill)
    );
    
    if (hasPartialMatch) {
      matchedSkills += 0.7; // Partial matches count as 70%
    }
  }
  
  // Return percentage of job skills matched
  return Math.min(matchedSkills / normalizedJobSkills.length, 1);
}

/**
 * Compute job type preference match
 */
function computeJobTypeScore(preferredTypes: JobType[], jobType: JobType): number {
  if (preferredTypes.length === 0) return 0.5; // Neutral if no preference
  return preferredTypes.includes(jobType) ? 1 : 0;
}

/**
 * Compute experience level match
 * Perfect match = 1, close match = 0.5-0.8, far match = 0-0.3
 */
function computeExperienceScore(
  userYears: number,
  jobMinYears: number,
  jobMaxYears: number | null,
  _jobLevel: ExperienceLevel // Reserved for future use
): number {
  // Check years-based matching
  const effectiveMax = jobMaxYears ?? jobMinYears + 5;
  
  if (userYears >= jobMinYears && userYears <= effectiveMax) {
    return 1; // Perfect fit
  }
  
  if (userYears < jobMinYears) {
    // Under-qualified: score based on how close
    const gap = jobMinYears - userYears;
    if (gap <= 1) return 0.7;
    if (gap <= 2) return 0.5;
    if (gap <= 3) return 0.3;
    return 0.1;
  }
  
  // Over-qualified: mild penalty
  const overBy = userYears - effectiveMax;
  if (overBy <= 2) return 0.8;
  if (overBy <= 5) return 0.6;
  return 0.4;
}

/**
 * Compute location match score
 */
function computeLocationScore(
  userLocation: string | null,
  preferredLocations: string[],
  jobLocation: string | null,
  isRemote: boolean
): number {
  // Remote jobs match everyone
  if (isRemote) return 1;
  
  if (!jobLocation) return 0.5; // Unknown location = neutral
  
  const normalizedJobLocation = normalizeText(jobLocation);
  
  // Check preferred locations first
  if (preferredLocations.length > 0) {
    const hasPreferredMatch = preferredLocations.some(loc => 
      normalizeText(loc).includes(normalizedJobLocation) ||
      normalizedJobLocation.includes(normalizeText(loc))
    );
    if (hasPreferredMatch) return 1;
  }
  
  // Check user's current location
  if (userLocation) {
    const normalizedUserLocation = normalizeText(userLocation);
    if (normalizedUserLocation.includes(normalizedJobLocation) ||
        normalizedJobLocation.includes(normalizedUserLocation)) {
      return 0.9;
    }
  }
  
  // No location preference set
  if (preferredLocations.length === 0 && !userLocation) {
    return 0.5;
  }
  
  return 0.2; // Location doesn't match preferences
}

/**
 * Compute salary expectation match
 */
function computeSalaryScore(
  expectedMin: number | null,
  expectedMax: number | null,
  jobMin: number | null,
  jobMax: number | null
): number {
  // If either side has no salary info, neutral score
  if ((expectedMin === null && expectedMax === null) ||
      (jobMin === null && jobMax === null)) {
    return 0.5;
  }
  
  const userMin = expectedMin ?? 0;
  const userMax = expectedMax ?? Infinity;
  const jMin = jobMin ?? 0;
  const jMax = jobMax ?? jMin * 1.5;
  
  // Check overlap
  const overlapMin = Math.max(userMin, jMin);
  const overlapMax = Math.min(userMax, jMax);
  
  if (overlapMin <= overlapMax) {
    // There's overlap
    const overlapRange = overlapMax - overlapMin;
    const userRange = userMax === Infinity ? jMax - jMin : userMax - userMin;
    const jobRange = jMax - jMin;
    
    if (userRange === 0 || jobRange === 0) return 1;
    
    const overlapPercent = overlapRange / Math.min(userRange || 1, jobRange || 1);
    return Math.min(overlapPercent, 1);
  }
  
  // No overlap - calculate how far apart
  const gap = overlapMin - overlapMax;
  const avgSalary = (jMin + jMax) / 2 || 1;
  const gapPercent = gap / avgSalary;
  
  if (gapPercent < 0.1) return 0.7;
  if (gapPercent < 0.2) return 0.5;
  if (gapPercent < 0.3) return 0.3;
  return 0.1;
}

/**
 * Main matching function - computes match score between profile and job
 */
export function computeJobMatch(
  profile: Profile,
  job: Job,
  config: MatchingConfig = DEFAULT_CONFIG
): MatchResult {
  const breakdown = {
    skills: computeSkillScore(profile.skills || [], job.skills_required || []),
    jobType: computeJobTypeScore(
      (profile.preferred_job_types as JobType[]) || [],
      job.job_type
    ),
    experience: computeExperienceScore(
      profile.experience_years || 0,
      job.experience_years_min || 0,
      job.experience_years_max,
      job.experience_level
    ),
    location: computeLocationScore(
      profile.location,
      profile.preferred_locations || [],
      job.location,
      job.is_remote
    ),
    salary: computeSalaryScore(
      profile.expected_salary_min,
      profile.expected_salary_max,
      job.salary_min,
      job.salary_max
    ),
  };
  
  // Compute weighted score
  const score = 
    breakdown.skills * config.weights.skills +
    breakdown.jobType * config.weights.jobType +
    breakdown.experience * config.weights.experience +
    breakdown.location * config.weights.location +
    breakdown.salary * config.weights.salary;
  
  return {
    job,
    score: Math.round(score * 100), // Convert to percentage
    breakdown,
  };
}

/**
 * Rank multiple jobs against a profile
 * Returns jobs sorted by match score (highest first)
 */
export function rankJobsForProfile(
  profile: Profile,
  jobs: Job[],
  config: MatchingConfig = DEFAULT_CONFIG,
  _appliedJobIds: string[] = [] // Reserved for future boosting
): MatchResult[] {
  const results = jobs.map(job => {
    return computeJobMatch(profile, job, config);
  });
  
  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Extract skill patterns from user's application history
 * to improve future recommendations
 */
export function extractSkillPatternsFromApplications(
  appliedJobs: Job[]
): Map<string, number> {
  const skillFrequency = new Map<string, number>();
  
  for (const job of appliedJobs) {
    for (const skill of job.skills_required || []) {
      const normalized = normalizeText(skill);
      skillFrequency.set(normalized, (skillFrequency.get(normalized) || 0) + 1);
    }
  }
  
  return skillFrequency;
}

/**
 * Boost matching config based on user's application patterns
 */
export function createPersonalizedConfig(
  baseConfig: MatchingConfig | undefined,
  appliedJobs: Job[],
  _profile: Profile // Reserved for profile-based personalization
): MatchingConfig {
  const config = baseConfig ?? DEFAULT_CONFIG;
  // If user has applied to jobs, learn from their patterns
  if (appliedJobs.length === 0) return config;
  
  // Analyze what types of jobs they apply to
  const typeFrequency = new Map<JobType, number>();
  const remoteCount = appliedJobs.filter(j => j.is_remote).length;
  
  for (const job of appliedJobs) {
    typeFrequency.set(job.job_type, (typeFrequency.get(job.job_type) || 0) + 1);
  }
  
  // If user consistently applies to certain job types, increase that weight
  const dominantType = [...typeFrequency.entries()]
    .sort((a, b) => b[1] - a[1])[0];
  
  if (dominantType && dominantType[1] / appliedJobs.length > 0.6) {
    // User has strong preference for this job type
    return {
      weights: {
        ...config.weights,
        jobType: Math.min(config.weights.jobType * 1.5, 0.25),
        skills: config.weights.skills - 0.05, // Rebalance
      },
    };
  }
  
  // If user prefers remote jobs
  if (remoteCount / appliedJobs.length > 0.7) {
    return {
      weights: {
        ...config.weights,
        location: Math.min(config.weights.location * 1.5, 0.25),
        skills: config.weights.skills - 0.05,
      },
    };
  }
  
  return baseConfig;
}

/**
 * Get match score label and color
 */
export function getMatchScoreDisplay(score: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (score >= 80) {
    return { label: 'Excellent Match', color: 'text-green-600', bgColor: 'bg-green-100' };
  }
  if (score >= 60) {
    return { label: 'Good Match', color: 'text-blue-600', bgColor: 'bg-blue-100' };
  }
  if (score >= 40) {
    return { label: 'Fair Match', color: 'text-amber-600', bgColor: 'bg-amber-100' };
  }
  return { label: 'Low Match', color: 'text-gray-600', bgColor: 'bg-gray-100' };
}
