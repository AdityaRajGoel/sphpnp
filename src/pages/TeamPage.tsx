import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import ScrollProgress from "@/components/ScrollProgress";
import CompanyValues from "@/components/CompanyValues";
import FAQ from "@/components/FAQ";
import SEOHead from "@/components/SEOHead";
import PageTransition from "@/components/PageTransition";
import { motion, useScroll, useTransform } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Phone, Mail, Award, TrendingUp, Users, Briefcase, Clock, Star,
  ChevronRight, Shield, Target, Handshake, GraduationCap, MessageCircle,
  MapPin, Calendar
} from "lucide-react";
import { useRef } from "react";
import { EASE_OUT, revealSection } from "@/lib/motion";

const teamMembers = [
  {
    name: "Anil Kumar Goel",
    role: "Director",
    description: "35+ years experience in financial services and long-term investment guidance. Expert in equity portfolio management and wealth planning for HNIs.",
    longBio: "Anil Kumar Goel has been the cornerstone of Parasram India's Panipat branch since the late 1980s. With deep expertise in equity markets and a disciplined approach to wealth creation, he has guided hundreds of families through market cycles - from the Harshad Mehta era to modern algorithmic trading.",
    phone: "+91 9416400314",
    email: "anil@sphpnp.com",
    icon: Award,
    accent: "from-secondary to-brand-green",
    statValue: "35+",
    statLabel: "Years",
    specialties: ["Equity Advisory", "Wealth Planning", "HNI Services", "Portfolio Review"],
    achievements: ["Managed 500+ client portfolios", "SEBI-registered advisor since 1989"],
  },
  {
    name: "Ajay Gupta",
    role: "Director",
    description: "30+ years experience in client advisory and financial product services. Specializes in mutual funds, SIPs, and retirement planning for families.",
    longBio: "Ajay Gupta brings three decades of experience in making financial products accessible to everyday investors. His strength lies in simplifying complex investment choices and creating goal-based financial plans that families can rely on for generations.",
    phone: "+91 9416400277",
    email: "ajay@sphpnp.com",
    icon: Users,
    accent: "from-brand-gold to-secondary",
    statValue: "30+",
    statLabel: "Years",
    specialties: ["Mutual Funds", "SIP Planning", "Retirement Advisory", "Tax Saving"],
    achievements: ["₹100Cr+ AUM in mutual funds", "Top advisor for SIP enrollments"],
  },
  {
    name: "Aditya Raj Goel",
    role: "Director",
    description: "Assists investors with account opening, KYC processing, and service queries. Handles online services, website, and social media presence.",
    longBio: "Aditya Raj Goel represents the next generation of financial services. He bridges traditional client servicing with modern digital tools - ensuring smooth onboarding, paperless KYC, and an active online presence that keeps clients informed and engaged.",
    phone: "+91 8295565443",
    email: "parasrampnp@gmail.com",
    icon: TrendingUp,
    accent: "from-secondary to-brand-gold",
    statValue: "5+",
    statLabel: "Years",
    specialties: ["Account Opening", "KYC Processing", "Digital Services", "Social Media"],
    achievements: ["Streamlined paperless onboarding", "Manages all digital platforms"],
  },
  {
    name: "Rajat Gupta",
    role: "Director",
    description: "Manages documentation, transaction execution, and coordination with service platforms and AMCs. Your go-to person for smooth operations.",
    longBio: "Rajat Gupta ensures that every transaction runs seamlessly from initiation to completion. His meticulous approach to documentation and strong relationships with AMCs and service platforms mean clients never have to worry about the operational side of investing.",
    phone: "+91 9999790011",
    email: "rajat@sphpnp.com",
    icon: Briefcase,
    accent: "from-brand-gold to-brand-green",
    statValue: "15+",
    statLabel: "Years",
    specialties: ["Client Relations", "Transaction Mgmt", "AMC Coordination", "Documentation"],
    achievements: ["Zero-error transaction record", "Fastest turnaround times in region"],
  },
];

