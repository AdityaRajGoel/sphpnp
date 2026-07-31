import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { Link } from "react-router-dom";
import { AlertTriangle, Printer } from "lucide-react";

const DisclaimerPage = () => {
  return (
    <PageTransition>
      <SEOHead
        title="Disclaimer | Parasram India Panipat"
        description="Disclaimer for the Shri Parasram Holdings Panipat website - information accuracy, investment risk, warranty and liability limitations, and third-party links."
        canonical="https://www.sphpnp.com/disclaimer"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Disclaimer" },
        ]}
      />
      <ScrollProgress />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Disclaimer" }]} />

        <main className="flex-1 py-8 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground">Disclaimer</h1>
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

                <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-4 mb-8">
                  <p className="text-sm text-foreground leading-relaxed m-0">
                    <strong>Investments in securities market are subject to market risks.</strong> Read all the related
                    documents carefully before investing.
                  </p>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-4">1. Information &amp; Changes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  The information and material contained in these pages - and the terms, conditions, and descriptions that
                  appear - are subject to change without prior notice. This website is operated by the Panipat branch of
                  Shri Parasram Holdings Pvt. Ltd. ("Parasram") and is provided for general information purposes.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">2. Investment Risk</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Investments in equity shares, derivatives, debentures, mutual funds, and other instruments are not
                  obligations of, nor guaranteed by, Parasram, and are subject to investment and market risks. The value of
                  investments can rise or fall, and past performance is not indicative of future results.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">3. Accuracy of Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Parasram does not warrant the accuracy, adequacy, or completeness of the information and material on this
                  website and expressly disclaims liability for any errors or omissions. Market data displayed may be
                  delayed and is provided for informational purposes only, not for trading or settlement.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">4. No Advice</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Unless expressly provided under a signed research or advisory agreement, nothing on this website
                  constitutes investment, tax, legal, or financial advice or a recommendation to buy or sell any security.
                  Content is educational in nature. Please consult a qualified professional and make your own independent
                  assessment before investing.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">5. Warranty Limitations</h3>
                <p className="text-muted-foreground leading-relaxed">
                  This website and its content are provided "as is" and "as available", without warranties of any kind,
                  whether express or implied, including but not limited to the warranties of non-infringement of third-party
                  rights, title, merchantability, fitness for a particular purpose, and freedom from computer virus.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">6. Limitation of Liability</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Parasram will not be liable for any damages - including, without limitation, direct, indirect, special,
                  incidental, or consequential damages - arising out of the use of, or the inability to use, this website, or
                  from any failure of performance, interruption, or delay, even if advised of the possibility of such damages.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">7. Third-Party Links</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Hyperlinks from and to other websites are used at your own risk. Parasram has not verified the content of
                  such linked websites and is not responsible for their accuracy, availability, or practices.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">8. Exchange Disclaimer</h3>
                <p className="text-muted-foreground leading-relaxed">
                  The stock exchanges (NSE, BSE, MCX) and depositories (NSDL, CDSL) do not in any manner endorse the
                  services offered through this website and shall not be responsible for any service quality issues or for
                  any consequences arising from their use.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">9. Related Policies</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Please also read our{" "}
                  <Link to="/terms" className="text-secondary hover:underline">Terms of Use</Link>,{" "}
                  <Link to="/privacy-policy" className="text-secondary hover:underline">Privacy Policy</Link>, and{" "}
                  <Link to="/cookie-policy" className="text-secondary hover:underline">Cookie Policy</Link>.
                  For grievances, contact{" "}
                  <a href="mailto:compliance@sphpl.com" className="text-secondary hover:underline">compliance@sphpl.com</a>.
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

export default DisclaimerPage;
