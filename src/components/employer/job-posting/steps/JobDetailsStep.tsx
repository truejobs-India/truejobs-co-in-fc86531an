import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, X, Plus, IndianRupee, Building2 } from 'lucide-react';
import { JobPostingData } from '../JobPostingWizard';
import { Company } from '@/types/database';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { CityAutocomplete } from '@/components/employer/CityAutocomplete';
import { INDIAN_STATES } from '@/data/indianCities';

interface JobDetailsStepProps {
  data: JobPostingData;
  company: Company | null;
  onUpdate: (updates: Partial<JobPostingData>) => void;
  onNext: () => void;
}

const JOB_CATEGORIES = [
  'Software Development',
  'Sales & Marketing',
  'Customer Support',
  'Finance & Accounting',
  'Human Resources',
  'Operations',
  'Design',
  'Data Science',
  'Content Writing',
  'Administration',
  'Other',
];

// City list removed — using CityAutocomplete component instead

const COMMON_PERKS = [
  'Overtime Pay',
  'Annual Bonus',
  'Travel Allowance (TA)',
  'Mobile Allowance',
  'Internet Allowance',
  'Flexible Working Hours',
  'Weekly Payout',
  'Joining Bonus',
  'PF',
  'Petrol Allowance',
  'Laptop',
  'Health Insurance',
  'ESI (ESIC)',
  'Food/Meals',
  'Accommodation',
  '5 Working Days',
  'One-Way Cab',
  'Two-Way Cab',
];

