import { Gauge,
  TrendingUp, BarChart3, PieChart, Landmark, FileText, Coins,
  Calculator, GitCompare, Calendar, ArrowUpDown, Activity,
  BookOpen, GraduationCap, Radio, Newspaper,
  Users, Building2, Phone, Mail, Award, ShieldCheck,
  Search, Flame, Briefcase, Globe, KeyRound, Banknote, Percent
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SubItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  external?: boolean;
};

export type MegaMenuItem = {
  label: string;
  href?: string;
  highlight?: boolean;
  subItems?: SubItem[];
};

export const megaMenuItems: MegaMenuItem[] = [
  {
    label: "Services",
    href: "/services",
    subItems: [
      { label: "All Services Overview", href: "/services", icon: Briefcase, description: "View our complete range of services" },
      { label: "Pricing & Charges", href: "/pricing", icon: Percent, description: "Brokerage rates & account charges" },
      { label: "F&O Trading", href: "/fno", icon: Activity, description: "Futures & Options dashboard" },
      { label: "Unlisted Shares", href: "/unlisted-space", icon: Flame, description: "Pre-IPO & unlisted opportunities" },
      { label: "Mutual Funds", href: "https://parasrammf.com/", icon: PieChart, description: "Invest in top-performing mutual funds", external: true },
      { label: "Fixed Deposits/Bonds", href: "/products", icon: Building2, description: "FDs, Bonds & Insurance" },
      { label: "Depository Services", href: "/depository-services", icon: ShieldCheck, description: "Demat & CDSL/NSDL" },
      { label: "Global Exchange", href: "https://www.indiainxga.com/member/index.aspx?memberCode=100183", icon: Globe, description: "Trade on international exchanges", external: true },
      { label: "Apply IPO", href: "https://dashboard.parasramindia.com/Account/Login?Link=1002", icon: FileText, description: "Apply for upcoming IPOs online", external: true },
    ],
  },
  {
    label: "Unlisted Space",
    href: "/unlisted-space",
    highlight: true,
  },
  {
    // Promoted out of the Markets dropdown to a top-level entry. IPO is one of
    // the few reasons a first-time visitor arrives at all, and a live GMP page
    // buried two levels down is a page nobody finds.
    label: "IPO",
    href: "/ipo",
    highlight: true,
  },
  {
    label: "Markets",
    href: "/screener",
    subItems: [
      { label: "Market Pulse", href: "/market-pulse", icon: Gauge, description: "Valuations, FII positions, FPI flows & deals" },
      { label: "Stock Screener", href: "/screener", icon: Search, description: "Filter stocks by key metrics" },
      { label: "Stock Comparison", href: "/compare", icon: GitCompare, description: "Compare two stocks side-by-side" },
      { label: "52 Week Tracker", href: "/52-week-tracker", icon: ArrowUpDown, description: "Stocks near 52-week highs/lows" },
      { label: "F&O Dashboard", href: "/fno", icon: Activity, description: "Live options chain & OI analysis" },
      { label: "IPO Tracker", href: "/ipo", icon: Landmark, description: "IPO dates, price bands and GMP history" },
      { label: "Reports & Downloads", href: "/reports", icon: FileText, description: "NSE/BSE/MCX bhavcopy, delivery & data" },
    ],
  },
  {
    label: "Tools",
    href: "/screener",
    subItems: [
      { label: "Margin Calculator", href: "/margin-calculator", icon: Calculator, description: "Calculate margin requirements" },
      { label: "F&O Margin Calculator", href: "https://webtrade.parasramindia.com/calculator#!/span", icon: Percent, description: "SPAN margin calculator for F&O trades", external: true },
      { label: "Brokerage Calculator", href: "/brokerage-calculator", icon: BarChart3, description: "Estimate trading charges & P&L" },
      { label: "Holiday Calendar", href: "/holidays", icon: Calendar, description: "Market holidays for 2026" },
    ],
  },
  {
    label: "Learn",
    href: "/learn",
    subItems: [
      { label: "Stock Recommendations", href: "/learn/recommendations", icon: TrendingUp, description: "Daily stock picks & analysis" },
      { label: "Articles & Guides", href: "/learn#articles", icon: GraduationCap, description: "Educational articles & tutorials" },
      { label: "Market News", href: "/learn#news", icon: Newspaper, description: "Latest business & market news" },
      { label: "Live TV", href: "/learn#live-tv", icon: Radio, description: "Zee Business & CNBC Awaaz live" },
    ],
  },
  {
    label: "About",
    href: "/about",
    subItems: [
      { label: "Our Journey", href: "/about#timeline", icon: Award, description: "Company milestones & timeline" },
      { label: "Our Team", href: "/team", icon: Users, description: "Meet the people behind Parasram Panipat" },
      { label: "Careers", href: "/careers", icon: Award, description: "Join our Panipat team" },
      { label: "Investor Corner", href: "/investor-corner", icon: ShieldCheck, description: "SEBI disclosures, advisories & grievances" },
    ],
  },
  {
    label: "Contact",
    href: "/contact",
    subItems: [
      { label: "Get in Touch", href: "/contact#contact-form", icon: Phone, description: "Call, email, or visit our office" },
      { label: "Open Account", href: "/open-account", icon: FileText, description: "Start trading in minutes" },
      { label: "Update KYC", href: "https://dashboard.parasramindia.com/Account/Login?Link=1006", icon: KeyRound, description: "Update your KYC details online", external: true },
      { label: "Fund Transfer", href: "https://www.parasramindia.com/fund-transfer/", icon: Banknote, description: "Transfer funds to your trading account", external: true },
      { label: "Find Us", href: "/contact#map", icon: Mail, description: "Office location & directions" },
    ],
  },
];
