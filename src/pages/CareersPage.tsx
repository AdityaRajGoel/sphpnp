import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import { motion } from "motion/react";
import { Briefcase, MapPin, Users, TrendingUp, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import SplitHero from "@/components/SplitHero";
import { BRANCH_EMAILS, PRIMARY_EMAIL } from "@/lib/contact";



const CareersPage = () => {
  return (
    <PageTransition>
      <SEOHead 
        title="Stock Broker Jobs in Panipat | Careers at Parasram India"
        description="Join our SEBI-registered stock broking firm in Panipat. We're hiring Relationship Managers and Equity Dealers. Build your career in financial services."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Careers" },
        ]}
        jsonLd={{
          "@type": "JobPosting",
          "title": "Financial Services Professional",
          "description": "Parasram India Panipat branch is looking for motivated individuals to join our growing team. Roles available in relationship management, equity dealing, and client advisory.",
          "datePosted": "2026-06-03",
          "validThrough": "2026-12-31",
          "employmentType": "FULL_TIME",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com",
            "logo": "https://www.sphpnp.com/logo.png"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Shakuntala Complex, Palika Bazaar",
              "addressLocality": "Panipat",
              "addressRegion": "Haryana",
              "postalCode": "132103",
              "addressCountry": "IN"
            }
          },
          "baseSalary": {
            "@type": "MonetaryAmount",
            "currency": "INR",
            "value": {
              "@type": "QuantitativeValue",
              "minValue": 15000,
              "maxValue": 50000,
              "unitText": "MONTH"
            }
          },
          "skills": "Stock market knowledge, client relationship management, NISM certification",
          "industry": "Financial Services",
          "applicationContact": {
            "@type": "ContactPoint",
            "email": PRIMARY_EMAIL,
            "contactType": "hiring"
          }
        }}
      />
      <div className="min-h-screen bg-background flex flex-col">
        <ScrollProgress />
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Careers" }]} />
        
        {/* Hero Section */}
        <SplitHero
          eyebrow={<><Briefcase className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" /> We're Hiring</>}
          title={<>Build Your Career in Finance</>}
          subtitle="Join the fastest growing brokerage branch in Panipat. Work with a trusted legacy spanning 50+ years and help drive wealth creation."
          illustration="derivatives-desk"
          badge={<p className="text-sm"><span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Learn on the desk</span><span className="font-semibold">Mentored by senior advisors</span></p>}
        />

        {/* Culture Section */}
        <section className="py-8 md:py-16 bg-muted/30">
          <div className="container mx-auto px-4 max-w-5xl text-center">
            <h2 className="text-3xl font-heading font-bold text-foreground mb-10">Why Join Parasram Panipat?</h2>
            <div className="grid md:grid-cols-3 gap-8 text-left">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Growth Opportunities</h3>
                <p className="text-sm text-muted-foreground">Rapid career progression models and incredibly competitive incentive structures directly tied to your performance.</p>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center mb-4 text-secondary">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Excellent Environment</h3>
                <p className="text-sm text-muted-foreground">Work closely with seasoned market veterans in an encouraging, fast-paced, and dynamic financial hub.</p>
              </div>
              <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
                <div className="w-12 h-12 bg-brand-gold/10 rounded-xl flex items-center justify-center mb-4 text-brand-gold">
                  <MapPin className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Local Branch Power</h3>
                <p className="text-sm text-muted-foreground">Capitalize on the Panipat industrial network with the full backing and tech infrastructure of a premier national broker.</p>
              </div>
            </div>
          </div>
        </section>

        {/* General Application Section */}
        <section className="py-10 md:py-20 relative">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="text-center bg-brand-gold/10 border border-brand-gold/30 rounded-2xl p-8">
              <h4 className="text-2xl font-bold text-foreground mb-3">Looking for Opportunities?</h4>
              <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">While we don't currently have any immediate openings, we are always on the lookout for driven talent. Send us your resume, and we'll reach out when a position opens up!</p>
              <Button asChild className="bg-brand-gold hover:bg-brand-gold/90 text-primary-foreground font-semibold px-8 py-6 text-lg rounded-full">
                <a href={`mailto:${PRIMARY_EMAIL}?subject=General Application`}>Submit Your Resume</a>
              </Button>
            </div>
          </div>
        </section>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default CareersPage;
