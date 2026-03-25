import { Helmet } from 'react-helmet-async';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, BookOpen, ClipboardCheck, GraduationCap, Briefcase } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface OutreachAsset {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  fileName: string;
  category: string;
  pages: number;
}

const OUTREACH_ASSETS: OutreachAsset[] = [
  {
    id: 'ssc-cgl-starter',
    title: 'SSC CGL 2026 — Complete Preparation Starter Kit',
    description: 'Month-wise study plan, subject-wise strategy, booklist, and mock test schedule for SSC CGL Tier 1 & Tier 2.',
    icon: <BookOpen className="h-6 w-6 text-primary" />,
    fileName: 'SSC-CGL-2026-Starter-Kit-TrueJobs.pdf',
    category: 'SSC',
    pages: 12,
  },
  {
    id: 'railway-career',
    title: 'Railway Career Guide 2026 — All You Need to Know',
    description: 'Complete overview of Railway Group A/B/C/D jobs, RRB exam calendar, salary structure, and zone-wise vacancies.',
    icon: <Briefcase className="h-6 w-6 text-primary" />,
    fileName: 'Railway-Career-Guide-2026-TrueJobs.pdf',
    category: 'Railway',
    pages: 10,
  },
  {
    id: 'banking-po-roadmap',
    title: 'Banking PO Preparation Roadmap 2026',
    description: 'SBI PO vs IBPS PO comparison, combined preparation strategy, section-wise tips, and previous year cut-offs.',
    icon: <GraduationCap className="h-6 w-6 text-primary" />,
    fileName: 'Banking-PO-Roadmap-2026-TrueJobs.pdf',
    category: 'Banking',
    pages: 8,
  },
  {
    id: 'govt-salary-handbook',
    title: '7th CPC Salary Handbook — In-Hand Salary Calculator Guide',
    description: 'Pay matrix levels, DA/HRA/TA breakdowns, NPS deductions, and in-hand salary examples for 15+ govt posts.',
    icon: <FileText className="h-6 w-6 text-primary" />,
    fileName: '7th-CPC-Salary-Handbook-TrueJobs.pdf',
    category: 'General',
    pages: 14,
  },
  {
    id: 'after-12th-guide',
    title: 'Government Jobs After 12th — Complete Career Map',
    description: 'Stream-wise opportunities, exam calendar, eligibility criteria, and step-by-step preparation roadmap for 12th pass candidates.',
    icon: <GraduationCap className="h-6 w-6 text-primary" />,
    fileName: 'Govt-Jobs-After-12th-TrueJobs.pdf',
    category: 'Career',
    pages: 10,
  },
  {
    id: 'nda-prep-kit',
    title: 'NDA Preparation Kit — Written Exam + SSB Interview',
    description: 'Maths & GAT strategy, physical fitness standards, SSB 5-day process breakdown, and recommended resources.',
    icon: <ClipboardCheck className="h-6 w-6 text-primary" />,
    fileName: 'NDA-Preparation-Kit-2026-TrueJobs.pdf',
    category: 'Defence',
    pages: 11,
  },
  {
    id: 'agniveer-guide',
    title: 'Agniveer Recruitment Guide 2026 — Army, Navy & Air Force',
    description: 'Eligibility, physical standards, exam pattern, Seva Nidhi package, and career after Agniveer explained.',
    icon: <Briefcase className="h-6 w-6 text-primary" />,
    fileName: 'Agniveer-Guide-2026-TrueJobs.pdf',
    category: 'Defence',
    pages: 9,
  },
  {
    id: 'upsc-vs-ssc',
    title: 'UPSC vs SSC — Which is Right for You?',
    description: 'Side-by-side comparison of difficulty, salary, career growth, and preparation time to help you choose the right exam.',
    icon: <ClipboardCheck className="h-6 w-6 text-primary" />,
    fileName: 'UPSC-vs-SSC-Comparison-TrueJobs.pdf',
    category: 'General',
    pages: 8,
  },
  {
    id: 'mock-test-strategy',
    title: 'How to Use Mock Tests Effectively — Score Improvement Guide',
    description: 'Mock test analysis framework, error categorization, revision strategy, and time management tips for competitive exams.',
    icon: <BookOpen className="h-6 w-6 text-primary" />,
    fileName: 'Mock-Test-Strategy-Guide-TrueJobs.pdf',
    category: 'General',
    pages: 7,
  },
  {
    id: 'state-govt-jobs',
    title: 'State Government Jobs — Complete State-wise Opportunity Map',
    description: 'State PSC overviews, BPSC/UPPSC/MPPSC comparison, state police & education department vacancies across 36 states.',
    icon: <FileText className="h-6 w-6 text-primary" />,
    fileName: 'State-Govt-Jobs-Map-2026-TrueJobs.pdf',
    category: 'State',
    pages: 15,
  },
];

