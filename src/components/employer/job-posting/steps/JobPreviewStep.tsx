import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Briefcase, 
  MapPin, 
  IndianRupee, 
  Clock, 
  GraduationCap, 
  Users, 
  MessageSquare,
  Pencil,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { JobPostingData } from '../JobPostingWizard';
import { Company } from '@/types/database';
import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';

interface JobPreviewStepProps {
  data: JobPostingData;
  company: Company | null;
  onNext: () => void;
  onBack: () => void;
  onEdit: (step: number) => void;
}

const formatJobType = (type: string) => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatLocationType = (type: string) => {
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export function JobPreviewStep({ data, company, onNext, onBack, onEdit }: JobPreviewStepProps) {
  const { t } = useLanguage();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    jobDetails: true,
    requirements: true,
    interview: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      {/* Job Details Section */}
      <Card>
        <Collapsible open={openSections.jobDetails} onOpenChange={() => toggleSection('jobDetails')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">{t('preview.jobDetails')}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onEdit(1)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                  {openSections.jobDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('preview.companyName')}</span>
                  <p className="font-medium">{company?.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.jobTitle')}</span>
                  <p className="font-medium">{data.title}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.jobRole')}</span>
                  <p className="font-medium">{data.category}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.jobType')}</span>
                  <p className="font-medium">
                    {formatJobType(data.jobType)} | {data.isNightShift ? t('preview.nightShift') : t('preview.dayShift')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.workType')}</span>
                  <p className="font-medium">{formatLocationType(data.locationType)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.jobCity')}</span>
                  <p className="font-medium">{data.city}, {data.state || data.country}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('preview.monthlySalary')}</span>
                  <p className="font-medium">
                    ₹ {data.salaryMin?.toLocaleString()} - ₹ {data.salaryMax?.toLocaleString()} {t('preview.perMonth')}
                    {data.payType === 'fixed_incentive' && ` (${t('preview.fixedPlusIncentives')})`}
                    {data.payType === 'fixed' && ` (${t('preview.fixed')})`}
                    {data.payType === 'incentive' && ` (${t('preview.incentiveOnlyLabel')})`}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.additionalPerks')}</span>
                  <p className="font-medium">{data.perks.length > 0 ? data.perks.join(', ') : t('preview.none')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.joiningFee')}</span>
                  <p className="font-medium">{data.hasJoiningFee ? t('jobDetails.yes') : t('jobDetails.no')}</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Candidate Requirements Section */}
      <Card>
        <Collapsible open={openSections.requirements} onOpenChange={() => toggleSection('requirements')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">{t('preview.candidateReq')}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onEdit(2)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                  {openSections.requirements ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-2">
              {/* Eligible Requirements */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-md">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-sm">{t('preview.eligibleReq')}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('preview.eligibleDesc')}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('preview.minEducation')}</span>
                    <p className="font-medium">{data.minEducation || t('preview.notSpecified')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('preview.expRequired')}</span>
                    <p className="font-medium">{formatJobType(data.experienceLevel)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('preview.english')}</span>
                    <p className="font-medium">{data.englishLevel}</p>
                  </div>
                </div>
              </div>

              {/* Preferred Requirements */}
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-md">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-sm">{t('preview.preferredReq')}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {t('preview.preferredDesc')}
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('preview.age')}</span>
                    <p className="font-medium">{data.ageMin} - {data.ageMax} {t('candidateReq.yrs')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('preview.gender')}</span>
                    <p className="font-medium">
                      {data.gender === 'any' ? t('candidateReq.bothGenders') : data.gender === 'male' ? t('candidateReq.maleOnly') : t('candidateReq.femaleOnly')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('preview.industry')}</span>
                    <p className="font-medium">{data.industry || t('preview.none')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('preview.skills')}</span>
                    <p className="font-medium">{data.skills.length > 0 ? data.skills.join(', ') : t('preview.noneSpecified')}</p>
                  </div>
                </div>
              </div>

              {/* Job Description */}
              {data.description && (
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">{t('preview.jobDesc')}</span>
                  <p className="text-sm whitespace-pre-wrap">{data.description.slice(0, 300)}...</p>
                  {data.description.length > 300 && (
                    <Button variant="link" size="sm" className="p-0 h-auto text-primary">
                      {t('preview.viewFullDesc')}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Interview Information Section */}
      <Card>
        <Collapsible open={openSections.interview} onOpenChange={() => toggleSection('interview')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{t('preview.interviewInfo')}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {t('preview.commPreference')} {data.communicationPreference === 'myself' ? t('preview.myself') : 
                    data.communicationPreference === 'other_recruiter' ? t('preview.otherRecruiter') : t('preview.willContact')} | 
                  {t('preview.walkInQuestion')} {data.isWalkIn ? t('jobDetails.yes') : t('jobDetails.no')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onEdit(3)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                  {openSections.interview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('interview.companyAddress')}</span>
                  <p className="font-medium">{data.companyAddress || t('preview.notProvided')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('preview.notifPreference')}</span>
                  <p className="font-medium">
                    {data.notificationPreference === 'email_myself' ? t('preview.emailToMyself') :
                     data.notificationPreference === 'email_other' ? t('preview.emailToOther') :
                     t('preview.dailySummaryLabel')}
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Navigation */}
      <div className="flex justify-center gap-4 pt-4">
        <Button variant="outline" size="lg" onClick={onBack}>
          {t('wizard.back')}
        </Button>
        <Button size="lg" className="px-12" onClick={onNext}>
          {t('wizard.continue')}
        </Button>
      </div>
    </div>
  );
}