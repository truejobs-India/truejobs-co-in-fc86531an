import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, User, Building2, AlertCircle, ArrowLeft, CheckCircle2, Sparkles, Shield, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react';
import truejobsLoginLogo from '@/assets/truejobs-login-logo.png';
import { AppRole } from '@/types/database';
// Personal email validation removed - all email types allowed for employers
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AuthPageTransition } from '@/components/auth/AuthPageTransition';
import { PremiumAuthBackground } from '@/components/auth/PremiumAuthBackground';

type SignupStep = 'details' | 'otp' | 'complete';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [optionalPassword, setOptionalPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [employerSubRole, setEmployerSubRole] = useState('hr');
  const [role, setRole] = useState<AppRole>('job_seeker');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<SignupStep>('details');
  const [otp, setOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const { } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const isEmployer = role === 'employer';
  const isEmployerWithPersonalEmail = false;

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const startCountdown = useCallback(() => {
    setResendCountdown(60);
  }, []);

  const sendOtp = async () => {
    setIsSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp/send', {
        body: { email, purpose: 'signup' },
      });

      if (error) throw error;

      setOtpSent(true);
      setStep('otp');
      startCountdown();
      toast({
        title: 'OTP Sent!',
        description: `A verification code has been sent to ${email}`,
      });
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast({
        title: 'Failed to Send OTP',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter a 6-digit verification code.',
        variant: 'destructive',
      });
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp/verify', {
        body: { email, otp },
      });

      if (error) throw error;

      if (data?.verified && data?.access_token) {
        await completeSignup(data.access_token, data.refresh_token, data.is_new_user);
      } else {
        throw new Error('Verification failed');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast({
        title: 'Invalid OTP',
        description: 'The verification code is incorrect or has expired.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const completeSignup = async (accessToken: string, refreshToken: string, isNewUser: boolean) => {
    setIsLoading(true);
    try {
      // Set the session directly using tokens from server-side verification
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) throw sessionError;

      const userId = sessionData?.user?.id;
      if (!userId) throw new Error('Failed to establish session');

      // If user set an optional password during signup, apply it now
      if (optionalPassword && optionalPassword.length >= 6) {
        await supabase.auth.updateUser({ password: optionalPassword });
      }

      // Update profile with full name
      await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', userId);

      // Assign employer role if selected (default is job_seeker from trigger)
      if (role === 'employer') {
        // Check if employer role already exists
        const { data: existingRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'employer');

        if (!existingRoles || existingRoles.length === 0) {
          await supabase
            .from('user_roles')
            .insert({ user_id: userId, role: 'employer' });
        }
      }

      // For employers, auto-create company profile (only if none exists)
      if (role === 'employer' && companyName.trim()) {
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('owner_id', userId)
          .limit(1)
          .maybeSingle();

        if (!existingCompany) {
          const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          try {
            await supabase.from('companies').insert({
              name: companyName.trim(),
              slug: `${slug}-${Date.now().toString(36)}`,
              owner_id: userId,
              is_approved: true,
              auto_approve_jobs: true,
            });
          } catch { /* ignore - employer can set up later */ }
        }
      }

      // Send welcome email (fire and forget)
      const welcomeFunction = role === 'employer' ? 'welcome-employer' : 'welcome-candidate';
      supabase.functions.invoke(welcomeFunction, {
        body: { userId, email, fullName },
      }).catch(err => console.error('Failed to send welcome email:', err));

      toast({
        title: 'Account Created!',
        description: role === 'employer' 
          ? 'Welcome to TrueJobs! Your company profile is ready.'
          : 'Welcome to TrueJobs. Let\'s set up your profile.',
      });
      const defaultPath = role === 'employer' ? '/employer/dashboard' : '/dashboard';
      navigate(redirectPath || defaultPath, { replace: true });
    } catch (error: any) {
      console.error('Signup completion error:', error);
      toast({
        title: 'Sign Up Failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (role === 'employer' && !companyName.trim()) {
      toast({
        title: 'Company Name Required',
        description: 'Please enter your company name to register as an employer.',
        variant: 'destructive',
      });
      return;
    }

    if (optionalPassword && optionalPassword.length < 6) {
      toast({
        title: 'Password Too Short',
        description: 'Password must be at least 6 characters, or leave it blank.',
        variant: 'destructive',
      });
      return;
    }
    
    await sendOtp();
  };


  const resendOtp = async () => {
    await sendOtp();
  };

  const goBack = () => {
    setStep('details');
    setOtp('');
    setOtpSent(false);
  };

  const benefits = isEmployer ? [
    'Post jobs and reach verified candidates',
    'AI-powered talent matching',
    'Streamlined hiring workflow',
  ] : [
    'AI-matched job recommendations',
    'One-click applications',
    'Real-time application tracking',
  ];

  // OTP Verification Step
  if (step === 'otp') {
    return (
      <Layout>
        <div className={cn(
          "min-h-[calc(100vh-4rem)] relative overflow-hidden",
          isEmployer 
            ? "bg-gradient-to-br from-red-50 via-orange-50 to-amber-50" 
            : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
        )}>
          <PremiumAuthBackground isEmployer={isEmployer} />
          
          <div className="relative flex items-center justify-center py-12 px-4 min-h-[calc(100vh-4rem)]">
            <AuthPageTransition>
              <Card className={cn(
                "w-full max-w-md backdrop-blur-xl border-white/50 shadow-2xl relative mx-auto",
                isEmployer 
                  ? "bg-white/80 shadow-red-100/50" 
                  : "bg-white/80 shadow-blue-100/50"
              )}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  className="absolute left-4 top-4 z-10"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                
                <CardHeader className="space-y-1 text-center pt-12">
                  <div className="flex justify-center mb-4">
                    <img 
                      src={truejobsLoginLogo} 
                      alt="TrueJobs - India's Smart Job Portal" 
                      className="h-16 w-auto object-contain transition-transform hover:scale-105 animate-[fade-in_0.6s_ease-out,scale-in_0.5s_ease-out]"
                    />
                  </div>
                  <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
                  <CardDescription>
                    We've sent a 6-digit verification code to<br />
                    <span className="font-medium text-foreground">{email}</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
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
                  </div>

                  <Button
                    onClick={verifyOtp}
                    className={cn(
                      "w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
                      isEmployer 
                        ? "bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-orange-200" 
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200"
                    )}
                    disabled={isVerifyingOtp || otp.length !== 6}
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Verify & Create Account
                      </>
                    )}
                  </Button>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Didn't receive the code?
                    </p>
                    {resendCountdown > 0 ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className={cn(
                          "inline-flex items-center justify-center h-10 w-10 rounded-full border-2",
                          isEmployer ? "border-orange-500/30 text-orange-500" : "border-primary/30 text-primary"
                        )}>
                          <span className="text-sm font-semibold">{resendCountdown}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          seconds to resend
                        </span>
                      </div>
                    ) : (
                      <Button
                        variant="link"
                        onClick={resendOtp}
                        disabled={isSendingOtp}
                        className={isEmployer ? 'text-orange-500 hover:text-orange-600' : 'text-primary hover:text-primary/80'}
                      >
                        {isSendingOtp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Resend Code'
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </AuthPageTransition>
          </div>
        </div>
      </Layout>
    );
  }

  // Main Signup Step - Premium Two-Column Design
  return (
    <Layout>
      <div className={cn(
        "min-h-[calc(100vh-4rem)] relative overflow-hidden",
        isEmployer 
          ? "bg-gradient-to-br from-red-50 via-orange-50 to-amber-50" 
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      )}>
        <PremiumAuthBackground isEmployer={isEmployer} />

        <div className="relative flex items-center justify-center py-12 px-4 min-h-[calc(100vh-4rem)]">
          <AuthPageTransition>
            <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center mx-auto">
            
            {/* Left Side - Benefits Section (hidden on mobile) */}
            <div className="hidden lg:flex flex-col space-y-8 pr-8">
              <div className="space-y-4">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                  isEmployer 
                    ? "bg-orange-100 text-orange-700" 
                    : "bg-blue-100 text-blue-700"
                )}>
                  <Sparkles className="h-4 w-4" />
                  {isEmployer ? 'Start Hiring Today' : 'Launch Your Career'}
                </div>
                <h1 className={cn(
                  "text-4xl font-bold tracking-tight",
                  isEmployer ? "text-red-900" : "text-gray-900"
                )}>
                  {isEmployer ? 'Find Top Talent Fast' : 'Your Dream Job Awaits'}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {isEmployer 
                    ? 'Join thousands of companies who trust TrueJobs to find the best candidates.'
                    : 'Create your account and get matched with jobs that fit your skills and ambitions.'}
                </p>
              </div>

              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm"
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                      isEmployer ? "bg-orange-100" : "bg-blue-100"
                    )}>
                      <CheckCircle className={cn(
                        "h-5 w-5",
                        isEmployer ? "text-orange-600" : "text-blue-600"
                      )} />
                    </div>
                    <span className="font-medium text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-4">
                <div className="flex items-center gap-2">
                  <Shield className={cn(
                    "h-5 w-5",
                    isEmployer ? "text-orange-600" : "text-blue-600"
                  )} />
                  <span className="text-sm text-muted-foreground">SSL Secured</span>
                </div>
                <div className="h-4 w-px bg-gray-300" />
                <span className="text-sm text-muted-foreground">Trusted by 10,000+ users</span>
              </div>
            </div>

            {/* Right Side - Signup Form */}
            <Card className={cn(
              "w-full backdrop-blur-xl border-white/50 shadow-2xl",
              isEmployer 
                ? "bg-white/80 shadow-red-100/50" 
                : "bg-white/80 shadow-blue-100/50"
            )}>
              <CardHeader className="space-y-1 text-center pb-6">
                <div className="flex justify-center mb-4">
                  <img 
                    src={truejobsLoginLogo} 
                    alt="TrueJobs - India's Smart Job Portal" 
                    className="h-20 w-auto object-contain transition-transform hover:scale-105 animate-[fade-in_0.6s_ease-out,scale-in_0.5s_ease-out]"
                  />
                </div>
                <CardTitle className={cn(
                  "text-2xl font-bold",
                  isEmployer ? "text-red-700" : "text-gray-900"
                )}>
                  {t('auth.signupTitle')}
                </CardTitle>
                <CardDescription>
                  {t('auth.signupDesc')}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('auth.selectRole')}</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(value) => setRole(value as AppRole)}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem
                          value="job_seeker"
                          id="job_seeker"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="job_seeker"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-white/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                        >
                          <User className="mb-2 h-6 w-6" />
                          <span className="text-sm font-medium">{t('auth.jobSeeker')}</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem
                          value="employer"
                          id="employer"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="employer"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-white/50 p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-500 [&:has([data-state=checked])]:border-orange-500 cursor-pointer transition-all"
                        >
                          <Building2 className="mb-2 h-6 w-6" />
                          <span className="text-sm font-medium">{t('auth.employer')}</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Employer-specific fields */}
                  {isEmployer && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Company Name <span className="text-destructive">*</span></Label>
                        <div className="relative group">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-orange-500 transition-colors" />
                          <Input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Your company name"
                            className="pl-11 h-12 bg-white/50 border-gray-200 focus:border-orange-400 focus:ring-orange-400/20"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Your Role</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'hr', label: 'HR' },
                            { value: 'recruiter', label: 'Recruiter' },
                            { value: 'consultant', label: 'Consultant' },
                          ].map((subRole) => (
                            <Button
                              key={subRole.value}
                              type="button"
                              variant={employerSubRole === subRole.value ? 'default' : 'outline'}
                              size="sm"
                              className={cn(
                                'h-10',
                                employerSubRole === subRole.value && 'bg-gradient-to-r from-red-600 to-orange-500'
                              )}
                              onClick={() => setEmployerSubRole(subRole.value)}
                            >
                              {subRole.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium">{t('auth.fullName')}</Label>
                    <div className="relative group">
                      <User className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                        isEmployer 
                          ? "text-muted-foreground group-focus-within:text-orange-500" 
                          : "text-muted-foreground group-focus-within:text-blue-500"
                      )} />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={cn(
                          "pl-11 h-12 bg-white/50 border-gray-200 transition-all",
                          isEmployer 
                            ? "focus:border-orange-400 focus:ring-orange-400/20" 
                            : "focus:border-blue-400 focus:ring-blue-400/20"
                        )}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      {t('auth.email')}
                    </Label>
                    <div className="relative group">
                      <Mail className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                        isEmployer 
                          ? "text-muted-foreground group-focus-within:text-orange-500" 
                          : "text-muted-foreground group-focus-within:text-blue-500"
                      )} />
                      <Input
                        id="email"
                        type="email"
                        placeholder={isEmployer ? 'name@company.com' : 'name@example.com'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(
                          "pl-11 h-12 bg-white/50 border-gray-200 transition-all",
                          isEmployer 
                            ? "focus:border-orange-400 focus:ring-orange-400/20" 
                            : "focus:border-blue-400 focus:ring-blue-400/20"
                        )}
                        required
                      />
                    </div>
                  </div>

                  {/* Optional Password */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium">
                      Set a Password <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <div className="relative group">
                      <Lock className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                        isEmployer 
                          ? "text-muted-foreground group-focus-within:text-orange-500" 
                          : "text-muted-foreground group-focus-within:text-blue-500"
                      )} />
                      <Input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 6 characters"
                        value={optionalPassword}
                        onChange={(e) => setOptionalPassword(e.target.value)}
                        minLength={6}
                        className={cn(
                          "pl-11 pr-11 h-12 bg-white/50 border-gray-200 transition-all",
                          isEmployer 
                            ? "focus:border-orange-400 focus:ring-orange-400/20" 
                            : "focus:border-blue-400 focus:ring-blue-400/20"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">You can also log in with OTP anytime</p>
                    {optionalPassword && optionalPassword.length > 0 && optionalPassword.length < 6 && (
                      <p className="text-xs text-destructive">Password must be at least 6 characters</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className={cn(
                      "w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
                      isEmployer 
                        ? "bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-orange-200" 
                        : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200"
                    )}
                    disabled={isLoading || isSendingOtp}
                  >
                    {(isLoading || isSendingOtp) && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Continue with Email Verification
                  </Button>
                </form>

              </CardContent>
              
              <CardFooter className="flex flex-col space-y-4 pt-6 border-t border-gray-100">
                <p className="text-center text-sm text-muted-foreground">
                  {t('auth.alreadyHaveAccount')}{' '}
                  <Link 
                    to="/login" 
                    className={cn(
                      "font-semibold transition-colors",
                      isEmployer 
                        ? "text-orange-600 hover:text-orange-700" 
                        : "text-primary hover:text-primary/80"
                    )}
                  >
                    {t('nav.login')}
                  </Link>
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  {t('auth.agreeTerms')}{' '}
                  <Link to="/terms" className="underline hover:text-foreground">
                    {t('footer.termsOfUse')}
                  </Link>{' '}
                  &{' '}
                  <Link to="/privacy" className="underline hover:text-foreground">
                    {t('footer.privacy')}
                  </Link>
                </p>
              </CardFooter>
            </Card>
            </div>
          </AuthPageTransition>
        </div>
      </div>
    </Layout>
  );
}
