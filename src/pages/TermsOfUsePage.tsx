import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Link } from "react-router-dom";
import { FileText, Printer } from "lucide-react";

const TermsOfUsePage = () => {
  return (
    <PageTransition>
      <SEOHead
        title="Terms of Use | Parasram India Panipat"
        description="Terms of Use for the Shri Parasram Holdings Panipat website - eligibility, account obligations, brokerage, market-risk disclosure and grievance redressal."
        canonical="https://www.sphpnp.com/terms"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Terms of Use" },
        ]}
      />
      <ScrollProgress />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Terms of Use" }]} />

        <main className="flex-1 py-8 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground">Terms of Use</h1>
              </div>
              <button
                onClick={() => window.print()}
                className="print:hidden shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
              <div className="bg-card p-6 md:p-8 rounded-2xl border border-border shadow-sm">
                <p className="text-sm text-muted-foreground mb-6">
                  Last Updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>

                <h3 className="text-xl font-bold text-foreground mb-4">1. Acceptance of These Terms</h3>
                <p className="text-muted-foreground leading-relaxed">
                  This website (www.sphpnp.com) is operated by the Panipat branch of Shri Parasram Holdings Pvt. Ltd.
                  ("Parasram", "we", "us", "our"), a SEBI-registered stock broker and depository participant. By accessing
                  or using this website, you agree to be bound by these Terms of Use and by all applicable laws and regulations.
                  If you do not agree with any part of these terms, please do not use this website.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">2. Scope of the Website</h3>
                <p className="text-muted-foreground leading-relaxed">
                  This website is an informational and service-facilitation platform for the Panipat branch. It provides
                  details of our broking, depository, and investment-facilitation services, market information, educational
                  content, and tools such as calculators and screeners. Trading, settlement, and depository operations are
                  carried out through the regulated systems of Shri Parasram Holdings Pvt. Ltd. and the relevant exchanges
                  and depositories (NSE, BSE, MCX, NSDL, CDSL), and are governed by the separate account-opening documents
                  you sign at onboarding.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">3. Eligibility</h3>
                <p className="text-muted-foreground leading-relaxed">
                  To open an account or use our services you must be at least 18 years of age, of sound mind, and competent
                  to enter into a legally binding contract under the Indian Contract Act, 1872. You must not be barred from
                  accessing securities markets by SEBI or any other regulatory authority.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">4. Account Opening &amp; KYC Obligations</h3>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                  <li>You agree to provide true, accurate, and complete information during KYC and account opening, including PAN, Aadhaar, bank, and income details as required by SEBI regulations.</li>
                  <li>You are responsible for keeping your login credentials, passwords, TPINs, and OTPs confidential. Any activity carried out through your credentials is your responsibility.</li>
                  <li>You must promptly notify us of any unauthorised use of your account or any breach of security.</li>
                </ul>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">5. Brokerage, Charges &amp; Payments</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Rates published on this website (including on our{" "}
                  <Link to="/pricing" className="text-secondary hover:underline">Pricing &amp; Charges</Link> page) are
                  indicative and may be customised based on your trading volume, segments, and order profile. Brokerage,
                  statutory levies (STT, exchange transaction charges, SEBI fees, stamp duty, GST) and other charges are
                  applied in accordance with your agreed tariff and prevailing regulations, and are subject to change without
                  prior notice. In case of any conflict, the tariff recorded in your signed account documents prevails.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">6. Market Risk Disclosure</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Investments in securities markets are subject to market risks. Read all the related documents carefully
                  before investing. The value of investments in equity shares, derivatives, debentures, mutual funds, and
                  other instruments can go up or down, and past performance is not indicative of future results. Investments
                  are not obligations of, nor guaranteed by, Parasram. Derivatives and margin trading carry a high level of
                  risk and may not be suitable for all investors.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">7. No Investment Advice</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Unless expressly provided under a signed research or advisory agreement, the content on this website -
                  including articles, market data, tools, and general information - is for educational and informational
                  purposes only and does not constitute investment, tax, legal, or financial advice or a recommendation to
                  buy or sell any security. You should make your own independent assessment and consult a qualified
                  professional before acting on any information.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">8. Acceptable Use</h3>
                <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2 mt-2">
                  <li>Use the website for any unlawful, fraudulent, or manipulative purpose, including market manipulation or insider trading.</li>
                  <li>Attempt to gain unauthorised access to any part of the website, its servers, or connected systems.</li>
                  <li>Introduce viruses, malware, or other harmful code, or interfere with the proper working of the website.</li>
                  <li>Copy, scrape, reproduce, or redistribute website content except as permitted under Section 9.</li>
                </ul>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">9. Intellectual Property</h3>
                <p className="text-muted-foreground leading-relaxed">
                  All content on this website - text, graphics, logos, tools, and software - is the property of Parasram or
                  its licensors and is protected by applicable intellectual-property laws. You may view and print content for
                  personal, non-commercial use only. Any other use requires our prior written permission.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">10. Third-Party Links</h3>
                <p className="text-muted-foreground leading-relaxed">
                  This website may contain links to third-party websites and data sources (such as exchanges and data
                  providers). Such links are provided for convenience only. We do not control and are not responsible for the
                  content, accuracy, or practices of third-party sites, and access to them is at your own risk.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">11. Limitation of Liability</h3>
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by law, Parasram shall not be liable for any direct, indirect, incidental,
                  special, or consequential loss or damage arising from your use of, or inability to use, this website,
                  including losses due to reliance on information, delays, interruptions, or errors. We do not warrant that
                  the website will be uninterrupted, error-free, or free of viruses or other harmful components. Nothing in
                  these terms limits any liability that cannot be excluded under applicable law.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">12. Indemnity</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify and hold harmless Parasram, its directors, employees, and representatives from any
                  claims, losses, or expenses arising out of your breach of these Terms of Use or your misuse of the website.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">13. Privacy</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your use of this website is also governed by our{" "}
                  <Link to="/privacy-policy" className="text-secondary hover:underline">Privacy Policy</Link> and{" "}
                  <Link to="/cookie-policy" className="text-secondary hover:underline">Cookie Policy</Link>, which explain how
                  we collect, use, and protect your information.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">14. Grievance Redressal</h3>
                <p className="text-muted-foreground leading-relaxed">
                  For any complaint or grievance, please contact our compliance team at{" "}
                  <a href="mailto:compliance@sphpl.com" className="text-secondary hover:underline">compliance@sphpl.com</a>.
                  If your grievance is not resolved satisfactorily, you may escalate it to the exchanges or through SEBI's
                  online complaint platform, SCORES, at{" "}
                  <a href="https://scores.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">scores.sebi.gov.in</a>.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">15. Governing Law &amp; Jurisdiction</h3>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms of Use are governed by the laws of India. Subject to the arbitration and dispute-resolution
                  mechanisms of the relevant exchanges and SEBI regulations, the courts at Panipat, Haryana shall have
                  jurisdiction over any dispute arising from the use of this website.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">16. Changes to These Terms</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may update these Terms of Use from time to time. Changes take effect when posted on this page.
                  Your continued use of the website after any change constitutes acceptance of the revised terms.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">17. Contact</h3>
                <p className="text-muted-foreground leading-relaxed">
                  For questions about these Terms of Use, contact the Panipat branch at{" "}
                  <a href="mailto:parasrampnp@gmail.com" className="text-secondary hover:underline">parasrampnp@gmail.com</a>{" "}
                  or see our <Link to="/contact" className="text-secondary hover:underline">Contact page</Link>.
                </p>
              </div>
            </div>
          </div>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default TermsOfUsePage;
