import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Mail, MapPin, Shield, Lock, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
import truejobsLogo from '@/assets/truejobs-logo.png';
import { INSURANCE_STATES } from '@/pages/jobs/cityData';
import { NEAR_ME_PAGES } from '@/pages/jobs/nearMeData';
import { MSMECredibility } from '@/components/MSMECredibility';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center">
              <img 
                src={truejobsLogo} 
                alt="TrueJobs - India's Smart Job Portal" 
                className="h-10 w-auto object-contain"
              />
            </Link>
            <p className="text-muted-foreground text-sm">
              {t('footer.tagline')}
            </p>

            {/* Business Information */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                <span>TrueJobs India, Registered Office: New Delhi, India</span>
              </div>
              <a href="mailto:info@truejobs.co.in" className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 shrink-0" />
                info@truejobs.co.in
              </a>
              <a href="mailto:support@truejobs.co.in" className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 shrink-0" />
                support@truejobs.co.in
              </a>
            </div>

            {/* Social Media Links */}
            <div className="flex gap-3">
              <a href="https://www.facebook.com/truejobsindia" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all" aria-label="Facebook">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/truejobsindia" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="https://twitter.com/truejobsindia" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/company/truejobsindia" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all" aria-label="LinkedIn">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="https://www.youtube.com/@truejobsindia" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all" aria-label="YouTube">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Sarkari Jobs */}
          <div>
            <h4 className="font-semibold mb-4">Sarkari Jobs</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/latest-govt-jobs" className="text-muted-foreground hover:text-foreground transition-colors">Latest Govt Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=ssc" className="text-muted-foreground hover:text-foreground transition-colors">SSC Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=railway" className="text-muted-foreground hover:text-foreground transition-colors">Railway Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=banking" className="text-muted-foreground hover:text-foreground transition-colors">Banking Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=defence" className="text-muted-foreground hover:text-foreground transition-colors">Defence Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=upsc" className="text-muted-foreground hover:text-foreground transition-colors">UPSC Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=teaching" className="text-muted-foreground hover:text-foreground transition-colors">Teaching Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=police" className="text-muted-foreground hover:text-foreground transition-colors">Police Jobs</Link></li>
              <li><Link to="/sarkari-jobs?dept=psu" className="text-muted-foreground hover:text-foreground transition-colors">PSU Jobs</Link></li>
            </ul>

            <h4 className="font-semibold mt-6 mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/sarkari-jobs?status=admit_card_released" className="text-muted-foreground hover:text-foreground transition-colors">Admit Cards</Link></li>
              <li><Link to="/sarkari-jobs?status=result_declared" className="text-muted-foreground hover:text-foreground transition-colors">Results</Link></li>
              <li><Link to="/sarkari-jobs" className="text-muted-foreground hover:text-foreground transition-colors">Answer Keys</Link></li>
              <li><Link to="/sarkari-jobs" className="text-muted-foreground hover:text-foreground transition-colors">Exam Calendar</Link></li>
            </ul>
          </div>

          {/* For Job Seekers */}
          <div>
            <h4 className="font-semibold mb-4">{t('footer.forJobSeekers')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/jobs" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.browseJobs')}
                </Link>
              </li>
              <li>
                <Link to="/private-jobs" className="text-muted-foreground hover:text-foreground transition-colors">
                  Private Jobs
                </Link>
              </li>
              <li>
                <Link to="/jobs?type=remote" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.remoteJobs')}
                </Link>
              </li>
              <li>
                <Link to="/jobs?experience=fresher" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.fresherJobs')}
                </Link>
              </li>
              <li>
                <Link to="/companies" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('nav.companies')}
                </Link>
              </li>
              <li>
                <Link to="/blog" className="text-muted-foreground hover:text-foreground transition-colors">
                  TrueJobs Career Insights
                </Link>
              </li>
              <li>
                <Link to="/tools/resume-builder" className="text-muted-foreground hover:text-foreground transition-colors">
                  AI Resume Builder
                </Link>
              </li>
              <li>
                <Link to="/tools/resume-checker" className="text-muted-foreground hover:text-foreground transition-colors">
                  Resume Checker
                </Link>
              </li>
            </ul>
          </div>

          {/* Company, Employers & Legal */}
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-4">{t('footer.forEmployers')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/employer/post-job" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('employer.postJob')}
                  </Link>
                </li>
                <li>
                  <Link to="/employer/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('footer.employerDashboard')}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">{t('footer.company')}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/aboutus" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('footer.about')}
                  </Link>
                </li>
                <li>
                  <Link to="/contactus" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('footer.contactUs')}
                  </Link>
                </li>
                <li>
                  <Link to="/privacypolicy" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('footer.privacy')}
                  </Link>
                </li>
                <li>
                  <Link to="/termsofuse" className="text-muted-foreground hover:text-foreground transition-colors">
                    {t('footer.termsOfUse')}
                  </Link>
                </li>
                <li>
                   <Link to="/disclaimer" className="text-muted-foreground hover:text-foreground transition-colors">
                     Disclaimer
                   </Link>
                 </li>
                 <li>
                   <Link to="/editorial-policy" className="text-muted-foreground hover:text-foreground transition-colors">
                     Editorial Policy
                   </Link>
                 </li>
               </ul>
            </div>
          </div>
        </div>

        {/* MSME Credibility */}
        <div className="border-t mt-8 pt-6">
          <MSMECredibility />
        </div>

        {/* Security & Trust Badges */}
        <div className="border-t mt-6 pt-6">
          <div className="flex flex-wrap justify-center items-center gap-6 mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-primary" />
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 text-primary" />
              <span>256-bit Encryption</span>
            </div>
          </div>
        </div>

        <div className="border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground text-center md:text-left">
            <p>© 2024–{new Date().getFullYear()} TrueJobs India. {t('footer.rights')}.</p>
            <p className="text-xs mt-1">CIN: Pending | Operated by TrueJobs India</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <Link to="/aboutus" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/contactus" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/privacypolicy" className="hover:text-foreground transition-colors">{t('footer.privacy')}</Link>
            <Link to="/termsofuse" className="hover:text-foreground transition-colors">{t('footer.terms')}</Link>
            <Link to="/disclaimer" className="hover:text-foreground transition-colors">Disclaimer</Link>
            <CookieSettingsButton />
          </div>
        </div>
      </div>
    </footer>
  );
}