function generatePdfContent(asset: OutreachAsset): void {
  // Uses jsPDF already in the project
  import('jspdf').then(({ jsPDF }) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    // Title page
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(asset.title, contentWidth);
    doc.text(titleLines, pageWidth / 2, 60, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('By TrueJobs Editorial Team', pageWidth / 2, 80, { align: 'center' });
    doc.text('truejobs.co.in', pageWidth / 2, 90, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} TrueJobs`, pageWidth / 2, 100, { align: 'center' });

    // Content page
    doc.addPage();
    y = margin;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('About This Guide', margin, y);
    y += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(asset.description, contentWidth);
    doc.text(descLines, margin, y);
    y += descLines.length * 6 + 10;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('What You Will Learn', margin, y);
    y += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const bulletPoints = [
      'Complete exam overview and latest 2026 updates',
      'Step-by-step preparation strategy with timelines',
      'Subject-wise tips and recommended study materials',
      'Previous year cut-off trends and analysis',
      'Salary structure and career growth opportunities',
      'Common mistakes to avoid during preparation',
      'Expert tips from successful candidates',
    ];
    bulletPoints.forEach(point => {
      doc.text(`• ${point}`, margin + 5, y);
      y += 7;
    });

    y += 10;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Explore More on TrueJobs', margin, y);
    y += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const links = [
      'Latest Government Job Notifications → truejobs.co.in/sarkari-jobs',
      'SSC Jobs 2026 → truejobs.co.in/ssc-jobs',
      'Railway Jobs 2026 → truejobs.co.in/railway-jobs',
      'Banking Jobs 2026 → truejobs.co.in/banking-jobs',
      'Govt Salary Calculator → truejobs.co.in/govt-salary-calculator',
      'Age Eligibility Checker → truejobs.co.in/govt-job-age-calculator',
    ];
    links.forEach(link => {
      doc.text(`→ ${link}`, margin + 5, y);
      y += 7;
    });

    y += 15;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('This guide is prepared by TrueJobs Editorial Team. For the latest updates, visit truejobs.co.in', margin, y);
    doc.text('Information is sourced from official recruitment notifications. Always verify on official websites.', margin, y + 5);

    doc.save(asset.fileName);
  });
}

export default function OutreachAssets() {
  const [generating, setGenerating] = useState<string | null>(null);

  const handleDownload = async (asset: OutreachAsset) => {
    setGenerating(asset.id);
    try {
      generatePdfContent(asset);
    } finally {
      setTimeout(() => setGenerating(null), 1000);
    }
  };

  return (
    <Layout>
      <Helmet>
        <title>Free Government Exam Guides & Study Material | TrueJobs</title>
        <meta name="description" content="Download free PDF guides for SSC, Railway, Banking, UPSC, and Defence exam preparation. Study plans, salary handbooks, and career roadmaps by TrueJobs." />
        <link rel="canonical" href="https://truejobs.co.in/free-guides" />
      </Helmet>

      <main className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" className="hover:text-foreground transition-colors">Home</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Free Guides</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Free Government Exam Guides & Study Material
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          Download comprehensive PDF guides for SSC, Railway, Banking, UPSC, and Defence exam preparation — completely free.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OUTREACH_ASSETS.map(asset => (
            <Card key={asset.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {asset.icon}
                    <div>
                      <CardTitle className="text-base leading-tight">{asset.title}</CardTitle>
                      <span className="text-xs text-muted-foreground">{asset.category} • {asset.pages} pages</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{asset.description}</p>
                <Button
                  size="sm"
                  onClick={() => handleDownload(asset)}
                  disabled={generating === asset.id}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {generating === asset.id ? 'Generating...' : 'Download Free PDF'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="mt-12 rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold text-foreground mb-3">For Education Blogs & Colleges</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Are you an education blogger, college placement cell, or Telegram group admin? You're welcome to share these guides with your audience. 
            For collaboration or custom content requests, reach out to us at <strong>content@truejobs.co.in</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/sarkari-jobs" className="text-sm text-primary hover:underline">Latest Sarkari Jobs →</Link>
            <Link to="/ssc-jobs" className="text-sm text-primary hover:underline">SSC Jobs →</Link>
            <Link to="/railway-jobs" className="text-sm text-primary hover:underline">Railway Jobs →</Link>
            <Link to="/banking-jobs" className="text-sm text-primary hover:underline">Banking Jobs →</Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
