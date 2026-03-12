import { describe, it, expect } from 'vitest';
import { CITY_JOBS_DATA } from '../pages/seo/cityJobsData';

describe('City Jobs Data - Duplicate Check', () => {
  it('should have no duplicate slugs', () => {
    const slugs = CITY_JOBS_DATA.map(c => c.slug);
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    slugs.forEach((s, i) => {
      if (seen.has(s)) {
        duplicates.push(`"${s}" at index ${seen.get(s)} and ${i}`);
      }
      seen.set(s, i);
    });
    expect(duplicates, `Duplicate slugs found: ${duplicates.join(', ')}`).toHaveLength(0);
  });

  it('should have no duplicate city names', () => {
    const cities = CITY_JOBS_DATA.map(c => c.city.toLowerCase());
    const seen = new Map<string, number>();
    const duplicates: string[] = [];
    cities.forEach((c, i) => {
      if (seen.has(c)) {
        duplicates.push(`"${c}" at index ${seen.get(c)} and ${i}`);
      }
      seen.set(c, i);
    });
    expect(duplicates, `Duplicate cities found: ${duplicates.join(', ')}`).toHaveLength(0);
  });

  it('should have exactly 100 entries', () => {
    expect(CITY_JOBS_DATA).toHaveLength(100);
  });

  it('all slugs should start with jobs-in-', () => {
    const invalid = CITY_JOBS_DATA.filter(c => !c.slug.startsWith('jobs-in-'));
    expect(invalid.map(c => c.slug)).toHaveLength(0);
  });
});
