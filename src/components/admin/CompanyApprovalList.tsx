import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Building2,
  Loader2,
  ExternalLink,
  MapPin,
  Users,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PendingCompany {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  industry: string | null;
  company_size: string | null;
  founded_year: number | null;
  website_url: string | null;
  location: string | null;
  created_at: string;
}

interface CompanyApprovalListProps {
  onStatsChange?: () => void;
}

export function CompanyApprovalList({ onStatsChange }: CompanyApprovalListProps) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<PendingCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<PendingCompany | null>(null);
  const [processingCompany, setProcessingCompany] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingCompanies();
  }, []);

  const fetchPendingCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching pending companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending companies',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (companyId: string) => {
    setProcessingCompany(companyId);
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_approved: true })
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: 'Company Approved',
        description: 'The company can now post jobs',
      });

      setCompanies(companies.filter(c => c.id !== companyId));
      setSelectedCompany(null);
      onStatsChange?.();
    } catch (error) {
      console.error('Error approving company:', error);
      toast({
        title: 'Error',
        description: 'Failed to approve company',
        variant: 'destructive',
      });
    } finally {
      setProcessingCompany(null);
    }
  };

  const handleRejectAndBlock = async (company: PendingCompany) => {
    setProcessingCompany(company.id);
    
    try {
      const { data, error } = await supabase.rpc('permanently_remove_and_block_company', {
        p_company_id: company.id,
        p_company_name: company.name,
        p_aliases: [],
        p_reason: 'Rejected and blocked during approval review',
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) throw new Error(result.error);

      toast({
        title: 'Company Rejected & Blocked',
        description: `${company.name} has been permanently removed and blocked from re-registering.`,
      });

      setCompanies(companies.filter(c => c.id !== company.id));
      setSelectedCompany(null);
      onStatsChange?.();
    } catch (error) {
      console.error('Error rejecting company:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject company',
        variant: 'destructive',
      });
    } finally {
      setProcessingCompany(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Pending Company Approvals
          </CardTitle>
          <CardDescription>
            Review and approve company profiles before they can post jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
              <p className="text-muted-foreground">
                No companies pending approval
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={company.logo_url || undefined} alt={`${company.name} logo`} />
                          <AvatarFallback>{company.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{company.name}</div>
                          {company.website_url && (
                            <a 
                              href={company.website_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:underline"
                            >
                              {company.website_url.replace(/^https?:\/\//, '').slice(0, 30)}
                            </a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {company.industry || 'Not specified'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {company.location || 'Not specified'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(company.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCompany(company)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(company.id)}
                          disabled={processingCompany === company.id}
                          className="text-green-600 hover:text-green-700"
                        >
                          {processingCompany === company.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(company.id)}
                          disabled={processingCompany === company.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Company Detail Dialog */}
      <Dialog open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedCompany?.logo_url || undefined} alt={`${selectedCompany?.name} logo`} />
                <AvatarFallback>{selectedCompany?.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <div>{selectedCompany?.name}</div>
                <Badge variant="outline" className="mt-1">
                  {selectedCompany?.industry || 'Industry not specified'}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription>
              Company profile pending approval
            </DialogDescription>
          </DialogHeader>
          
          {selectedCompany && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedCompany.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {selectedCompany.location}
                  </div>
                )}
                {selectedCompany.company_size && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {selectedCompany.company_size} employees
                  </div>
                )}
                {selectedCompany.founded_year && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Founded {selectedCompany.founded_year}
                  </div>
                )}
                {selectedCompany.website_url && (
                  <a 
                    href={selectedCompany.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Website
                  </a>
                )}
              </div>

              {selectedCompany.description && (
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">About</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedCompany.description}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedCompany(null)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleReject(selectedCompany.id)}
                  disabled={processingCompany === selectedCompany.id}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  onClick={() => handleApprove(selectedCompany.id)}
                  disabled={processingCompany === selectedCompany.id}
                >
                  {processingCompany === selectedCompany.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
