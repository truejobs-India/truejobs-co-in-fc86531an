import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Plus, 
  Trash2, 
  Loader2,
  AlertTriangle,
  Ban,
  Globe,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import type { RestrictedDomain, AppSetting } from '@/types/database';

interface RestrictedDomainsManagerProps {
  onSettingsChange?: () => void;
}

export function RestrictedDomainsManager({ onSettingsChange }: RestrictedDomainsManagerProps) {
  const { toast } = useToast();
  const [domains, setDomains] = useState<RestrictedDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteDomain, setDeleteDomain] = useState<RestrictedDomain | null>(null);
  const [blockingEnabled, setBlockingEnabled] = useState(true);
  const [isUpdatingToggle, setIsUpdatingToggle] = useState(false);
  
  const [formData, setFormData] = useState({
    domain: '',
    reason: 'Job portal - ToS restrictions',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch domains
      const { data: domainsData, error: domainsError } = await supabase
        .from('restricted_domains')
        .select('*')
        .order('domain', { ascending: true });

      if (domainsError) throw domainsError;
      setDomains(domainsData || []);

      // Fetch blocking setting
      const { data: settingData, error: settingError } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'scraping_block_job_portals')
        .single();

      if (!settingError && settingData) {
        const value = settingData.value as { enabled?: boolean };
        setBlockingEnabled(value.enabled ?? true);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load restricted domains',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBlocking = async (enabled: boolean) => {
    setIsUpdatingToggle(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value: { enabled },
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'scraping_block_job_portals');

      if (error) throw error;

      setBlockingEnabled(enabled);
      onSettingsChange?.();
      
      toast({
        title: enabled ? 'Blocking Enabled' : 'Blocking Disabled',
        description: enabled 
          ? 'Job portals will be blocked from scraping'
          : '⚠️ Warning: Job portals can now be scraped. Proceed with caution.',
        variant: enabled ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: 'Error',
        description: 'Failed to update setting',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingToggle(false);
    }
  };

  const handleAddDomain = async () => {
    if (!formData.domain) {
      toast({
        title: 'Validation Error',
        description: 'Domain is required',
        variant: 'destructive',
      });
      return;
    }

    // Normalize domain
    let normalizedDomain = formData.domain.toLowerCase().trim();
    normalizedDomain = normalizedDomain.replace(/^(https?:\/\/)?(www\.)?/, '');
    normalizedDomain = normalizedDomain.replace(/\/.*$/, '');

    try {
      const { error } = await supabase
        .from('restricted_domains')
        .insert({
          domain: normalizedDomain,
          reason: formData.reason || 'Job portal - ToS restrictions',
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Duplicate Domain',
            description: 'This domain is already in the restricted list',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Domain Added',
        description: `${normalizedDomain} added to restricted list`,
      });

      setFormData({ domain: '', reason: 'Job portal - ToS restrictions' });
      setIsAddDialogOpen(false);
      fetchData();
      onSettingsChange?.();
    } catch (error: any) {
      console.error('Error adding domain:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add domain',
        variant: 'destructive',
      });
    }
  };

  const handleToggleDomain = async (domain: RestrictedDomain) => {
    try {
      const { error } = await supabase
        .from('restricted_domains')
        .update({ is_active: !domain.is_active })
        .eq('id', domain.id);

      if (error) throw error;

      setDomains(domains.map(d => 
        d.id === domain.id ? { ...d, is_active: !d.is_active } : d
      ));
      
      toast({
        title: domain.is_active ? 'Domain Disabled' : 'Domain Enabled',
        description: `${domain.domain} is now ${domain.is_active ? 'allowed' : 'blocked'}`,
      });
      onSettingsChange?.();
    } catch (error) {
      console.error('Error toggling domain:', error);
      toast({
        title: 'Error',
        description: 'Failed to update domain',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDomain = async () => {
    if (!deleteDomain) return;

    try {
      const { error } = await supabase
        .from('restricted_domains')
        .delete()
        .eq('id', deleteDomain.id);

      if (error) throw error;

      toast({
        title: 'Domain Removed',
        description: `${deleteDomain.domain} removed from restricted list`,
      });

      setDeleteDomain(null);
      fetchData();
      onSettingsChange?.();
    } catch (error) {
      console.error('Error deleting domain:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove domain',
        variant: 'destructive',
      });
    }
  };

  const activeDomains = domains.filter(d => d.is_active);
  const inactiveDomains = domains.filter(d => !d.is_active);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Restricted Domains
              </CardTitle>
              <CardDescription>
                Block scraping of job portals and other restricted sites for ToS compliance
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Restricted Domain</DialogTitle>
                  <DialogDescription>
                    Add a domain to block from scraping. Common job portals are pre-configured.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="example.com"
                      value={formData.domain}
                      onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter domain without http/https (e.g., naukri.com)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Input
                      id="reason"
                      placeholder="Job portal - ToS restrictions"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddDomain}>Add Domain</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Global Toggle */}
          <div className={`flex items-center justify-between p-4 rounded-lg border-2 ${
            blockingEnabled 
              ? 'bg-green-500/10 border-green-500/30' 
              : 'bg-destructive/10 border-destructive/30'
          }`}>
            <div className="flex items-center gap-3">
              {blockingEnabled ? (
                <Shield className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-destructive" />
              )}
              <div>
                <h3 className="font-semibold">
                  {blockingEnabled ? 'Job Portal Blocking: Active' : 'Job Portal Blocking: Disabled'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {blockingEnabled 
                    ? 'Restricted domains will be blocked from scraping'
                    : 'Warning: All domains can be scraped, including job portals'}
                </p>
              </div>
            </div>
            <Switch
              checked={blockingEnabled}
              onCheckedChange={handleToggleBlocking}
              disabled={isUpdatingToggle}
            />
          </div>

          {!blockingEnabled && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Compliance Warning:</strong> Scraping job portals may violate their Terms of Service 
                and could result in legal action or IP blocking. Only disable this for testing purposes.
              </AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{domains.length}</div>
              <div className="text-xs text-muted-foreground">Total Domains</div>
            </div>
            <div className="bg-destructive/10 rounded-lg p-3 text-center border border-destructive/20">
              <div className="text-2xl font-bold text-destructive">{activeDomains.length}</div>
              <div className="text-xs text-destructive">Blocked</div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-muted-foreground">{inactiveDomains.length}</div>
              <div className="text-xs text-muted-foreground">Allowed</div>
            </div>
          </div>

          {/* Domains Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : domains.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Restricted Domains</h3>
              <p className="text-muted-foreground">Add domains to block from scraping</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {domains.map((domain) => (
                    <TableRow key={domain.id}>
                      <TableCell className="font-mono text-sm">
                        {domain.domain}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {domain.reason}
                      </TableCell>
                      <TableCell className="text-center">
                        {domain.is_active ? (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" />
                            Blocked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Allowed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={domain.is_active}
                            onCheckedChange={() => handleToggleDomain(domain)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteDomain(domain)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteDomain} onOpenChange={() => setDeleteDomain(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Restricted Domain?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{deleteDomain?.domain}" from the restricted list.
              Scraping will be allowed for this domain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDomain}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
