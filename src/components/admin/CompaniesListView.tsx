import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Search, Building2, Briefcase, ChevronRight } from 'lucide-react';

interface CompanyData {
  name: string;
  jobCount: number;
}

interface CompaniesListViewProps {
  onCompanyClick: (companyName: string) => void;
  refreshKey?: number;
}

export function CompaniesListView({ onCompanyClick, refreshKey }: CompaniesListViewProps) {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, [refreshKey]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCompanies(companies);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCompanies(
        companies.filter((c) => c.name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, companies]);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const companyMap = new Map<string, number>();

      // 1. Fetch registered companies from the companies table
      const { data: registeredCompanies } = await supabase
        .from('companies')
        .select('id, name');

      const companyIdToName = new Map<string, string>();
      if (registeredCompanies) {
        registeredCompanies.forEach((c) => {
          companyIdToName.set(c.id, c.name);
          // Initialize with 0 so they always appear
          companyMap.set(c.name, 0);
        });
      }

      // 2. Count jobs per company (by company_name OR company_id)
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('jobs')
          .select('company_name, company_id')
          .or('is_deleted.is.null,is_deleted.eq.false')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          data.forEach((job: { company_name: string | null; company_id: string | null }) => {
            // Resolve name: prefer company_name, fallback to registered company name via company_id
            const name = job.company_name?.trim() || 
              (job.company_id ? companyIdToName.get(job.company_id) : null);
            if (name) {
              companyMap.set(name, (companyMap.get(name) || 0) + 1);
            }
          });
          hasMore = data.length === pageSize;
          page++;
        }
      }

      const companiesArray = Array.from(companyMap.entries())
        .map(([name, jobCount]) => ({ name, jobCount }))
        .sort((a, b) => b.jobCount - a.jobCount);

      setCompanies(companiesArray);
      setFilteredCompanies(companiesArray);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Companies ({companies.length})
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredCompanies.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {searchQuery ? 'No companies match your search' : 'No companies found'}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredCompanies.map((company) => (
              <Button
                key={company.name}
                variant="ghost"
                className="w-full justify-between h-auto py-3 px-4 hover:bg-muted"
                onClick={() => onCompanyClick(company.name)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-left">{company.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Briefcase className="h-3 w-3" />
                    {company.jobCount} job{company.jobCount !== 1 ? 's' : ''}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
