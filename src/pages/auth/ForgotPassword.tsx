import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Phone, Lock, Sparkles, Shield, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { AuthPageTransition } from '@/components/auth/AuthPageTransition';
import { PremiumAuthBackground } from '@/components/auth/PremiumAuthBackground';
import truejobsLoginLogo from '@/assets/truejobs-login-logo.png';

export default function ForgotPassword() {
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [step, setStep] = useState<'input' | 'otp' | 'reset'>('input');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const { t } = useLanguage();
  const { toast } = useToast();

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleEmailSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp/send', {
        body: { email, purpose: 'reset_password' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to send OTP');
      }

      toast({
        title: 'OTP Sent!',
        description: 'Please check your email for the verification code.',
      });
      setStep('otp');
      setResendTimer(60);
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handlePhoneSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { phone, action: 'send', purpose: 'reset_password' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to send OTP');
      }

      toast({
        title: t('forgotPassword.otpSent'),
        description: t('forgotPassword.checkPhone'),
      });
      setStep('otp');
      setResendTimer(60);
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleVerifyEmailOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-email-otp/verify', {
        body: { email, otp }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Invalid OTP');
      }

      toast({
        title: 'Email Verified!',
        description: 'Please set your new password.',
      });
      setStep('reset');
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleVerifyPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { phone, action: 'verify', otp, purpose: 'reset_password' }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Invalid OTP');
      }

      toast({
        title: t('forgotPassword.phoneVerified'),
        description: t('forgotPassword.setNewPassword'),
      });
      setStep('reset');
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error') || 'Error',
        description: t('forgotPassword.passwordsDoNotMatch'),
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error') || 'Error',
        description: 'Password must be at least 6 characters long',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      let data, error;
      
      if (method === 'email') {
        const result = await supabase.functions.invoke('reset-password-email', {
          body: { email, newPassword }
        });
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase.functions.invoke('reset-password-phone', {
          body: { phone, newPassword }
        });
        data = result.data;
        error = result.error;
      }

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Failed to reset password');
      }

      toast({
        title: t('forgotPassword.passwordReset'),
        description: t('forgotPassword.passwordResetSuccess'),
      });

      window.location.href = '/login';
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    if (method === 'email') {
      await handleEmailSendOTP({ preventDefault: () => {} } as React.FormEvent);
    } else {
      await handlePhoneSendOTP({ preventDefault: () => {} } as React.FormEvent);
    }
  };

  const goBack = () => {
    if (step === 'otp') {
      setStep('input');
      setOtp('');
    } else if (step === 'reset') {
      setStep('otp');
    }
  };

  const benefits = [
    'Secure password recovery',
    'Multiple verification options',
    'Instant account access',
  ];

  const getOTPDescription = () => {
    if (method === 'email') {
      return (
        <>
          Enter the 6-digit code sent to<br />
          <span className="font-medium text-foreground">{email}</span>
        </>
      );
    }
    return (
      <>
        Enter the 6-digit code sent to<br />
        <span className="font-medium text-foreground">{phone}</span>
      </>
    );
  };

  return (
    <Layout>
      <SEO title="Reset Password" noindex={true} />
      <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <PremiumAuthBackground />

        <div className="relative flex items-center justify-center py-12 px-4 min-h-[calc(100vh-4rem)]">
          <AuthPageTransition>
            <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center mx-auto">
              {/* Left Side - Benefits Section (hidden on mobile) */}
              <div className="hidden lg:flex flex-col space-y-8 pr-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                    <Sparkles className="h-4 w-4" />
                    Account Recovery
                  </div>
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                    Reset Your Password
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Don't worry, it happens to the best of us. Choose your preferred recovery method and get back to your account.
                  </p>
                </div>

                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-white/80 shadow-sm"
                    >
                      <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100">
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="font-medium text-gray-700">{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span className="text-sm text-muted-foreground">SSL Secured</span>
                  </div>
                  <div className="h-4 w-px bg-gray-300" />
                  <span className="text-sm text-muted-foreground">Trusted by 10,000+ users</span>
                </div>
              </div>

              {/* Right Side - Reset Form */}
              <Card className="w-full backdrop-blur-xl border-white/50 shadow-2xl bg-white/80 shadow-blue-100/50 relative">
                {step !== 'input' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goBack}
                    className="absolute left-4 top-4 z-10"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                
                <CardHeader className="space-y-1 text-center pb-8">
                  <div className="flex justify-center mb-6">
                    <img 
                      src={truejobsLoginLogo} 
                      alt="TrueJobs - India's Smart Job Portal" 
                      className="h-20 w-auto object-contain transition-transform hover:scale-105 animate-[fade-in_0.6s_ease-out,scale-in_0.5s_ease-out]"
                    />
                  </div>
                  <CardTitle className="text-2xl font-bold">
                    {step === 'input' && t('forgotPassword.title')}
                    {step === 'otp' && `Verify Your ${method === 'email' ? 'Email' : 'Phone'}`}
                    {step === 'reset' && 'Create New Password'}
                  </CardTitle>
                  <CardDescription>
                    {step === 'input' && t('forgotPassword.subtitle')}
                    {step === 'otp' && getOTPDescription()}
                    {step === 'reset' && 'Choose a strong password for your account'}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {step === 'input' && (
                    <Tabs value={method} onValueChange={(v) => { setMethod(v as 'email' | 'phone'); setStep('input'); }}>
                      <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {t('forgotPassword.email')}
                        </TabsTrigger>
                        <TabsTrigger value="phone" className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {t('forgotPassword.phone')}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="email">
                        <form onSubmit={handleEmailSendOTP} className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">{t('forgotPassword.emailAddress')}</Label>
                            <div className="relative group">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                              <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="pl-11 h-12 bg-white/50 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                                required
                              />
                            </div>
                          </div>
                          <Button 
                            type="submit" 
                            className="w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200" 
                            disabled={isLoading}
                          >
                            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Send OTP
                          </Button>
                        </form>
                      </TabsContent>

                      <TabsContent value="phone">
                        <form onSubmit={handlePhoneSendOTP} className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-sm font-medium">{t('forgotPassword.phoneNumber')}</Label>
                            <div className="relative group">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                              <Input
                                id="phone"
                                type="tel"
                                placeholder="+91 98765 43210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="pl-11 h-12 bg-white/50 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                                required
                              />
                            </div>
                          </div>
                          <Button 
                            type="submit" 
                            className="w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200" 
                            disabled={isLoading}
                          >
                            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            {t('forgotPassword.sendOTP')}
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  )}

                  {step === 'otp' && (
                    <form onSubmit={method === 'email' ? handleVerifyEmailOTP : handleVerifyPhoneOTP} className="space-y-6">
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
                          {t('forgotPassword.didntReceive')}{' '}
                          <button
                            type="button"
                            onClick={handleResendOTP}
                            disabled={resendTimer > 0 || isLoading}
                            className={cn(
                              "font-medium hover:underline",
                              resendTimer > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary"
                            )}
                          >
                            {resendTimer > 0 ? `Resend in ${resendTimer}s` : t('forgotPassword.resend')}
                          </button>
                        </p>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200" 
                        disabled={isLoading || otp.length !== 6}
                      >
                        {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                        {t('forgotPassword.verifyOTP')}
                      </Button>
                    </form>
                  )}

                  {step === 'reset' && (
                    <form onSubmit={handleResetPassword} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword" className="text-sm font-medium">{t('forgotPassword.newPassword')}</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                          <Input
                            id="newPassword"
                            type="password"
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="pl-11 h-12 bg-white/50 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                            required
                            minLength={6}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-medium">{t('forgotPassword.confirmPassword')}</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pl-11 h-12 bg-white/50 border-gray-200 focus:border-blue-400 focus:ring-blue-400/20 transition-all"
                            required
                            minLength={6}
                          />
                        </div>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200" 
                        disabled={isLoading}
                      >
                        {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                        {t('forgotPassword.resetPassword')}
                      </Button>
                    </form>
                  )}
                </CardContent>
                
                <CardFooter className="flex flex-col space-y-4 pt-4">
                  <p className="text-center text-sm text-muted-foreground">
                    {t('forgotPassword.rememberPassword')}{' '}
                    <Link to="/login" className="font-medium text-primary hover:underline">
                      {t('forgotPassword.backToLogin')}
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
