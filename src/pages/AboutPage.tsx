import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import About from "@/components/About";
import HowItWorks from "@/components/HowItWorks";
import CompanyTimeline from "@/components/CompanyTimeline";
import GoogleReviews from "@/components/GoogleReviews";
import ClientMarquee from "@/components/ClientMarquee";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import FAQ from "@/components/FAQ";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";

const aboutFAQs = [
  { q: "How long has Parasram India been in business?", a: "Parasram has been serving investors since 1970, giving us over 50 years of experience in the financial markets. The business was incorporated as Shri Parasram Holdings Pvt. Ltd. in 1994 (CIN: U67120DL1994PTC060726). Our Panipat branch has been serving clients since 1997." },
  { q: "Is Parasram India registered with SEBI?", a: "Yes, Shri Parasram Holdings Pvt. Ltd. is a SEBI-registered stock broker. Its SEBI Registration No. INZ000220838 covers NSE, BSE, MCX and MSEI, and its commodity registration for MCX & NCDEX is INZ000033839. CIN: U67120DL1994PTC060726." },
  { q: "What services does the Panipat branch offer?", a: "Our Panipat branch offers equity trading, derivatives, commodity trading, mutual fund investments, IPO applications, SIP planning, unlisted shares, portfolio management services, and personalized financial advisory." },
  { q: "How can I open a Demat account?", a: "You can open a free Demat account by visiting our branch at Shakuntala Complex, Palika Bazaar, Panipat, or by filling out the online form on our website. You'll need your PAN card, Aadhaar card, and bank details." },
  { q: "Do you provide research and advisory services?", a: "Yes, our research team provides daily market reports, stock recommendations, and personalized portfolio advisory. All research calls are SEBI-compliant." },
  { q: "What are the brokerage charges?", a: "We offer competitive brokerage rates. Contact our Panipat branch for the latest rate card tailored to your trading volume and requirements." },
];

const AboutPage = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead
        title="About Parasram India Panipat | 50+ Years Legacy Stock Broker"
        description="Parasram India - Panipat's most trusted SEBI-registered stock broker since 1970. NSE, BSE & MCX member. 10L+ happy clients. Open your free Demat account today."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "About Us" },
        ]}
        faqItems={aboutFAQs.map(f => ({ question: f.q, answer: f.a }))}
        jsonLd={{
          "@type": "AboutPage",
          "name": "About Shri Parasram Holdings Panipat",
          "description": "Parasram India is one of the oldest and most trusted SEBI-registered stock brokers in Panipat, Haryana, serving investors since 1970.",
          "about": {
            "@type": "Organization",
            "name": "Shri Parasram Holdings Pvt. Ltd.",
            "alternateName": "Shri Parasram Holdings Panipat",
            "foundingDate": "1970",
            "numberOfEmployees": { "@type": "QuantitativeValue", "value": 10 },
            "legalName": "Shri Parasram Holdings Pvt. Ltd.",
            "url": "https://www.sphpnp.com",
            "logo": "https://www.sphpnp.com/logo.png",
            "telephone": "+919416400314",
            "email": "parasrampnp@gmail.com",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Shakuntala Complex, Palika Bazaar",
              "addressLocality": "Panipat",
              "addressRegion": "Haryana",
              "postalCode": "132103",
              "addressCountry": "IN"
            },
            "areaServed": "Panipat, Haryana"
            // aggregateRating + review removed: Google bars a business from
            // marking up its own reviews, and bars markup for content not
            // rendered on the page. These were both.
          }
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "About Us" }]} />
      <About />
      <CompanyTimeline />
      <HowItWorks />
      <ClientMarquee />
      {/* The old <Testimonials /> block was six invented client stories with
          invented names, roles and performance claims. Removed rather than
          rewritten - the GoogleReviews section below already carries real,
          attributable social proof from the live Business Profile. */}
      <GoogleReviews />
      <FAQ
        title="About Parasram India"
        subtitle="Common questions about our firm and services"
        items={aboutFAQs}
      />
      <Footer />
      <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default AboutPage;
