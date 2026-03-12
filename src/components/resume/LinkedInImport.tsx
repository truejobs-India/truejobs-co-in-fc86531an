import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Linkedin, 
  Loader2, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  User,
  Briefcase,
  GraduationCap,
  Award,
  MapPin,
  ExternalLink
} from 'lucide-react';

interface LinkedInProfile {
  full_name: string | null;
  headline: string | null;
  location: string | null;
  bio: string | null;
  skills: string[] | null;
  experience: {
    job_title: string;
    company_name: string;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    description: string | null;
  }[] | null;
  education: {
    institution: string;
    degree: string;
    field_of_study: string | null;
    start_date: string | null;
    end_date: string | null;
  }[] | null;
  linkedin_url: string;
}

export function LinkedInImport() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importedData, setImportedData] = useState<LinkedInProfile | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // Import options
  const [importOptions, setImportOptions] = useState({
    fullName: true,
    headline: true,
    location: true,
    bio: true,
    skills: true,
    experience: true,
    education: true,
    linkedinUrl: true
  });

  const fetchLinkedInProfile = async () => {
    if (!linkedinUrl.trim()) {
      toast({ title: 'Please enter a LinkedIn URL', variant: 'destructive' });
      return;
    }
    if (!user) return;

    setIsLoading(true);
    setImportedData(null);

    try {
      const { data, error } = await supabase.functions.invoke('linkedin-import', {
        body: { linkedinUrl, userId: user.id }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to import profile');

      setImportedData(data.data);
      setShowConfirmDialog(true);
      toast({ title: 'Profile data extracted successfully!' });
    } catch (error) {
      console.error('LinkedIn import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import LinkedIn profile',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const applyImportedData = async () => {
    if (!user || !profile || !importedData) return;

    setIsImporting(true);

    try {
      // Update profile with selected fields
      const profileUpdates: Record<string, unknown> = {};

      if (importOptions.fullName && importedData.full_name) {
        profileUpdates.full_name = importedData.full_name;
      }
      if (importOptions.headline && importedData.headline) {
        profileUpdates.headline = importedData.headline;
      }
      if (importOptions.location && importedData.location) {
        profileUpdates.location = importedData.location;
      }
      if (importOptions.bio && importedData.bio) {
        profileUpdates.bio = importedData.bio;
      }
      if (importOptions.skills && importedData.skills?.length) {
        // Merge with existing skills
        const existingSkills = profile.skills || [];
        const newSkills = [...new Set([...existingSkills, ...importedData.skills])];
        profileUpdates.skills = newSkills;
      }
      if (importOptions.linkedinUrl && importedData.linkedin_url) {
        profileUpdates.linkedin_url = importedData.linkedin_url;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', profile.id);

        if (profileError) throw profileError;
      }

      // Import experience
      if (importOptions.experience && importedData.experience?.length) {
        for (const exp of importedData.experience) {
          await supabase.from('experience').insert({
            profile_id: profile.id,
            job_title: exp.job_title,
            company_name: exp.company_name,
            location: exp.location,
            start_date: exp.start_date,
            end_date: exp.is_current ? null : exp.end_date,
            is_current: exp.is_current,
            description: exp.description
          });
        }
      }

      // Import education
      if (importOptions.education && importedData.education?.length) {
        for (const edu of importedData.education) {
          await supabase.from('education').insert({
            profile_id: profile.id,
            institution: edu.institution,
            degree: edu.degree,
            field_of_study: edu.field_of_study,
            start_date: edu.start_date,
            end_date: edu.end_date,
            is_current: false
          });
        }
      }

      await refreshProfile();
      setShowConfirmDialog(false);
      setImportedData(null);
      setLinkedinUrl('');
      
      toast({ title: 'Profile imported successfully!' });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to apply imported data',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#0077B5] flex items-center justify-center">
              <Linkedin className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Import from LinkedIn</CardTitle>
              <CardDescription>
                Auto-populate your resume with data from your LinkedIn profile
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Important Notes</p>
                <ul className="mt-1 space-y-1 text-amber-700">
                  <li>• Your LinkedIn profile must be public for import to work</li>
                  <li>• Private profiles cannot be accessed</li>
                  <li>• Data extraction accuracy depends on profile structure</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin-url">LinkedIn Profile URL</Label>
            <div className="flex gap-2">
              <Input
                id="linkedin-url"
                placeholder="https://www.linkedin.com/in/your-profile"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={fetchLinkedInProfile} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Example: https://www.linkedin.com/in/johndoe
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Profile Data Extracted
            </DialogTitle>
            <DialogDescription>
              Review the extracted data and select what you want to import
            </DialogDescription>
          </DialogHeader>

          {importedData && (
            <ScrollArea className="flex-1 max-h-[50vh] pr-4">
              <div className="space-y-4">
                {/* Basic Info */}
                {importedData.full_name && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Checkbox
                      id="import-name"
                      checked={importOptions.fullName}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, fullName: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-name" className="flex items-center gap-2 cursor-pointer">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Full Name
                      </Label>
                      <p className="text-sm mt-1">{importedData.full_name}</p>
                    </div>
                  </div>
                )}

                {importedData.headline && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Checkbox
                      id="import-headline"
                      checked={importOptions.headline}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, headline: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-headline" className="cursor-pointer">Headline</Label>
                      <p className="text-sm mt-1 text-muted-foreground">{importedData.headline}</p>
                    </div>
                  </div>
                )}

                {importedData.location && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Checkbox
                      id="import-location"
                      checked={importOptions.location}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, location: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-location" className="flex items-center gap-2 cursor-pointer">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        Location
                      </Label>
                      <p className="text-sm mt-1">{importedData.location}</p>
                    </div>
                  </div>
                )}

                {importedData.bio && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Checkbox
                      id="import-bio"
                      checked={importOptions.bio}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, bio: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-bio" className="cursor-pointer">About / Summary</Label>
                      <p className="text-sm mt-1 text-muted-foreground line-clamp-3">{importedData.bio}</p>
                    </div>
                  </div>
                )}

                {importedData.skills && importedData.skills.length > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Checkbox
                      id="import-skills"
                      checked={importOptions.skills}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, skills: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-skills" className="flex items-center gap-2 cursor-pointer">
                        <Award className="h-4 w-4 text-muted-foreground" />
                        Skills ({importedData.skills.length})
                      </Label>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {importedData.skills.slice(0, 10).map((skill, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {importedData.skills.length > 10 && (
                          <Badge variant="outline" className="text-xs">
                            +{importedData.skills.length - 10} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {importedData.experience && importedData.experience.length > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Checkbox
                      id="import-experience"
                      checked={importOptions.experience}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, experience: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-experience" className="flex items-center gap-2 cursor-pointer">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        Work Experience ({importedData.experience.length})
                      </Label>
                      <div className="mt-2 space-y-2">
                        {importedData.experience.slice(0, 3).map((exp, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-medium">{exp.job_title}</p>
                            <p className="text-muted-foreground">{exp.company_name}</p>
                          </div>
                        ))}
                        {importedData.experience.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{importedData.experience.length - 3} more positions
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {importedData.education && importedData.education.length > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg border">
                    <Checkbox
                      id="import-education"
                      checked={importOptions.education}
                      onCheckedChange={(checked) => 
                        setImportOptions(prev => ({ ...prev, education: !!checked }))
                      }
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-education" className="flex items-center gap-2 cursor-pointer">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        Education ({importedData.education.length})
                      </Label>
                      <div className="mt-2 space-y-2">
                        {importedData.education.map((edu, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-medium">{edu.degree}</p>
                            <p className="text-muted-foreground">{edu.institution}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Checkbox
                    id="import-linkedin-url"
                    checked={importOptions.linkedinUrl}
                    onCheckedChange={(checked) => 
                      setImportOptions(prev => ({ ...prev, linkedinUrl: !!checked }))
                    }
                  />
                  <div className="flex-1">
                    <Label htmlFor="import-linkedin-url" className="flex items-center gap-2 cursor-pointer">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      LinkedIn URL
                    </Label>
                    <p className="text-sm mt-1 text-muted-foreground">{importedData.linkedin_url}</p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={applyImportedData} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import Selected
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
