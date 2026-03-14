import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAdminToast as useToast } from '@/contexts/AdminMessagesContext';
import { Plus, Pencil, Trash2, Loader2, IndianRupee } from 'lucide-react';

interface JobPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  original_price: number | null;
  currency: string;
  duration_days: number;
  visibility_level: string;
  features: string[];
  is_featured: boolean;
  is_urgent_hiring: boolean;
  has_whatsapp_notifications: boolean;
  has_priority_placement: boolean;
  display_order: number;
  is_active: boolean;
  max_job_posts: number;
}

const initialPlan: Partial<JobPlan> = {
  name: '',
  slug: '',
  price: 0,
  original_price: null,
  currency: 'INR',
  duration_days: 15,
  visibility_level: 'basic',
  features: [],
  is_featured: false,
  is_urgent_hiring: false,
  has_whatsapp_notifications: false,
  has_priority_placement: false,
  display_order: 0,
  is_active: true,
  max_job_posts: 1,
};

export function JobPlansManager() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<JobPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<JobPlan>>(initialPlan);
  const [featuresText, setFeaturesText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('job_posting_plans')
      .select('*')
      .order('display_order');

    if (!error && data) {
      setPlans(data.map(p => ({ 
        ...p, 
        features: Array.isArray(p.features) ? (p.features as string[]) : [] 
      })) as JobPlan[]);
    }
    setIsLoading(false);
  };

  const handleEdit = (plan: JobPlan) => {
    setEditingPlan(plan);
    setFeaturesText(plan.features.join('\n'));
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingPlan({ ...initialPlan, display_order: plans.length + 1 });
    setFeaturesText('');
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingPlan.name || !editingPlan.slug) {
      toast({ title: 'Name and slug are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    const features = featuresText.split('\n').filter(f => f.trim());
    const planData = { ...editingPlan, features: features as any };

    let error;
    if (editingPlan.id) {
      ({ error } = await supabase.from('job_posting_plans').update(planData as any).eq('id', editingPlan.id));
    } else {
      ({ error } = await supabase.from('job_posting_plans').insert(planData as any));
    }

    if (error) {
      toast({ title: 'Error saving plan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingPlan.id ? 'Plan updated' : 'Plan created' });
      setIsDialogOpen(false);
      fetchPlans();
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    
    const { error } = await supabase.from('job_posting_plans').delete().eq('id', id);
    if (!error) {
      toast({ title: 'Plan deleted' });
      fetchPlans();
    }
  };

  const toggleActive = async (plan: JobPlan) => {
    await supabase.from('job_posting_plans').update({ is_active: !plan.is_active }).eq('id', plan.id);
    fetchPlans();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Job Posting Plans</CardTitle>
            <CardDescription>Manage pricing plans for job postings</CardDescription>
          </div>
          <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Add Plan</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Job Posts</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    ₹{plan.price}
                    {plan.original_price && <span className="text-muted-foreground line-through ml-2">₹{plan.original_price}</span>}
                  </TableCell>
                  <TableCell>{plan.duration_days} days</TableCell>
                  <TableCell>{plan.max_job_posts}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {plan.is_featured && <Badge variant="secondary">Featured</Badge>}
                      {plan.is_urgent_hiring && <Badge variant="secondary">Urgent</Badge>}
                      {plan.has_whatsapp_notifications && <Badge variant="secondary">WhatsApp</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={plan.is_active} onCheckedChange={() => toggleActive(plan)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan.id ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={editingPlan.name || ''} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} /></div>
                <div><Label>Slug</Label><Input value={editingPlan.slug || ''} onChange={e => setEditingPlan({...editingPlan, slug: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Price (₹)</Label><Input type="number" value={editingPlan.price || 0} onChange={e => setEditingPlan({...editingPlan, price: parseInt(e.target.value)})} /></div>
                <div><Label>Original Price</Label><Input type="number" value={editingPlan.original_price || ''} onChange={e => setEditingPlan({...editingPlan, original_price: parseInt(e.target.value) || null})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Duration (days)</Label><Input type="number" value={editingPlan.duration_days || 15} onChange={e => setEditingPlan({...editingPlan, duration_days: parseInt(e.target.value)})} /></div>
                <div><Label>Max Job Posts</Label><Input type="number" value={editingPlan.max_job_posts || 1} onChange={e => setEditingPlan({...editingPlan, max_job_posts: parseInt(e.target.value) || 1})} /></div>
              </div>
              <div><Label>Features (one per line)</Label><Textarea value={featuresText} onChange={e => setFeaturesText(e.target.value)} rows={4} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2"><Switch checked={editingPlan.is_featured} onCheckedChange={v => setEditingPlan({...editingPlan, is_featured: v})} /><Label>Featured</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editingPlan.is_urgent_hiring} onCheckedChange={v => setEditingPlan({...editingPlan, is_urgent_hiring: v})} /><Label>Urgent Hiring Tag</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editingPlan.has_whatsapp_notifications} onCheckedChange={v => setEditingPlan({...editingPlan, has_whatsapp_notifications: v})} /><Label>WhatsApp Notifications</Label></div>
                <div className="flex items-center gap-2"><Switch checked={editingPlan.has_priority_placement} onCheckedChange={v => setEditingPlan({...editingPlan, has_priority_placement: v})} /><Label>Priority Placement</Label></div>
              </div>
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingPlan.id ? 'Update' : 'Create'} Plan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
