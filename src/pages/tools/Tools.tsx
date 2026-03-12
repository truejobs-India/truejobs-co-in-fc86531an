import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Target,
  FileText,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Upload,
  Download,
  Shield,
  Zap,
  CalendarDays,
  Percent,
  IndianRupee,
  ImageIcon,
  Camera,
  Merge,
  Keyboard,
  UserCheck,
  Wallet,
  Calendar,
} from 'lucide-react';

interface ToolCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  features: string[];
}

const resumeTools: ToolCard[] = [
  {
    title: 'AI Resume Checker',
    description: 'Upload your existing resume and get AI-powered improvement suggestions. Select the changes you want and download an optimized, ATS-friendly PDF.',
    icon: Target,
    href: '/tools/resume-checker',
    badge: 'Popular',
    badgeVariant: 'default',
    features: [
      'Upload PDF, DOC, or DOCX resumes',
      'AI-powered analysis with Claude 3 Sonnet',
      'Selectable improvement suggestions',
      'ATS compatibility scoring',
      'Download improved resume as PDF',
    ],
  },
  {
    title: 'AI Resume Builder',
    description: 'Create a professional resume from scratch. Fill in your details and let AI generate polished content with strong action verbs and proper formatting.',
    icon: FileText,
    href: '/tools/resume-builder',
    badge: 'New',
    badgeVariant: 'secondary',
    features: [
      'Structured form for all resume sections',
      'AI-generated professional summary',
      'Experience bullets with action verbs',
      'Live preview while editing',
      'Export to ATS-friendly PDF',
    ],
  },
];

const govtExamTools: ToolCard[] = [
  {
    title: 'Age Calculator',
    description: 'Calculate your exact age in years, months, and days for government exam eligibility. Includes category-wise age relaxation table.',
    icon: CalendarDays,
    href: '/govt-job-age-calculator',
    badge: 'Free',
    badgeVariant: 'outline',
    features: [
      'Exact age calculation (years, months, days)',
      'Custom reference/cut-off date',
      'Quick-set buttons for common dates',
      'Category-wise relaxation display',
      'Eligibility summary per category',
    ],
  },
  {
    title: 'Percentage & CGPA Calculator',
    description: 'Calculate percentage from marks or convert CGPA to percentage. Supports 10-point, 7-point, and 4-point scales used by Indian universities.',
    icon: Percent,
    href: '/percentage-calculator',
    badge: 'Free',
    badgeVariant: 'outline',
    features: [
      'Marks to percentage conversion',
      'CGPA to percentage (10/7/4-point)',
      'Instant calculation on input',
      'Common exam requirement info',
      'University conversion formulas',
    ],
  },
  {
    title: '7th CPC Salary Calculator',
    description: 'Calculate the complete government salary breakdown under the 7th Pay Commission including DA, HRA, Transport Allowance, NPS, and estimated tax.',
    icon: IndianRupee,
    href: '/govt-salary-calculator',
    badge: 'Free',
    badgeVariant: 'outline',
    features: [
      'All 18 pay levels with basic pay steps',
      'DA, HRA, and Transport Allowance',
      'NPS deduction calculation',
      'Estimated income tax (New Regime)',
      'Net take-home salary display',
    ],
  },
  {
    title: 'Eligibility Checker',
    description: 'Check which government exams you are eligible for based on your age, qualification, and reservation category.',
    icon: UserCheck,
    href: '/govt-exam-eligibility-checker',
    badge: 'New',
    badgeVariant: 'secondary',
    features: [
      'Age + qualification based matching',
      'Category-wise age relaxation',
      'All active exams checked',
      'Direct links to exam details',
      'Real-time database queries',
    ],
  },
  {
    title: 'Application Fee Calculator',
    description: 'Check category-wise application fees for any government exam. See fees for General, OBC, SC/ST, and female candidates.',
    icon: Wallet,
    href: '/govt-exam-fee-calculator',
    badge: 'New',
    badgeVariant: 'secondary',
    features: [
      'Category-wise fee breakdown',
      'General, OBC, SC/ST, Female fees',
      'Fee exemption indicator',
      'Direct apply link',
      'All active exams covered',
    ],
  },
  {
    title: 'Exam Calendar',
    description: 'Browse all upcoming government exams month-by-month. Track application deadlines, exam dates, admit cards, and results.',
    icon: Calendar,
    href: '/govt-exam-calendar',
    badge: 'New',
    badgeVariant: 'secondary',
    features: [
      'Monthly calendar view',
      'Application start & end dates',
      'Exam date tracking',
      'Vacancy count display',
      'Year-wise filtering',
    ],
  },
];

