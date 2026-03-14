import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { 
  Search, 
  Users, 
  Mail, 
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  UserCheck,
  Briefcase,
  Shield,
  MoreVertical,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  location: string | null;
  is_active: boolean;
}

interface UserRole {
  user_id: string;
  role: string;
}

const PAGE_SIZE = 20;

type RoleFilter = 'all' | 'job_seeker' | 'employer' | 'admin';

export function UsersListView() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  // Role counts for badges
  const [roleCounts, setRoleCounts] = useState({
    all: 0,
    job_seeker: 0,
    employer: 0,
    admin: 0
  });

  useEffect(() => {
    fetchRoleCounts();
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [currentPage, roleFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter]);

  const fetchRoleCounts = async () => {
    try {
      const [allCount, seekerCount, employerCount, adminCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'job_seeker'),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'employer'),
        supabase.from('user_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      ]);

      setRoleCounts({
        all: allCount.count || 0,
        job_seeker: seekerCount.count || 0,
        employer: employerCount.count || 0,
        admin: adminCount.count || 0
      });
    } catch (error) {
      console.error('Error fetching role counts:', error);
    }
  };

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      // If filtering by role, first get user_ids with that role
      let filteredUserIds: string[] | null = null;
      
      if (roleFilter !== 'all') {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', roleFilter);
        
        if (rolesData) {
          filteredUserIds = rolesData.map(r => r.user_id);
        }
      }

      let query = supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, avatar_url, created_at, location, is_active', { count: 'exact' });

      // Apply role filter
      if (filteredUserIds !== null) {
        if (filteredUserIds.length === 0) {
          // No users with this role
          setProfiles([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
        query = query.in('user_id', filteredUserIds);
      }

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (error) throw error;
      setProfiles(data || []);
      setTotalCount(count || 0);

      // Fetch roles for these users
      if (data && data.length > 0) {
        const userIds = data.map(p => p.user_id);
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        if (rolesData) {
          const rolesMap = new Map<string, string>();
          rolesData.forEach((r: UserRole) => rolesMap.set(r.user_id, r.role));
          setUserRoles(rolesMap);
        }
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchProfiles();
  };

  const toggleUserActive = async (profile: Profile) => {
    try {
      const newStatus = !profile.is_active;
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('id', profile.id);
      if (error) throw error;
      toast({ title: `User ${newStatus ? 'activated' : 'paused'} successfully` });
      fetchProfiles();
      fetchRoleCounts();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({ title: 'Failed to update user status', variant: 'destructive' });
    }
  };

  const deleteUser = async (profile: Profile) => {
    try {
      // Delete user role first, then profile
      await supabase.from('user_roles').delete().eq('user_id', profile.user_id);
      const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
      if (error) throw error;
      toast({ title: 'User deleted successfully' });
      fetchProfiles();
      fetchRoleCounts();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: 'Failed to delete user', variant: 'destructive' });
    }
  };

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all users with the current filter (without pagination)
      let filteredUserIds: string[] | null = null;
      
      if (roleFilter !== 'all') {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', roleFilter);
        
        if (rolesData) {
          filteredUserIds = rolesData.map(r => r.user_id);
        }
      }

      let query = supabase
        .from('profiles')
        .select('id, user_id, full_name, email, phone, avatar_url, created_at, location, is_active');

      if (filteredUserIds !== null && filteredUserIds.length > 0) {
        query = query.in('user_id', filteredUserIds);
      } else if (filteredUserIds !== null && filteredUserIds.length === 0) {
        toast({ title: 'No users to export', variant: 'destructive' });
        setIsExporting(false);
        return;
      }

      if (searchQuery.trim()) {
        query = query.or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'No users to export', variant: 'destructive' });
        setIsExporting(false);
        return;
      }

      // Fetch roles for all users
      const userIds = data.map(p => p.user_id);
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map<string, string>();
      rolesData?.forEach((r: UserRole) => rolesMap.set(r.user_id, r.role));

      // Create CSV content
      const headers = ['Name', 'Email', 'Phone', 'Location', 'Role', 'Registered On'];
      const rows = data.map(profile => [
        profile.full_name || 'N/A',
        profile.email,
        profile.phone || 'N/A',
        profile.location || 'N/A',
        rolesMap.get(profile.user_id) || 'Unknown',
        format(new Date(profile.created_at), 'yyyy-MM-dd HH:mm')
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // Download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `truejobs_users_${roleFilter}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: `Exported ${data.length} users successfully!` });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getRoleBadge = (userId: string) => {
    const role = userRoles.get(userId);
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Admin</Badge>;
      case 'employer':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Employer</Badge>;
      case 'job_seeker':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Job Seeker</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getRoleIcon = (role: RoleFilter) => {
    switch (role) {
      case 'job_seeker': return <UserCheck className="h-4 w-4" />;
      case 'employer': return <Briefcase className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Users ({totalCount})
            </CardTitle>
            <Button 
              onClick={exportToCSV} 
              disabled={isExporting || totalCount === 0}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Download CSV'}
            </Button>
          </div>

          {/* Role Filter Tabs */}
          <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)} className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="all" className="flex items-center gap-1 text-xs sm:text-sm">
                {getRoleIcon('all')}
                <span className="hidden sm:inline">All</span>
                <Badge variant="secondary" className="ml-1 text-xs">{roleCounts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="job_seeker" className="flex items-center gap-1 text-xs sm:text-sm">
                {getRoleIcon('job_seeker')}
                <span className="hidden sm:inline">Candidates</span>
                <Badge variant="secondary" className="ml-1 text-xs">{roleCounts.job_seeker}</Badge>
              </TabsTrigger>
              <TabsTrigger value="employer" className="flex items-center gap-1 text-xs sm:text-sm">
                {getRoleIcon('employer')}
                <span className="hidden sm:inline">Employers</span>
                <Badge variant="secondary" className="ml-1 text-xs">{roleCounts.employer}</Badge>
              </TabsTrigger>
              <TabsTrigger value="admin" className="flex items-center gap-1 text-xs sm:text-sm">
                {getRoleIcon('admin')}
                <span className="hidden sm:inline">Admins</span>
                <Badge variant="secondary" className="ml-1 text-xs">{roleCounts.admin}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No users found
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors ${!profile.is_active ? 'opacity-60 bg-muted/30' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={profile.avatar_url || undefined} alt={`${profile.full_name || 'User'} profile photo`} />
                      <AvatarFallback>{getInitials(profile.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">
                          {profile.full_name || 'Unnamed User'}
                        </h3>
                        {getRoleBadge(profile.user_id)}
                        {!profile.is_active && (
                          <Badge variant="destructive" className="text-xs">Paused</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          {profile.email}
                        </span>
                        {profile.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {profile.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Joined {formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    {/* Action menu for non-admin users */}
                    {userRoles.get(profile.user_id) !== 'admin' && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toggleUserActive(profile)}>
                            {profile.is_active ? (
                              <><Pause className="h-4 w-4 mr-2" /> Pause User</>
                            ) : (
                              <><Play className="h-4 w-4 mr-2" /> Activate User</>
                            )}
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" /> Delete User
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {profile.full_name || 'this user'}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove the user's profile and role. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(profile)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
