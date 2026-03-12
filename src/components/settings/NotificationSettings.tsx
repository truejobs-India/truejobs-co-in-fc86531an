import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, BellOff, CheckCircle, AlertCircle, Mail, MapPin, 
  Briefcase, IndianRupee, Clock, Loader2, Save, X 
} from 'lucide-react';
import { toast } from 'sonner';

const JOB_CATEGORIES = [
  'Technology', 'Marketing', 'Sales', 'Finance', 'Healthcare',
  'Education', 'Design', 'Engineering', 'Customer Service', 'HR'
];

const JOB_TYPES = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'remote', label: 'Remote' },
];

const EXPERIENCE_LEVELS = [
  { value: 'fresher', label: 'Fresher (0-1 years)' },
  { value: 'junior', label: 'Junior (1-2 years)' },
  { value: 'mid', label: 'Mid Level (3-5 years)' },
  { value: 'senior', label: 'Senior (5-8 years)' },
  { value: 'lead', label: 'Lead (8+ years)' },
];

const POPULAR_LOCATIONS = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai',
  'Pune', 'Kolkata', 'Ahmedabad', 'Noida', 'Gurgaon'
];

interface NotificationPreferences {
  id?: string;
  email_enabled: boolean;
  push_enabled: boolean;
  job_categories: string[];
  preferred_locations: string[];
  salary_min: number | null;
  salary_max: number | null;
  job_types: string[];
  experience_levels: string[];
  alert_frequency: 'instant' | 'daily' | 'weekly';
}

const defaultPreferences: NotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
  job_categories: [],
  preferred_locations: [],
  salary_min: null,
  salary_max: null,
  job_types: [],
  experience_levels: [],
  alert_frequency: 'daily',
};

