import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, User, Lock, Briefcase, UserSearch } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/types/database';

export default function PhoneSignup() {
  const [step, setStep] = useState<'phone' | 'otp' | 'details'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('job_seeker');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { phone, action: 'send', purpose: 'signup' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to send OTP');
      }

      toast({
        title: t('phoneSignup.otpSent'),
        description: t('phoneSignup.checkPhone'),
      });
      setStep('otp');
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { phone, action: 'verify', otp, purpose: 'signup' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Invalid OTP');
      }

      toast({
        title: t('phoneSignup.phoneVerified'),
        description: t('phoneSignup.completeReg'),
      });
      setStep('details');
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const phoneEmail = `${phone.replace(/\D/g, '')}@sms.local`;
      
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: phoneEmail,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName,
            phone: phone,
          },
        },
      });

      if (signupError) throw signupError;

      if (signupData.user) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({ user_id: signupData.user.id, role: selectedRole });

        if (roleError) throw roleError;

        await supabase
          .from('profiles')
          .update({ full_name: fullName, phone: phone })
          .eq('user_id', signupData.user.id);
      }

      toast({
        title: t('phoneSignup.accountCreated'),
        description: t('phoneSignup.welcomeMessage'),
      });

      navigate(selectedRole === 'employer' ? '/employer/dashboard' : '/dashboard');
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Signup Failed',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <Layout>
      <SEO title="Phone Sign Up" noindex={true} />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">
              {step === 'phone' && t('phoneSignup.title')}
              {step === 'otp' && t('phoneSignup.verifyPhone')}
              {step === 'details' && t('phoneSignup.completeRegistration')}
            </CardTitle>
            <CardDescription>
              {step === 'phone' && t('phoneSignup.enterPhone')}
              {step === 'otp' && t('phoneSignup.enterOTP')}
              {step === 'details' && t('phoneSignup.fillDetails')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'phone' && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('phoneSignup.phoneNumber')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('phoneSignup.includeCountryCode')}
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('phoneSignup.sendOTP')}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                <div className="flex flex-col items-center space-y-4">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-sm text-muted-foreground">
                    {t('phoneSignup.didntReceive')}{' '}
                    <button
                      type="button"
                      onClick={() => handleSendOTP({ preventDefault: () => {} } as React.FormEvent)}
                      className="text-primary hover:underline"
                    >
                      {t('phoneSignup.resend')}
                    </button>
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('phoneSignup.verifyOTP')}
                </Button>
              </form>
            )}

            {step === 'details' && (
              <form onSubmit={handleCompleteSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>{t('auth.selectRole')}</Label>
                  <RadioGroup
                    value={selectedRole}
                    onValueChange={(value) => setSelectedRole(value as AppRole)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="job_seeker" id="job_seeker" className="peer sr-only" />
                      <Label
                        htmlFor="job_seeker"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        <UserSearch className="mb-3 h-6 w-6" />
                        {t('auth.jobSeeker')}
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="employer" id="employer" className="peer sr-only" />
                      <Label
                        htmlFor="employer"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                      >
                        <Briefcase className="mb-3 h-6 w-6" />
                        {t('auth.employer')}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('phoneSignup.createAccount')}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">
                {t('nav.login')}
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {t('phoneSignup.preferEmail')}{' '}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                {t('phoneSignup.signUpWithEmail')}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}