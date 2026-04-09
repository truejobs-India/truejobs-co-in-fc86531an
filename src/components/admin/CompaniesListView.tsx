import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Search, Building2, Briefcase, ChevronRight, ShieldBan, Loader2, AlertTriangle } from 'lucide-react';

interface CompanyData {
  id?: string; // registered companies have UUID
  name: string;
  jobCount: number;
}

interface CompaniesListViewProps {
  onCompanyClick: (companyName: string) => void;
  refreshKey?: number;
}

interface ImpactData {
  jobsByIdCount: number;
  jobsByNameCount: number;
  draftsCount: number;
  hasStorageAssets: boolean;
}

export function CompaniesListView({ onCompanyClick, refreshKey }: CompaniesListViewProps) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Remove & Block dialog state
  const [blockTarget, setBlockTarget] = useState<CompanyData | null>(null);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [aliases, setAliases] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

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
      // Query only registered companies from the companies table
      const { data: registeredCompanies, error } = await supabase
        .from('companies')
        .select('id, name');

      if (error) throw error;

      // For each company, count its non-deleted jobs
      const companiesWithCounts: CompanyData[] = await Promise.all(
        (registeredCompanies || []).map(async (c) => {
          const { count } = await supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .eq('company_id', c.id)
            .or('is_deleted.is.null,is_deleted.eq.false');
          return { id: c.id, name: c.name, jobCount: count || 0 };
        })
      );

      companiesWithCounts.sort((a, b) => b.jobCount - a.jobCount);
      setCompanies(companiesWithCounts);
      setFilteredCompanies(companiesWithCounts);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openBlockDialog = async (company: CompanyData) => {
    setBlockTarget(company);
    setConfirmName('');
    setAliases('');
    setImpact(null);
    setIsLoadingImpact(true);

    try {
      const normalized = company.name.trim().toLowerCase();
      
      // Fetch impact counts in parallel
      const [jobsByIdResult, jobsByNameResult, draftsResult] = await Promise.all([
        company.id
          ? supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('company_id', company.id)
          : Promise.resolve({ count: 0 }),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).ilike('company_name', normalized),
        company.id
          ? supabase.from('job_posting_drafts').select('id', { count: 'exact', head: true }).eq('company_id', company.id)
          : Promise.resolve({ count: 0 }),
      ]);

      // Check storage
      let hasStorageAssets = false;
      if (company.id) {
        const { data: storageFiles } = await supabase.storage.from('company-assets').list(company.id);
        hasStorageAssets = !!(storageFiles && storageFiles.length > 0);
      }

      setImpact({
        jobsByIdCount: (jobsByIdResult as any).count || 0,
        jobsByNameCount: (jobsByNameResult as any).count || 0,
        draftsCount: (draftsResult as any).count || 0,
        hasStorageAssets,
      });
    } catch (err) {
      console.error('Error fetching impact:', err);
      toast({ title: 'Error', description: 'Failed to compute impact', variant: 'destructive' });
    } finally {
      setIsLoadingImpact(false);
    }
  };

  const executeRemoveAndBlock = async () => {
    if (!blockTarget) return;
    setIsBlocking(true);

    try {
      const aliasArray = aliases
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      const { data, error } = await supabase.rpc('permanently_remove_and_block_company', {
        p_company_id: blockTarget.id || null,
        p_company_name: blockTarget.name,
        p_aliases: aliasArray,
        p_reason: 'Permanently removed by admin',
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) throw new Error(result.error);

      // Delete storage assets deterministically
      let storageStatus = '';
      if (blockTarget.id) {
        try {
          const { data: files } = await supabase.storage.from('company-assets').list(blockTarget.id);
          if (files && files.length > 0) {
            const paths = files.map(f => `${blockTarget.id}/${f.name}`);
            const { error: removeErr } = await supabase.storage.from('company-assets').remove(paths);
            if (removeErr) {
              storageStatus = `Storage cleanup failed for: ${paths.join(', ')}. Remove manually from company-assets bucket.`;
            } else {
              storageStatus = 'All company storage assets removed.';
            }
          }
        } catch {
          storageStatus = 'Storage cleanup could not be completed. Check company-assets bucket manually.';
        }
      }

      toast({
        title: 'Company Permanently Removed & Blocked',
        description: `Deleted ${result.deleted_jobs_by_id + result.deleted_jobs_by_name} jobs, ${result.deleted_drafts} drafts. ${storageStatus}`,
      });

      setBlockTarget(null);
      fetchCompanies();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to remove company', variant: 'destructive' });
    } finally {
      setIsBlocking(false);
    }
  };

  const canConfirm = confirmName.trim().toLowerCase() === blockTarget?.name.trim().toLowerCase();

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Registered Companies ({companies.length})
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
                <div key={company.name} className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 justify-between h-auto py-3 px-4 hover:bg-muted"
                    onClick={() => onCompanyClick(company.name)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-left">{company.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Briefcase className="h-3 w-3" />
                        {company.jobCount} job{company.jobCount !== 1 ? 's' : ''}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Button>
                  {company.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => openBlockDialog(company)}
                      title="Permanently Remove & Block"
                    >
                      <ShieldBan className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove & Block Confirmation Dialog */}
      <Dialog open={!!blockTarget} onOpenChange={() => !isBlocking && setBlockTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Permanently Remove & Block Company
            </DialogTitle>
            <DialogDescription>
              This action is <strong>irreversible</strong>. All company data, linked jobs, drafts,
              and storage assets will be permanently deleted. The company will be blocked from
              re-registering across all sources.
            </DialogDescription>
          </DialogHeader>

          {blockTarget && (
            <div className="space-y-4">
              {/* Company info */}
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <div><strong>Name:</strong> {blockTarget.name}</div>
                {blockTarget.id && <div><strong>ID:</strong> <code className="text-xs">{blockTarget.id}</code></div>}
                <div><strong>Type:</strong> {blockTarget.id ? 'Registered company' : 'Name-only'}</div>
              </div>

              {/* Impact counts */}
              {isLoadingImpact ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Computing impact...
                </div>
              ) : impact && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1 text-sm">
                  <div className="font-medium text-destructive mb-2">Will be permanently deleted:</div>
                  <div>• {impact.jobsByIdCount} jobs linked by company ID</div>
                  <div>• {impact.jobsByNameCount} jobs matched by company name</div>
                  <div>• {impact.draftsCount} job posting drafts</div>
                  <div>• Storage assets: {impact.hasStorageAssets ? 'Yes (will be removed)' : 'None'}</div>
                </div>
              )}

              {/* Aliases */}
              <div>
                <label className="text-sm font-medium">Known aliases (optional, comma-separated)</label>
                <Input
                  value={aliases}
                  onChange={e => setAliases(e.target.value)}
                  placeholder="e.g. Acme Corp, Acme Inc"
                  className="mt-1"
                />
              </div>

              {/* Type-to-confirm */}
              <div>
                <label className="text-sm font-medium">
                  Type <strong>"{blockTarget.name}"</strong> to confirm
                </label>
                <Input
                  value={confirmName}
                  onChange={e => setConfirmName(e.target.value)}
                  placeholder="Type company name exactly"
                  className="mt-1"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBlockTarget(null)} disabled={isBlocking}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={executeRemoveAndBlock}
                  disabled={!canConfirm || isBlocking || isLoadingImpact}
                >
                  {isBlocking ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Removing...</>
                  ) : (
                    <><ShieldBan className="h-4 w-4 mr-1" /> Permanently Remove & Block</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
