import type { StoryItem } from "@/components/FeatureStory";

/** The service catalogue as illustrated rows, for /services. Claims match the service pages they link to. */
export const SERVICE_STORIES: StoryItem[] = [
  {
    slug: "analyst-charts",
    eyebrow: "Stocks & equity",
    title: "Research first, then the trade",
    body: "Trade NSE and BSE shares from a free demat account, with the same research terminal our advisors use: live screener, stock pages with full financials, and daily research.",
    points: ["60+ metrics, ready-made scans and typed queries", "Financial statements, peers and checklists for every tracked stock", "Research from SEBI-registered analysts"],
    to: "/screener",
    cta: "Open the screener",
  },
  {
    slug: "mutual-funds-planning",
    eyebrow: "Mutual funds & SIP",
    title: "A SIP for every goal",
    body: "Start a SIP from ₹500 a month and give each one a purpose - education, a home, retirement. Backtest a monthly SIP on a real fund's history before you commit.",
    points: ["Direct and regular plans", "Goal-based allocation with an advisor", "SIP calculator and NAV backtest"],
    to: "/sip-calculator",
    cta: "Plan a SIP",
  },
  {
    slug: "ipo-guidance",
    eyebrow: "IPOs",
    title: "Apply for IPOs with the details in front of you",
    body: "Issue dates, price bands, subscription and a transparent record of grey-market premium, then apply through the UPI mandate or ASBA in a few taps.",
    points: ["Mainboard and SME issues", "Listing-day performance for listed issues", "The pipeline of companies that have filed with SEBI"],
    to: "/ipo",
    cta: "See current IPOs",
  },
  {
    slug: "derivatives-desk",
    eyebrow: "Futures & options",
    title: "Trade derivatives with the chain in view",
    body: "NIFTY, BANKNIFTY and stock F&O with a live option chain, Put-Call Ratio, Max Pain and open-interest build-up, plus a margin calculator with current lot sizes.",
    points: ["Live option chain and positioning", "Margin and brokerage calculators", "Risk support from our desk"],
    to: "/fno",
    cta: "Open the F&O dashboard",
  },
  {
    slug: "demat-network",
    eyebrow: "Demat & depository",
    title: "Your securities, held safely",
    body: "A demat account with CDSL and NSDL depository services: hold, transfer and pledge shares electronically, with statements you can check any time.",
    points: ["Free account opening", "Pledging and transfers", "Depository participant services in Panipat"],
    to: "/depository-services",
    cta: "Depository services",
  },
  {
    slug: "insurance-family",
    eyebrow: "FDs, bonds & insurance",
    title: "Protection and steady income beside equity",
    body: "Round out a portfolio with high-rated fixed deposits, corporate bonds and insurance cover for health, life and assets - chosen with an advisor, not sold off a shelf.",
    points: ["Top-rated FDs and bonds", "Life, health and general insurance", "Claim support"],
    to: "/products",
    cta: "Explore products",
  },
];

/** Three rows for the home page: how the branch helps, beyond the tools. */
export const HOME_STORIES: StoryItem[] = [
  {
    slug: "advisor-consultation",
    eyebrow: "Personal advice",
    title: "An advisor who knows your goals, down the road in Panipat",
    body: "Sit down with our team to plan a portfolio across equity, funds, IPOs and fixed income - and come back whenever the market or your life changes.",
    points: ["Face-to-face consultations", "Research-backed recommendations", "On-ground support for every query"],
    to: "/contact#contact-form",
    cta: "Talk to an advisor",
  },
  {
    slug: "ipo-journey",
    eyebrow: "IPOs made simple",
    title: "From the offer document to allotment",
    body: "Read the issue details, authorise through UPI and track your application - with dates, price bands and subscription tracked for every current IPO.",
    to: "/ipo",
    cta: "Browse IPOs",
  },
  {
    slug: "market-bridge",
    eyebrow: "Unlisted & pre-IPO",
    title: "Invest before the listing bell",
    body: "Buy verified pre-IPO and unlisted shares of well-known Indian companies, starting from a single share, with transfer handled for you.",
    to: "/unlisted-space",
    cta: "View unlisted shares",
  },
];
