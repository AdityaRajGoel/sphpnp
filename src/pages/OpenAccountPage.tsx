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
import { validateAll, validateEmail, validateName, validatePhone, type FieldCheck } from "@/lib/form-validation";
import { FieldMessage, fieldStateClass } from "@/components/ui/form-field";
import { IllustrationFrame } from "@/components/ui/illustration";
import { BRANCH_EMAILS } from "@/lib/contact";

const LEAD_CHECKS: Partial<Record<"name" | "phone" | "email" | "city" | "message", FieldCheck>> = {
  name: validateName,
  phone: validatePhone,
  email: validateEmail({ optional: true }),
  city: (v) => (v.length > 100 ? "City must be 100 characters or fewer" : null),
};

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
  const [touched, setTouched] = useState<Partial<Record<keyof typeof form, boolean>>>({});
  const formRenderTime = useRef(Date.now());

  const errors = validateAll(form, LEAD_CHECKS);
  const shownError = (field: keyof typeof form) => (touched[field] ? errors[field] ?? null : null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const name = e.target.name as keyof typeof form;
    if (form[name].trim()) setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const fieldProps = (field: "name" | "phone" | "email" | "city") => ({
    id: `lead-${field}`,
    name: field,
    value: form[field],
    onChange: handleChange,
    onBlur: handleBlur,
    "aria-invalid": shownError(field) ? true : undefined,
    "aria-describedby": `lead-${field}-message`,
    className: `pl-10 ${fieldStateClass(shownError(field), touched[field] && !errors[field] && !!form[field].trim())}`,
  });

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

    const invalid = Object.keys(validateAll(trimmed, LEAD_CHECKS));
    if (invalid.length > 0) {
      setTouched({ name: true, phone: true, email: true, city: true });
      document.getElementById(`lead-${invalid[0]}`)?.focus();
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

      if (data?.success === false) {
        // Transport succeeded but the lead was not persisted server-side.
        // Never show the success state - offer the WhatsApp fallback instead.
        toast({
          title: "We couldn't save your details",
          description: data?.whatsappUrl
            ? "Please message us on WhatsApp and we'll take it from there."
            : "Please try again or call us directly.",
          variant: "destructive",
        });
        if (data?.whatsappUrl) {
          window.open(data.whatsappUrl, '_blank');
        }
        return;
      }

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
          description="Open a free Demat & trading account with Parasram India Panipat. Zero account opening charges. Invest in stocks, mutual funds and IPOs. SEBI registered."
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
              <Button asChild className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold">
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
        description="Open a free Demat & trading account with Parasram India Panipat. Zero account opening charges. Invest in stocks, mutual funds and IPOs. SEBI registered."
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
          "description": "Open a free Demat and trading account with Parasram India Panipat. Zero account opening charges. SEBI registered broker, serving investors since 1970, offering NSE, BSE, MCX access.",
          "serviceType": "Demat Account Opening",
          "provider": {
            "@type": "FinancialService",
            "name": "Shri Parasram Holdings Panipat",
            "url": "https://www.sphpnp.com",
            "telephone": "+919416400314"
            // aggregateRating + review removed: self-authored, and not rendered
            // on the page - both barred by Google's review-snippet policy.
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
          "description": "Step-by-step guide to opening a free Demat and trading account with Parasram India, a SEBI-registered stock broker serving investors since 1970.",
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

      <section className="relative py-10 md:py-28 overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
        <div className="container mx-auto max-w-6xl px-4 relative z-10 grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="text-center lg:text-left">
            <motion.span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
              <TrendingUp className="w-3.5 h-3.5 text-secondary" /> Free Demat Account
            </motion.span>
            <motion.h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground mb-4 [text-wrap:balance]" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              {t("openAccount.title1")} {t("openAccount.title2")}
            </motion.h1>
            <motion.p className="text-lg text-primary-foreground/80 max-w-xl mx-auto lg:mx-0" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              {t("openAccount.subtitle")}
            </motion.p>
          </div>
          <IllustrationFrame
            slug="advisor-consultation"
            priority
            sizes="(min-width: 1280px) 560px, (min-width: 1024px) 45vw, 92vw"
            frameClassName="mx-auto w-full max-w-xl lg:max-w-none"
            badge={<p className="text-sm"><span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Guided by our Panipat team</span><span className="font-semibold">₹0 account opening</span></p>}
          />
        </div>
      </section>

      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((b, i) => (
              <motion.div key={b.title} className="flex items-start gap-3 bg-card border border-border/50 rounded-xl p-4" {...revealItem(i)}>
                <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0"><b.icon className="w-5 h-5 text-brand-orange" /></div>
                <div><p className="text-sm font-bold text-foreground">{b.title}</p><p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p></div>
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

              <form onSubmit={handleSubmit} noValidate className="space-y-3">
                {/* Honeypot - hidden from humans */}
                <div className="absolute opacity-0 -z-10" style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                  <Input name="_website" tabIndex={-1} autoComplete="off" />
                </div>
                <p className="text-xs text-muted-foreground">Fields marked <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required.</p>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div>
                    <label htmlFor="lead-name" className="text-xs font-semibold text-foreground mb-1.5 block">Full name <span className="text-destructive" aria-hidden="true">*</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <Input {...fieldProps("name")} placeholder="As on your PAN card" required aria-required="true" maxLength={100} autoComplete="name" />
                    </div>
                    <FieldMessage id="lead-name-message" error={shownError("name")} />
                  </div>
                  <div>
                    <label htmlFor="lead-phone" className="text-xs font-semibold text-foreground mb-1.5 block">Mobile number <span className="text-destructive" aria-hidden="true">*</span></label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <Input {...fieldProps("phone")} type="tel" inputMode="tel" placeholder="98765 43210" required aria-required="true" maxLength={20} autoComplete="tel" />
                    </div>
                    <FieldMessage id="lead-phone-message" error={shownError("phone")} hint="We call from a Panipat number within one working day" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  <div>
                    <label htmlFor="lead-email" className="text-xs font-semibold text-foreground mb-1.5 block">Email <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <Input {...fieldProps("email")} placeholder="name@example.com" type="email" inputMode="email" maxLength={255} autoComplete="email" />
                    </div>
                    <FieldMessage id="lead-email-message" error={shownError("email")} />
                  </div>
                  <div>
                    <label htmlFor="lead-city" className="text-xs font-semibold text-foreground mb-1.5 block">City <span className="font-normal text-muted-foreground">(optional)</span></label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                      <Input {...fieldProps("city")} placeholder="Panipat" maxLength={100} autoComplete="address-level2" />
                    </div>
                    <FieldMessage id="lead-city-message" error={shownError("city")} />
                  </div>
                </div>
                <div>
                  <label htmlFor="lead-message" className="text-xs font-semibold text-foreground mb-1.5 block">Message <span className="font-normal text-muted-foreground">(optional)</span></label>
                  <Textarea id="lead-message" name="message" aria-describedby="lead-message-count" value={form.message} onChange={handleChange} placeholder="Any specific requirements or questions..." rows={4} maxLength={1000} />
                  <p id="lead-message-count" className="pt-1 text-right text-xs tabular-nums text-muted-foreground">{form.message.length} / 1000</p>
                </div>
                <RippleButton type="submit" disabled={loading} className="w-full sm:w-auto bg-secondary text-secondary-foreground font-bold text-base px-10 py-6 shadow-lg hover:opacity-90 transition-opacity">
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
                    <div><div className="text-sm font-semibold">Email</div>{BRANCH_EMAILS.map((e) => <a key={e} href={`mailto:${e}`} className="block text-xs text-primary-foreground/70 hover:text-secondary transition-colors">{e}</a>)}</div>
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
