import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, Clock, Send, MessageSquare, Shield, HelpCircle, Building2, FileText } from 'lucide-react';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  email: z.string().trim().email('Please enter a valid email address').max(255, 'Email must be less than 255 characters'),
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(200, 'Subject must be less than 200 characters'),
  message: z.string().trim().min(20, 'Message must be at least 20 characters').max(2000, 'Message must be less than 2000 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<Partial<ContactFormData>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof ContactFormData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      contactSchema.parse(formData);
      
      // Simulate form submission
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: 'Message Sent!',
        description: 'Thank you for contacting us. We will get back to you within 24-48 hours.',
      });
      
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<ContactFormData> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof ContactFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast({
          title: 'Error',
          description: 'Something went wrong. Please try again later.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const contactDepartments = [
    {
      icon: Mail,
      title: 'General Inquiries',
      email: 'info@truejobs.co.in',
      description: 'For general questions about TrueJobs, partnerships, media inquiries, and business development.',
    },
    {
      icon: HelpCircle,
      title: 'Technical Support',
      email: 'support@truejobs.co.in',
      description: 'For account issues, login problems, technical bugs, feature requests, and platform assistance.',
    },
    {
      icon: Building2,
      title: 'Employer Services',
      email: 'payments@truejobs.co.in',
      description: 'For job posting plans, billing queries, invoice requests, payment issues, and employer account management.',
    },
    {
      icon: Shield,
      title: 'Nodal Officer / Grievance Redressal',
      email: 'nodal@truejobs.co.in',
      description: 'For escalations, complaints, content removal requests, and grievance redressal as per Indian IT Act requirements.',
    },
  ];

  const faqs = [
    {
      q: 'Is TrueJobs free for job seekers?',
      a: 'Yes. Registration, job search, applications, and all candidate tools are completely free. We never charge job seekers any fees.',
    },
    {
      q: 'How do I report a fraudulent job listing?',
      a: 'Email support@truejobs.co.in with the job title and URL. We investigate all reports within 24 hours and remove confirmed fraudulent listings immediately.',
    },
    {
      q: 'How can employers post jobs on TrueJobs?',
      a: 'Employers can register for a free account, create a company profile, and post jobs using our tiered plans. Visit the Employer section for details.',
    },
    {
      q: 'What is your response time?',
      a: 'We aim to respond to all inquiries within 24-48 business hours. Urgent matters (fraud reports, security issues) are prioritized.',
    },
    {
      q: 'How do I delete my account and data?',
      a: 'Email support@truejobs.co.in from your registered email with the subject "Account Deletion Request". We process all deletion requests within 7 business days.',
    },
  ];

  return (
    <Layout>
      <SEO 
        title="Contact Us - TrueJobs | Get Help & Support" 
        description="Contact TrueJobs for job search help, employer services, technical support, or grievance redressal. Reach us via email or our contact form. Response within 24-48 hours."
        url="/contactus"
      />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-12 md:py-16">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-lg text-muted-foreground">
            Have questions, feedback, or need assistance? Our team is here to help. 
            Whether you're a job seeker or an employer, we'd love to hear from you.
          </p>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 md:py-16">
        {/* Contact Departments */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Reach the Right Team</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {contactDepartments.map((dept) => (
              <Card key={dept.title} className="h-full">
                <CardContent className="pt-6 flex flex-col h-full">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <dept.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{dept.title}</h3>
                  <a href={`mailto:${dept.email}`} className="text-primary hover:underline text-sm mb-2">
                    {dept.email}
                  </a>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{dept.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Business Hours + Form */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Business Hours</h3>
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Monday – Friday</span>
                    <span className="font-medium text-foreground">9:00 AM – 6:00 PM IST</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saturday</span>
                    <span className="font-medium text-foreground">10:00 AM – 2:00 PM IST</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sunday</span>
                    <span className="font-medium text-foreground">Closed</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
                  Email support is monitored during business hours. Urgent fraud or security 
                  reports are reviewed on a priority basis.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Quick Links</h3>
                </div>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/privacypolicy" className="text-primary hover:underline">Privacy Policy</Link>
                  </li>
                  <li>
                    <Link to="/termsofuse" className="text-primary hover:underline">Terms of Use</Link>
                  </li>
                  <li>
                    <Link to="/disclaimer" className="text-primary hover:underline">Disclaimer</Link>
                  </li>
                  <li>
                    <Link to="/aboutus" className="text-primary hover:underline">About TrueJobs</Link>
                  </li>
                  <li>
                    <Link to="/blog" className="text-primary hover:underline">Career Blog</Link>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Send us a Message</CardTitle>
                <CardDescription>
                  Fill out the form below and our team will get back to you within 24-48 business hours. 
                  For urgent matters, please email the relevant department directly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Your full name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={errors.name ? 'border-destructive' : ''}
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="e.g., Account issue, Job listing question, Partnership inquiry"
                      value={formData.subject}
                      onChange={handleInputChange}
                      className={errors.subject ? 'border-destructive' : ''}
                    />
                    {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Please describe your inquiry in detail so we can assist you effectively..."
                      rows={6}
                      value={formData.message}
                      onChange={handleInputChange}
                      className={errors.message ? 'border-destructive' : ''}
                    />
                    {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
                  </div>
                  
                  <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQs */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {faqs.map((faq, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-sm mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