export function JobDetailsStep({ data, company, onUpdate, onNext }: JobDetailsStepProps) {
  const { t } = useLanguage();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const JOB_TYPES = [
    { value: 'full_time', label: t('job.fullTime') },
    { value: 'part_time', label: t('job.partTime') },
    { value: 'contract', label: t('job.contract') },
    { value: 'internship', label: t('job.internship') },
  ];

  const LOCATION_TYPES = [
    { value: 'onsite', label: t('jobDetails.workFromOffice') },
    { value: 'work_from_home', label: t('jobDetails.workFromHome') },
    { value: 'hybrid', label: t('jobDetails.hybrid') },
    { value: 'remote', label: t('jobDetails.remote') },
  ];

  const PAY_TYPES = [
    { value: 'fixed', label: t('jobDetails.fixedOnly') },
    { value: 'fixed_incentive', label: t('jobDetails.fixedIncentive') },
    { value: 'incentive', label: t('jobDetails.incentiveOnly') },
  ];

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!data.title.trim()) newErrors.title = t('jobDetails.jobTitleRequired');
    if (!data.category) newErrors.category = t('jobDetails.categoryRequired');
    if (!data.city) newErrors.city = t('jobDetails.cityRequired');
    if (!data.description.trim()) newErrors.description = t('jobDetails.descriptionRequired');
    if (data.payType !== 'incentive' && (!data.salaryMin || !data.salaryMax)) {
      newErrors.salary = t('jobDetails.salaryRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  const togglePerk = (perk: string) => {
    if (data.perks.includes(perk)) {
      onUpdate({ perks: data.perks.filter(p => p !== perk) });
    } else {
      onUpdate({ perks: [...data.perks, perk] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('jobDetails.title')}</CardTitle>
          <CardDescription>
            {t('jobDetails.desc')}
            <span className="text-destructive ml-1">{t('jobDetails.mandatory')}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label>{t('jobDetails.companyHiring')} <span className="text-destructive">*</span></Label>
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{company?.name}</span>
              </div>
              <Button variant="link" size="sm" className="text-primary">
                {t('jobDetails.change')}
              </Button>
            </div>
          </div>

          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('jobDetails.jobTitle')} <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={data.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder={t('jobDetails.jobTitlePlaceholder')}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          {/* Job Category */}
          <div className="space-y-2">
            <Label>{t('jobDetails.jobCategory')} <span className="text-destructive">*</span></Label>
            <Select value={data.category} onValueChange={(value) => {
              onUpdate({ category: value });
              if (value !== 'Other') {
                onUpdate({ otherCategory: '' });
              }
            }}>
              <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                <SelectValue placeholder={t('jobDetails.selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {JOB_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
          </div>

          {/* Other Category Details - shown when "Other" is selected */}
          {data.category === 'Other' && (
            <div className="space-y-2">
              <Label>{t('jobDetails.otherCategoryDetails') || 'Please specify the category'} <span className="text-destructive">*</span></Label>
              <Input
                placeholder={t('jobDetails.otherCategoryPlaceholder') || 'Enter job category details'}
                value={data.otherCategory || ''}
                onChange={(e) => onUpdate({ otherCategory: e.target.value })}
                className={errors.otherCategory ? 'border-destructive' : ''}
              />
              {errors.otherCategory && <p className="text-sm text-destructive">{errors.otherCategory}</p>}
            </div>
          )}

          {/* Job Type */}
          <div className="space-y-2">
            <Label>{t('jobDetails.jobType')} <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map((type) => (
                <Button
                  key={type.value}
                  type="button"
                  variant={data.jobType === type.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate({ jobType: type.value as JobPostingData['jobType'] })}
                >
                  {type.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="nightShift"
                checked={data.isNightShift}
                onCheckedChange={(checked) => onUpdate({ isNightShift: checked as boolean })}
              />
              <Label htmlFor="nightShift" className="text-sm cursor-pointer">
                {t('jobDetails.nightShift')}
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('jobDetails.location')}</CardTitle>
          <CardDescription>{t('jobDetails.locationDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Work Location Type */}
          <div className="space-y-2">
            <Label>{t('jobDetails.workLocationType')} <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {LOCATION_TYPES.map((type) => (
                <Button
                  key={type.value}
                  type="button"
                  variant={data.locationType === type.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate({ locationType: type.value as JobPostingData['locationType'] })}
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* City - Dynamic Autocomplete */}
          <div className="space-y-2">
            <Label>{t('jobDetails.jobCity')} <span className="text-destructive">*</span></Label>
            <CityAutocomplete
              value={data.city}
              onChange={(city) => onUpdate({ city })}
              placeholder={t('jobDetails.selectCity') || 'Type city name (min 3 chars)...'}
              error={errors.city}
            />
          </div>

          {/* State */}
          <div className="space-y-2">
            <Label>State</Label>
            <Select value={data.state} onValueChange={(value) => onUpdate({ state: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data.city && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-md text-sm">
              <Info className="h-4 w-4 text-blue-500 mt-0.5" />
              <p className="text-blue-700 dark:text-blue-400">
                {t('jobDetails.applicationCap').replace('{city}', data.city)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('jobDetails.compensation')}</CardTitle>
          <CardDescription>
            {t('jobDetails.compensationDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pay Type */}
          <div className="space-y-2">
            <Label>{t('jobDetails.payType')} <span className="text-destructive">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {PAY_TYPES.map((type) => (
                <Button
                  key={type.value}
                  type="button"
                  variant={data.payType === type.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate({ payType: type.value as JobPostingData['payType'] })}
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Salary Range */}
          {data.payType !== 'incentive' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('jobDetails.fixedSalary')} <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={data.salaryMin || ''}
                      onChange={(e) => onUpdate({ salaryMin: parseInt(e.target.value) || null })}
                      className="pl-10"
                      placeholder="8,000"
                    />
                  </div>
                  <span className="text-muted-foreground">{t('candidateReq.to')}</span>
                  <div className="relative flex-1">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={data.salaryMax || ''}
                      onChange={(e) => onUpdate({ salaryMax: parseInt(e.target.value) || null })}
                      className="pl-10"
                      placeholder="12,000"
                    />
                  </div>
                </div>
              </div>

              {data.payType === 'fixed_incentive' && (
                <div className="space-y-2">
                  <Label>{t('jobDetails.avgIncentive')} <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={data.incentiveAmount || ''}
                      onChange={(e) => onUpdate({ incentiveAmount: parseInt(e.target.value) || null })}
                      className="pl-10"
                      placeholder="10,000"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Salary Breakdown Preview */}
          {(data.salaryMin || data.salaryMax) && (
            <div className="p-4 bg-muted/50 rounded-md space-y-2">
              <p className="font-medium text-sm">{t('jobDetails.salaryBreakup')}</p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('jobDetails.fixedSalaryMonth')}</span>
                  <span>₹ {data.salaryMin?.toLocaleString()} - ₹ {data.salaryMax?.toLocaleString()}</span>
                </div>
                {data.incentiveAmount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('jobDetails.avgIncentiveMonth')}</span>
                    <span>₹ {data.incentiveAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-medium border-t pt-2">
                  <span>{t('jobDetails.earningPotential')}</span>
                  <span>
                    ₹ {data.salaryMin?.toLocaleString()} - ₹ {((data.salaryMax || 0) + (data.incentiveAmount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {errors.salary && <p className="text-sm text-destructive">{errors.salary}</p>}

          {/* Perks */}
          <div className="space-y-3">
            <Label>{t('jobDetails.additionalPerks')}</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_PERKS.map((perk) => (
                <Badge
                  key={perk}
                  variant={data.perks.includes(perk) ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors',
                    data.perks.includes(perk) ? '' : 'hover:bg-muted'
                  )}
                  onClick={() => togglePerk(perk)}
                >
                  {perk}
                  {data.perks.includes(perk) ? (
                    <X className="h-3 w-3 ml-1" />
                  ) : (
                    <Plus className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Joining Fee */}
          <div className="space-y-2">
            <Label>{t('jobDetails.joiningFee')} <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={data.hasJoiningFee ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ hasJoiningFee: true })}
              >
                {t('jobDetails.yes')}
              </Button>
              <Button
                type="button"
                variant={!data.hasJoiningFee ? 'default' : 'outline'}
                size="sm"
                onClick={() => onUpdate({ hasJoiningFee: false })}
              >
                {t('jobDetails.no')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('jobDetails.jobDescription')}</CardTitle>
          <CardDescription>{t('jobDetails.describeRole')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder={t('jobDetails.writePlaceholder')}
            rows={8}
            className={errors.description ? 'border-destructive' : ''}
          />
          {errors.description && <p className="text-sm text-destructive mt-2">{errors.description}</p>}
        </CardContent>
      </Card>

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button size="lg" className="px-12" onClick={handleNext}>
          {t('wizard.continue')}
        </Button>
      </div>
    </div>
  );
}