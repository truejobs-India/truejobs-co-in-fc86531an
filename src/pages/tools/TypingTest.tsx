import { useState, useEffect, useCallback, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Play, RotateCcw, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SITE_URL = 'https://truejobs.co.in';

const EXAM_PRESETS: Record<string, { wpm: number; label: string }> = {
  'ssc-chsl': { wpm: 35, label: 'SSC CHSL (35 WPM)' },
  'ssc-cgl': { wpm: 30, label: 'SSC CGL (30 WPM)' },
  'ibps-clerk': { wpm: 40, label: 'IBPS Clerk (40 WPM)' },
  'rrb-ntpc': { wpm: 30, label: 'Railway NTPC (30 WPM)' },
  'custom': { wpm: 0, label: 'Free Practice' },
};

const DURATION_OPTIONS = [
  { value: '60', label: '1 Minute' },
  { value: '120', label: '2 Minutes' },
  { value: '300', label: '5 Minutes' },
  { value: '600', label: '10 Minutes' },
];

const ENGLISH_PARAGRAPHS = [
  "The government of India conducts several competitive examinations every year to recruit candidates for various posts in central and state departments. These exams test the knowledge and skills of aspirants in areas such as reasoning, quantitative aptitude, general awareness, and English language. Lakhs of candidates appear for these examinations annually, making them highly competitive. Proper preparation and time management are essential for success in these exams.",
  "India is a diverse country with a rich cultural heritage that spans thousands of years. The country is home to multiple languages, religions, and traditions that coexist harmoniously. From the snow-capped mountains of the Himalayas to the tropical beaches of Kerala, the geographical diversity of India is equally remarkable. This diversity is reflected in the food, festivals, and customs of its people.",
  "Technology has transformed the way we work and communicate in the modern world. The advent of the internet and smartphones has made information accessible to everyone at their fingertips. Digital platforms have created new opportunities for employment and entrepreneurship. Government initiatives like Digital India aim to bridge the digital divide and empower citizens through technology.",
  "Education plays a vital role in the development of any nation. It empowers individuals with knowledge and skills necessary to contribute meaningfully to society. The right to education is a fundamental right in India, ensuring that every child has access to quality education. With the implementation of the new education policy, the focus is shifting towards holistic and multidisciplinary learning.",
  "Environmental conservation is one of the most pressing challenges of our time. Climate change, deforestation, and pollution are threatening the ecological balance of our planet. Governments and organizations worldwide are taking measures to reduce carbon emissions and promote sustainable development. Individual actions like reducing waste, conserving water, and planting trees can also make a significant difference.",
];

const HINDI_PARAGRAPHS = [
  "भारत सरकार हर वर्ष केंद्रीय और राज्य विभागों में विभिन्न पदों पर भर्ती के लिए कई प्रतियोगी परीक्षाएं आयोजित करती है। ये परीक्षाएं तर्कशक्ति, गणित, सामान्य ज्ञान और भाषा जैसे क्षेत्रों में उम्मीदवारों के ज्ञान और कौशल का परीक्षण करती हैं। इन परीक्षाओं में हर साल लाखों उम्मीदवार शामिल होते हैं जिससे ये अत्यंत प्रतिस्पर्धी बन जाती हैं।",
  "भारत एक विविधताओं से भरा देश है जिसकी सांस्कृतिक विरासत हजारों वर्ष पुरानी है। यहां अनेक भाषाएं, धर्म और परंपराएं एक साथ सद्भाव में रहती हैं। हिमालय की बर्फीली चोटियों से लेकर केरल के उष्णकटिबंधीय समुद्र तटों तक भारत की भौगोलिक विविधता भी उल्लेखनीय है।",
];

function getRandomParagraph(lang: string): string {
  const pool = lang === 'hindi' ? HINDI_PARAGRAPHS : ENGLISH_PARAGRAPHS;
  return pool[Math.floor(Math.random() * pool.length)];
}

const FAQ_ITEMS = [
  {
    question: 'What is the typing speed required for SSC CHSL?',
    answer: 'SSC CHSL requires a typing speed of 35 words per minute (WPM) in English or 30 WPM in Hindi on a computer. This is a qualifying test, not for ranking.',
  },
  {
    question: 'How is typing speed calculated?',
    answer: 'Typing speed is calculated as: (Total characters typed correctly ÷ 5) ÷ Time in minutes. One word is standardized as 5 characters including spaces.',
  },
  {
    question: 'What is the difference between gross and net WPM?',
    answer: 'Gross WPM counts all characters typed, while net WPM subtracts errors. Government exams typically measure net WPM — only correctly typed characters count.',
  },
  {
    question: 'Can I practice Hindi typing here?',
    answer: 'Yes, you can select Hindi as the language. However, you will need a Hindi keyboard layout (like Inscript or Kruti Dev) installed on your system.',
  },
];

type TestState = 'idle' | 'running' | 'finished';

export default function TypingTest() {
  const [exam, setExam] = useState('ssc-chsl');
  const [duration, setDuration] = useState('60');
  const [language, setLanguage] = useState('english');
  const [testState, setTestState] = useState<TestState>('idle');
  const [paragraph, setParagraph] = useState('');
  const [typed, setTyped] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const totalSeconds = Number(duration);
  const examPreset = EXAM_PRESETS[exam];

  const startTest = useCallback(() => {
    const text = getRandomParagraph(language);
    setParagraph(text);
    setTyped('');
    setTimeLeft(totalSeconds);
    setStartTime(Date.now());
    setTestState('running');
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [language, totalSeconds]);

  const endTest = useCallback(() => {
    setTestState('finished');
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resetTest = () => {
    setTestState('idle');
    setTyped('');
    setParagraph('');
    setTimeLeft(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Timer
  useEffect(() => {
    if (testState !== 'running') return;
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = totalSeconds - elapsed;
      if (remaining <= 0) {
        setTimeLeft(0);
        endTest();
      } else {
        setTimeLeft(remaining);
      }
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [testState, startTime, totalSeconds, endTest]);

  // Calculate stats
  const stats = (() => {
    if (!paragraph || !typed) return null;
    const elapsedMin = testState === 'finished'
      ? totalSeconds / 60
      : Math.max((Date.now() - startTime) / 60000, 0.01);

    let correct = 0;
    let errors = 0;
    for (let i = 0; i < typed.length; i++) {
      if (i < paragraph.length && typed[i] === paragraph[i]) correct++;
      else errors++;
    }

    const grossWpm = Math.round((typed.length / 5) / elapsedMin);
    const netWpm = Math.max(0, Math.round((correct / 5) / elapsedMin));
    const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 0;

    return { grossWpm, netWpm, accuracy, errors, correct, totalTyped: typed.length };
  })();

  const passed = stats && examPreset.wpm > 0 ? stats.netWpm >= examPreset.wpm : null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // Character-level highlighting
  const renderParagraph = () => {
    return paragraph.split('').map((char, i) => {
      let cls = 'text-muted-foreground';
      if (i < typed.length) {
        cls = typed[i] === char ? 'text-green-600 dark:text-green-400' : 'text-destructive bg-destructive/10';
      } else if (i === typed.length) {
        cls = 'text-foreground bg-primary/20';
      }
      return <span key={i} className={cls}>{char}</span>;
    });
  };

  const schemaWebApp = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Typing Test for Government Exams',
    url: `${SITE_URL}/typing-test-for-government-exams`,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'All',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  };

  const schemaFAQ = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const schemaBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${SITE_URL}/tools` },
      { '@type': 'ListItem', position: 3, name: 'Typing Test', item: `${SITE_URL}/typing-test-for-government-exams` },
    ],
  };

  return (
    <Layout>
      <SEO
        title="Typing Test for Govt Exams | SSC IBPS Railway"
        description="Practice typing speed for SSC CHSL, SSC CGL, IBPS Clerk, Railway exams. Check your WPM and accuracy against official requirements. Free online typing test."
        canonical="/typing-test-for-government-exams"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaWebApp) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaFAQ) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaBreadcrumb) }} />

      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <nav className="text-sm text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/" className="hover:text-primary">Home</Link></li>
            <li>/</li>
            <li><Link to="/tools" className="hover:text-primary">Tools</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">Typing Test</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">Typing Test for Government Exams</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">
          Practice your typing speed and accuracy for government exam requirements. SSC CHSL requires
          35 WPM in English, IBPS Clerk requires 40 WPM, and Railway NTPC requires 30 WPM. Use this
          free typing test to check if you meet the required speed and track your improvement over time.
        </p>

        {/* Settings */}
        {testState === 'idle' && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Exam Preset</label>
                  <Select value={exam} onValueChange={setExam}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EXAM_PRESETS).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Duration</label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Language</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="hindi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={startTest} className="w-full" size="lg">
                <Play className="h-5 w-5 mr-2" /> Start Typing Test
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Test Area */}
        {(testState === 'running' || testState === 'finished') && (
          <div className="space-y-4 mb-8">
            {/* Timer Bar */}
            <div className="flex items-center justify-between bg-muted/50 rounded-xl px-6 py-3">
              <div className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" />
                <span className={cn('text-2xl font-mono font-bold', timeLeft <= 10 && testState === 'running' && 'text-destructive')}>
                  {formatTime(timeLeft)}
                </span>
              </div>
              {stats && (
                <div className="flex gap-4 text-sm">
                  <span>WPM: <strong className="text-primary">{stats.netWpm}</strong></span>
                  <span>Accuracy: <strong>{stats.accuracy}%</strong></span>
                  <span>Errors: <strong className="text-destructive">{stats.errors}</strong></span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={resetTest}>
                <RotateCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            </div>

            {/* Paragraph Display */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-base leading-relaxed font-mono mb-4 p-4 bg-muted/30 rounded-lg select-none min-h-[100px]">
                  {renderParagraph()}
                </div>
                <textarea
                  ref={textareaRef}
                  className="w-full h-32 p-4 border rounded-lg bg-background text-base font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={testState === 'finished' ? 'Test completed!' : 'Start typing here...'}
                  value={typed}
                  onChange={(e) => {
                    if (testState === 'running') setTyped(e.target.value);
                  }}
                  disabled={testState === 'finished'}
                  spellCheck={false}
                  autoComplete="off"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results */}
        {testState === 'finished' && stats && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-primary/5 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{stats.netWpm}</p>
                  <p className="text-sm text-muted-foreground">Net WPM</p>
                </div>
                <div className="bg-primary/5 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold">{stats.grossWpm}</p>
                  <p className="text-sm text-muted-foreground">Gross WPM</p>
                </div>
                <div className="bg-primary/5 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold">{stats.accuracy}%</p>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                </div>
                <div className="bg-primary/5 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-destructive">{stats.errors}</p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>

              {/* Exam Comparison */}
              {examPreset.wpm > 0 && (
                <div className={cn(
                  'rounded-xl p-5 text-center border-2',
                  passed ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-destructive bg-destructive/5'
                )}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {passed ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="h-6 w-6 text-destructive" />
                    )}
                    <span className="text-lg font-bold">
                      {passed ? 'Qualified!' : 'Keep Practicing'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your Speed: <strong>{stats.netWpm} WPM</strong> |{' '}
                    {examPreset.label} Requirement: <strong>{examPreset.wpm} WPM</strong>
                  </p>
                </div>
              )}

              <div className="mt-6 text-center">
                <Button onClick={resetTest} size="lg">
                  <RotateCcw className="h-4 w-4 mr-2" /> Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Exam Requirements Table */}
        <Card className="mb-8">
          <CardHeader><CardTitle className="text-lg">Typing Speed Requirements by Exam</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2.5 px-3 font-semibold">Exam</th>
                    <th className="text-center py-2.5 px-3 font-semibold">English (WPM)</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Hindi (WPM)</th>
                    <th className="text-center py-2.5 px-3 font-semibold">Nature</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { exam: 'SSC CHSL (LDC/DEO)', eng: 35, hin: 30, nature: 'Qualifying' },
                    { exam: 'SSC CGL (Tax Asst)', eng: 30, hin: '-', nature: 'Qualifying' },
                    { exam: 'IBPS Clerk', eng: 40, hin: 35, nature: 'Qualifying' },
                    { exam: 'Railway NTPC', eng: 30, hin: 25, nature: 'Qualifying' },
                    { exam: 'UPSC (Steno)', eng: 80, hin: '-', nature: 'Skill Test' },
                  ].map(r => (
                    <tr key={r.exam} className="border-b">
                      <td className="py-2 px-3 font-medium">{r.exam}</td>
                      <td className="py-2 px-3 text-center">{r.eng}</td>
                      <td className="py-2 px-3 text-center">{r.hin}</td>
                      <td className="py-2 px-3 text-center"><Badge variant="outline">{r.nature}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Internal Links */}
        <section className="mb-8 p-6 bg-muted/50 rounded-xl">
          <h2 className="text-lg font-semibold mb-3">Explore More</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'SSC Jobs', href: '/sarkari-jobs' },
              { label: 'Age Calculator', href: '/govt-job-age-calculator' },
              { label: 'Salary Calculator', href: '/govt-salary-calculator' },
              { label: 'Photo Resizer', href: '/photo-resizer' },
              { label: 'PDF Tools', href: '/pdf-tools' },
              { label: 'AI Resume Checker', href: '/tools/resume-checker' },
            ].map((link) => (
              <Link key={link.label} to={link.href}>
                <Badge variant="outline" className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors">
                  {link.label}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