const teamFAQs = [
  { q: "Can I request a specific advisor?", a: "Yes, you can request to work with any of our team members. While all our advisors are well-equipped, we're happy to match you with someone whose expertise aligns with your goals." },
  { q: "Do your advisors provide personalized recommendations?", a: "Absolutely. Our advisors take the time to understand your financial situation, risk appetite, and goals before making any recommendations. All advice is SEBI-compliant." },
  { q: "How do I schedule a consultation?", a: "You can call any team member directly using the numbers listed above, or visit our branch during office hours. For first-time consultations, we recommend calling ahead." },
  { q: "Is there a minimum investment amount to get started?", a: "No. We welcome investors of all sizes. Whether you want to start a ₹500 monthly SIP or invest ₹50 lakhs in equities, our team is here to help." },
  { q: "What are your office hours?", a: "Our branch operates Monday to Saturday, 9:30 AM to 5:30 PM IST. We are closed on Sundays and stock exchange holidays." },
];

const branchStats = [
  { label: "Branch Established", value: "1997", icon: Calendar },
  { label: "Active Clients", value: "2,000+", icon: Users },
  { label: "AUM Managed", value: "₹250Cr+", icon: TrendingUp },
  // The firm's SEBI registration is not tied to the branch opening date, so show
  // the registration number rather than a year that contradicts "since 1970".
  { label: "SEBI Registered", value: "INZ000220838", icon: Shield },
];

