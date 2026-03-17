import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorModalProvider } from "@/components/ui/error-modal-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import { Suspense, lazy } from "react";

// Critical path – eagerly loaded
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// SEO resolver – lazy-loaded to avoid bundling ~5000 lines of config data for all users
const SEOLandingResolver = lazy(() => import("./pages/seo/SEOLandingResolver"));
const BoardResultStatePage = lazy(() => import("./pages/board-results/BoardResultStatePage"));
const BoardResultBoardPage = lazy(() => import("./pages/board-results/BoardResultBoardPage"));

// Lazy-loaded routes (code-split)
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const PhoneSignup = lazy(() => import("./pages/auth/PhoneSignup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));

const Jobs = lazy(() => import("./pages/jobs/Jobs"));
const JobDetail = lazy(() => import("./pages/jobs/JobDetail"));
const InsuranceAdvisorUP = lazy(() => import("./pages/jobs/InsuranceAdvisorUP"));
const InsuranceAdvisorCity = lazy(() => import("./pages/jobs/InsuranceAdvisorCity"));
const InsuranceAdvisorState = lazy(() => import("./pages/jobs/InsuranceAdvisorState"));
const NearMeJobPage = lazy(() => import("./pages/jobs/NearMeJobPage"));
const PrivateJobs = lazy(() => import("./pages/jobs/PrivateJobs"));
const SarkariJobs = lazy(() => import("./pages/jobs/SarkariJobs"));
const GovtExamDetail = lazy(() => import("./pages/jobs/GovtExamDetail"));
const LatestGovtJobs = lazy(() => import("./pages/jobs/LatestGovtJobs"));
const EmploymentNewsJobs = lazy(() => import("./pages/jobs/EmploymentNewsJobs"));
const EmploymentNewsJobDetail = lazy(() => import("./pages/jobs/EmploymentNewsJobDetail"));

const Companies = lazy(() => import("./pages/companies/Companies"));
const CompanyDetail = lazy(() => import("./pages/companies/CompanyDetail"));
const Profile = lazy(() => import("./pages/profile/Profile"));
const JobSeekerDashboard = lazy(() => import("./pages/dashboard/JobSeekerDashboard"));
const EmployerDashboard = lazy(() => import("./pages/employer/EmployerDashboard"));
const CompanyProfile = lazy(() => import("./pages/employer/CompanyProfile"));
const PostJob = lazy(() => import("./pages/employer/PostJob"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const Offline = lazy(() => import("./pages/Offline"));

// Legal & Static Pages
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("./pages/legal/TermsOfUse"));
const About = lazy(() => import("./pages/legal/About"));
const Contact = lazy(() => import("./pages/legal/Contact"));
const Disclaimer = lazy(() => import("./pages/legal/Disclaimer"));
const EditorialPolicy = lazy(() => import("./pages/legal/EditorialPolicy"));

// Blog
const Blog = lazy(() => import("./pages/blog/Blog"));
const BlogCategory = lazy(() => import("./pages/blog/BlogCategory"));
const BlogPost = lazy(() => import("./pages/blog/BlogPost"));

// Resources
const SamplePapers = lazy(() => import("./pages/resources/SamplePapers"));
const Books = lazy(() => import("./pages/resources/Books"));
const PreviousYearPapers = lazy(() => import("./pages/resources/PreviousYearPapers"));
const ResourceHub = lazy(() => import("./pages/resources/ResourceHub"));
const ResourceDetail = lazy(() => import("./pages/resources/ResourceDetail"));
const ResourceDownload = lazy(() => import("./pages/resources/ResourceDownload"));

// Tools (heavy – jspdf)
const Tools = lazy(() => import("./pages/tools/Tools"));
const ResumeChecker = lazy(() => import("./pages/tools/ResumeChecker"));
const ResumeBuilder = lazy(() => import("./pages/tools/ResumeBuilder"));
const AgeCalculator = lazy(() => import("./pages/tools/AgeCalculator"));
const PercentageCalculator = lazy(() => import("./pages/tools/PercentageCalculator"));
const SalaryCalculator = lazy(() => import("./pages/tools/SalaryCalculator"));
const PhotoResizer = lazy(() => import("./pages/tools/PhotoResizer"));
const ImageResizer = lazy(() => import("./pages/tools/ImageResizer"));
const PdfTools = lazy(() => import("./pages/tools/PdfTools"));
const TypingTest = lazy(() => import("./pages/tools/TypingTest"));
const EligibilityChecker = lazy(() => import("./pages/tools/EligibilityChecker"));
const FeeCalculator = lazy(() => import("./pages/tools/FeeCalculator"));
const ExamCalendar = lazy(() => import("./pages/tools/ExamCalendar"));
const OutreachAssets = lazy(() => import("./pages/tools/OutreachAssets"));

// Campaign
const EnrolNow = lazy(() => import("./pages/EnrolNow"));
const ThankYou = lazy(() => import("./pages/ThankYou"));


// Minimal loading fallback (prevents CLS)
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

// Initialize React Query client with stable settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetch when switching tabs
      refetchOnReconnect: false, // Prevent refetch on reconnect
      retry: 1, // Only retry once on failure
      staleTime: 5 * 60 * 1000, // Data stays fresh for 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ErrorModalProvider />
          {import.meta.env.PROD ? <PWAUpdatePrompt /> : null}
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/phone-signup" element={<PhoneSignup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                
                <Route path="/jobs" element={<Jobs />} />
                <Route path="/jobs/:id" element={<JobDetail />} />
                <Route path="/insurance-advisor-jobs-uttar-pradesh" element={<InsuranceAdvisorUP />} />
                <Route path="/insurance-advisor-jobs-west-bengal" element={<InsuranceAdvisorState />} />
                <Route path="/insurance-advisor-jobs-madhya-pradesh" element={<InsuranceAdvisorState />} />
                <Route path="/insurance-advisor-jobs-bihar" element={<InsuranceAdvisorState />} />
                <Route path="/insurance-advisor-jobs-:citySlug" element={<InsuranceAdvisorCity />} />
                <Route path="/private-jobs" element={<Suspense fallback={<PageLoader />}><PrivateJobs /></Suspense>} />
                <Route path="/sarkari-jobs" element={<SarkariJobs />} />
                <Route path="/sarkari-jobs/:slug" element={<GovtExamDetail />} />
                <Route path="/latest-govt-jobs" element={<LatestGovtJobs />} />
                <Route path="/jobs/employment-news" element={<EmploymentNewsJobs />} />
                <Route path="/jobs/employment-news/:slug" element={<EmploymentNewsJobDetail />} />
                <Route path="/results/:state/:board" element={<BoardResultBoardPage />} />
                <Route path="/results/:state" element={<BoardResultStatePage />} />
                <Route path="/:slug" element={<SEOLandingResolver />} />
                {/* Resources */}
                <Route path="/sample-papers" element={<SamplePapers />} />
                <Route path="/sample-papers/hub/:hubSlug" element={<ResourceHub />} />
                <Route path="/sample-papers/:slug/download" element={<ResourceDownload />} />
                <Route path="/sample-papers/:slug" element={<ResourceDetail />} />
                <Route path="/books" element={<Books />} />
                <Route path="/books/hub/:hubSlug" element={<ResourceHub />} />
                <Route path="/books/:slug/download" element={<ResourceDownload />} />
                <Route path="/books/:slug" element={<ResourceDetail />} />
                <Route path="/previous-year-papers" element={<PreviousYearPapers />} />
                <Route path="/previous-year-papers/hub/:hubSlug" element={<ResourceHub />} />
                <Route path="/previous-year-papers/:slug/download" element={<ResourceDownload />} />
                <Route path="/previous-year-papers/:slug" element={<ResourceDetail />} />

                <Route path="/companies" element={<Companies />} />
                <Route path="/companies/:slug" element={<CompanyDetail />} />
                <Route path="/offline" element={<Offline />} />
                {/* Legal & Static Pages */}
                <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                <Route path="/termsofuse" element={<TermsOfUse />} />
                <Route path="/aboutus" element={<About />} />
                <Route path="/contactus" element={<Contact />} />
                <Route path="/disclaimer" element={<Disclaimer />} />
                <Route path="/editorial-policy" element={<EditorialPolicy />} />
                {/* Legacy redirects */}
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-use" element={<TermsOfUse />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                
                {/* Blog */}
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/category/:slug" element={<BlogCategory />} />
                <Route path="/blog/:slug" element={<BlogPost />} />

                {/* Tools */}
                <Route path="/tools" element={<Tools />} />
                <Route path="/tools/resume-checker" element={<ResumeChecker />} />
                <Route path="/tools/resume-builder" element={<ResumeBuilder />} />
                <Route path="/govt-job-age-calculator" element={<AgeCalculator />} />
                <Route path="/percentage-calculator" element={<PercentageCalculator />} />
                <Route path="/govt-salary-calculator" element={<SalaryCalculator />} />
                <Route path="/photo-resizer" element={<PhotoResizer />} />
                <Route path="/image-resizer" element={<ImageResizer />} />
                <Route path="/pdf-tools" element={<PdfTools />} />
                <Route path="/typing-test-for-government-exams" element={<TypingTest />} />
                <Route path="/govt-exam-eligibility-checker" element={<EligibilityChecker />} />
                <Route path="/govt-exam-fee-calculator" element={<FeeCalculator />} />
                <Route path="/govt-exam-calendar" element={<ExamCalendar />} />
                <Route path="/free-guides" element={<OutreachAssets />} />


                {/* Campaign */}
                <Route path="/enrol-now" element={<EnrolNow />} />
                <Route path="/thankyou" element={<ThankYou />} />

                {/* Protected - Any Authenticated User */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute allowedRoles={['job_seeker']}>
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                {/* Protected - Job Seeker */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['job_seeker']}>
                      <JobSeekerDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Protected - Employer */}
                <Route
                  path="/employer/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['employer']}>
                      <EmployerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employer/company"
                  element={
                    <ProtectedRoute allowedRoles={['employer']}>
                      <CompanyProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/employer/post-job"
                  element={
                    <ProtectedRoute allowedRoles={['employer']}>
                      <PostJob />
                    </ProtectedRoute>
                  }
                />

                {/* Protected - Admin */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;