import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Download, Search, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface Enrollment {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  experience: string;
  job_role: string | null;
  preferred_location: string | null;
  skills: string | null;
  status: string;
  created_at: string;
}

export function EnrollmentsManager() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_enrollments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast({ title: 'Error', description: 'Failed to load enrollments', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = enrollments.filter((e) => {
    const q = searchQuery.toLowerCase();
    return (
      e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.phone.includes(q) ||
      (e.job_role?.toLowerCase().includes(q) ?? false)
    );
  });

  const downloadCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Experience', 'Job Role', 'Location', 'Skills', 'Status', 'Registered At'];
    const rows = filtered.map((e) => [
      e.full_name,
      e.email,
      e.phone,
      e.experience,
      e.job_role || '',
      e.preferred_location || '',
      e.skills || '',
      e.status,
      format(new Date(e.created_at), 'dd-MM-yyyy HH:mm'),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enrollments_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: 'Downloaded', description: `${filtered.length} records exported to CSV` });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-xl">Campaign Enrollments</CardTitle>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
            <Button onClick={fetchEnrollments} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={downloadCSV} disabled={filtered.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isLoading ? 'Loading...' : `${filtered.length} of ${enrollments.length} registrations`}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No enrollments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead>Job Role</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e, i) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{e.full_name}</TableCell>
                    <TableCell className="text-xs">{e.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.phone}</TableCell>
                    <TableCell>{e.experience}</TableCell>
                    <TableCell>{e.job_role || '—'}</TableCell>
                    <TableCell>{e.preferred_location || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === 'pending' ? 'secondary' : 'default'}>
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(e.created_at), 'dd MMM yyyy, HH:mm')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
