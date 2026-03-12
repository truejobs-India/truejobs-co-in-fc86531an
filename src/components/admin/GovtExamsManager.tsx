import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Search, Loader2, AlertTriangle, Star, Flame, ExternalLink } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface GovtExam {
  id: string;
  exam_name: string;
  slug: string;
  conducting_body: string | null;
  department_slug: string | null;
  exam_category: string;
  states: string[];
  total_vacancies: number;
  qualification_required: string | null;
  age_limit: string | null;
  age_relaxation: string | null;
  application_fee: string | null;
  salary_range: string | null;
  pay_scale: string | null;
  application_start: string | null;
  application_end: string | null;
  exam_date: string | null;
  admit_card_date: string | null;
  result_date: string | null;
  apply_link: string | null;
  official_notification_url: string | null;
  official_website: string | null;
  notification_pdf_url: string | null;
  selection_stages: string | null;
  how_to_apply: string | null;
  status: string;
  is_featured: boolean;
  is_hot: boolean;
  published_date: string | null;
  seo_keywords: string[];
  meta_title: string | null;
  meta_description: string | null;
  seo_content: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'admit_card_released', label: 'Admit Card Released' },
  { value: 'exam_completed', label: 'Exam Completed' },
  { value: 'result_declared', label: 'Result Declared' },
  { value: 'closed', label: 'Closed' },
];

const CATEGORY_OPTIONS = [
  { value: 'central', label: 'Central Govt' },
  { value: 'state', label: 'State Govt' },
  { value: 'banking', label: 'Banking' },
  { value: 'railway', label: 'Railway' },
  { value: 'defence', label: 'Defence' },
  { value: 'teaching', label: 'Teaching' },
  { value: 'police', label: 'Police' },
  { value: 'psu', label: 'PSU' },
];

const DEPARTMENT_SLUGS = [
  { value: 'ssc', label: 'SSC' },
  { value: 'railway', label: 'Railway' },
  { value: 'banking', label: 'Banking' },
  { value: 'upsc', label: 'UPSC' },
  { value: 'defence', label: 'Defence' },
  { value: 'teaching', label: 'Teaching' },
  { value: 'police', label: 'Police' },
  { value: 'psu', label: 'PSU' },
  { value: 'state', label: 'State Govt' },
];

const SEMANTIC_SUFFIXES = ['-update', '-details', '-apply-online', '-recruitment', '-vacancy'];

function generateSlug(examName: string, year?: string): string {
  const base = examName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  const y = year || new Date().getFullYear().toString();
  return `${base}-${y}-notification`;
}

const EMPTY_FORM: Partial<GovtExam> = {
  exam_name: '',
  slug: '',
  conducting_body: '',
  department_slug: '',
  exam_category: 'central',
  states: [],
  total_vacancies: 0,
  qualification_required: '',
  age_limit: '',
  age_relaxation: '',
  application_fee: '',
  salary_range: '',
  pay_scale: '',
  application_start: '',
  application_end: '',
  exam_date: '',
  admit_card_date: '',
  result_date: '',
  apply_link: '',
  official_notification_url: '',
  official_website: '',
  notification_pdf_url: '',
  selection_stages: '',
  how_to_apply: '',
  status: 'upcoming',
  is_featured: false,
  is_hot: false,
  published_date: '',
  seo_keywords: [],
  meta_title: '',
  meta_description: '',
  seo_content: '',
};

