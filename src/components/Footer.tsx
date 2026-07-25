import { useState, ReactNode } from "react";
import { useT } from "@/i18n/LanguageContext";
import { ExternalLink, Instagram, Phone, Mail, Facebook, ArrowUp, Twitter, Shield, AlertCircle, ChevronDown, ArrowRight, BadgeCheck } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import logo80 from "@/assets/logo-80.webp";
import logo160 from "@/assets/logo-160.webp";
import appQr from "@/assets/app-qr.svg";

type FooterLink = { label: string; href: string; external?: boolean; title?: string };

const companyLinks: FooterLink[] = [
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Unlisted Shares", href: "/unlisted-space" },
  { label: "Products & FDs", href: "/products" },
  { label: "Depository Services", href: "/depository-services" },
  { label: "Our Team", href: "/team" },
  { label: "Careers", href: "/careers" },
  { label: "Contact Us", href: "/contact" },
  { label: "Open Account", href: "/open-account" },
  { label: "Pricing & Charges", href: "/pricing" },
];

const toolLinks: FooterLink[] = [
  { label: "Stock Screener", href: "/screener" },
  { label: "52-Week Tracker", href: "/52-week-tracker" },
  { label: "F&O Dashboard", href: "/fno" },
  { label: "Stock Comparison", href: "/compare" },
  { label: "Learning Center", href: "/learn" },
  { label: "Stock Recommendations", href: "/learn/recommendations" },
  { label: "Margin Calculator", href: "/margin-calculator" },
  { label: "Brokerage Calculator", href: "/brokerage-calculator" },
  { label: "Holiday Calendar", href: "/holidays" },
  { label: "Reports & Downloads", href: "/reports" },
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
  { label: "Useful Downloads", href: "https://www.parasramindia.com/software-setups/", external: true },
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
  { href: "mailto:parasrampnp@gmail.com", icon: Mail, label: "Email" },
  { href: "https://www.facebook.com/share/18B5W5rZaT/", icon: Facebook, label: "Facebook" },
  { href: "https://x.com/ParasramPanipat", icon: Twitter, label: "X" },
];

