import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X, Star, Award } from 'lucide-react';
import { JobPostingData } from '../JobPostingWizard';
import { useLanguage } from '@/contexts/LanguageContext';

interface CandidateRequirementsStepProps {
  data: JobPostingData;
  onUpdate: (updates: Partial<JobPostingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const EDUCATION_LEVELS = [
  'No formal education',
  '10th Pass',
  '12th Pass',
  'Diploma',
  'Graduate',
  'Post Graduate',
  'Doctorate',
];

const EXPERIENCE_LEVELS = [
  { value: 'fresher', label: 'Fresher (0-1 years)' },
  { value: 'junior', label: 'Junior (1-2 years)' },
  { value: 'mid', label: 'Mid Level (3-5 years)' },
  { value: 'senior', label: 'Senior (5-8 years)' },
  { value: 'lead', label: 'Lead (8+ years)' },
  { value: 'executive', label: 'Executive' },
];

const ENGLISH_LEVELS = [
  'No English',
  'Basic English',
  'Good English',
  'Fluent English',
];

const INDUSTRIES = [
  'None',
  'IT & Software',
  'Banking & Finance',
  'Healthcare',
  'Education',
  'E-commerce',
  'Manufacturing',
  'Retail',
  'Consulting',
  'Telecom',
];

const COMMON_SKILLS = [
  'Communication',
  'Problem Solving',
  'Team Work',
  'Leadership',
  'Time Management',
  'Customer Service',
  'Sales',
  'Marketing',
  'Data Analysis',
  'Project Management',
];

export function CandidateRequirementsStep({ data, onUpdate, onNext, onBack }: CandidateRequirementsStepProps) {
  const { t } = useLanguage();
  const [skillInput, setSkillInput] = useState('');

  const handleAddSkill = () => {
    if (skillInput.trim() && !data.skills.includes(skillInput.trim())) {
      onUpdate({ skills: [...data.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    onUpdate({ skills: data.skills.filter(s => s !== skill) });
  };

  const toggleSkill = (skill: string) => {
    if (data.skills.includes(skill)) {
      handleRemoveSkill(skill);
    } else {
      onUpdate({ skills: [...data.skills, skill] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Eligible Requirements */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('candidateReq.eligibleTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('candidateReq.eligibleDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Minimum Education */}
          <div className="space-y-2">
            <Label>{t('candidateReq.minEducation')}</Label>
            <Select 
              value={data.minEducation} 
              onValueChange={(value) => onUpdate({ minEducation: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateReq.selectMinEducation')} />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Experience Level */}
          <div className="space-y-2">
            <Label>{t('candidateReq.experienceRequired')}</Label>
            <Select 
              value={data.experienceLevel} 
              onValueChange={(value) => onUpdate({ experienceLevel: value as JobPostingData['experienceLevel'] })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateReq.selectExperience')} />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* English Level */}
          <div className="space-y-2">
            <Label>{t('candidateReq.englishProficiency')}</Label>
            <Select 
              value={data.englishLevel} 
              onValueChange={(value) => onUpdate({ englishLevel: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateReq.selectEnglish')} />
              </SelectTrigger>
              <SelectContent>
                {ENGLISH_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Preferred Requirements */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">{t('candidateReq.preferredTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('candidateReq.preferredDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Age Range */}
          <div className="space-y-4">
            <Label>{t('candidateReq.ageRange')}</Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span>{data.ageMin} {t('candidateReq.yrs')}</span>
                  <span>{data.ageMax} {t('candidateReq.yrs')}</span>
                </div>
                <div className="flex gap-4">
                  <Input
                    type="number"
                    min={18}
                    max={60}
                    value={data.ageMin}
                    onChange={(e) => onUpdate({ ageMin: parseInt(e.target.value) || 18 })}
                    className="w-24"
                  />
                  <span className="self-center">{t('candidateReq.to')}</span>
                  <Input
                    type="number"
                    min={18}
                    max={70}
                    value={data.ageMax}
                    onChange={(e) => onUpdate({ ageMax: parseInt(e.target.value) || 60 })}
                    className="w-24"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label>{t('candidateReq.genderPreference')}</Label>
            <div className="flex gap-2">
              {[
                { value: 'any', label: t('candidateReq.bothGenders') },
                { value: 'male', label: t('candidateReq.maleOnly') },
                { value: 'female', label: t('candidateReq.femaleOnly') },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={data.gender === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onUpdate({ gender: option.value as JobPostingData['gender'] })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label>{t('candidateReq.industryExp')}</Label>
            <Select 
              value={data.industry} 
              onValueChange={(value) => onUpdate({ industry: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('candidateReq.selectIndustry')} />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((industry) => (
                  <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Skills */}
          <div className="space-y-3">
            <Label>{t('candidateReq.requiredSkills')}</Label>
            <div className="flex gap-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder={t('candidateReq.addSkill')}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
              />
              <Button type="button" onClick={handleAddSkill}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Common Skills */}
            <div className="flex flex-wrap gap-2 mt-2">
              {COMMON_SKILLS.map((skill) => (
                <Badge
                  key={skill}
                  variant={data.skills.includes(skill) ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleSkill(skill)}
                >
                  {skill}
                  {data.skills.includes(skill) ? (
                    <X className="h-3 w-3 ml-1" />
                  ) : (
                    <Plus className="h-3 w-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>

            {/* Selected Skills */}
            {data.skills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground w-full mb-1">{t('candidateReq.selected')}</span>
                {data.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="gap-1">
                    {skill}
                    <button 
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-1 hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Job Description Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('candidateReq.detailedReq')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('candidateReq.requirements')}</Label>
            <Textarea
              value={data.requirements}
              onChange={(e) => onUpdate({ requirements: e.target.value })}
              placeholder={t('candidateReq.reqPlaceholder')}
              rows={5}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('candidateReq.responsibilities')}</Label>
            <Textarea
              value={data.responsibilities}
              onChange={(e) => onUpdate({ responsibilities: e.target.value })}
              placeholder={t('candidateReq.respPlaceholder')}
              rows={5}
            />
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