import { useState, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  User, Mail, Phone, ArrowRight, CheckCircle2,
  Shield, Award, TrendingUp, MapPin, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { RippleButton } from "@/components/ui/ripple-button";

import { revealItem, revealItemX } from "@/lib/motion";
const benefits = [
  { icon: Shield, title: "SEBI Registered", desc: "Trade with a trusted, regulation-compliant broker" },
  { icon: TrendingUp, title: "Multi-Exchange Access", desc: "NSE, BSE, MCX - all platforms under one roof" },
  { icon: Award, title: "50+ Years Legacy", desc: "Decades of expertise in Indian capital markets" },
  { icon: MapPin, title: "Zero Account Opening Fee", desc: "Open your Demat account absolutely free" },
];

const OpenAccountPage = () => {
  const { t } = useT();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", message: "" });
  const formRenderTime = useRef(Date.now());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    const honeypot = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('[name="_website"]');
    if (honeypot && honeypot.value) return;

    const trimmed = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      city: form.city.trim(),
      message: form.message.trim(),
    };

    if (!trimmed.name || !trimmed.phone) {
      toast({ title: "Please fill required fields", description: "Name and phone number are mandatory.", variant: "destructive" });
      return;
    }
    if (trimmed.name.length > 100 || trimmed.phone.length > 20) {
      toast({ title: "Invalid input", description: "Please check your name and phone number.", variant: "destructive" });
      return;
    }
    if (trimmed.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-lead', {
        body: {
          ...trimmed,
          _website: "", // honeypot
          _ts: formRenderTime.current, // timestamp CSRF
        },
      });

      if (error) throw error;

      setSubmitted(true);
      toast({ title: "Request Submitted! ✅", description: "Our team will contact you shortly." });

      // Open WhatsApp notification in new tab for the business
      if (data?.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
      }
    } catch {
      toast({ title: "Submission failed", description: "Please try again or call us directly.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
        <SEOHead
          title="Open Free Demat Account in Panipat | Parasram India"
          description="Open a free Demat & trading account with Parasram India Panipat. Zero account opening charges. Start investing in stocks, mutual funds and IPOs. SEBI registered."
          breadcrumbs={[
            { name: "Home", url: "/" },
            { name: "Open Demat Account" },
          ]}
        />
        <ScrollProgress />
        <Header />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <motion.div className="text-center max-w-md" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <motion.div className="w-20 h-20 mx-auto mb-6 bg-secondary/10 rounded-full flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}>
              <CheckCircle2 className="w-10 h-10 text-secondary" />
            </motion.div>
            <h2 className="font-heading text-3xl font-bold text-foreground mb-3">Thank You!</h2>
            <p className="text-muted-foreground mb-2">Your account opening request has been submitted successfully.</p>
            <p className="text-sm text-muted-foreground mb-8">Our team will call you within 24 hours. You can also visit our branch at <b>Shakuntala Complex, Palika Bazaar, Panipat</b>.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild className="btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground font-bold">
                <a href="tel:+919416400314"><Phone className="w-4 h-4 mr-2" />Call Now</a>
              </Button>
              <Button asChild variant="outline"><Link to="/">Back to Home</Link></Button>
            </div>
          </motion.div>
        </div>
        <Footer />
        <WhatsAppButton />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead
        title="Open Free Demat Account in Panipat | Parasram India"
        description="Open a free Demat & trading account with Parasram India Panipat. Zero account opening charges. Start investing in stocks, mutual funds and IPOs. SEBI registered."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Open Demat Account" },
        ]}
        faqItems={[
          { question: "Is there any charge to open a Demat account with Parasram India?", answer: "No, account opening is completely free at Parasram India Panipat. There are no account opening charges." },
          { question: "How long does it take to open a Demat account?", answer: "The account opening process typically takes 1-2 business days after successful KYC verification. Documents can be submitted online or at our branch." },
          { question: "What documents are needed to open a Demat account?", answer: "You need PAN card, Aadhaar card, a cancelled cheque or bank passbook, and a recent passport-size photograph. For online KYC, your Aadhaar-linked mobile number is needed." },
          { question: "Can I open a Demat account online?", answer: "Yes, you can initiate the account opening online by filling the form on this page. Our team will contact you within 24 hours to complete the KYC process." },
          { question: "What can I trade with a Demat account at Parasram India?", answer: "You can trade in equities, mutual funds, IPOs, F&O, commodities (MCX), currency, and unlisted shares across NSE and BSE through a single account." },
        ]}
        jsonLd={{
          "@type": "Service",
          "name": "Free Demat Account Opening - Parasram India Panipat",
          "description": "Open a free Demat and trading account with Parasram India Panipat. Zero account opening charges. SEBI registered broker since 1970 offering NSE, BSE, MCX access.",
          "serviceType": "Demat Account Opening",
          "provider": {
            "@type": "FinancialService",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com",
            "telephone": "+919416400314",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": 4.9,
              "reviewCount": 350,
              "bestRating": 5,
              "worstRating": 1
            },
            "review": [
              {
                "@type": "Review",
                "reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5 },
                "author": { "@type": "Person", "name": "Vikram Singh" },
                "reviewBody": "Opened my Demat account within 24 hours with zero fees. The team was extremely helpful throughout the process."
              },
              {
                "@type": "Review",
                "reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5 },
                "author": { "@type": "Person", "name": "Neha Gupta" },
                "reviewBody": "Quick and paperless Demat account opening. Very impressed with the service and support from Parasram India Panipat."
              }
            ]
          },
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "INR",
            "description": "Free Demat account opening with zero charges",
            "availability": "https://schema.org/InStock"
          },
          "areaServed": {
            "@type": "City",
            "name": "Panipat",
            "sameAs": "https://www.wikidata.org/wiki/Q1484275"
          }
        }}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": "How to Open a Free Demat Account with Parasram India Panipat",
          "description": "Step-by-step guide to opening a free Demat and trading account with Parasram India, Panipat's SEBI-registered stock broker since 1970.",
          "totalTime": "PT2D",
          "estimatedCost": { "@type": "MonetaryAmount", "currency": "INR", "value": "0" },
          "step": [
            { "@type": "HowToStep", "position": 1, "name": "Fill the online form", "text": "Enter your name, phone number and email in the account opening form on this page." },
            { "@type": "HowToStep", "position": 2, "name": "Team contacts you", "text": "Our team calls you within 24 hours to guide you through the KYC process." },
            { "@type": "HowToStep", "position": 3, "name": "Submit KYC documents", "text": "Provide PAN card, Aadhaar card, a cancelled cheque, and a passport-size photo - online or at our Panipat branch." },
            { "@type": "HowToStep", "position": 4, "name": "Account activated", "text": "Your Demat and trading account is activated within 1-2 business days after successful KYC verification." }
          ]
        })}</script>
      </Helmet>
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Open Demat Account" }]} />

      <section className="relative py-10 md:py-28 overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(213 80% 12% / 0.95), hsl(213 80% 22% / 0.9), hsl(145 70% 25% / 0.88))` }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 right-10 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-brand-gold/15 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <TrendingUp className="w-3.5 h-3.5 text-secondary" /> Free Demat Account
          </motion.span>
          <motion.h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-4" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {t("openAccount.title1")} <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-brand-gold">{t("openAccount.title2")}</span>
          </motion.h1>
          <motion.p className="text-lg text-primary-foreground/80 max-w-xl mx-auto" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            {t("openAccount.subtitle")}
          </motion.p>
        </div>
      </section>

      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((b, i) => (
              <motion.div key={b.title} className="flex items-start gap-3 bg-card border border-border/50 rounded-xl p-4" {...revealItem(i)}>
                <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0"><b.icon className="w-5 h-5 text-brand-orange" /></div>
                <div><h3 className="text-sm font-bold text-foreground">{b.title}</h3><p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p></div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-10">
            <motion.div className="lg:col-span-3" {...revealItemX("left")}>
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-2">Fill Your Details</h2>
              <p className="text-sm text-muted-foreground mb-8">Our team will get in touch with you to complete the account opening process.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Honeypot - hidden from humans */}
                <div className="absolute opacity-0 -z-10" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                  <Input name="_website" tabIndex={-1} autoComplete="off" />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input name="name" aria-label="Your Name" value={form.name} onChange={handleChange} placeholder="Enter your name" className="pl-10" required maxLength={100} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input name="phone" aria-label="Phone Number" value={form.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" className="pl-10" required maxLength={20} />
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input name="email" aria-label="Email Address" value={form.email} onChange={handleChange} placeholder="your@email.com" className="pl-10" type="email" maxLength={255} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1.5 block">City</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input name="city" aria-label="City" value={form.city} onChange={handleChange} placeholder="Panipat" className="pl-10" maxLength={100} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Message (Optional)</label>
                  <Textarea name="message" aria-label="Message" value={form.message} onChange={handleChange} placeholder="Any specific requirements or questions..." rows={4} maxLength={1000} />
                </div>
                <RippleButton type="submit" disabled={loading} className="w-full sm:w-auto bg-gradient-to-r from-brand-orange to-brand-gold text-white font-bold text-base px-10 py-6 shadow-lg shadow-brand-orange/20 hover:opacity-90 transition-opacity">
                  {loading ? "Submitting..." : "Submit Request"}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </RippleButton>
              </form>
            </motion.div>

            <motion.div className="lg:col-span-2" {...revealItemX("right")}>
              <div className="bg-gradient-to-br from-brand-charcoal to-brand-navy rounded-2xl p-6 text-primary-foreground sticky top-24">
                <h3 className="font-heading text-xl font-bold mb-6">Visit Our Branch</h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><MapPin className="w-4 h-4 text-secondary" /></div>
                    <div><div className="text-sm font-semibold">Address</div><div className="text-xs text-primary-foreground/70 mt-0.5">Shakuntala Complex, Palika Bazaar, Panipat - 132103</div></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Phone className="w-4 h-4 text-brand-gold" /></div>
                    <div>
                      <div className="text-sm font-semibold">Phone</div>
                      <div className="text-xs text-primary-foreground/70 mt-0.5 space-y-0.5">
                        <a href="tel:+919416400314" className="block hover:text-secondary transition-colors">+91 94164 00314</a>
                        <a href="tel:+919999790011" className="block hover:text-secondary transition-colors">+91 99997 90011</a>
                        <a href="tel:+919416400277" className="block hover:text-secondary transition-colors">+91 94164 00277</a>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Mail className="w-4 h-4 text-brand-orange" /></div>
                    <div><div className="text-sm font-semibold">Email</div><a href="mailto:parasrampnp@gmail.com" className="text-xs text-primary-foreground/70 hover:text-secondary transition-colors">parasrampnp@gmail.com</a></div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Clock className="w-4 h-4 text-secondary" /></div>
                    <div><div className="text-sm font-semibold">Office Hours</div><div className="text-xs text-primary-foreground/70 mt-0.5">Mon–Sat: 9:00 AM – 6:00 PM</div></div>
                  </div>
                </div>
                <div className="mt-6 pt-5 border-t border-white/10">
                  <a href="https://maps.app.goo.gl/dvR1a5LPc5xAq4Va8" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-primary-foreground text-xs font-bold px-4 py-2.5 rounded-lg transition-colors">
                    <MapPin className="w-3.5 h-3.5" /> Open in Google Maps
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default OpenAccountPage;
