import { Layout } from '@/components/layout/Layout';
import { AdPlaceholder } from '@/components/ads/AdPlaceholder';
import { SEO } from '@/components/SEO';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfUse() {
  return (
    <Layout>
      <SEO 
        title="Terms of Use - TrueJobs | Terms & Conditions" 
        description="Read the Terms of Use governing your access to TrueJobs, an independent government job information portal. Covers user responsibilities, no government affiliation, verification obligations, and dispute resolution."
        url="/termsofuse"
      />
      <div className="container mx-auto px-4 py-12 max-w-4xl content-area my-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Use</CardTitle>
            <p className="text-muted-foreground">Effective Date: March 09, 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>
              Welcome to TrueJobs ("TrueJobs," "we," "our," or "us"). These Terms of Use govern your access to and use of https://truejobs.co.in and all related pages, content, features, tools, dashboards, forms, communications, and services made available through the website (collectively, the "Website").
            </p>
            <p>
              By accessing or using the Website, you agree to be bound by these Terms of Use. If you do not agree with these Terms, please do not use the Website.
            </p>

            <h2>1. About TrueJobs</h2>
            <p>
              TrueJobs is an independent online job information portal serving users in India. The Website primarily focuses on Government Job Notifications, and may also publish information relating to Private Jobs, Work From Home opportunities, Part-Time opportunities, admit cards, results, answer keys, syllabus updates, exam-related content, and other career-related informational material.
            </p>
            <p>
              The Website is intended to help users discover, understand, and track job-related opportunities and updates in a more accessible format. TrueJobs is an informational platform and should not be understood as an official source of recruitment authority.
            </p>

            <h2>2. No Government Affiliation</h2>
            <p>
              TrueJobs is not affiliated with, endorsed by, authorized by, sponsored by, or connected with any ministry, department, commission, board, agency, public sector undertaking, statutory authority, or other government body of the Government of India, any State Government, or any local authority.
            </p>
            <p>
              Any reference on the Website to a government department, ministry, authority, recruitment board, examination body, institution, organization, or official portal is made strictly for identification, informational, editorial, and reference purposes only. Such reference does not imply any official relationship or endorsement.
            </p>

            <h2>3. Acceptance of These Terms</h2>
            <p>
              By visiting, browsing, creating an account, logging in, subscribing, contacting us, or otherwise using any part of the Website, you acknowledge that you have read, understood, and agreed to these Terms of Use, as well as any other applicable policies published on the Website, including our Privacy Policy, Disclaimer, and Editorial Policy.
            </p>
            <p>If you do not agree to these Terms, you must stop using the Website.</p>

            <h2>4. Informational Nature of the Website</h2>
            <p>
              The content published on TrueJobs is provided for general informational and convenience purposes only. We collect, compile, organize, and summarize information from publicly available sources, including official recruitment websites, public notices, employment news, official advertisements, employer announcements, and other public-domain materials.
            </p>
            <p>
              Although we aim to present information clearly and accurately, the content on the Website is not an official notification, official recruitment instruction, legal advice, or a substitute for the original source.
            </p>
            <p>Users must understand that:</p>
            <ul>
              <li>TrueJobs may summarize or simplify information,</li>
              <li>official notices may contain additional clauses or changes,</li>
              <li>and official notifications and official websites remain the final authority.</li>
            </ul>

            <h2>5. User Responsibility to Verify Official Information</h2>
            <p>
              Before applying for any job, paying any fee, uploading any document, attending any examination, relying on any deadline, or making any recruitment-related decision, you must independently verify all relevant details from the official notification, official recruitment portal, or the concerned employer or authority.
            </p>
            <p>This includes verifying, where applicable:</p>
            <ul>
              <li>eligibility criteria,</li>
              <li>educational qualifications,</li>
              <li>age limits,</li>
              <li>reservation rules,</li>
              <li>important dates,</li>
              <li>fee details,</li>
              <li>examination schedules,</li>
              <li>result and admit card instructions,</li>
              <li>application procedures,</li>
              <li>required documents,</li>
              <li>and official contact details.</li>
            </ul>
            <p>If there is any discrepancy between information on TrueJobs and the official source, the official source shall prevail.</p>

            <h2>6. User Accounts and Registration</h2>
            <p>
              Certain features of the Website may require or allow account registration, login, profile creation, dashboard access, employer access, password-based access, or account-linked interaction.
            </p>
            <p>If you register for an account, you agree to:</p>
            <ul>
              <li>provide accurate, current, and complete information,</li>
              <li>keep your account details reasonably updated,</li>
              <li>maintain the confidentiality of your login credentials,</li>
              <li>and accept responsibility for activities that occur under your account unless unauthorized use is promptly reported.</li>
            </ul>
            <p>
              You must not create an account using false information, impersonate another person or entity, or use another user's credentials without authorization.
            </p>
            <p>
              We reserve the right to suspend, restrict, or terminate any account that appears fraudulent, misleading, abusive, inactive for extended periods where operationally necessary, or used in violation of these Terms or applicable law.
            </p>

            <h2>7. Password Security</h2>
            <p>
              If your account uses a password or other authentication credentials, you are responsible for keeping them secure and confidential.
            </p>
            <p>You must notify us promptly if you believe:</p>
            <ul>
              <li>your account has been accessed without authorization,</li>
              <li>your password has been compromised,</li>
              <li>or there has been any suspicious activity involving your account.</li>
            </ul>
            <p>
              We are not responsible for loss or damage resulting from your failure to maintain the security of your credentials, except to the extent required by applicable law.
            </p>

            <h2>8. Electronic Communications</h2>
            <p>
              By registering, contacting us, subscribing to alerts, requesting support, or using services that involve communication, you consent to receive communications from us electronically where relevant.
            </p>
            <p>Such communications may include:</p>
            <ul>
              <li>welcome messages,</li>
              <li>account notices,</li>
              <li>verification messages,</li>
              <li>password reset communications,</li>
              <li>OTPs,</li>
              <li>job alerts,</li>
              <li>newsletters,</li>
              <li>support replies,</li>
              <li>policy updates,</li>
              <li>service announcements,</li>
              <li>and other operational communications related to your use of the Website.</li>
            </ul>
            <p>
              You may be able to opt out of certain non-essential communications, but we may still send essential service-related, security-related, legal, or account-related communications where necessary.
            </p>

            <h2>9. Private Jobs and Third-Party Opportunities</h2>
            <p>
              Although TrueJobs primarily focuses on government job-related information, we may also publish private jobs, work-from-home opportunities, part-time opportunities, and related listings.
            </p>
            <p>
              Such listings may be based on employer announcements, public sources, third-party submissions, or other available information. TrueJobs does not guarantee:
            </p>
            <ul>
              <li>the legitimacy of every employer or listing,</li>
              <li>any interview or hiring outcome,</li>
              <li>salary, benefits, or working conditions,</li>
              <li>the availability or continuation of any opportunity,</li>
              <li>or the authenticity of every third-party claim.</li>
            </ul>
            <p>Users are solely responsible for independently verifying private employers, companies, offers, and communications before taking action.</p>

            <h2>10. No Recruitment, Placement, or Employment Guarantee</h2>
            <p>
              TrueJobs is not a recruitment agency, staffing service, placement consultant, employer, examination authority, or government recruitment body.
            </p>
            <p>Unless explicitly stated for a specific feature, TrueJobs does not:</p>
            <ul>
              <li>conduct recruitment,</li>
              <li>shortlist or select candidates,</li>
              <li>issue appointment letters,</li>
              <li>control hiring decisions,</li>
              <li>guarantee interviews or selection,</li>
              <li>or guarantee any employment, engagement, admission, or recruitment outcome.</li>
            </ul>
            <p>
              Any employment relationship, hiring decision, selection process, or dispute is solely between the user and the relevant employer, organization, or authority.
            </p>

            <h2>11. Acceptable Use</h2>
            <p>You agree to use the Website only for lawful purposes and in a way that does not infringe the rights of others or interfere with the operation of the Website.</p>
            <p>You must not:</p>
            <ul>
              <li>submit false, misleading, deceptive, unlawful, defamatory, abusive, or infringing content,</li>
              <li>misuse forms, accounts, dashboards, or employer features,</li>
              <li>attempt unauthorized access to any account, server, database, or protected area,</li>
              <li>introduce malware, malicious code, bots, scraping tools, or harmful automation without authorization,</li>
              <li>disrupt, overload, or damage the Website or related infrastructure,</li>
              <li>impersonate another person, employer, recruiter, or organization,</li>
              <li>use the Website for spam, fraud, data harvesting, or illegal activity,</li>
              <li>or violate applicable law while using the Website.</li>
            </ul>
            <p>We reserve the right to investigate misuse and take appropriate action, including restricting or terminating access.</p>

            <h2>12. Intellectual Property</h2>
            <p>
              Unless otherwise stated, all original content, layout, branding, text, page design, graphics, compilations, editorial summaries, and other materials created by TrueJobs are owned by or licensed to TrueJobs and are protected by applicable intellectual property laws.
            </p>
            <p>You may:</p>
            <ul>
              <li>view the Website for personal, non-commercial use,</li>
              <li>print or save limited portions for lawful personal reference,</li>
              <li>and share links to Website pages.</li>
            </ul>
            <p>You may not, without prior written permission:</p>
            <ul>
              <li>copy substantial portions of the Website,</li>
              <li>republish full articles,</li>
              <li>redistribute, scrape, mirror, or commercially exploit content,</li>
              <li>or use content in a manner that competes with or undermines the Website.</li>
            </ul>

            <h2>13. Third-Party Names, Logos, and Trademarks</h2>
            <p>
              All company names, organization names, trademarks, service marks, logos, icons, product names, exam names, and other identifiers appearing on the Website belong to their respective owners.
            </p>
            <p>
              Their appearance on TrueJobs is for identification, informational, editorial, comparative, or reference purposes only and does not imply any affiliation, authorization, endorsement, sponsorship, or partnership with TrueJobs unless expressly stated otherwise.
            </p>

            <h2>14. External Links and Third-Party Websites</h2>
            <p>
              The Website may contain links to official recruitment portals, employer websites, advertiser websites, social media platforms, or other third-party websites and services.
            </p>
            <p>
              These links are provided for convenience and reference only. We do not control, endorse, or guarantee the content, accuracy, availability, security, or privacy practices of any third-party website.
            </p>
            <p>When you leave TrueJobs and access a third-party site, you do so at your own risk and subject to that third party's terms and policies.</p>

            <h2>15. Advertisements and Third-Party Services</h2>
            <p>
              TrueJobs may display advertisements, sponsored content, affiliate links, or other monetized elements, including advertising served through Google AdSense or other third-party services.
            </p>
            <p>
              The appearance of any advertisement or sponsored material does not constitute an endorsement, verification, guarantee, or recommendation by TrueJobs unless expressly stated otherwise.
            </p>
            <p>We are not responsible for:</p>
            <ul>
              <li>the content of third-party advertisements,</li>
              <li>the products or services offered by advertisers,</li>
              <li>or any transaction, claim, or dispute between you and a third-party advertiser or service provider.</li>
            </ul>

            <h2>16. Accuracy, Availability, and No Warranty</h2>
            <p>
              We aim to maintain accurate, useful, and timely information on the Website. However, we do not guarantee that the Website or any content on it will always be:
            </p>
            <ul>
              <li>complete,</li>
              <li>current,</li>
              <li>error-free,</li>
              <li>uninterrupted,</li>
              <li>secure,</li>
              <li>or suitable for your particular purpose.</li>
            </ul>
            <p>
              Recruitment information can change quickly, and authorities or employers may issue corrections, cancellations, extensions, or revised instructions at any time.
            </p>
            <p>The Website and its content are provided on an "as is" and "as available" basis to the fullest extent permitted by applicable law.</p>

            <h2>17. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, TrueJobs and its owners, operators, affiliates, editors, contributors, employees, contractors, and representatives shall not be liable for any direct, indirect, incidental, consequential, special, exemplary, or punitive loss or damage arising out of or relating to:
            </p>
            <ul>
              <li>your use of or inability to use the Website,</li>
              <li>reliance on content published on the Website,</li>
              <li>errors, omissions, inaccuracies, or delays,</li>
              <li>missed deadlines, missed applications, or missed opportunities,</li>
              <li>third-party listings, employers, links, advertisements, or services,</li>
              <li>unauthorized access to accounts or data despite reasonable safeguards,</li>
              <li>or any decision made based on Website content.</li>
            </ul>

            <h2>18. Suspension, Restriction, or Termination</h2>
            <p>
              We may, at our discretion and where reasonably necessary, suspend, restrict, disable, or terminate access to all or any part of the Website or any user account if we believe that:
            </p>
            <ul>
              <li>these Terms have been violated,</li>
              <li>the Website or other users may be at risk,</li>
              <li>the account is being used fraudulently or unlawfully,</li>
              <li>or such action is necessary for security, compliance, operational, or legal reasons.</li>
            </ul>
            <p>We may also modify, suspend, or discontinue any feature or service at any time without liability, subject to applicable law.</p>

            <h2>19. Privacy and Related Policies</h2>
            <p>Your use of the Website is also subject to our other policies, including our:</p>
            <ul>
              <li>Privacy Policy,</li>
              <li>Disclaimer,</li>
              <li>Editorial Policy,</li>
              <li>and any other applicable posted policy or notice.</li>
            </ul>
            <p>You are encouraged to read those documents carefully, as they form an important part of how the Website operates and how your information and use of the Website are handled.</p>

            <h2>20. Changes to These Terms</h2>
            <p>
              We may update these Terms of Use from time to time to reflect changes in the Website, our operations, legal requirements, technology, or business practices.
            </p>
            <p>When we do so, we will post the updated Terms on this page and revise the effective date as appropriate. Your continued use of the Website after updated Terms are posted constitutes your acceptance of the revised Terms.</p>

            <h2>21. Governing Law and Jurisdiction</h2>
            <p>These Terms of Use shall be governed by and construed in accordance with the laws of India.</p>
            <p>
              Any dispute, claim, controversy, or legal proceeding arising out of or relating to these Terms of Use, the Website, or your use of the Website shall be subject to the exclusive jurisdiction of the competent courts in Delhi, India.
            </p>

            <h2>22. Contact Information</h2>
            <p>If you have any questions, concerns, notices, or requests regarding these Terms of Use, you may contact us:</p>
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
