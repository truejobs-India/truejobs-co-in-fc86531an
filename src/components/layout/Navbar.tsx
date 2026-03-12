import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationBell } from '@/components/ui/NotificationBell';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Briefcase, 
  Building2, 
  Menu, 
  User, 
  LogOut, 
  Settings, 
  LayoutDashboard, 
  Globe, 
  Check, 
  FileText, 
  CheckCircle, 
  BarChart3, 
  Gift,
  ChevronDown,
  BookOpen,
  HelpCircle,
  Users,
  MapPin,
  Factory,
  GraduationCap,
  Laptop,
  UserCheck,
  TrendingUp,
  Heart,
  FolderOpen,
  RefreshCw,
  Landmark
} from 'lucide-react';
import candidateLoginButton from '@/assets/candidate-login-button.png';
import employerLoginButton from '@/assets/employer-login-button.png';
import truejobsLogo from '@/assets/truejobs-logo.png';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const LANGUAGE_OPTIONS: { code: Language; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
];

const JOBS_BY_LOCATION = [
  { label: 'Jobs in Mumbai', href: '/jobs?location=mumbai' },
  { label: 'Jobs in Delhi NCR', href: '/jobs?location=delhi' },
  { label: 'Jobs in Bangalore', href: '/jobs?location=bangalore' },
  { label: 'Jobs in Hyderabad', href: '/jobs?location=hyderabad' },
  { label: 'Jobs in Chennai', href: '/jobs?location=chennai' },
  { label: 'Jobs in Pune', href: '/jobs?location=pune' },
];

const JOBS_BY_INDUSTRY = [
  { label: 'IT & Software', href: '/jobs?industry=it' },
  { label: 'Banking & Finance', href: '/jobs?industry=banking' },
  { label: 'Healthcare', href: '/jobs?industry=healthcare' },
  { label: 'Manufacturing', href: '/jobs?industry=manufacturing' },
  { label: 'Education', href: '/jobs?industry=education' },
  { label: 'E-commerce', href: '/jobs?industry=ecommerce' },
];

const JOBS_BY_EXPERIENCE = [
  { label: 'Fresher Jobs', href: '/jobs?experience=fresher' },
  { label: '1-3 Years', href: '/jobs?experience=junior' },
  { label: '3-5 Years', href: '/jobs?experience=mid' },
  { label: '5-10 Years', href: '/jobs?experience=senior' },
  { label: '10+ Years', href: '/jobs?experience=lead' },
];

const JOBS_BY_TYPE = [
  { label: 'Remote Jobs', href: '/jobs?type=remote' },
  { label: 'Work From Home', href: '/jobs?type=wfh' },
  { label: 'Full Time', href: '/jobs?type=full_time' },
  { label: 'Part Time', href: '/jobs?type=part_time' },
  { label: 'Internship', href: '/jobs?type=internship' },
];

const TOOLS_ITEMS = [
  { labelKey: 'nav.aiResumeBuilder', href: '/tools/resume-builder', icon: FileText, description: 'Create professional resumes with AI', hasNew: true },
  { labelKey: 'nav.aiResumeChecker', href: '/tools/resume-checker', icon: CheckCircle, description: 'Check your resume ATS score', hasNew: true },
  { labelKey: 'nav.polls', href: '#', icon: BarChart3, description: 'Participate in career polls' },
  { labelKey: 'nav.contestsSurveys', href: '#', icon: Gift, description: 'Win prizes and earn rewards' },
];