// Collapsible on mobile, always open on md+
const FooterColumn = ({
  title, open, onToggle, delay, children,
}: { title: string; open: boolean; onToggle: () => void; delay: number; children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay }}
  >
    <h4
      className="font-heading font-semibold mb-4 flex justify-between items-center cursor-pointer md:cursor-default"
      onClick={onToggle}
    >
      {title}
      <ChevronDown className={`w-4 h-4 md:hidden transition-transform ${open ? "rotate-180" : ""}`} />
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
      {/* Animated top border */}
      <div
        className="h-1 bg-gradient-to-r from-secondary via-brand-gold to-secondary"
        style={{ backgroundSize: "200% 100%", animation: "ticker-left 6s linear infinite alternate" }}
      />

      {/* CTA band - the footer's conversion anchor */}
      <div className="border-b border-primary-foreground/10">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <motion.div
            className="flex flex-col md:flex-row items-center justify-between gap-4"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center md:text-left">
              <h3 className="font-heading text-xl md:text-2xl font-bold">
                Start your investment journey <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-brand-gold">today</span>
              </h3>
              <p className="text-primary-foreground/60 text-sm mt-1">
                Free Demat account · SEBI registered since 1970 · Real branch support in Panipat
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
                className="inline-flex items-center gap-2 btn-shine bg-gradient-to-r from-secondary to-brand-green text-secondary-foreground font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-secondary/20 hover:scale-[1.03] transition-transform"
              >
                {t("footer.ctaBand")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Main 5-column grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-10">
          {/* Column 1 - Brand */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <motion.img
              src={logo80}
              srcSet={`${logo80} 80w, ${logo160} 160w`}
              sizes="48px"
              alt="Parasram India - Stock Broker Since 1970"
              width={80}
              height={80}
              className="h-12 w-auto mb-4 brightness-0 invert"
              whileHover={{ scale: 1.05 }}
            />
            <p className="text-primary-foreground/70 text-sm mb-4">
              Science of Investment - Your trusted partner for wealth creation since 1970.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  aria-label={item.label}
                  className="w-9 h-9 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-secondary hover:scale-110 hover:-translate-y-1 transition-[color,background-color,border-color,transform] ease-out"
                >
                  <item.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </motion.div>

          <FooterColumn title={t("footer.col.company")} open={!!openSections.company} onToggle={() => toggleSection("company")} delay={0.1}>
            <FooterLinks links={companyLinks} />
          </FooterColumn>

          <FooterColumn title={t("footer.col.tools")} open={!!openSections.tools} onToggle={() => toggleSection("tools")} delay={0.15}>
            <FooterLinks links={toolLinks} />
          </FooterColumn>

          <FooterColumn title={t("footer.col.important")} open={!!openSections.important} onToggle={() => toggleSection("important")} delay={0.2}>
            <FooterLinks links={importantLinks} />
          </FooterColumn>

          <FooterColumn title={t("footer.col.branch")} open={!!openSections.branch} onToggle={() => toggleSection("branch")} delay={0.25}>
            <div className="text-sm">
              <p className="text-primary-foreground/70 mb-3">
                Shri Parasram Holdings<br />
                Shakuntala Complex, Palika Bazaar<br />
                Panipat - 132103
              </p>
              <div className="flex flex-col gap-1 mb-3">
                <a href="tel:+919416400314" className="hover:text-secondary transition-colors py-1 inline-flex items-center min-h-[36px]">+91 9416400314</a>
                <a href="tel:+919999790011" className="hover:text-secondary transition-colors py-1 inline-flex items-center min-h-[36px]">+91 9999790011</a>
                <a href="tel:+919416400277" className="hover:text-secondary transition-colors py-1 inline-flex items-center min-h-[36px]">+91 9416400277</a>
              </div>
              <p className="text-primary-foreground/70 mb-4">
                <a href="mailto:parasrampnp@gmail.com" className="hover:text-secondary transition-colors">parasrampnp@gmail.com</a>
              </p>

              {/* App download with scannable QR (parent-site pattern) */}
              <div className="flex items-center gap-3">
                <a
                  href="https://play.google.com/store/apps/details?id=com.parasramindia.xts"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Scan or tap to download the Parasram Trade app on Google Play"
                  className="shrink-0 bg-white rounded-lg p-1.5 hover:scale-105 transition-transform shadow-md"
                >
                  <img src={appQr} alt="QR code - download the Parasram Trade app" width={64} height={64} className="w-16 h-16" loading="lazy" />
                </a>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold text-primary-foreground/80">Scan for Parasram Trade</span>
                  <div className="flex gap-1.5 flex-wrap">
                    <a
                      href="https://play.google.com/store/apps/details?id=com.parasramindia.xts"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center bg-primary-foreground/10 hover:bg-secondary/30 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-[color,background-color,border-color,transform] ease-out hover:scale-105"
                    >
                      Google Play
                    </a>
                    <a
                      href="https://apps.apple.com/us/app/parasram-trade/id1564728869"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center bg-primary-foreground/10 hover:bg-secondary/30 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-[color,background-color,border-color,transform] ease-out hover:scale-105"
                    >
                      App Store
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </FooterColumn>
        </div>

        {/* Compliance & Grievance */}
        <motion.div
          className="border-t border-primary-foreground/15 pt-6 mb-6"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
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
              <p className="mb-2 text-primary-foreground/70">
                <Link to="/privacy-policy" className="tap-area hover:text-secondary hover:underline transition-colors">Privacy Policy</Link>
                <span className="mx-2">|</span>
                <Link to="/cookie-policy" className="tap-area hover:text-secondary hover:underline transition-colors">Cookie Policy</Link>
                <span className="mx-2">|</span>
                <Link to="/terms" className="tap-area hover:text-secondary hover:underline transition-colors">Terms of Use</Link>
                <span className="mx-2">|</span>
                <Link to="/disclaimer" className="tap-area hover:text-secondary hover:underline transition-colors">Disclaimer</Link>
                <span className="mx-2">|</span>
                <Link to="/investor-corner" className="hover:text-secondary hover:underline transition-colors">Investor Corner</Link>
                <span className="mx-2">|</span>
                <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer" className="hover:text-secondary hover:underline transition-colors">Sitemap</a>
                <span className="mx-2">|</span>
                <a href="https://www.parasramindia.com/investor-charter/" target="_blank" rel="noopener noreferrer" className="hover:text-secondary hover:underline transition-colors">Investor Charter</a>
              </p>
              <p className="text-primary-foreground/40">
                Investments in securities market are subject to market risks. Read all related documents carefully before investing.
              </p>
              <p className="mt-2">
                © {new Date().getFullYear()} Parasram India Pvt. Ltd. All rights reserved. | Panipat Branch
              </p>
            </div>
            <button
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="w-10 h-10 bg-secondary/20 hover:bg-secondary rounded-full flex items-center justify-center text-primary-foreground transition-[color,background-color,border-color,transform] ease-out hover:scale-110 hover:-translate-y-1 active:scale-[0.97]"
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
