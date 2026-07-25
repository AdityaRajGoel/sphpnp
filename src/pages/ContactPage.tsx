import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import ContactForm from "@/components/ContactForm";
import WhatsAppButton from "@/components/WhatsAppButton";
import ScrollProgress from "@/components/ScrollProgress";
import FAQ from "@/components/FAQ";
import SEOHead from "@/components/SEOHead";
import { useT } from "@/i18n/LanguageContext";
import PageTransition from "@/components/PageTransition";
import { motion } from "motion/react";
import { MessageCircle, MapPin, Phone, Mail, Clock, ExternalLink, Instagram, Facebook, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { revealSection } from "@/lib/motion";
const contactFAQs = [
  { q: "What are your office timings?", a: "Our Panipat branch is open Monday to Friday from 9:00 AM to 6:00 PM, and Saturday from 9:00 AM to 2:00 PM. We are closed on Sundays and market holidays." },
  { q: "Can I visit without an appointment?", a: "Yes! Walk-ins are welcome during office hours. However, for detailed portfolio consultations, we recommend calling ahead to schedule an appointment so our advisors can dedicate proper time to you." },
  { q: "How quickly will you respond to my inquiry?", a: "We aim to respond to all inquiries within 24 hours on business days. For urgent matters, please call us directly at +91 9416400314." },
  { q: "Do you provide services outside Panipat?", a: "Yes, while our physical branch is in Panipat, we serve clients across Haryana and India through our online trading platforms and phone/video consultations." },
  { q: "Is there parking available near your office?", a: "Yes, there is public parking available near Shakuntala Complex, Palika Bazaar. Our office is easily accessible from the main market area." },
];

const quickContacts = [
  { icon: MapPin, label: "Visit Us", value: "Shakuntala Complex, Palika Bazaar, Panipat - 132103", href: "https://maps.app.goo.gl/dvR1a5LPc5xAq4Va8" },
  { icon: Phone, label: "Call Us", value: "+91 9416400314", href: "tel:+919416400314" },
  { icon: Mail, label: "Email Us", value: "parasrampnp@gmail.com", href: "mailto:parasrampnp@gmail.com" },
  { icon: Clock, label: "Working Hours", value: "Mon–Fri 9AM–6PM, Sat 9AM–2PM", href: undefined },
];

const ContactPage = () => {
  const { t } = useT();
  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead
        title="Contact Parasram India Panipat | Stock Broker Office"
        description="Contact Parasram India Panipat at Shakuntala Complex, Palika Bazaar. Call +91 9416400314. Open Mon-Sat. Free Demat account opening and investment consultation."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Contact" },
        ]}
        faqItems={contactFAQs.map(f => ({ question: f.q, answer: f.a }))}
        jsonLd={{
          "@type": "LocalBusiness",
          "name": "Shri Parasram Holdings Panipat",
          "telephone": "+919416400314",
          "email": "parasrampnp@gmail.com",
          "address": { "@type": "PostalAddress", "streetAddress": "Shakuntala Complex, Palika Bazaar", "addressLocality": "Panipat", "addressRegion": "Haryana", "postalCode": "132103", "addressCountry": "IN" },
          "openingHours": ["Mo-Fr 09:00-18:00", "Sa 09:00-14:00"],
          "geo": { "@type": "GeoCoordinates", "latitude": "29.3909", "longitude": "76.9635" },
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Contact" }]} />

      {/* Hero banner */}
      <section className="py-8 md:py-20 bg-hero text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-10 right-20 w-72 h-72 bg-secondary/10 rounded-full blur-3xl"
          />
          <div
            className="absolute bottom-10 left-10 w-60 h-60 bg-brand-gold/8 rounded-full blur-3xl"
          />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MessageCircle className="w-4 h-4 text-brand-gold" />
            <span className="text-sm font-medium">We'd love to hear from you</span>
          </motion.div>
          <motion.h1
            className="font-heading text-4xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {t("contact.title1")} <span className="text-secondary">{t("contact.title2")}</span>
          </motion.h1>
          <motion.p
            className="text-primary-foreground/70 text-lg max-w-xl mx-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {t("contact.subtitle")}
          </motion.p>
        </div>
      </section>

      {/* Quick contact cards */}
      <section className="relative z-20 -mt-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {quickContacts.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, duration: 0.5 }}
              >
                <Card className="bg-card border-border/50 shadow-lg hover:shadow-xl hover:border-secondary/30 transition-[box-shadow,color,background-color,border-color] duration-base group h-full">
                  <CardContent className="p-4 md:p-5 text-center">
                    <div className="w-10 h-10 bg-secondary/10 group-hover:bg-secondary/20 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors">
                      <item.icon className="w-5 h-5 text-secondary" />
                    </div>
                    <h3 className="font-heading text-xs md:text-sm font-semibold text-foreground mb-1">{item.label}</h3>
                    {item.href ? (
                      <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="text-muted-foreground text-xs md:text-sm hover:text-secondary transition-colors leading-snug block">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-muted-foreground text-xs md:text-sm leading-snug">{item.value}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Main content: Form + Info side by side */}
      <section id="contact-form" className="py-8 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Contact Form */}
            <div className="lg:col-span-3">
              <ContactForm />
            </div>

            {/* Sidebar info */}
            <div className="lg:col-span-2 space-y-5">
              {/* Phone numbers */}
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
                <Card className="bg-card border-border/50">
                  <CardContent className="p-5">
                    <h3 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-secondary" /> Call Us Directly
                    </h3>
                    <div className="space-y-2">
                      {["+91 9416400314", "+91 9999790011", "+91 9416400277"].map((num) => (
                        <a key={num} href={`tel:${num.replace(/\s/g, "")}`} className="flex items-center gap-2 text-muted-foreground hover:text-secondary transition-colors text-sm py-1">
                          <ArrowRight className="w-3 h-3" /> {num}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Social links */}
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
                <Card className="bg-card border-border/50">
                  <CardContent className="p-5">
                    <h3 className="font-heading font-semibold text-foreground mb-3">Follow Us</h3>
                    <div className="flex gap-3">
                      <a href="https://www.instagram.com/parasrampanipat/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-secondary/10 text-muted-foreground hover:text-secondary transition-colors text-sm">
                        <Instagram className="w-4 h-4" /> Instagram
                      </a>
                      <a href="https://www.facebook.com/share/18B5W5rZaT/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-secondary/10 text-muted-foreground hover:text-secondary transition-colors text-sm">
                        <Facebook className="w-4 h-4" /> Facebook
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* CTA card */}
              <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
                <Card className="bg-hero text-primary-foreground overflow-hidden relative">
                  <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, hsl(145 70% 40%) 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
                  <CardContent className="p-6 relative z-10 text-center">
                    <h3 className="font-heading text-lg font-bold mb-2">Ready to Start Investing?</h3>
                    <p className="text-primary-foreground/70 text-sm mb-4">Open your free Demat account today</p>
                    <Button asChild size="sm" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold w-full">
                      <a href="/open-account">
                        Open Account <ArrowRight className="ml-2 w-4 h-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Map section */}
      <section id="map" className="py-12 bg-muted/50">
        <div className="container mx-auto px-4">
          <motion.div
            className="rounded-2xl overflow-hidden border border-border/50 shadow-lg"
            {...revealSection}
          >
            <iframe
              src="https://maps.google.com/maps?q=29.394309972550538,76.96980579867602&t=m&z=17&output=embed&iwloc=near"
              width="100%"
              height="350"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Parasram Panipat Office Location"
              className="w-full"
            />
            <div className="bg-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 text-secondary" />
                Shakuntala Complex, Palika Bazaar, Panipat - 132103
              </div>
              <Button asChild variant="outline" size="sm" className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground">
                <a href="https://maps.app.goo.gl/dvR1a5LPc5xAq4Va8" target="_blank" rel="noopener noreferrer">
                  Open in Maps <ExternalLink className="ml-2 w-4 h-4" />
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <FAQ
        title="Contact & Visiting"
        subtitle="Helpful info about reaching us"
        items={contactFAQs}
      />
      <Footer />
      <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default ContactPage;
