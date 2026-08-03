import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import VisibleBreadcrumbs from "@/components/VisibleBreadcrumbs";
import PageTransition from "@/components/PageTransition";
import ScrollProgress from "@/components/ScrollProgress";
import WhatsAppButton from "@/components/WhatsAppButton";
import { motion } from "motion/react";
import {
  ShieldCheck, AlertTriangle, Scale, CheckCircle2, XCircle, Snowflake,
  ExternalLink, FileText, Landmark, Vote, MessagesSquare, KeyRound, Phone, Mail,
  Building2, Users, Banknote, Printer,
} from "lucide-react";
import { DURATION, EASE_OUT, revealSection } from "@/lib/motion";
import { useScrollSpy } from "@/hooks/useScrollSpy";

/** Anchor targets, in document order. Module scope so the observer in
 *  useScrollSpy is built once rather than on every render. */
const SECTIONS = [
  ["risk", "Derivatives Risk"],
  ["advisory", "Investor Advisory"],
  ["dos-donts", "Do's & Don'ts"],
  ["freeze", "Freeze Account"],
  ["grievance", "Grievances"],
  ["links", "Official Links"],
] as const;

const SECTION_IDS = SECTIONS.map(([id]) => id);

// SEBI-mandated standard Risk Disclosure on Derivatives (verbatim per
// SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/73 - must be displayed by brokers).
const DERIVATIVES_RISK_POINTS = [
  "9 out of 10 individual traders in the equity Futures and Options segment incurred net losses.",
  "On an average, loss makers registered net trading loss close to ₹50,000.",
  "Over and above the net trading losses incurred, loss makers expended an additional 28% of net trading losses as transaction costs.",
  "Those making net trading profits incurred between 15% to 50% of such profits as transaction cost.",
];

const DOS = [
  "Trade only through registered members of the Exchange. Check with the exchange whether the member is registered.",
  "Insist on filling up a standard 'Know Your Client (KYC)' form and on getting a client code.",
  "Insist on reading and signing the standard 'Risk Disclosure Agreement'.",
  "When trading through an authorised person, ensure a duly signed contract note is issued for every executed trade with your unique client code.",
  "Scrutinise minutely both the transaction and holding statements you receive from your Depository Participant.",
  "Read, understand and stay updated on the guidelines and circulars of the Exchange and SEBI.",
  "Be aware of your risk-taking ability and fix stop-loss limits; liquidate positions at those levels to limit losses.",
  "Collect/pay mark-to-market margins on your futures positions on a daily basis.",
  "Understand the risks and margin calls associated with margin-based positions.",
  "Go through all Rules, Bye-Laws, Regulations and circulars issued by the Exchanges and SEBI.",
  "Apply your own prudent judgement and take informed investment decisions.",
];

const DONTS = [
  "Do not start trading before reading and understanding the Risk Disclosure Agreement and entering into the prescribed agreement with the member.",
  "Do not deal with unregistered intermediaries, even if their charges or margins are lower.",
  "Do not get carried away by luring advertisements, rumours, hot tips, or promises of unrealistic returns.",
  "Do not forget to take note of the risks involved in an investment.",
  "Do not sign blank Delivery Instruction Slips (DIS) or leave them with your DP or broker to save time.",
  "Do not give or enter into cash transactions.",
  "Do not trade any product without knowing the risks and rewards associated with it.",
];