export function NotificationSettings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, 50]);

  useEffect(() => {
    if (user) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setPreferences({
        id: data.id,
        email_enabled: data.email_enabled,
        push_enabled: data.push_enabled,
        job_categories: data.job_categories || [],
        preferred_locations: data.preferred_locations || [],
        salary_min: data.salary_min,
        salary_max: data.salary_max,
        job_types: data.job_types || [],
        experience_levels: data.experience_levels || [],
        alert_frequency: data.alert_frequency as 'instant' | 'daily' | 'weekly',
      });
      if (data.salary_min || data.salary_max) {
        setSalaryRange([
          data.salary_min ? data.salary_min / 100000 : 0,
          data.salary_max ? data.salary_max / 100000 : 50
        ]);
      }
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please log in to save preferences');
      return;
    }

    setIsSaving(true);

    const prefsToSave = {
      user_id: user.id,
      email_enabled: preferences.email_enabled,
      push_enabled: preferences.push_enabled,
      job_categories: preferences.job_categories,
      preferred_locations: preferences.preferred_locations,
      salary_min: salaryRange[0] > 0 ? salaryRange[0] * 100000 : null,
      salary_max: salaryRange[1] < 50 ? salaryRange[1] * 100000 : null,
      job_types: preferences.job_types,
      experience_levels: preferences.experience_levels,
      alert_frequency: preferences.alert_frequency,
    };

    const { error } = preferences.id
      ? await supabase
          .from('notification_preferences')
          .update(prefsToSave)
          .eq('id', preferences.id)
      : await supabase
          .from('notification_preferences')
          .insert(prefsToSave);

    if (error) {
      toast.error('Failed to save preferences');
      console.error(error);
    } else {
      toast.success('Notification preferences saved!');
      fetchPreferences();
    }

    setIsSaving(false);
  };

  const handlePushToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        const success = await subscribe();
        if (success) {
          setPreferences(prev => ({ ...prev, push_enabled: true }));
          toast.success('Push notifications enabled!');
        } else {
          toast.error('Could not enable notifications');
        }
      } else {
        await unsubscribe();
        setPreferences(prev => ({ ...prev, push_enabled: false }));
        toast.info('Push notifications disabled');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleArrayItem = (array: string[], item: string) => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  const addLocation = () => {
    if (newLocation.trim() && !preferences.preferred_locations.includes(newLocation.trim())) {
      setPreferences(prev => ({
        ...prev,
        preferred_locations: [...prev.preferred_locations, newLocation.trim()]
      }));
      setNewLocation('');
    }
  };

  const removeLocation = (location: string) => {
    setPreferences(prev => ({
      ...prev,
      preferred_locations: prev.preferred_locations.filter(l => l !== location)
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-base font-medium">Email Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Receive job alerts via email
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.email_enabled}
              onCheckedChange={(checked) => 
                setPreferences(prev => ({ ...prev, email_enabled: checked }))
              }
            />
          </div>

          {isSupported && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  isSubscribed ? 'bg-green-100' : 'bg-muted'
                }`}>
                  {isSubscribed ? (
                    <Bell className="h-5 w-5 text-green-600" />
                  ) : (
                    <BellOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <Label className="text-base font-medium">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get instant alerts in your browser
                  </p>
                </div>
              </div>
              <Switch
                checked={isSubscribed}
                onCheckedChange={handlePushToggle}
              />
            </div>
          )}

          {permission === 'denied' && (
            <div className="p-3 bg-destructive/10 rounded-lg flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              Push notifications are blocked. Enable them in browser settings.
            </div>
          )}
        </div>

        <Separator />

        {/* Alert Frequency */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Alert Frequency</Label>
          </div>
          <RadioGroup
            value={preferences.alert_frequency}
            onValueChange={(value: 'instant' | 'daily' | 'weekly') =>
              setPreferences(prev => ({ ...prev, alert_frequency: value }))
            }
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="instant" id="instant" />
              <Label htmlFor="instant" className="cursor-pointer">Instant</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="daily" id="daily" />
              <Label htmlFor="daily" className="cursor-pointer">Daily Digest</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="weekly" id="weekly" />
              <Label htmlFor="weekly" className="cursor-pointer">Weekly Summary</Label>
            </div>
          </RadioGroup>
        </div>

        <Separator />

        {/* Job Categories */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Job Categories</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {JOB_CATEGORIES.map((category) => (
              <Badge
                key={category}
                variant={preferences.job_categories.includes(category) ? 'default' : 'outline'}
                className="cursor-pointer transition-colors"
                onClick={() => setPreferences(prev => ({
                  ...prev,
                  job_categories: toggleArrayItem(prev.job_categories, category)
                }))}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Job Types */}
        <div className="space-y-3">
          <Label className="font-medium">Job Types</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {JOB_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={type.value}
                  checked={preferences.job_types.includes(type.value)}
                  onCheckedChange={() => setPreferences(prev => ({
                    ...prev,
                    job_types: toggleArrayItem(prev.job_types, type.value)
                  }))}
                />
                <Label htmlFor={type.value} className="text-sm cursor-pointer">
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Experience Levels */}
        <div className="space-y-3">
          <Label className="font-medium">Experience Levels</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {EXPERIENCE_LEVELS.map((level) => (
              <div key={level.value} className="flex items-center space-x-2">
                <Checkbox
                  id={level.value}
                  checked={preferences.experience_levels.includes(level.value)}
                  onCheckedChange={() => setPreferences(prev => ({
                    ...prev,
                    experience_levels: toggleArrayItem(prev.experience_levels, level.value)
                  }))}
                />
                <Label htmlFor={level.value} className="text-sm cursor-pointer">
                  {level.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Preferred Locations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Preferred Locations</Label>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-2">
            {preferences.preferred_locations.map((location) => (
              <Badge key={location} variant="secondary" className="gap-1">
                {location}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={() => removeLocation(location)}
                />
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add a city..."
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addLocation()}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="sm" onClick={addLocation}>
              Add
            </Button>
          </div>

          <div className="flex flex-wrap gap-1 mt-2">
            {POPULAR_LOCATIONS.filter(l => !preferences.preferred_locations.includes(l))
              .slice(0, 5)
              .map((location) => (
                <Badge
                  key={location}
                  variant="outline"
                  className="cursor-pointer text-xs hover:bg-primary/10"
                  onClick={() => setPreferences(prev => ({
                    ...prev,
                    preferred_locations: [...prev.preferred_locations, location]
                  }))}
                >
                  + {location}
                </Badge>
              ))}
          </div>
        </div>

        <Separator />

        {/* Salary Range */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Minimum Salary Range (LPA)</Label>
          </div>
          <div className="px-2">
            <Slider
              value={salaryRange}
              onValueChange={(value) => setSalaryRange(value as [number, number])}
              min={0}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground mt-2">
              <span>₹{salaryRange[0]}L</span>
              <span>₹{salaryRange[1]}L{salaryRange[1] >= 50 ? '+' : ''}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Save Button */}
        <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Preferences
        </Button>

        {isSubscribed && (
          <div className="p-3 bg-green-50 rounded-lg flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="h-4 w-4" />
            You'll receive job alerts based on your preferences.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
