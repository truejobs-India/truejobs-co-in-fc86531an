import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Disclaimer() {
  return (
    <Layout>
      <AdPlaceholder variant="banner" />
      <SEO 
        title="Disclaimer - TrueJobs | Legal Notices & Content Attribution" 
        description="Read the TrueJobs disclaimer. TrueJobs is an independent informational portal with no government affiliation. Covers content sourcing, verification responsibility, advertising, and limitation of liability."
        url="/disclaimer"
      />
      <div className="container mx-auto px-4 py-12 max-w-4xl content-area my-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Disclaimer</CardTitle>
            <p className="text-muted-foreground">Effective Date: March 09, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>
              Welcome to TrueJobs ("TrueJobs," "we," "our," or "us"). This Disclaimer governs your use of https://truejobs.co.in and all related pages, content, tools, features, and services available through the website. By accessing or using this website, you acknowledge that you have read, understood, and agreed to this Disclaimer. If you do not agree, you should discontinue use of the website.
            </p>

            <h2>1. General Information Disclaimer</h2>
            <p>
              TrueJobs is an independent online job information portal created to help users discover and understand employment-related updates in India. The website primarily publishes information related to Government Job Notifications, and may also publish updates relating to Private Jobs, Work From Home opportunities, Part-Time opportunities, admit cards, results, answer keys, syllabi, exam updates, and career-related informational content.
            </p>
            <p>
              All content on TrueJobs is provided for general informational and educational purposes only. The information made available on this website should not be treated as official, final, legal, professional, or authoritative advice of any kind. While we aim to present information in a clear, useful, and timely format, we do not make any representation or warranty that all content on the website is always complete, current, accurate, or free from error.
            </p>

            <h2>2. No Government Affiliation</h2>
            <p>
              TrueJobs is not affiliated with, associated with, endorsed by, authorized by, or connected to any government authority, ministry, department, commission, board, agency, public sector undertaking, or statutory body of the Government of India or of any State Government.
            </p>
            <p>
              Any references on the website to government departments, ministries, commissions, recruitment boards, examinations, institutions, or official bodies are used strictly for identification, reference, and informational purposes only. Such references do not imply any official relationship, partnership, approval, or endorsement.
            </p>
            <p>
              Users should always remember that TrueJobs is a private, independent informational platform and not an official government website.
            </p>

            <h2>3. Informational Purpose Only</h2>
            <p>
              TrueJobs collects and summarizes information from publicly available sources, including official recruitment websites, public notifications, employment news, recruitment advertisements, and other public-domain materials. This information is republished in an easier-to-read and user-friendly format for convenience.
            </p>
            <p>
              However, the website content is only a summary or informational presentation of such materials. It may not include every clause, condition, corrigendum, amendment, extension, or detail of the original official notification. The official notification or official recruitment website is the final and authoritative source of information.
            </p>

            <h2>4. Official Verification Responsibility</h2>
            <p>
              Users are solely responsible for verifying every important detail from the official notification, official recruitment portal, or other original source before taking any action.
            </p>
            <p>This includes, without limitation:</p>
            <ul>
              <li>eligibility criteria,</li>
              <li>age limits,</li>
              <li>educational qualifications,</li>
              <li>application start and end dates,</li>
              <li>examination schedules,</li>
              <li>application fees,</li>
              <li>reservation rules,</li>
              <li>admit card instructions,</li>
              <li>result procedures,</li>
              <li>required documents,</li>
              <li>official contact details,</li>
              <li>and all other recruitment conditions.</li>
            </ul>
            <p>
              If there is any discrepancy between information published on TrueJobs and the official notification or official website, the official source shall prevail. By using this website, you agree that it is your responsibility to cross-check and confirm the relevant details before applying or acting on any information.
            </p>

            <h2>5. Accuracy and Completeness Disclaimer</h2>
            <p>
              We make reasonable efforts to keep the information on TrueJobs as accurate and updated as possible. However, recruitment notices and job-related details can change quickly and without notice. Authorities and employers may revise or withdraw information at any time.
            </p>
            <p>Therefore, TrueJobs does not guarantee:</p>
            <ul>
              <li>the completeness of any content,</li>
              <li>the accuracy of every detail,</li>
              <li>the timeliness of updates,</li>
              <li>the continued availability of any vacancy or opportunity,</li>
              <li>or the suitability of any content for a particular purpose.</li>
            </ul>
            <p>Any reliance you place on the information available on this website is strictly at your own risk.</p>

            <h2>6. Not a Recruitment Agency or Hiring Entity</h2>
            <p>
              TrueJobs is not a recruitment agency, placement consultant, hiring company, employer, or government recruiting authority. We do not conduct recruitment, shortlist candidates, issue appointment letters, guarantee selection, arrange employment, or control any hiring process.
            </p>
            <p>
              The website serves only as an informational platform. Any application, selection, interview, joining, salary, contractual relationship, or employment outcome is solely between the user and the relevant employer, recruiter, or official authority.
            </p>
            <p>
              TrueJobs does not guarantee that any user will receive a job, interview call, admit card, or recruitment benefit by using this website.
            </p>

            <h2>7. Private Jobs, Work From Home, and Part-Time Opportunities</h2>
            <p>
              Although TrueJobs primarily focuses on government job information, the website may also publish private job opportunities, work-from-home roles, and part-time opportunities intended to support aspirants and other users.
            </p>
            <p>
              Such opportunities may be based on publicly available information, employer announcements, or third-party sources. TrueJobs does not independently guarantee the legitimacy, safety, salary, work conditions, availability, or fitness of any such opportunity.
            </p>
            <p>
              Users must independently verify private employers, companies, offers, payment terms, and all related conditions before engaging with any such opportunity. Users should exercise caution in cases involving payment requests, sensitive personal data requests, suspicious communications, or unverifiable employers.
            </p>

            <h2>8. External Links Disclaimer</h2>
            <p>
              TrueJobs may contain links to third-party websites, including official recruitment portals, employer websites, advertiser websites, and other external sources. These links are provided for convenience and reference only.
            </p>
            <p>
              We do not own, control, monitor, or guarantee the content, security, accuracy, policies, or availability of any third-party website. Inclusion of any external link does not mean that TrueJobs endorses or approves the linked website, its operator, or its content.
            </p>
            <p>
              When you click on an external link, you leave the TrueJobs website and access that third-party website at your own risk. You should review the terms, privacy policy, and authenticity of any third-party website before relying on it or interacting with it.
            </p>

            <h2>9. Advertisements and Third-Party Content</h2>
            <p>
              TrueJobs may display advertisements and sponsored or monetized content through services such as Google AdSense and other advertising or analytics providers.
            </p>
            <p>
              The presence of an advertisement, sponsored placement, or third-party promotional material on the website does not constitute a recommendation, endorsement, verification, or guarantee by TrueJobs. We are not responsible for the claims, offers, products, services, or representations made by third-party advertisers.
            </p>
            <p>
              Any dealings, purchases, communications, or disputes between you and any advertiser or third party are solely between you and that third party.
            </p>

            <h2>10. Logos, Names, and Trademarks</h2>
            <p>
              All company names, brand names, trademarks, service marks, logos, icons, product names, and other identifying marks appearing on TrueJobs are the property of their respective owners.
            </p>
            <p>
              Any use of such names, marks, or logos on this website is strictly for identification, informational, editorial, comparative, or reference purposes only. Their appearance on TrueJobs does not imply any affiliation, association, endorsement, approval, authorization, sponsorship, or partnership with TrueJobs unless expressly stated otherwise.
            </p>

            <h2>11. No Professional or Legal Advice</h2>
            <p>
              The content available on TrueJobs does not constitute legal advice, career counseling, financial advice, tax advice, educational advice, or any other professional advice. Users should seek independent advice from qualified professionals where necessary.
            </p>
            <p>
              Nothing on this website should be interpreted as creating a professional-client relationship or as a substitute for consulting the official notification, competent authority, or a qualified advisor.
            </p>

            <h2>12. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, TrueJobs and its owners, operators, editors, contributors, employees, affiliates, and representatives shall not be liable for any direct, indirect, incidental, consequential, special, punitive, or exemplary loss or damage arising from or related to:
            </p>
            <ul>
              <li>use of or inability to use the website,</li>
              <li>reliance on information published on the website,</li>
              <li>errors, omissions, inaccuracies, or delays in content,</li>
              <li>missed deadlines, missed applications, or missed opportunities,</li>
              <li>third-party links, advertisements, or services,</li>
              <li>technical issues, interruptions, or website downtime,</li>
              <li>account misuse or unauthorized access despite reasonable safeguards,</li>
              <li>or any decision made based on the information available on the website.</li>
            </ul>
            <p>Use of the website is entirely at your own risk.</p>

            <h2>13. Editorial Independence and Content Presentation</h2>
            <p>
              TrueJobs may summarize, format, categorize, or explain information in a simplified manner for reader convenience. However, such presentation is editorial in nature and should not be confused with the official wording or binding effect of the original source.
            </p>
            <p>
              Advertisements, analytics, monetization arrangements, or commercial interests do not convert website content into official recruitment communication, nor do they alter the independent responsibility of users to verify information from official sources.
            </p>

            <h2>14. Corrections and Updates</h2>
            <p>
              We reserve the right to modify, update, remove, correct, or revise any website content at any time and without prior notice. This includes changes made in response to updated official notifications, editorial corrections, technical updates, user feedback, or legal and operational requirements.
            </p>
            <p>
              Even where corrections are made, we do not guarantee that all previously viewed or cached content will immediately reflect the updated position. Users should therefore verify current details from the relevant official source.
            </p>

            <h2>15. Intellectual Property and Reference Use</h2>
            <p>
              All original editorial content, summaries, formatting, design, and presentation created by TrueJobs are the property of TrueJobs unless otherwise stated. References to official notifications, government bodies, recruitment boards, companies, employers, and other organizations are made for informational identification only.
            </p>
            <p>
              If any person or organization believes that any content on the website infringes their rights or requires correction, they may contact us using the contact details made available on the website for review.
            </p>

            <h2>16. Changes to This Disclaimer</h2>
            <p>
              We may revise this Disclaimer from time to time to reflect changes in the website, applicable practices, legal requirements, or operational needs. Any updated version will be posted on this page with a revised effective date.
            </p>
            <p>Your continued use of the website after any such changes constitutes your acceptance of the revised Disclaimer.</p>

            <h2>17. Contact Information</h2>
            <p>
              If you have any questions, concerns, complaints, correction requests, or feedback regarding this Disclaimer or any content published on TrueJobs, you may contact us:
            </p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:info@truejobs.co.in" className="text-primary underline">info@truejobs.co.in</a></li>
              <li><strong>Support:</strong> <a href="mailto:support@truejobs.co.in" className="text-primary underline">support@truejobs.co.in</a></li>
              <li><strong>Contact Page:</strong> <a href="/contactus" className="text-primary underline">truejobs.co.in/contactus</a></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