export function GovtExamsManager() {
  const { toast } = useToast();
  const [exams, setExams] = useState<GovtExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<GovtExam | null>(null);
  const [form, setForm] = useState<Partial<GovtExam>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [statesInput, setStatesInput] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');

  const fetchExams = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('govt_exams').select('*').order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    if (search) query = query.ilike('exam_name', `%${search}%`);
    const { data, error } = await query.limit(100);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setExams((data as unknown as GovtExam[]) || []);
    }
    setLoading(false);
  }, [statusFilter, search, toast]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const openCreate = () => {
    setEditingExam(null);
    setForm(EMPTY_FORM);
    setStatesInput('');
    setKeywordsInput('');
    setDuplicateWarning(null);
    setIsFormOpen(true);
  };

  const openEdit = (exam: GovtExam) => {
    setEditingExam(exam);
    setForm({ ...exam });
    setStatesInput(exam.states?.join(', ') || '');
    setKeywordsInput(exam.seo_keywords?.join(', ') || '');
    setDuplicateWarning(null);
    setIsFormOpen(true);
  };

  const handleExamNameChange = async (name: string) => {
    setForm(f => {
      const slug = generateSlug(name);
      const metaTitle = `${name} ${new Date().getFullYear()} Notification — Apply Online | TrueJobs`;
      const metaDesc = `${name} ${new Date().getFullYear()} recruitment notification. Check eligibility, vacancy, salary, exam date & apply online.`;
      return { ...f, exam_name: name, slug, meta_title: metaTitle, meta_description: metaDesc };
    });

    // Duplicate detection
    const year = new Date().getFullYear().toString();
    const { data } = await supabase
      .from('govt_exams')
      .select('id, exam_name, slug')
      .ilike('exam_name', `%${name}%`)
      .limit(5);
    const dups = (data as unknown as GovtExam[])?.filter(d => !editingExam || d.id !== editingExam.id);
    if (dups && dups.length > 0) {
      setDuplicateWarning(`Possible duplicate: "${dups[0].exam_name}" already exists (${dups[0].slug})`);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleSave = async () => {
    if (!form.exam_name || !form.slug) {
      toast({ title: 'Missing fields', description: 'Exam name and slug are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const states = statesInput.split(',').map(s => s.trim()).filter(Boolean);
    const keywords = keywordsInput.split(',').map(s => s.trim()).filter(Boolean);

    // Check slug collision and append semantic suffix
    let finalSlug = form.slug!;
    if (!editingExam) {
      const { data: existing } = await supabase.from('govt_exams').select('slug').eq('slug', finalSlug).limit(1);
      if ((existing as unknown as any[])?.length) {
        for (const suffix of SEMANTIC_SUFFIXES) {
          const candidate = finalSlug + suffix;
          const { data: check } = await supabase.from('govt_exams').select('slug').eq('slug', candidate).limit(1);
          if (!(check as unknown as any[])?.length) { finalSlug = candidate; break; }
        }
      }
    }

    const payload = {
      exam_name: form.exam_name,
      slug: finalSlug,
      conducting_body: form.conducting_body || null,
      department_slug: form.department_slug || null,
      exam_category: form.exam_category || 'central',
      states,
      total_vacancies: form.total_vacancies || 0,
      qualification_required: form.qualification_required || null,
      age_limit: form.age_limit || null,
      age_relaxation: form.age_relaxation || null,
      application_fee: form.application_fee || null,
      salary_range: form.salary_range || null,
      pay_scale: form.pay_scale || null,
      application_start: form.application_start || null,
      application_end: form.application_end || null,
      exam_date: form.exam_date || null,
      admit_card_date: form.admit_card_date || null,
      result_date: form.result_date || null,
      apply_link: form.apply_link || null,
      official_notification_url: form.official_notification_url || null,
      official_website: form.official_website || null,
      notification_pdf_url: form.notification_pdf_url || null,
      selection_stages: form.selection_stages || null,
      how_to_apply: form.how_to_apply || null,
      status: form.status || 'upcoming',
      is_featured: form.is_featured || false,
      is_hot: form.is_hot || false,
      published_date: form.published_date || null,
      seo_keywords: keywords,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      seo_content: form.seo_content || null,
    };

    let error;
    if (editingExam) {
      ({ error } = await supabase.from('govt_exams').update(payload as any).eq('id', editingExam.id));
    } else {
      ({ error } = await supabase.from('govt_exams').insert(payload as any));
    }

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editingExam ? 'Updated' : 'Created', description: `${form.exam_name} saved successfully` });
      setIsFormOpen(false);
      fetchExams();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('govt_exams').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
      fetchExams();
    }
  };

  const toggleFeatured = async (exam: GovtExam) => {
    await supabase.from('govt_exams').update({ is_featured: !exam.is_featured } as any).eq('id', exam.id);
    fetchExams();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'result_declared': return 'bg-purple-100 text-purple-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Government Exams & Jobs</h2>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Govt Exam
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exam name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : exams.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No government exams found. Add your first one!</CardContent></Card>
      ) : (
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vacancies</TableHead>
                <TableHead>Last Date</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map(exam => (
                <TableRow key={exam.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{exam.exam_name}</p>
                      <p className="text-xs text-muted-foreground">{exam.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{exam.exam_category}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor(exam.status)}`}>
                      {exam.status.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell>{exam.total_vacancies?.toLocaleString() || '—'}</TableCell>
                  <TableCell>{exam.application_end || '—'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleFeatured(exam)}>
                      <Star className={`h-4 w-4 ${exam.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(exam)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(exam.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExam ? 'Edit' : 'Add'} Government Exam</DialogTitle>
            <DialogDescription>Fill in the exam details. Slug is auto-generated from the exam name.</DialogDescription>
          </DialogHeader>

          {duplicateWarning && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {duplicateWarning}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label>Exam Name *</Label>
              <Input value={form.exam_name || ''} onChange={e => handleExamNameChange(e.target.value)} placeholder="SSC CGL 2026" />
            </div>
            <div className="space-y-2">
              <Label>Slug *</Label>
              <Input value={form.slug || ''} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Conducting Body</Label>
              <Input value={form.conducting_body || ''} onChange={e => setForm(f => ({ ...f, conducting_body: e.target.value }))} placeholder="Staff Selection Commission" />
            </div>
            <div className="space-y-2">
              <Label>Department Slug</Label>
              <Select value={form.department_slug || ''} onValueChange={v => setForm(f => ({ ...f, department_slug: v }))}>
                <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_SLUGS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.exam_category || 'central'} onValueChange={v => setForm(f => ({ ...f, exam_category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status || 'upcoming'} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Total Vacancies</Label>
              <Input type="number" value={form.total_vacancies || 0} onChange={e => setForm(f => ({ ...f, total_vacancies: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>States (comma-separated)</Label>
              <Input value={statesInput} onChange={e => setStatesInput(e.target.value)} placeholder="Uttar Pradesh, Bihar, Delhi" />
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <Label>Application Start</Label>
              <Input type="date" value={form.application_start || ''} onChange={e => setForm(f => ({ ...f, application_start: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Application End</Label>
              <Input type="date" value={form.application_end || ''} onChange={e => setForm(f => ({ ...f, application_end: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Exam Date</Label>
              <Input value={form.exam_date || ''} onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))} placeholder="March 2026" />
            </div>
            <div className="space-y-2">
              <Label>Published Date</Label>
              <Input type="date" value={form.published_date || ''} onChange={e => setForm(f => ({ ...f, published_date: e.target.value }))} />
            </div>

            {/* Eligibility */}
            <div className="space-y-2">
              <Label>Qualification</Label>
              <Input value={form.qualification_required || ''} onChange={e => setForm(f => ({ ...f, qualification_required: e.target.value }))} placeholder="Graduate" />
            </div>
            <div className="space-y-2">
              <Label>Age Limit</Label>
              <Input value={form.age_limit || ''} onChange={e => setForm(f => ({ ...f, age_limit: e.target.value }))} placeholder="18-32 years" />
            </div>
            <div className="space-y-2">
              <Label>Age Relaxation</Label>
              <Input value={form.age_relaxation || ''} onChange={e => setForm(f => ({ ...f, age_relaxation: e.target.value }))} placeholder="SC/ST: 5 years, OBC: 3 years" />
            </div>
            <div className="space-y-2">
              <Label>Application Fee</Label>
              <Input value={form.application_fee || ''} onChange={e => setForm(f => ({ ...f, application_fee: e.target.value }))} placeholder="₹100 (Gen), Free (SC/ST)" />
            </div>

            {/* Salary */}
            <div className="space-y-2">
              <Label>Salary Range</Label>
              <Input value={form.salary_range || ''} onChange={e => setForm(f => ({ ...f, salary_range: e.target.value }))} placeholder="₹25,000 - ₹81,000" />
            </div>
            <div className="space-y-2">
              <Label>Pay Scale</Label>
              <Input value={form.pay_scale || ''} onChange={e => setForm(f => ({ ...f, pay_scale: e.target.value }))} placeholder="Level 4-7" />
            </div>

            {/* Links */}
            <div className="space-y-2">
              <Label>Apply Link</Label>
              <Input value={form.apply_link || ''} onChange={e => setForm(f => ({ ...f, apply_link: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Official Notification URL</Label>
              <Input value={form.official_notification_url || ''} onChange={e => setForm(f => ({ ...f, official_notification_url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Official Website</Label>
              <Input value={form.official_website || ''} onChange={e => setForm(f => ({ ...f, official_website: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notification PDF URL</Label>
              <Input value={form.notification_pdf_url || ''} onChange={e => setForm(f => ({ ...f, notification_pdf_url: e.target.value }))} />
            </div>

            {/* SEO */}
            <div className="md:col-span-2 space-y-2">
              <Label>SEO Keywords (comma-separated)</Label>
              <Input value={keywordsInput} onChange={e => setKeywordsInput(e.target.value)} placeholder="ssc cgl 2026 notification, ssc cgl apply online" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Meta Title</Label>
              <Input value={form.meta_title || ''} onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Meta Description</Label>
              <Textarea value={form.meta_description || ''} onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))} rows={2} />
            </div>

            {/* Content */}
            <div className="md:col-span-2 space-y-2">
              <Label>Selection Stages</Label>
              <Textarea value={form.selection_stages || ''} onChange={e => setForm(f => ({ ...f, selection_stages: e.target.value }))} rows={2} placeholder="Tier 1 → Tier 2 → Skill Test → Document Verification" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>How to Apply</Label>
              <Textarea value={form.how_to_apply || ''} onChange={e => setForm(f => ({ ...f, how_to_apply: e.target.value }))} rows={3} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>SEO Content (HTML)</Label>
              <Textarea value={form.seo_content || ''} onChange={e => setForm(f => ({ ...f, seo_content: e.target.value }))} rows={4} />
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_featured || false} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} />
                <Star className="h-4 w-4" /> Featured
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_hot || false} onChange={e => setForm(f => ({ ...f, is_hot: e.target.checked }))} />
                <Flame className="h-4 w-4" /> Hot
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingExam ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
