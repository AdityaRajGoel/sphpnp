import { useState, ReactNode } from "react";
import { useT } from "@/i18n/LanguageContext";
import { ExternalLink, Instagram, Phone, Mail, Facebook, ArrowUp, Twitter, Github, Shield, AlertCircle, ChevronDown, ArrowRight, BadgeCheck } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import logo80 from "@/assets/logo-80.webp";
import logo160 from "@/assets/logo-160.webp";
import { TRADING_APPS } from "@/lib/trading-apps";
import { APP_QR } from "@/components/apps/appMedia";

import { revealFade, revealItem, revealSection } from "@/lib/motion";
import { openConsentSettings } from "@/lib/consent";
import { BRANCH_EMAILS, PRIMARY_EMAIL } from "@/lib/contact";
type FooterLink = { label: string; href: string; external?: boolean; title?: string };

// Grouped as the header groups them, so a page sits in the same place in both.
const investLinks: FooterLink[] = [
  { label: "Our Services", href: "/services" },
  { label: "Open Account", href: "/open-account" },
  { label: "Pricing & Charges", href: "/pricing" },
  { label: "IPO Tracker", href: "/ipo" },
  { label: "Unlisted Shares", href: "/unlisted-space" },
  { label: "FDs & Bonds", href: "/products" },
  { label: "Depository Services", href: "/depository-services" },
  { label: "Mobile & Desktop Apps", href: "/apps" },
];

const toolLinks: FooterLink[] = [
  { label: "Market Pulse", href: "/market-pulse" },
  { label: "Indices", href: "/indices" },
  { label: "Stock Screener", href: "/screener" },
  { label: "F&O Dashboard", href: "/fno" },
  { label: "52-Week Tracker", href: "/52-week-tracker" },
  { label: "Brokerage Calculator", href: "/brokerage-calculator" },
  { label: "Margin Calculator", href: "/margin-calculator" },
  { label: "SIP Calculator", href: "/sip-calculator" },
  { label: "Holiday Calendar", href: "/holidays" },
  { label: "Reports & Downloads", href: "/reports" },
];

const companyLinks: FooterLink[] = [
  { label: "About Us", href: "/about" },
  { label: "Our Team", href: "/team" },
  { label: "Careers", href: "/careers" },
  { label: "Contact Us", href: "/contact" },
  { label: "Learning Center", href: "/learn" },
  { label: "Stock Recommendations", href: "/learn/recommendations" },
  { label: "Help & Docs", href: "/help" },
];

const importantLinks: FooterLink[] = [
  { label: "About Company", href: "https://www.parasramindia.com/about-us/", external: true },
  { label: "Research", href: "https://www.parasramindia.com/tools-and-research/", external: true },
  { label: "Investor Charter", href: "https://www.parasramindia.com/investor-charter/", external: true },
  { label: "Investor Corner", href: "/investor-corner" },
  { label: "SCORES Portal", href: "https://scores.sebi.gov.in", external: true, title: "SEBI Complaint Redressal" },
  { label: "SMART ODR", href: "https://smartodr.in/login", external: true, title: "SEBI Online Dispute Resolution" },
  { label: "NSE Investor", href: "https://www.nseindia.com/static/invest/investors-home", external: true },
  { label: "BSE Investor", href: "https://www.bseindia.com/investor.html", external: true },
  { label: "Forms & Downloads", href: "/downloads" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
  { label: "Cookie Settings", href: "#cookies" },
  { label: "Terms of Use", href: "/terms" },
  { label: "Disclaimer", href: "/disclaimer" },
  { label: "Investor Corner", href: "/investor-corner" },
  { label: "Sitemap", href: "/sitemap.xml", external: true },
  { label: "Investor Charter", href: "https://www.parasramindia.com/investor-charter/", external: true },
];

const regBadges = [
  "SEBI INZ000220838",
  "NSE · BSE Member",
  "MCX INZ000033839",
  "CDSL DP 12058200",
  "NSDL DP IN302365",
  "AMFI ARN-35616",
];

const socialLinks = [
  { href: "https://www.instagram.com/parasrampanipat/", icon: Instagram, label: "Instagram" },
  { href: "tel:+919416400314", icon: Phone, label: "Phone" },
  { href: `mailto:${PRIMARY_EMAIL}`, icon: Mail, label: "Email" },
  { href: "https://www.facebook.com/share/18B5W5rZaT/", icon: Facebook, label: "Facebook" },
  { href: "https://x.com/ParasramPanipat", icon: Twitter, label: "X" },
  // Source for this site. Not a social profile, but it shares the icon row
  // because it is the same kind of "go read more about us elsewhere" link.
  { href: "https://github.com/AdityaRajGoel/sphpnp", icon: Github, label: "Source code on GitHub" },
];

// Collapsible on mobile, always open on md+
const FooterColumn = ({
  title, open, onToggle, delay, children,
}: { title: string; open: boolean; onToggle: () => void; delay: number; children: ReactNode }) => (
  <motion.div
    {...revealSection}
    transition={{ duration: 0.5, delay }}
  >
    {/* Phones collapse the column, so the heading is a real button there; md+
        always shows it open and a button would be a tab stop that does nothing. */}
    <h4 className="font-heading font-semibold mb-4">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between text-left md:hidden">
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      <span className="hidden md:inline">{title}</span>
    </h4>
    <div className={open ? "block" : "hidden md:block"}>{children}</div>
  </motion.div>
);

const FooterLinks = ({ links }: { links: FooterLink[] }) => (
  <ul className="space-y-2 text-sm">
    {links.map((link) => (
      <li key={link.label} className="hover:translate-x-1 transition-transform">
        {link.external ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.title}
            className="text-primary-foreground/70 hover:text-secondary transition-colors inline-flex items-center gap-1"
          >
            {link.label}
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        ) : (
          <Link
            to={link.href}
            className="text-primary-foreground/70 hover:text-secondary transition-colors inline-flex items-center gap-1"
          >
            {link.label}
          </Link>
        )}
      </li>
    ))}
  </ul>
);