const TeamMemberCard = ({ member, index }: { member: typeof teamMembers[0]; index: number }) => {
  

  return (
    <motion.div
      className="group bg-card rounded-2xl border border-border/50 hover:border-secondary/30 shadow-lg hover:shadow-2xl transition-[color,background-color,border-color,box-shadow] duration-slow relative overflow-hidden"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.12, duration: 0.6, ease: EASE_OUT }}
      whileHover={{ y: -6 }}
    >
      {/* Top gradient bar */}
      <div className={`h-1.5 bg-gradient-to-r ${member.accent}`} />

      {/* Hover overlay */}
      <motion.div className="absolute inset-0 bg-gradient-to-br from-secondary/5 to-brand-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-slow" />

      <div className="relative z-10 p-8 sm:p-10">
        {/* Header row */}
        <div className="flex items-start gap-5 mb-6">
          <motion.div
            className={`w-20 h-20 bg-gradient-to-br ${member.accent} rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0`}
            whileHover={{ rotate: [0, -8, 8, 0], scale: 1.1 }}
            transition={{ duration: 0.5 }}
          >
            <member.icon className="w-8 h-8" />
          </motion.div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-2xl font-bold text-foreground group-hover:text-secondary transition-colors">
              {member.name}
            </h3>
            <p className="text-secondary font-semibold text-base">{member.role}</p>
          </div>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-3">
          <a
            href={`tel:${member.phone}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors bg-muted/50 hover:bg-secondary/10 rounded-lg px-3 py-2"
          >
            <Phone className="w-4 h-4" />
            {member.phone}
          </a>
          <a
            href={`mailto:${member.email}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-secondary transition-colors bg-muted/50 hover:bg-secondary/10 rounded-lg px-3 py-2"
          >
            <Mail className="w-4 h-4" />
            {member.email}
          </a>
          <a
            href={`https://wa.me/${member.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${member.name.split(' ')[0]}, I'd like to schedule a consultation.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        </div>
      </div>

      {/* Corner accent */}
      <motion.div
        className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-secondary/8 to-transparent rounded-tl-3xl"
        initial={{ opacity: 0, scale: 0 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.5 + index * 0.1 }}
      />
    </motion.div>
  );
};

const TeamPage = () => {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.3]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      <SEOHead
        title="Our Team | Financial Advisors Panipat - Parasram India"
        description="Meet the experienced financial advisors at Parasram India Panipat. 35+ years of combined expertise in equity, mutual funds, IPOs, and wealth management."
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Our Team" },
        ]}
        faqItems={teamFAQs.map(f => ({ question: f.q, answer: f.a }))}
        jsonLd={{
          "@type": "Organization",
          "name": "Shri Parasram Holdings Panipat",
          "url": "https://www.sphpnp.com",
          "description": "Trusted stock brokerage firm in Panipat since 1970 with 2,000+ active clients and ₹250Cr+ AUM managed.",
          "employee": teamMembers.map(m => ({
            "@type": "Person",
            "name": m.name,
            "jobTitle": m.role,
            "telephone": m.phone,
            "email": m.email,
            "description": m.description,
            "worksFor": {
              "@type": "Organization",
              "name": "Shri Parasram Holdings Panipat"
            }
          })),
          "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": 4.9,
            "reviewCount": 200,
            "bestRating": 5,
            "worstRating": 1
          },
          "review": [
            {
              "@type": "Review",
              "reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5 },
              "author": { "@type": "Person", "name": "Rajesh Sharma" },
              "reviewBody": "Excellent team of advisors. Anil Kumar Goel's 35 years of market expertise has helped me grow my portfolio significantly. Highly recommended!"
            },
            {
              "@type": "Review",
              "reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5 },
              "author": { "@type": "Person", "name": "Sunita Verma" },
              "reviewBody": "Been investing with Parasram Panipat for 15 years. The team is always available and provides honest, unbiased advice."
            }
          ]
        }}
      />
      <ScrollProgress />
      <Header />
      <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Our Team" }]} />

      {/* Hero Section */}
      <motion.section ref={heroRef} style={{ opacity: heroOpacity }} className="py-10 md:py-28 bg-background relative overflow-hidden">
        {/* Ambient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-20 right-10 w-72 h-72 bg-secondary/5 rounded-full blur-3xl"
          />
          <div
            className="absolute bottom-10 left-10 w-80 h-80 bg-brand-gold/5 rounded-full blur-3xl"
          />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            className="text-center mb-6"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.span
              className="inline-block text-secondary font-semibold text-sm uppercase tracking-wider mb-4"
              initial={{ opacity: 0, letterSpacing: "0em" }}
              animate={{ opacity: 1, letterSpacing: "0.15em" }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              Our Experts
            </motion.span>
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
              Meet Our <span className="text-secondary">Team</span>
            </h1>
            <motion.div
              className="w-20 h-1 bg-gradient-to-r from-secondary to-brand-gold mx-auto rounded-full mb-6"
              initial={{ width: 0 }}
              animate={{ width: 80 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            />
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-6">
              Meet the people behind Parasram Panipat
            </p>

            <motion.div
              className="inline-flex items-center gap-2 bg-card border border-border/50 rounded-full px-6 py-3 shadow-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
            >
              <Clock className="w-4 h-4 text-brand-gold" />
              <span className="text-sm text-foreground font-medium">
                Panipat branch serving investors since 1997
              </span>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Branch Stats */}
      <section className="py-6 border-y border-border/50 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {branchStats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="flex items-center gap-3 justify-center py-3"
                {...revealSection}
                transition={{ delay: i * 0.1 }}
              >
                <stat.icon className="w-5 h-5 text-secondary" />
                <div>
                  <div className="text-lg font-bold text-foreground">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Grid */}
      <section className="py-8 md:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            {teamMembers.map((member, index) => (
              <TeamMemberCard key={member.name} member={member} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-8 md:py-16 bg-muted/30 border-y border-border/50">
        <div className="container mx-auto px-4">
          <motion.h2
            className="font-heading text-2xl md:text-3xl font-bold text-foreground text-center mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Why Families Trust <span className="text-secondary">Our Team</span>
          </motion.h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { icon: Shield, title: "SEBI Registered", desc: "Fully compliant with all regulatory requirements. Your investments are in safe hands." },
              { icon: Target, title: "Goal-Based Advice", desc: "We don't sell products - we craft personalized plans aligned with your life goals." },
              { icon: Handshake, title: "Relationship First", desc: "We build long-term relationships, not transactions. Many clients have been with us for 20+ years." },
              { icon: GraduationCap, title: "Investor Education", desc: "We believe informed investors make better decisions. Free workshops and guidance included." },
              { icon: MapPin, title: "Local Presence", desc: "Walk into our Panipat branch anytime. Face-to-face advice you can trust." },
              { icon: TrendingUp, title: "Proven Track Record", desc: "Consistent wealth creation across market cycles for over three decades." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                {...revealSection}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="p-5 h-full hover:shadow-md transition-shadow border-border/50 hover:border-secondary/30">
                  <item.icon className="w-6 h-6 text-secondary mb-3" />
                  <h3 className="font-heading font-bold text-foreground text-sm mb-1.5">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-8 md:py-16 bg-background">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            {...revealSection}
          >
            <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-3">
              Ready to Start Your Investment Journey?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Schedule a free consultation with any of our advisors. No commitments, no minimum investment.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold shadow-lg">
                <Link to="/contact">
                  <Star className="w-5 h-5 mr-2 text-brand-gold" />
                  Book Free Consultation
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/open-account">Open Demat Account</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <CompanyValues />
      <FAQ
        title="Working With Our Team"
        subtitle="Questions about consultations and getting started"
        items={teamFAQs}
      />
      <Footer />
      <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default TeamPage;