export function Navbar() {
  const { user, profile, role, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getDashboardLink = () => {
    switch (role) {
      case 'admin':
        return '/admin';
      case 'employer':
        return '/employer/dashboard';
      default:
        return '/dashboard';
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const currentLanguageOption = LANGUAGE_OPTIONS.find(opt => opt.code === language);

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <img 
              src={truejobsLogo} 
              alt="TrueJobs - India's Smart Job Portal" 
              className="h-10 w-auto object-contain"
            />
          </Link>

          {/* Desktop Primary Navigation */}
          <div className="hidden lg:flex items-center gap-1 ml-10">
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                {/* Sarkari Jobs - Primary */}
                <NavigationMenuItem>
                  <Link 
                    to="/sarkari-jobs" 
                    className="px-4 py-2 text-sm font-semibold text-[hsl(170,60%,30%)] hover:text-[hsl(170,60%,20%)] hover:bg-[hsl(170,60%,95%)] rounded-md transition-colors whitespace-nowrap"
                  >
                    🏛️ Sarkari Jobs
                  </Link>
                </NavigationMenuItem>




                <NavigationMenuItem>
                  <Link 
                    to="/blog" 
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors whitespace-nowrap"
                  >
                    TrueJobs Career Insights
                  </Link>
                </NavigationMenuItem>

                {/* Help Center */}
                <NavigationMenuItem>
                  <Link 
                    to="/contactus" 
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                  >
                    {t('nav.helpCenter')}
                  </Link>
                </NavigationMenuItem>

                {/* Tools Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 bg-transparent data-[state=open]:bg-gray-50">
                    {t('nav.tools')}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="w-72 p-2 bg-white">
                      {TOOLS_ITEMS.map((item) => (
                        <li key={item.labelKey}>
                          <NavigationMenuLink asChild>
                            <Link
                              to={item.href}
                              className="flex items-start gap-3 p-3 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <item.icon className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {t(item.labelKey)}
                                  </span>
                                  {item.hasNew && (
                                    <Badge className="bg-slate-500 hover:bg-slate-600 text-white text-[10px] px-1.5 py-0 h-4 font-medium">
                                      NEW
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {item.description}
                                </div>
                              </div>
                            </Link>
                          </NavigationMenuLink>
                        </li>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Language Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center gap-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                >
                  <Globe className="h-4 w-4" />
                  <span className="text-sm font-medium">{currentLanguageOption?.nativeLabel}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-white">
                {LANGUAGE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.code}
                    onClick={() => setLanguage(option.code)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <span>{option.nativeLabel}</span>
                    {language === option.code && <Check className="h-4 w-4 text-blue-600" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {user ? (
              <>
                {/* Notifications */}
                <NotificationBell />

                {/* Logged in As Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2 px-3 py-2 h-auto border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
                        <AvatarFallback className="bg-blue-600 text-white text-xs">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start">
                        <span className="text-xs text-gray-500">Logged in as</span>
                        <span className="text-sm font-medium text-gray-900 max-w-[120px] truncate">
                          {profile?.full_name || 'User'}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 bg-white" align="end">
                    <DropdownMenuLabel className="font-normal px-3 py-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-gray-900">{profile?.full_name || 'User'}</p>
                        <p className="text-xs text-gray-500">{profile?.email}</p>
                        <Badge variant="outline" className="w-fit mt-1 capitalize text-xs">
                          {role === 'job_seeker' ? 'Candidate' : role?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Quick Actions for Candidates */}
                    {role === 'job_seeker' && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer">
                          <Heart className="mr-2 h-4 w-4 text-rose-500" />
                          My Saved Jobs
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/tools/resume-builder')} className="cursor-pointer">
                          <FileText className="mr-2 h-4 w-4 text-blue-500" />
                          My Resume
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer">
                          <FolderOpen className="mr-2 h-4 w-4 text-green-500" />
                          My All Job Applications
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    
                    <DropdownMenuItem onClick={() => navigate(getDashboardLink())} className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4 text-gray-500" />
                      {t('nav.dashboard')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(role === 'employer' ? '/employer/company' : '/profile')} className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-gray-500" />
                      {t('nav.profile')}
                    </DropdownMenuItem>
                    {role === 'employer' && (
                      <DropdownMenuItem onClick={() => navigate('/employer/company')} className="cursor-pointer">
                        <Building2 className="mr-2 h-4 w-4 text-gray-500" />
                        {t('employer.company')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4 text-gray-500" />
                      {t('nav.settings')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    
                    {/* Switch Role Options */}
                    <DropdownMenuLabel className="text-xs text-gray-500 font-normal px-3 py-1">
                      Switch Account
                    </DropdownMenuLabel>
                    <DropdownMenuItem 
                      onClick={async () => {
                        await signOut();
                        navigate('/login?role=candidate');
                      }} 
                      className="cursor-pointer"
                    >
                      <RefreshCw className="mr-2 h-4 w-4 text-gray-500" />
                      Switch User
                    </DropdownMenuItem>
                    {role === 'job_seeker' && (
                      <DropdownMenuItem 
                        onClick={async () => {
                          await signOut();
                          navigate('/login?role=employer');
                        }} 
                        className="cursor-pointer"
                      >
                        <Building2 className="mr-2 h-4 w-4 text-orange-500" />
                        Login As Employer
                      </DropdownMenuItem>
                    )}
                    {role === 'employer' && (
                      <DropdownMenuItem 
                        onClick={async () => {
                          await signOut();
                          navigate('/login?role=candidate');
                        }} 
                        className="cursor-pointer"
                      >
                        <User className="mr-2 h-4 w-4 text-blue-500" />
                        Login As Candidate
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('nav.logout')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  className="hover:opacity-90 hover:scale-105 transition-all cursor-pointer hidden sm:block" 
                  onClick={() => navigate('/login?role=employer')}
                >
                  <img 
                    src={employerLoginButton} 
                    alt="Employer login - Post jobs and hire talent" 
                    className="h-12 object-contain"
                  />
                </button>
                <button 
                  className="hover:opacity-90 hover:scale-105 transition-all cursor-pointer" 
                  onClick={() => navigate('/login?role=candidate')}
                >
                  <img 
                    src={candidateLoginButton} 
                    alt="Job seeker login - Find your dream job" 
                    className="h-10 sm:h-12 object-contain"
                  />
                </button>
              </div>
            )}

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-gray-50">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-white p-0">
                <div className="flex flex-col h-full">
                  {/* Mobile Header */}
                  <div className="p-4 border-b border-gray-100">
                    <Link to="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-lg font-semibold text-gray-900">TrueJobs</span>
                    </Link>
                  </div>

                  <div className="flex-1 overflow-y-auto py-4">
                    {/* Primary Navigation */}
                    <div className="px-4 space-y-1">
                      <Link
                        to="/sarkari-jobs"
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-[hsl(170,60%,30%)] hover:bg-[hsl(170,60%,95%)] rounded-lg"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Landmark className="h-4 w-4" />
                        🏛️ Sarkari Jobs
                      </Link>
                    </div>

                    {/* Tools Section */}
                    <div className="mt-6 px-4">
                      <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {t('nav.tools')}
                      </p>
                      <div className="space-y-1">
                        {TOOLS_ITEMS.map((item) => (
                          <Link
                            key={item.labelKey}
                            to={item.href}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <item.icon className="h-4 w-4 text-gray-500" />
                            <span className="flex-1">{t(item.labelKey)}</span>
                            {item.hasNew && (
                              <Badge className="bg-slate-500 text-white text-[10px] px-1.5 py-0 h-4">
                                NEW
                              </Badge>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Resources Section */}
                    <div className="mt-6 px-4">
                      <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {t('nav.resources')}
                      </p>
                      <div className="space-y-1">
                        <Link
                          to="/blog"
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <BookOpen className="h-5 w-5 text-gray-500" />
                          TrueJobs Career Insights
                        </Link>
                        <Link
                          to="/contactus"
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <HelpCircle className="h-5 w-5 text-gray-500" />
                          {t('nav.helpCenter')}
                        </Link>
                      </div>
                    </div>


                    {/* Language */}
                    <div className="mt-6 px-4">
                      <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                        {t('language.switchTo')}
                      </p>
                      <div className="flex flex-wrap gap-2 px-3">
                        {LANGUAGE_OPTIONS.map((option) => (
                          <Button
                            key={option.code}
                            variant={language === option.code ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "text-xs",
                              language === option.code 
                                ? "bg-blue-600 hover:bg-blue-700" 
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                            onClick={() => setLanguage(option.code)}
                          >
                            {option.nativeLabel}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Footer - Login Buttons */}
                  {!user && (
                    <div className="border-t border-gray-100 p-4 space-y-2">
                      <Button 
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          navigate('/login?role=employer');
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <Building2 className="mr-2 h-4 w-4" />
                        {t('nav.employerLogin')}
                      </Button>
                      <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => {
                          navigate('/login?role=candidate');
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <User className="mr-2 h-4 w-4" />
                        {t('nav.candidateLogin')}
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
