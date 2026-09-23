import {
  Gauge, TrendingUp, BarChart3, PieChart, Landmark, FileText, Calculator, GitCompare, Calendar, ArrowUpDown,
  Activity, GraduationCap, Radio, Newspaper, Users, Building2, Phone, Mail, Award, ShieldCheck, Search, Flame,
  Briefcase, Globe, KeyRound, Banknote, Percent, LifeBuoy, LineChart, Star, Wallet, Smartphone, UserPlus, Rocket,
  BookOpen, History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SubItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  external?: boolean;
};

/** A titled column inside a dropdown. */
export type MenuGroup = { title: string; items: SubItem[] };

/** The card on the right of a dropdown: one thing worth a click, with a reason. */
export type MenuFeature = {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  /** Shows the Parasram Money phone screenshot. */
  showAppShot?: boolean;
};

export type MegaMenuItem = {
  label: string;
  href?: string;
  /** Green, for the two pages most visitors come for. */
  highlight?: boolean;
  groups?: MenuGroup[];
  feature?: MenuFeature;
};

export const menuLinks = (item: MegaMenuItem): SubItem[] => item.groups?.flatMap((g) => g.items) ?? [];

export const megaMenuItems: MegaMenuItem[] = [
  {
    label: "Services",
    href: "/services",
    groups: [
      {
        title: "Invest in",
        items: [
          { label: "Stocks & F&O", href: "/services", icon: Briefcase, description: "Equity, futures, options and commodities" },
          { label: "Apply for an IPO", href: "https://dashboard.parasramindia.com/Account/Login?Link=1002", icon: FileText, description: "Bid online through your account", external: true },
          { label: "Unlisted Shares", href: "/unlisted-space", icon: Flame, description: "Pre-IPO and unlisted companies" },
          { label: "Mutual Funds", href: "https://parasrammf.com/", icon: PieChart, description: "SIPs and lump sum in any fund", external: true },
          { label: "FDs & Bonds", href: "/products", icon: Building2, description: "Fixed deposits, bonds and insurance" },
          { label: "Global Exchange", href: "https://www.indiainxga.com/member/index.aspx?memberCode=100183", icon: Globe, description: "US stocks through India INX GIFT City", external: true },
        ],
      },
      {
        title: "Your account",
        items: [
          { label: "Open an Account", href: "/open-account", icon: UserPlus, description: "Free Demat and trading account" },
          { label: "Pricing & Charges", href: "/pricing", icon: Percent, description: "Brokerage and account charges" },
          { label: "Depository Services", href: "/depository-services", icon: ShieldCheck, description: "CDSL and NSDL Demat" },
          { label: "Update KYC", href: "https://dashboard.parasramindia.com/Account/Login?Link=1006", icon: KeyRound, description: "Change your details online", external: true },
          { label: "Fund Transfer", href: "https://www.parasramindia.com/fund-transfer/", icon: Banknote, description: "Add money to your trading account", external: true },
        ],
      },
    ],
    feature: {
      eyebrow: "Since 1970",
      title: "Open a free Demat account",
      body: "Zero account opening charges, a real branch in Panipat and people who pick up the phone.",
      href: "/open-account",
      cta: "Open account",
    },
  },
  {
    label: "Markets",
    href: "/market-pulse",
    groups: [
      {
        title: "Overview",
        items: [
          { label: "Market Pulse", href: "/market-pulse", icon: Gauge, description: "Valuations, FII flows and deals" },
          { label: "Indices", href: "/indices", icon: LineChart, description: "Nifty, Sensex and sector indices" },
          { label: "Reports & Downloads", href: "/reports", icon: FileText, description: "Bhavcopy, delivery and exchange data" },
        ],
      },
      {
        title: "Research",
        items: [
          { label: "Stock Screener", href: "/screener", icon: Search, description: "Filter stocks by key metrics" },
          { label: "Stock Comparison", href: "/compare", icon: GitCompare, description: "Two stocks side by side" },
          { label: "52 Week Tracker", href: "/52-week-tracker", icon: ArrowUpDown, description: "Near 52-week highs and lows" },
          { label: "F&O Dashboard", href: "/fno", icon: Activity, description: "Option chain and OI analysis" },
        ],
      },
      {
        title: "IPO",
        items: [
          { label: "IPO Tracker", href: "/ipo", icon: Landmark, description: "Dates, price bands and GMP" },
          { label: "IPO Pipeline", href: "/ipo-pipeline", icon: History, description: "Issues filed with SEBI" },
        ],
      },
    ],
    feature: {
      eyebrow: "Updated daily",
      title: "Market Pulse",
      body: "Where the market stands today: valuations, what FIIs and DIIs did, and the big deals.",
      href: "/market-pulse",
      cta: "See today's pulse",
    },
  },
  { label: "IPO", href: "/ipo", highlight: true },
  { label: "Unlisted Space", href: "/unlisted-space", highlight: true },
  {
    label: "Tools",
    href: "/brokerage-calculator",
    groups: [
      {
        title: "Calculators",
        items: [
          { label: "Brokerage Calculator", href: "/brokerage-calculator", icon: Calculator, description: "Charges and net P&L on a trade" },
          { label: "Margin Calculator", href: "/margin-calculator", icon: Wallet, description: "SPAN margin for F&O and MCX" },
          { label: "SIP Calculator", href: "/sip-calculator", icon: TrendingUp, description: "What a monthly SIP can grow to" },
        ],
      },
      {
        title: "Your lists",
        items: [
          { label: "My Watchlist", href: "/watchlist", icon: Star, description: "Stocks you are following" },
          { label: "My Portfolio", href: "/portfolio", icon: BarChart3, description: "Track your holdings" },
          { label: "Holiday Calendar", href: "/holidays", icon: Calendar, description: "NSE, BSE and MCX holidays" },
        ],
      },
      {
        title: "Trading apps",
        items: [
          { label: "Mobile & Desktop Apps", href: "/apps", icon: Smartphone, description: "Parasram Money, Trade and MoneyMaker" },
        ],
      },
    ],
    feature: {
      eyebrow: "New app",
      title: "Parasram Money",
      body: "Tradetron algo trading and instant margin pledge, on Android, iPhone and the web.",
      href: "/apps",
      cta: "Get the app",
      showAppShot: true,
    },
  },
  {
    label: "Learn",
    href: "/learn",
    groups: [
      {
        title: "Learn",
        items: [
          { label: "Learning Center", href: "/learn", icon: BookOpen, description: "Start here if you are new" },
          { label: "Articles & Guides", href: "/learn#articles", icon: GraduationCap, description: "Plain-language explainers" },
          { label: "Help & Docs", href: "/help", icon: LifeBuoy, description: "How to use the site's tools" },
        ],
      },
      {
        title: "Stay informed",
        items: [
          { label: "Stock Recommendations", href: "/learn/recommendations", icon: Rocket, description: "Picks with entry, target and stop" },
          { label: "Market News", href: "/learn#news", icon: Newspaper, description: "Business and market headlines" },
          { label: "Live TV", href: "/learn#live-tv", icon: Radio, description: "Zee Business and CNBC Awaaz" },
        ],
      },
    ],
    feature: {
      eyebrow: "Research",
      title: "Stock Recommendations",
      body: "Our analysts' calls, each with an entry price, a target and a stop-loss.",
      href: "/learn/recommendations",
      cta: "See the picks",
    },
  },
  {
    label: "About",
    href: "/about",
    groups: [
      {
        title: "Parasram",
        items: [
          { label: "Our Journey", href: "/about#timeline", icon: Award, description: "From 1970 to today" },
          { label: "Our Team", href: "/team", icon: Users, description: "The people at the Panipat branch" },
          { label: "Careers", href: "/careers", icon: Briefcase, description: "Work with us" },
        ],
      },
      {
        title: "Trust & safety",
        items: [
          { label: "Investor Corner", href: "/investor-corner", icon: ShieldCheck, description: "SEBI disclosures and grievances" },
          { label: "Contact Us", href: "/contact#contact-form", icon: Phone, description: "Call, email or message us" },
          { label: "Find the Branch", href: "/contact#map", icon: Mail, description: "Office location and hours" },
        ],
      },
    ],
    feature: {
      eyebrow: "SEBI registered",
      title: "Five decades of trust",
      body: "Shri Parasram Holdings: member of NSE, BSE and MCX, a CDSL and NSDL participant.",
      href: "/about",
      cta: "Our story",
    },
  },
  { label: "Contact", href: "/contact" },
];

const pathOf = (href: string) => href.split("#")[0];

// Deep pages that belong to a section without being listed in its menu.
const SECTION_PREFIXES: Record<string, string[]> = {
  IPO: ["/ipo"],
  Markets: ["/stock/", "/indices", "/sectors/", "/ipo-pipeline"],
  Learn: ["/learn"],
};

/**
 * The top-level item to underline for a path. A direct link wins over a menu
 * that also lists the page (/ipo is "IPO", not "Markets"), then the menu whose
 * links or section prefixes cover the path.
 */
export function activeSection(pathname: string, items: MegaMenuItem[] = megaMenuItems): string | null {
  const direct = items.find((i) => !i.groups && i.href && (pathname === i.href || (SECTION_PREFIXES[i.label] ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))));
  if (direct) return direct.label;
  for (const i of items) {
    if (!i.groups) continue;
    if (i.href && pathname === i.href) return i.label;
    if (menuLinks(i).some((l) => !l.external && pathOf(l.href) === pathname)) return i.label;
    if ((SECTION_PREFIXES[i.label] ?? []).some((p) => pathname.startsWith(p))) return i.label;
  }
  return null;
}
