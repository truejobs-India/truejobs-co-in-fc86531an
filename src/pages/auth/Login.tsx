import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Sparkles, Shield, CheckCircle, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import truejobsLoginLogo from '@/assets/truejobs-login-logo.png';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type Step = 'email' | 'otp';
type LoginMethod = 'otp' | 'password';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('otp');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<Step>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const searchParams = new URLSearchParams(location.search);
  const isEmployer = searchParams.get('role') === 'employer';

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOTP = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await supabase.functions.invoke('send-email-otp/send', {
        body: { email: email.trim(), purpose: 'login' },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || 'Failed to send OTP');
      }

      setStep('otp');
      setResendTimer(30);
      toast({
        title: 'OTP Sent!',
        description: `A 6-digit code has been sent to ${email}`,
      });
      // Focus first OTP input
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only last digit
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newOtp.every(d => d !== '')) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      otpRefs.current[5]?.focus();
      handleVerifyOTP(pastedData);
    }
  };

  const handleVerifyOTP = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await supabase.functions.invoke('send-email-otp/verify', {
        body: { email: email.trim(), otp: code },
      });

      if (response.error || response.data?.error) {
        throw new Error(response.data?.error || 'Invalid OTP');
      }

      const { access_token, refresh_token, roles, is_new_user } = response.data;

      // Set the session directly using tokens from server-side verification
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        throw new Error('Failed to establish session. Please try again.');
      }

      toast({
        title: is_new_user ? 'Welcome to TrueJobs!' : 'Welcome back!',
        description: 'You have been logged in successfully.',
      });

      // Fetch roles directly from DB since response roles may be stale for existing users
      const sessionUser = (await supabase.auth.getUser()).data.user;
      const { data: freshRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessionUser?.id || '');

      const userRolesList = freshRoles?.map(r => r.role) || [];

      // Redirect based on role
      if (from) {
        navigate(from, { replace: true });
      } else if (userRolesList.includes('admin')) {
        navigate('/admin', { replace: true });
      } else if (userRolesList.includes('employer')) {
        navigate('/employer/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error: signInError } = await signIn(email.trim(), password);
      if (signInError) throw signInError;

      toast({
        title: 'Welcome back!',
        description: 'You have been logged in successfully.',
      });

      // Fetch roles for redirect
      const sessionUser = (await supabase.auth.getUser()).data.user;
      const { data: freshRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', sessionUser?.id || '');

      const userRolesList = freshRoles?.map(r => r.role) || [];

      if (from) {
        navigate(from, { replace: true });
      } else if (userRolesList.includes('admin')) {
        navigate('/admin', { replace: true });
      } else if (userRolesList.includes('employer')) {
        navigate('/employer/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const benefits = isEmployer ? [
    'Access to verified candidates',
    'AI-powered talent matching',
    'Streamlined hiring workflow',
  ] : [
    'AI-matched job recommendations',
    'One-click applications',
    'Real-time application tracking',
  ];

  return (
    <Layout>
      <div className={cn(
        "min-h-[calc(100vh-4rem)] relative overflow-hidden",
        isEmployer 
          ? "bg-gradient-to-br from-red-50 via-orange-50 to-amber-50" 
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      )}>
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={cn(
            "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-30",
            isEmployer ? "bg-orange-300" : "bg-blue-300"
          )} />
          <div className={cn(
            "absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20",
            isEmployer ? "bg-red-300" : "bg-indigo-300"
          )} />
          <div className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl opacity-10",
            isEmployer ? "bg-amber-400" : "bg-purple-400"
          )} />
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          />
        </div>

        <div className="relative flex items-center justify-center py-12 px-4 min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
            
            {/* Left Side - Benefits */}
            <div className="hidden lg:flex flex-col space-y-8 pr-8">
              <div className="space-y-4">
                <div className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                  isEmployer 
                    ? "bg-orange-100 text-orange-700" 
                    : "bg-blue-100 text-blue-700"
                )}>
                  <Sparkles className="h-4 w-4" />
                  {isEmployer ? 'Hire Top Talent' : 'Find Your Dream Job'}
                </div>
                <h1 className={cn(
                  "text-4xl font-bold tracking-tight",
                  isEmployer ? "text-red-900" : "text-gray-900"
                )}>
                  {isEmployer ? 'Build Your Dream Team' : 'Your Career Journey Starts Here'}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {isEmployer 
                    ? 'Connect with thousands of verified candidates and find the perfect match for your team.'
                    : 'Join thousands of professionals who found their dream jobs through TrueJobs.'}
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

            {/* Right Side - Login Card */}
            <Card className={cn(
              "w-full backdrop-blur-xl border-white/50 shadow-2xl",
              isEmployer 
                ? "bg-white/80 shadow-red-100/50" 
                : "bg-white/80 shadow-blue-100/50"
            )}>
              <CardHeader className="space-y-1 text-center pb-8">
                <div className="flex justify-center mb-6">
                  <img 
                    src={truejobsLoginLogo} 
                    alt="TrueJobs - India's Smart Job Portal" 
                    className="h-20 w-auto object-contain transition-transform hover:scale-105"
                  />
                </div>
                <CardTitle className={cn(
                  "text-2xl font-bold",
                  isEmployer ? "text-red-700" : "text-gray-900"
                )}>
                  {step === 'email' 
                    ? (isEmployer ? t('auth.welcomeEmployer') : 'Sign In to TrueJobs')
                    : 'Enter Verification Code'
                  }
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {step === 'email' 
                    ? (loginMethod === 'otp' ? 'Enter your email to receive a login code' : 'Sign in with your email and password')
                    : `We sent a 6-digit code to ${email}`
                  }
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {step === 'email' ? (
                  <div className="space-y-5">
                    <Tabs value={loginMethod} onValueChange={(v) => { setLoginMethod(v as LoginMethod); setError(''); }} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="otp">
                          <Mail className="h-4 w-4 mr-2" />
                          Login with OTP
                        </TabsTrigger>
                        <TabsTrigger value="password">
                          <Lock className="h-4 w-4 mr-2" />
                          Login with Password
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="otp">
                        <form onSubmit={handleSendOTP} className="space-y-5 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="email-otp" className="text-sm font-medium">Email Address</Label>
                            <div className="relative group">
                              <Mail className={cn(
                                "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                                isEmployer 
                                  ? "text-muted-foreground group-focus-within:text-orange-500" 
                                  : "text-muted-foreground group-focus-within:text-blue-500"
                              )} />
                              <Input
                                id="email-otp"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                className={cn(
                                  "pl-11 h-12 bg-white/50 border-gray-200 transition-all",
                                  isEmployer 
                                    ? "focus:border-orange-400 focus:ring-orange-400/20" 
                                    : "focus:border-blue-400 focus:ring-blue-400/20"
                                )}
                                required
                                autoFocus
                              />
                            </div>
                            {error && (
                              <p className="text-sm text-red-600 mt-1">{error}</p>
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
                            disabled={isLoading}
                          >
                            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Send Login Code
                          </Button>
                        </form>
                      </TabsContent>

                      <TabsContent value="password">
                        <form onSubmit={handlePasswordLogin} className="space-y-5 pt-2">
                          <div className="space-y-2">
                            <Label htmlFor="email-pw" className="text-sm font-medium">Email Address</Label>
                            <div className="relative group">
                              <Mail className={cn(
                                "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                                isEmployer 
                                  ? "text-muted-foreground group-focus-within:text-orange-500" 
                                  : "text-muted-foreground group-focus-within:text-blue-500"
                              )} />
                              <Input
                                id="email-pw"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(''); }}
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
                            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                            <div className="relative group">
                              <Lock className={cn(
                                "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors",
                                isEmployer 
                                  ? "text-muted-foreground group-focus-within:text-orange-500" 
                                  : "text-muted-foreground group-focus-within:text-blue-500"
                              )} />
                              <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                className={cn(
                                  "pl-11 pr-11 h-12 bg-white/50 border-gray-200 transition-all",
                                  isEmployer 
                                    ? "focus:border-orange-400 focus:ring-orange-400/20" 
                                    : "focus:border-blue-400 focus:ring-blue-400/20"
                                )}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                            {error && (
                              <p className="text-sm text-red-600 mt-1">{error}</p>
                            )}
                          </div>
                          <div className="flex justify-end">
                            <Link
                              to="/forgot-password"
                              className={cn(
                                "text-sm font-medium transition-colors",
                                isEmployer ? "text-orange-600 hover:text-orange-700" : "text-primary hover:text-primary/80"
                              )}
                            >
                              Forgot Password?
                            </Link>
                          </div>
                          <Button 
                            type="submit" 
                            className={cn(
                              "w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
                              isEmployer 
                                ? "bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-orange-200" 
                                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200"
                            )}
                            disabled={isLoading}
                          >
                            {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                            Sign In
                          </Button>
                        </form>
                      </TabsContent>
                    </Tabs>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Back button */}
                    <button 
                      onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); setError(''); }}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Change email
                    </button>

                    {/* OTP Input */}
                    <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                      {otp.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { otpRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className={cn(
                            "w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 bg-white/50 transition-all outline-none",
                            digit 
                              ? (isEmployer ? "border-orange-400 ring-2 ring-orange-100" : "border-blue-400 ring-2 ring-blue-100")
                              : "border-gray-200",
                            isEmployer 
                              ? "focus:border-orange-500 focus:ring-2 focus:ring-orange-200" 
                              : "focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          )}
                        />
                      ))}
                    </div>

                    {error && (
                      <p className="text-sm text-red-600 text-center">{error}</p>
                    )}

                    <Button 
                      onClick={() => handleVerifyOTP()}
                      className={cn(
                        "w-full h-12 text-base font-semibold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5",
                        isEmployer 
                          ? "bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 shadow-orange-200" 
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200"
                      )}
                      disabled={isLoading || otp.join('').length !== 6}
                    >
                      {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                      Verify & Sign In
                    </Button>

                    {/* Resend OTP */}
                    <p className="text-center text-sm text-muted-foreground">
                      Didn't receive the code?{' '}
                      {resendTimer > 0 ? (
                        <span className="font-medium">Resend in {resendTimer}s</span>
                      ) : (
                        <button
                          onClick={() => handleSendOTP()}
                          className={cn(
                            "font-semibold transition-colors",
                            isEmployer ? "text-orange-600 hover:text-orange-700" : "text-primary hover:text-primary/80"
                          )}
                        >
                          Resend Code
                        </button>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 pt-6 border-t border-gray-100">
                <p className="text-center text-sm text-muted-foreground">
                  New to TrueJobs?{' '}
                  <Link 
                    to="/signup" 
                    className={cn(
                      "font-semibold transition-colors",
                      isEmployer 
                        ? "text-orange-600 hover:text-orange-700" 
                        : "text-primary hover:text-primary/80"
                    )}
                  >
                    {t('nav.signup')}
                  </Link>
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