const ADVISORIES = [
  {
    title: "No guaranteed returns",
    text: "Beware of fixed / guaranteed / regular-return or capital-protection schemes. Brokers, their authorised persons, and associates are NOT authorised to offer guaranteed returns or enter into loan agreements paying interest on your funds. Claims arising from such arrangements are not accepted by the Exchange in case of a member default.",
  },
  {
    title: "Don't keep funds idle with the broker",
    text: "Your stock broker must return any credit balance within three working days if you have not traded in the last 30 calendar days. Claims for idle funds without exchange transactions are not accepted in case of a member default.",
  },
  {
    title: "Check your settlement frequency",
    text: "If you opted for a running account, ensure your broker settles it at least once in 90 days (or 30 days if opted). Claims of clients of a defaulter member are subject to Investor Protection Fund eligibility norms published on the NSE, BSE and MCX websites.",
  },
  {
    title: "Securities as margin only via margin pledge",
    text: "Brokers cannot accept transfer of securities as margin. Securities offered as collateral must remain in your account and can only be pledged to the broker through the Depository 'margin pledge' system. Brokers may take client securities only towards settlement of securities sold.",
  },
  {
    title: "Keep contact details updated",
    text: "Keep your mobile number and email updated with the broker for Exchange records. If you stop receiving Exchange/Depository messages, take it up with the broker or Exchange immediately.",
  },
  {
    title: "Verify Exchange messages",
    text: "Do not ignore emails/SMS from the Exchange about your trades. Verify them against contract notes and statements, compare weekly fund/securities balance messages, and report any discrepancy to the broker in writing - escalating to the Exchange/Depository if unresolved.",
  },
  {
    title: "Transfer funds only to a SEBI-registered broker",
    text: "Never transfer trading funds to anyone else - including an authorised person or broker associate. Abstain from unauthorised collective-investment or portfolio-management schemes promising indicative, guaranteed or fixed returns.",
  },
];

// Official firm-level documents & regulator portals (linked, not copied - these
// must always reflect the parent firm's latest published versions).
const OFFICIAL_LINKS: { label: string; desc: string; href: string; icon: typeof FileText }[] = [
  { label: "Investor Charter", desc: "Broker, NSDL & CDSL investor charters", href: "https://www.parasramindia.com/investor-charter/", icon: Scale },
  { label: "Investor Grievances / Complaints Data", desc: "Monthly complaints disclosure (PDF)", href: "https://www.parasramindia.com/wp-content/uploads/2026/05/COMPLAINTS-TRENDS-2026.pdf", icon: FileText },
  { label: "Policies & Procedures", desc: "RMS and client-dealing policies", href: "https://www.parasramindia.com/wp-content/uploads/2022/07/policy-procedure.docx", icon: FileText },
  { label: "SEBI SCORES", desc: "File a complaint with the regulator", href: "https://scores.sebi.gov.in/", icon: Landmark },
  { label: "SMART ODR", desc: "Online dispute resolution portal", href: "https://smartodr.in/login", icon: MessagesSquare },
  { label: "Collateral Segregation (NSE)", desc: "Verify your collateral with the exchange", href: "https://investorhelpline.nseindia.com/ClientCollateral/welcomeCLUser", icon: ShieldCheck },
  { label: "CDSL e-Voting", desc: "Vote on company resolutions", href: "https://evoting.cdslindia.com/Evoting/EvotingLogin", icon: Vote },
  { label: "NSDL e-Voting", desc: "Vote on company resolutions", href: "https://eservices.nsdl.com/", icon: Vote },
  { label: "Update KYC", desc: "Keep your details current online", href: "https://dashboard.parasramindia.com/Account/Login?Link=1006", icon: KeyRound },
  { label: "Fit & Proper Annexure", desc: "Contract-note annexure (PDF)", href: "https://www.parasramindia.com/wp-content/uploads/2025/06/Fit-and-Proper-Annexure-ContractNote.pdf", icon: FileText },
  { label: "Member Details", desc: "Firm & exchange registration overview", href: "https://www.parasramindia.com/member-details/", icon: Building2 },
  { label: "Basic Firm Details", desc: "Stock broker & depository participant details (PDF)", href: "https://www.parasramindia.com/wp-content/uploads/2023/11/Basic-Details-of-Stock-Broker-Depository-Participant.pdf", icon: FileText },
  { label: "Key Managerial Personnel", desc: "Details of the management team (PDF)", href: "https://www.parasramindia.com/wp-content/uploads/2023/08/Details-of-Key-Managerial-Personnel.pdf", icon: Users },
  { label: "Authorised Persons List", desc: "Current list of registered APs (PDF)", href: "https://www.parasramindia.com/wp-content/uploads/2026/03/APDETAILSASON07032026.pdf", icon: Users },
  { label: "FATCA / CRS Guidance", desc: "Foreign Account Tax Compliance guidance note (PDF)", href: "https://www.parasramindia.com/wp-content/uploads/2022/07/GuidanceNoteonFATCAandCRSMay2016.pdf", icon: FileText },
  { label: "Client Bank Account Details", desc: "Verified bank accounts for fund transfers (PDF)", href: "https://www.parasramindia.com/wp-content/uploads/2025/07/CLIENT-BANK-ACCOUNTS-2025.pdf", icon: Banknote },
];

