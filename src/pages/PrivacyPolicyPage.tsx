import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { ShieldCheck, Printer } from "lucide-react";

const PrivacyPolicyPage = () => {
  return (
    <PageTransition>
      <SEOHead 
        title="Privacy Policy | Parasram India Panipat" 
        description="Read the privacy policy of Parasram India Panipat Branch to understand how we manage, protect, and use your personal and financial data."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Privacy Policy" },
        ]}
      />
      <ScrollProgress />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Privacy Policy" }]} />
        
        <main className="flex-1 py-8 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground">Privacy Policy</h1>
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
                <p className="text-sm text-muted-foreground mb-6">Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                
                <h3 className="text-xl font-bold text-foreground mb-4">1. Introduction</h3>
                <p className="text-muted-foreground leading-relaxed">
                  At Shri Parasram Holdings Pvt. Ltd. (Panipat Branch), we value your trust and respect your privacy. This Privacy Policy outlines our practices regarding the collection, use, and disclosure of your information through our platform and services.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">2. Information We Collect</h3>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2">
                  <li><strong>Personal Identification Information:</strong> Name, address, email, phone number, PAN, Aadhaar, and bank details required for rigorous KYC compliance.</li>
                  <li><strong>Financial Information:</strong> Income details, trading history, and portfolio data necessary for executing trades and providing advisory services.</li>
                  <li><strong>Usage Data:</strong> We may monitor your interaction with our website (e.g., time on page, scroll depth) to show relevant offers and improve user experience.</li>
                </ul>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">3. How We Use Your Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your information is utilized exclusively to:
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2 mt-2">
                  <li>Facilitate the opening and maintenance of your Demat and Trading accounts.</li>
                  <li>Execute, process, and settle your trades efficiently.</li>
                  <li>Provide personalized market insights, reports, and relevant financial product offers.</li>
                  <li>Comply with statutory and regulatory requirements mandated by SEBI, NSE, BSE, MCX, NSDL, and CDSL.</li>
                </ul>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">4. Data Protection and Security</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We employ security measures to protect your personal and financial data against unauthorized access, alteration, or disclosure. All sensitive data transactions occur over secure, encrypted channels.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">5. Sharing of Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We do not sell or rent your personal data to third parties. We may strictly share your data with regulatory authorities, depositories, or clearing corporations as required by Indian law and SEBI guidelines.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">6. Contact Us</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions or grievances regarding this Privacy Policy, please contact our local Panipat support team at <a href="mailto:parasrampnp@gmail.com" className="text-secondary hover:underline">parasrampnp@gmail.com</a>.
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

export default PrivacyPolicyPage;
