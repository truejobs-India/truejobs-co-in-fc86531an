import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Bell, MapPin } from 'lucide-react';
import { JobPostingData } from '../JobPostingWizard';
import { Company } from '@/types/database';
import { useLanguage } from '@/contexts/LanguageContext';

interface InterviewInfoStepProps {
  data: JobPostingData;
  company: Company | null;
  onUpdate: (updates: Partial<JobPostingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function InterviewInfoStep({ data, company, onUpdate, onNext, onBack }: InterviewInfoStepProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Interview Method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('interview.methodTitle')}</CardTitle>
          <CardDescription>
            {t('interview.methodDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Walk-in Interview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>{t('interview.isWalkIn')}</Label>
              <Badge variant="secondary" className="bg-primary/10 text-primary">{t('interview.new')}</Badge>
              <Button variant="link" size="sm" className="text-primary p-0 h-auto">
                {t('interview.knowMore')}
              </Button>
            </div>
            <RadioGroup
              value={data.isWalkIn ? 'yes' : 'no'}
              onValueChange={(value) => onUpdate({ isWalkIn: value === 'yes' })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="walkIn-yes" />
                <Label htmlFor="walkIn-yes" className="cursor-pointer">{t('jobDetails.yes')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="walkIn-no" />
                <Label htmlFor="walkIn-no" className="cursor-pointer">{t('jobDetails.no')}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Company Address */}
          <div className="space-y-2">
            <Label htmlFor="address">{t('interview.companyAddress')} <span className="text-destructive">*</span></Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="address"
                value={data.companyAddress}
                onChange={(e) => onUpdate({ companyAddress: e.target.value })}
                placeholder={t('interview.enterAddress')}
                className="pl-10"
              />
            </div>
            {company?.location && !data.companyAddress && (
              <Button 
                variant="link" 
                size="sm" 
                className="p-0 h-auto text-primary"
                onClick={() => onUpdate({ companyAddress: company.location || '' })}
              >
                {t('interview.useCompanyLocation')} {company.location}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Communication Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('interview.commPreference')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>{t('interview.commQuestion')} <span className="text-destructive">*</span></Label>
            <RadioGroup
              value={data.communicationPreference}
              onValueChange={(value) => onUpdate({ communicationPreference: value as JobPostingData['communicationPreference'] })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="myself" id="comm-myself" />
                <Label htmlFor="comm-myself" className="cursor-pointer">{t('interview.yesToMyself')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other_recruiter" id="comm-other" />
                <Label htmlFor="comm-other" className="cursor-pointer">{t('interview.yesToOther')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no_contact" id="comm-no" />
                <Label htmlFor="comm-no" className="cursor-pointer">{t('interview.noContact')}</Label>
              </div>
            </RadioGroup>
          </div>

          {data.communicationPreference === 'other_recruiter' && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="recruiterPhone">{t('interview.recruiterPhone')}</Label>
              <div className="relative max-w-xs">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="recruiterPhone"
                  type="tel"
                  value={data.recruiterPhone}
                  onChange={(e) => onUpdate({ recruiterPhone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                  className="pl-10"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('interview.notifPreference')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label>
              {t('interview.notifQuestion').split('Email Alerts')[0]}
              <span className="inline-flex items-center gap-1">
                <Mail className="h-4 w-4 text-primary" />
                Email Alerts
              </span>
              {t('interview.notifQuestion').split('Email Alerts')[1]}
              <span className="text-destructive"> *</span>
            </Label>
            <RadioGroup
              value={data.notificationPreference}
              onValueChange={(value) => onUpdate({ notificationPreference: value as JobPostingData['notificationPreference'] })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email_myself" id="notif-myself" />
                <Label htmlFor="notif-myself" className="cursor-pointer">{t('interview.emailMyself')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email_other" id="notif-other" />
                <Label htmlFor="notif-other" className="cursor-pointer">{t('interview.emailOther')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily_summary" id="notif-summary" />
                <Label htmlFor="notif-summary" className="cursor-pointer">{t('interview.dailySummary')}</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
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