const Footer = () => {
  const { t } = useT();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (section: string) =>
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="bg-hero text-primary-foreground relative overflow-hidden">
      {/* A still brand rule. It was an animated green-gold loop: motion with no
          information in it, on the one part of the page people read slowly. */}
      <div className="h-0.5 bg-secondary" aria-hidden />

      {/* CTA band - the footer's conversion anchor */}
      <div className="border-b border-primary-foreground/10">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <motion.div
            className="flex flex-col md:flex-row items-center justify-between gap-4"
            {...revealItem()}
          >
            <div className="text-center md:text-left">
              <h3 className="font-heading text-xl md:text-2xl font-bold">
                Start your investment journey today
              </h3>
              <p className="text-primary-foreground/60 text-sm mt-1">
                Free Demat account · SEBI registered · Serving investors since 1970 · Real branch support in Panipat
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <a
                href="tel:+919416400314"
                className="inline-flex items-center gap-2 border border-primary-foreground/25 hover:border-secondary hover:text-secondary rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                <Phone className="w-4 h-4" /> +91 9416400314
              </a>
              <Link
                to="/open-account"
                className="inline-flex items-center gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold px-5 py-2.5 rounded-xl shadow-lg transition-transform"
              >
                {t("footer.ctaBand")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-6 md:gap-8">
          {/* Brand and branch */}
          <motion.div {...revealSection} className="lg:col-span-2 lg:pr-6">
            <img
              src={logo80}
              srcSet={`${logo80} 80w, ${logo160} 160w`}
              sizes="48px"
              alt="Parasram India - Stock Broker Since 1970"
              width={80}
              height={80}
              loading="lazy"
              className="mb-4 h-12 w-auto brightness-0 invert"
            />
            <p className="mb-5 max-w-xs text-sm text-primary-foreground/70">
              Science of Investment - your trusted partner for wealth creation since 1970.
            </p>
            <h4 className="mb-2 font-heading text-sm font-semibold">{t("footer.col.branch")}</h4>
            <address className="text-sm not-italic text-primary-foreground/70">
              Shri Parasram Holdings, Shakuntala Complex,<br />Palika Bazaar, Panipat - 132103
            </address>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href="tel:+919416400314" className="inline-flex min-h-[32px] items-center transition-colors hover:text-secondary">+91 9416400314</a>
              <a href="tel:+919999790011" className="inline-flex min-h-[32px] items-center transition-colors hover:text-secondary">+91 9999790011</a>
              <a href="tel:+919416400277" className="inline-flex min-h-[32px] items-center transition-colors hover:text-secondary">+91 9416400277</a>
              {BRANCH_EMAILS.map((e) => (
                <a key={e} href={`mailto:${e}`} className="inline-flex min-h-[32px] items-center transition-colors hover:text-secondary">{e}</a>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={item.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/10 transition-[background-color,transform] duration-fast ease-out hover:-translate-y-0.5 hover:bg-secondary"
                >
                  <item.icon className="h-4 w-4" aria-hidden />
                </a>
              ))}
            </div>
          </motion.div>

          <FooterColumn title={t("footer.col.invest")} open={!!openSections.invest} onToggle={() => toggleSection("invest")} delay={0.05}>
            <FooterLinks links={investLinks} />
          </FooterColumn>
          <FooterColumn title={t("footer.col.tools")} open={!!openSections.tools} onToggle={() => toggleSection("tools")} delay={0.1}>
            <FooterLinks links={toolLinks} />
          </FooterColumn>
          <FooterColumn title={t("footer.col.company")} open={!!openSections.company} onToggle={() => toggleSection("company")} delay={0.15}>
            <FooterLinks links={companyLinks} />
          </FooterColumn>
          <FooterColumn title={t("footer.col.important")} open={!!openSections.important} onToggle={() => toggleSection("important")} delay={0.2}>
            <FooterLinks links={importantLinks} />
          </FooterColumn>
        </div>

        {/* Apps band: a Google Play QR per app (most clients are on Android) with
            both store links; /apps has the iPhone codes and the desktop apps. */}
        <motion.div {...revealSection} className="mb-8 flex flex-col gap-5 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            {TRADING_APPS.map((app) => (
              <div key={app.id} className="flex items-center gap-3">
                <a
                  href={app.playHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Scan or tap to get ${app.name} on Google Play`}
                  className="shrink-0 rounded-lg bg-white p-1 shadow-md transition-transform"
                >
                  <img src={APP_QR[app.id].android} alt={`QR code to download ${app.name} on Google Play`} width={56} height={56} className="h-14 w-14" loading="lazy" />
                </a>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold">
                    {app.name}
                    {app.isNew && <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-px text-[9px] font-bold uppercase text-secondary-foreground">New</span>}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <a href={app.playHref} target="_blank" rel="noopener noreferrer" aria-label={`Get ${app.name} on Google Play`} className="inline-flex min-h-[32px] items-center rounded-md bg-primary-foreground/10 px-2.5 text-xs font-medium transition-colors hover:bg-secondary/30">
                      Google Play
                    </a>
                    <a href={app.iosHref} target="_blank" rel="noopener noreferrer" aria-label={`Get ${app.name} on the App Store`} className="inline-flex min-h-[32px] items-center rounded-md bg-primary-foreground/10 px-2.5 text-xs font-medium transition-colors hover:bg-secondary/30">
                      App Store
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/apps" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
            All apps, MoneyMaker desktop and TradeX API <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </motion.div>

        {/* Compliance & Grievance */}
        <motion.div
          className="border-t border-primary-foreground/15 pt-6 mb-6"
          {...revealItem()}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-primary-foreground/5 rounded-xl p-4 border border-primary-foreground/10">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-secondary" />
                <h5 className="font-semibold text-sm">Compliance Officer</h5>
              </div>
              <p className="text-primary-foreground/60 text-xs leading-relaxed">
                <strong className="text-primary-foreground/80">Mr. Vivek Sheel Aggarwal</strong><br />
                Email: <a href="mailto:compliance@sphpl.com" className="tap-area hover:text-secondary transition-colors">compliance@sphpl.com</a><br />
                Phone: <a href="tel:01147000044" className="tap-area hover:text-secondary transition-colors">011-47000044</a>, <a href="tel:+919999796260" className="tap-area hover:text-secondary transition-colors">9999796260</a> (Corporate Office)<br />
                Hours: Mon – Sat, 9AM – 6PM
              </p>
            </div>

            <div className="bg-primary-foreground/5 rounded-xl p-4 border border-primary-foreground/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-brand-gold" />
                <h5 className="font-semibold text-sm">Grievance Redressal</h5>
              </div>
              <p className="text-primary-foreground/60 text-xs leading-relaxed">
                If your grievance is not resolved within 30 days, escalate to{" "}
                <a href="https://scores.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline font-semibold">
                  SEBI SCORES
                </a>{" "}
                portal or contact the{" "}
                <a href="https://igms.irda.gov.in" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline font-semibold">
                  IRDAI IGMS
                </a>.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Registration badges */}
        <motion.div
          className="flex flex-wrap justify-center gap-2 mb-6"
          {...revealFade}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          {regBadges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary-foreground/60 bg-primary-foreground/5 border border-primary-foreground/10 rounded-full px-3 py-1.5 hover:border-secondary/40 hover:text-primary-foreground/90 transition-colors"
            >
              <BadgeCheck className="w-3 h-3 text-secondary" />
              {badge}
            </span>
          ))}
        </motion.div>

        {/* Bottom bar */}
        <div className="border-t border-primary-foreground/20 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <a
              href="https://parasramindia.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-secondary hover:underline text-sm"
            >
              Visit Main Website
              <ExternalLink className="w-4 h-4" />
            </a>
            <div className="text-center text-xs text-primary-foreground/50 max-w-3xl">
              <nav aria-label="Legal">
                <ul className="mb-2 flex flex-wrap justify-center gap-x-1 text-primary-foreground/70 [&>li+li]:before:mx-2 [&>li+li]:before:text-primary-foreground/30 [&>li+li]:before:content-['·']">
                  {LEGAL_LINKS.map((l) => (
                    <li key={l.label}>
                      {l.href === "#cookies" ? (
                        <button type="button" onClick={openConsentSettings} className="tap-area transition-colors hover:text-secondary hover:underline">{l.label}</button>
                      ) : l.external ? (
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="tap-area transition-colors hover:text-secondary hover:underline">{l.label}</a>
                      ) : (
                        <Link to={l.href} className="tap-area transition-colors hover:text-secondary hover:underline">{l.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
              <p className="text-primary-foreground/40">
                Investments in securities market are subject to market risks. Read all related documents carefully before investing.
              </p>
              <p className="mt-2">
                © {new Date().getFullYear()} Shri Parasram Holdings Pvt. Ltd. (SPHPL). All rights reserved. | Panipat Branch
              </p>
            </div>
            <button
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="w-10 h-10 bg-secondary/20 hover:bg-secondary rounded-full flex items-center justify-center text-primary-foreground transition-[color,background-color,border-color,transform] ease-out hover:-translate-y-0.5 active:scale-[0.97]"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