const documentTools: ToolCard[] = [
  {
    title: 'Photo Resizer (Exams)',
    description: 'Resize your passport photo and signature to exact dimensions required by SSC, IBPS, UPSC, and Railway application forms.',
    icon: Camera,
    href: '/photo-resizer',
    badge: 'Free',
    badgeVariant: 'outline',
    features: [
      'SSC, IBPS, UPSC, Railway presets',
      'Photo and signature sizing',
      'Auto crop to correct aspect ratio',
      'Compression to meet file size limits',
      '100% browser-based processing',
    ],
  },
  {
    title: 'Image Resizer',
    description: 'Resize any image to custom dimensions or social media presets. Convert between JPG, PNG, and WebP formats.',
    icon: ImageIcon,
    href: '/image-resizer',
    badge: 'Free',
    badgeVariant: 'outline',
    features: [
      'Custom width and height',
      'Social media and print presets',
      'Format conversion (JPG, PNG, WebP)',
      'Quality slider for compression',
      'Aspect ratio lock/unlock',
    ],
  },
  {
    title: 'PDF Tools',
    description: 'Merge, compress, and convert PDFs entirely in your browser. Create PDFs from images with zero server uploads.',
    icon: Merge,
    href: '/pdf-tools',
    badge: 'Free',
    badgeVariant: 'outline',
    features: [
      'Merge multiple PDFs into one',
      'Compress PDF file size',
      'Convert images to PDF',
      'Max 10 files, 20MB each',
      '100% browser-based processing',
    ],
  },
];

const preparationTools: ToolCard[] = [
  {
    title: 'Typing Test (Govt Exams)',
    description: 'Practice typing speed for SSC CHSL, SSC CGL, IBPS Clerk, and Railway exams. Compare your WPM against official requirements.',
    icon: Keyboard,
    href: '/typing-test-for-government-exams',
    badge: 'Free',
    badgeVariant: 'outline',
    features: [
      'SSC, IBPS, Railway exam presets',
      'English and Hindi language support',
      'Real-time WPM and accuracy tracking',
      'Character-level error highlighting',
      'Pass/fail comparison with requirements',
    ],
  },
];

function ToolCardGrid({ tools }: { tools: ToolCard[] }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tools.map((tool) => (
        <Card key={tool.href} className="relative overflow-hidden group hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between mb-2">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <tool.icon className="h-6 w-6 text-primary" />
              </div>
              <Badge variant={tool.badgeVariant}>{tool.badge}</Badge>
            </div>
            <CardTitle className="text-xl">{tool.title}</CardTitle>
            <CardDescription className="text-base">{tool.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-6">
              {tool.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="w-full group-hover:bg-primary/90">
              <Link to={tool.href}>
                Get Started
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Tools() {
  return (
    <Layout noAds>
      <SEO
        title="Free Government Job & Resume Tools | TrueJobs"
        description="Free AI-powered resume tools, government salary calculator, age calculator, and percentage converter. Prepare for SSC, UPSC, IBPS, Railway exams with our utility tools."
      />

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
            <Badge variant="outline" className="text-sm">100% Free Tools</Badge>
          </div>
          <h1 className="text-4xl font-bold mb-4">Government Job Preparation Tools</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            A comprehensive suite of free tools to help you prepare for government exams and land your dream job.
            From AI-powered resume building to salary calculators and age eligibility checkers — everything
            you need for SSC, UPSC, IBPS, Railway, and state-level exam preparation is right here.
          </p>
        </div>

        {/* Features Banner */}
        <div className="bg-primary/5 border rounded-2xl p-6 mb-12">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Privacy First</h3>
              <p className="text-sm text-muted-foreground">Your data is never shared or used for training</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">Instant Results</h3>
              <p className="text-sm text-muted-foreground">All calculators run instantly in your browser</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold">100% Accurate</h3>
              <p className="text-sm text-muted-foreground">Based on official 7th CPC and government data</p>
            </div>
          </div>
        </div>

        {/* Resume Tools Section */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">Resume Tools</h2>
          <p className="text-muted-foreground mb-6">
            Build and optimize your resume with AI-powered tools that ensure ATS compatibility.
          </p>
          <ToolCardGrid tools={resumeTools} />
        </section>

        {/* Government Exam Tools Section */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">Government Exam Tools</h2>
          <p className="text-muted-foreground mb-6">
            Essential calculators for government job aspirants. Check your age eligibility,
            convert CGPA to percentage, and calculate expected salary under the 7th Pay Commission.
          </p>
          <ToolCardGrid tools={govtExamTools} />
        </section>

        {/* Document Tools Section */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">Document Tools</h2>
          <p className="text-muted-foreground mb-6">
            Resize photos and images for exam applications, social media, and print.
            All processing happens in your browser — no files are uploaded.
          </p>
          <ToolCardGrid tools={documentTools} />
        </section>

        {/* Preparation Tools Section */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">Preparation Tools</h2>
          <p className="text-muted-foreground mb-6">
            Practice and prepare for government exam skill tests with these interactive tools.
          </p>
          <ToolCardGrid tools={preparationTools} />
        </section>

        {/* How It Works */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: 1, title: 'Choose a Tool', description: 'Select the tool you need from above', icon: Sparkles },
              { step: 2, title: 'Enter Details', description: 'Fill in your information or upload a file', icon: Upload },
              { step: 3, title: 'Get Results', description: 'View instant results and analysis', icon: CheckCircle2 },
              { step: 4, title: 'Download / Act', description: 'Download your results or take action', icon: Download },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="relative inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground text-xl font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-muted/50 rounded-lg text-center text-sm text-muted-foreground">
          <strong>Disclaimer:</strong> All tools provide results based on official data and formulas.
          Salary calculations use the 7th CPC pay matrix. AI-generated resume suggestions are advisory.
          Always verify eligibility criteria from the official exam notification.
        </div>
      </div>
    </Layout>
  );
}
