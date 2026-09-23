import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { ShieldCheck, Printer } from "lucide-react";
import { PRIMARY_EMAIL } from "@/lib/contact";

const CookiePolicyPage = () => {
  return (
    <PageTransition>
      <SEOHead 
        title="Cookie Policy | Parasram India Panipat" 
        description="Learn how Parasram India Panipat uses cookies and tracking technologies to enhance your browsing and trading experience."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Cookie Policy" },
        ]}
      />
      <ScrollProgress />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Cookie Policy" }]} />
        
        <main className="flex-1 py-8 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground">Cookie Policy</h1>
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
                
                <h3 className="text-xl font-bold text-foreground mb-4">1. What Are Cookies?</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Cookies are small text files stored on your device (computer, tablet, or mobile) when you visit a website. They are widely used to make websites function correctly, improve user experience, and provide vital analytics to the site owners.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">2. How We Use Cookies</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our platform uses cookies for the following purposes:
                </p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-2 mt-2">
                  <li><strong>Essential Cookies:</strong> Required for core site functionality, secure log-ins, and routing capabilities.</li>
                  <li><strong>Analytical/Performance Cookies:</strong> We utilize analytics software to track generalized user engagement (like time spent on page or scroll depth). This helps us improve our content and deliver smarter, non-intrusive support overlays.</li>
                  <li><strong>Functionality Cookies:</strong> Used to recognize you when you return, allowing us to remember your preferences (like your theme choice or hiding a popup).</li>
                </ul>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">3. Local Storage</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Alongside standard cookies, we may use Web Storage (Local Storage) to store preferences locally on your browser. For example, we record if you have already seen a particular promotional popup to ensure you are not repeatedly interrupted during the same session.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">4. Managing Your Cookies</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can control and manage cookies using your browser settings. Be aware that removing or blocking cookies can impact your user experience, and parts of the Parasram platform may no longer be fully accessible.
                </p>

                <h3 className="text-xl font-bold text-foreground mt-8 mb-4">5. Contact Us</h3>
                <p className="text-muted-foreground leading-relaxed">
                  For any questions regarding our use of cookies or this policy, please email us at <a href={`mailto:${PRIMARY_EMAIL}`} className="text-secondary hover:underline">{PRIMARY_EMAIL}</a>.
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

export default CookiePolicyPage;