const SectionCard = ({ id, icon: Icon, title, children }: { id: string; icon: typeof Scale; title: string; children: React.ReactNode }) => (
  <motion.section
    id={id}
    aria-labelledby={`${id}-h`}
    className="bg-card p-6 md:p-8 rounded-2xl border border-border shadow-sm scroll-mt-24"
    {...revealSection}
  >
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <h2 id={`${id}-h`} className="text-xl md:text-2xl font-heading font-bold text-foreground">{title}</h2>
    </div>
    {children}
  </motion.section>
);

/**
 * Anchor nav that tracks reading position.
 *
 * The highlight is one shared `layoutId` element rather than a background on
 * each pill, so Motion moves a single node between them. That keeps it on
 * transform — no width/left animation, no layout pass per frame — and gives
 * the page the sense of being live without costing anything on scroll.
 */
const SectionNav = () => {
  const activeId = useScrollSpy(SECTION_IDS);

  return (
    <nav aria-label="Investor corner sections" className="flex flex-wrap gap-2 mb-10">
      {SECTIONS.map(([id, label]) => {
        const isActive = activeId === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={isActive ? "true" : undefined}
            className={`relative text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors ${
              isActive
                ? "border-transparent text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-secondary/40"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="investor-nav-active"
                className="absolute inset-0 rounded-full bg-secondary/10 border border-secondary/40"
                transition={{ duration: DURATION.base, ease: [...EASE_OUT] }}
              />
            )}
            <span className="relative">{label}</span>
          </a>
        );
      })}
    </nav>
  );
};

const InvestorCornerPage = () => {
  return (
    <PageTransition>
      <SEOHead
        title="Investor Corner - Compliance & Protection | Parasram India"
        description="SEBI-mandated investor protection from Shri Parasram Holdings Panipat: derivatives risk disclosure, advisories, do's & don'ts, grievance redressal and SCORES."
        canonical="https://www.sphpnp.com/investor-corner"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Investor Corner" },
        ]}
      />
      <ScrollProgress />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <VisibleBreadcrumbs items={[{ name: "Home", url: "/" }, { name: "Investor Corner" }]} />

        <main className="flex-1 py-8 md:py-16">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="text-3xl md:text-5xl font-heading font-bold text-foreground">Investor Corner</h1>
              </div>
              <button
                onClick={() => window.print()}
                className="print:hidden shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
            </div>
            <p className="text-muted-foreground max-w-3xl mb-4">
              SEBI-mandated disclosures, investor-protection advisories and official grievance channels for clients of
              Shri Parasram Holdings Pvt. Ltd. (SEBI Reg: INZ000220838) - Panipat branch. Firm-level documents link to
              the official versions on parasramindia.com.
            </p>

            {/* Quick anchors, highlighting whichever section is on screen */}
            <SectionNav />

            <div className="space-y-8">
              {/* SEBI derivatives risk disclosure */}
              <SectionCard id="risk" icon={AlertTriangle} title="Risk Disclosure on Derivatives">
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                  <p className="text-sm font-semibold text-foreground mb-3">
                    As mandated by SEBI, every investor must note (source: SEBI study on equity F&amp;O traders):
                  </p>
                  <ul className="space-y-2.5">
                    {DERIVATIVES_RISK_POINTS.map((p, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90 leading-relaxed">
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </SectionCard>

              {/* Advisory for investors */}
              <SectionCard id="advisory" icon={ShieldCheck} title="Advisory for Investors">
                <div className="grid md:grid-cols-2 gap-4">
                  {ADVISORIES.map((a) => (
                    <div key={a.title} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <h3 className="text-sm font-bold text-foreground mb-1.5">{a.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.text}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  KYC is a one-time exercise while dealing in the securities market. Once KYC is done through a
                  SEBI-registered intermediary, you need not undergo the same process again when you approach another
                  intermediary. Prevent unauthorised transactions - keep your mobile number and email updated with your
                  broker and depository participant, and verify every alert you receive.
                </p>
              </SectionCard>

              {/* Do's and Don'ts */}
              <SectionCard id="dos-donts" icon={Scale} title="Do's & Don'ts for Investors">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-secondary uppercase tracking-wide mb-3">Do's</h3>
                    <ul className="space-y-2.5">
                      {DOS.map((d, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/85 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-destructive uppercase tracking-wide mb-3">Don'ts</h3>
                    <ul className="space-y-2.5">
                      {DONTS.map((d, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-foreground/85 leading-relaxed">
                          <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </SectionCard>

              {/* Voluntary freezing */}
              <SectionCard id="freeze" icon={Snowflake} title="Voluntary Freezing / Blocking of Trading Account">
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Per SEBI circular SEBI/HO/MIRSD/POD-1/P/CIR/2024/4 (January 12, 2024), you can voluntarily freeze,
                  block or deactivate your trading account at any time through these official firm channels:
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <a href="mailto:stoptrade@sphpl.com" className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 hover:border-secondary/40 transition-colors">
                    <Mail className="w-4 h-4 text-secondary shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">stoptrade@sphpl.com</div>
                      <div className="text-[11px] text-muted-foreground">From your registered email ID</div>
                    </div>
                  </a>
                  <a href="tel:01147000064" className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 hover:border-secondary/40 transition-colors">
                    <Phone className="w-4 h-4 text-secondary shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">011-4700-0064</div>
                      <div className="text-[11px] text-muted-foreground">From your registered mobile number</div>
                    </div>
                  </a>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  You can also freeze via the "Parasram Trade" mobile app (Important Links) or the official form on{" "}
                  <a href="https://www.parasramindia.com/voluntary-freezing-blocking-of-trading-accounts-by-clients/" target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">
                    parasramindia.com
                  </a>
                  . To reactivate, log in and use the "Reactivation of trading account" option under Update KYC.
                  Helpdesk: 011-4700-0000 (Ext 64/65/66) · kyc@sphpl.com
                </p>
              </SectionCard>

              {/* Grievance redressal */}
              <SectionCard id="grievance" icon={MessagesSquare} title="Grievance Redressal - Escalation Path">
                <ol className="space-y-3">
                  {[
                    { step: "1. Your branch / dealer", detail: "Contact the Panipat branch first: +91 94164 00314 · parasrampnp@gmail.com" },
                    { step: "2. Firm compliance desk", detail: "Escalate to Shri Parasram Holdings Pvt. Ltd.: compliance@sphpl.com · 011-4700-0000" },
                    { step: "3. Stock Exchange", detail: "NSE / BSE / MCX investor-services cell if the firm's response is unsatisfactory" },
                    { step: "4. SEBI SCORES", detail: "File on scores.sebi.gov.in - complaints are tracked and time-bound" },
                    { step: "5. SMART ODR", detail: "Online conciliation & arbitration at smartodr.in when other channels are exhausted" },
                  ].map((s) => (
                    <li key={s.step} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div className="text-sm font-bold text-foreground">{s.step}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.detail}</div>
                    </li>
                  ))}
                </ol>
              </SectionCard>

              {/* Official links */}
              <SectionCard id="links" icon={ExternalLink} title="Official Documents & Portals">
                <div className="grid sm:grid-cols-2 gap-3">
                  {OFFICIAL_LINKS.map(({ label, desc, href, icon: Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 hover:border-secondary/40 hover:bg-muted/40 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground group-hover:text-secondary transition-colors flex items-center gap-1.5">
                          {label} <ExternalLink className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                        <div className="text-[11px] text-muted-foreground">{desc}</div>
                      </div>
                    </a>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-4">
                  Firm-level documents open the official versions published by Shri Parasram Holdings Pvt. Ltd. on
                  parasramindia.com so they always reflect the latest filings.
                </p>
              </SectionCard>
            </div>
          </div>
        </main>

        <Footer />
        <WhatsAppButton />
      </div>
    </PageTransition>
  );
};

export default InvestorCornerPage;
