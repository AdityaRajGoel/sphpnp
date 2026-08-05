// Original, India-specific educational content for the Learning Center.
// Each entry renders at /learn/:slug as a full, indexable article.
// NOTE: This is factual finance-education content - review for accuracy
// before major edits. It is not investment advice or stock recommendations.

export type LearnArticle = {
  slug: string;
  title: string;               // <title> / H1
  metaDescription: string;     // 150-160 chars
  category: "basics" | "trading" | "analysis" | "investing";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  readTime: number;            // minutes
  updated: string;             // ISO date
  keyTakeaways: string[];
  related: string[];           // slugs
  content: string;             // markdown
};

export const LEARN_ARTICLES: Record<string, LearnArticle> = {
  "demat-account": {
    slug: "demat-account",
    title: "What is a Demat Account? A Beginner's Guide for Indian Investors",
    metaDescription:
      "A Demat account holds your shares electronically. Learn how it works, documents needed, charges, and how to open a free Demat account in India in 2026.",
    category: "basics",
    difficulty: "Beginner",
    readTime: 6,
    updated: "2026-07-01",
    keyTakeaways: [
      "A Demat account holds your shares and securities in electronic form - no paper certificates.",
      "It works alongside a trading account: the trading account places orders, the Demat account stores what you buy.",
      "In India, Demat accounts are held with CDSL or NSDL through a SEBI-registered broker (Depository Participant).",
      "Opening is fully online with PAN, Aadhaar, a bank proof and a photo - and is free at Parasram India.",
    ],
    related: ["full-service-vs-discount-broker", "mutual-funds-guide", "ipo-guide"],
    content: `## What is a Demat account?

A **Demat account** (short for "dematerialised account") holds the shares, bonds, mutual funds, ETFs and other securities you own in **electronic form**. Before 1996, Indian investors received physical share certificates on paper - slow to transfer, easy to lose, and prone to forgery. Today, everything sits safely in your Demat account, just like money sits in your bank account.

## Demat vs. trading account - what's the difference?

New investors often confuse the two. You need **both**, and they work together:

| Account | What it does |
|---------|--------------|
| **Trading account** | Places buy/sell orders on the NSE and BSE |
| **Demat account** | Stores the shares you actually own |
| **Bank account** | Funds the trades and receives your money |

When you buy 10 shares of a company, your trading account executes the order and those 10 shares are **credited to your Demat account** two working days later (the T+1/T+2 settlement cycle).

## Who holds your Demat account in India?

There are two central depositories in India - **CDSL** and **NSDL** - that actually maintain the electronic records. You don't deal with them directly. Instead you open your account through a **Depository Participant (DP)** - a SEBI-registered broker like Parasram India that acts as the bridge between you and the depository.

## Documents you need to open a Demat account

- **PAN card** (mandatory)
- **Aadhaar card** (for e-KYC and mobile OTP verification)
- **Bank proof** - a cancelled cheque or recent bank statement
- **A passport-size photograph**
- **Signature** on white paper (for online KYC)

## How to open a Demat account (step by step)

1. **Fill the online form** with your name, mobile and email.
2. **Complete KYC** - upload PAN, Aadhaar and bank proof; verify via Aadhaar OTP.
3. **In-person verification (IPV)** - a short video step, done online.
4. **e-Sign** the agreement using your Aadhaar-linked mobile.
5. **Account activated** - usually within 1–2 working days.

## What charges should you know about?

- **Account opening fee** - ₹0 at Parasram India.
- **Annual Maintenance Charge (AMC)** - a small yearly fee to maintain the account.
- **Brokerage** - charged per trade (use a [brokerage calculator](/brokerage-calculator) to estimate it).
- **DP charges** - a small fee when you sell shares.

## Why a Demat account matters

Without a Demat account you simply cannot buy or hold shares, apply for IPOs, or invest in most mutual funds and bonds in India. It is the foundation of your entire investment journey - secure, paperless, and instantly accessible from your phone.

> Ready to start? You can [open a free Demat account with Parasram India](/open-account) - SEBI-registered since 1970, with a real branch in Panipat for in-person help.`,
  },

  "pe-ratio": {
    slug: "pe-ratio",
    title: "P/E Ratio Explained: How to Tell if a Stock is Cheap or Expensive",
    metaDescription:
      "The P/E ratio is the most-used stock valuation metric. Learn how to calculate it, what a good P/E is, its limits, and how Indian investors use it wisely.",
    category: "analysis",
    difficulty: "Beginner",
    readTime: 7,
    updated: "2026-07-01",
    keyTakeaways: [
      "P/E ratio = Share Price ÷ Earnings Per Share (EPS). It shows how much you pay for ₹1 of profit.",
      "A high P/E can mean an expensive stock or high growth expectations; a low P/E can mean value or hidden problems.",
      "Always compare a company's P/E to its own history and to its sector peers - never in isolation.",
      "P/E is useless for loss-making companies and can be distorted by one-off profits.",
    ],
    related: ["tax-on-share-market-income", "fno-basics", "mutual-funds-guide"],
    content: `## What is the P/E ratio?

The **Price-to-Earnings (P/E) ratio** is the single most popular way to judge whether a stock is cheaply or expensively priced. It answers a simple question: *how many rupees am I paying for every ₹1 of the company's annual profit?*

## The formula

$$P/E = \\frac{\\text{Market Price per Share}}{\\text{Earnings per Share (EPS)}}$$

For example, if a stock trades at **₹500** and its EPS is **₹25**, the P/E is:

\`\`\`
₹500 ÷ ₹25 = 20
\`\`\`

A P/E of **20** means investors are willing to pay ₹20 today for every ₹1 the company earns in a year.

## What is a "good" P/E ratio?

There's no universal magic number - it depends entirely on context:

| P/E range | Often signals |
|-----------|---------------|
| Below 15 | Potentially undervalued - or a struggling business |
| 15–25 | Fairly valued for a stable Indian large-cap |
| Above 30 | High growth expectations - or overvaluation |

A fast-growing IT or FMCG company routinely trades at a P/E of 40+, while a mature PSU bank might sit below 10. **Comparing an IT stock's P/E to a bank's tells you nothing** - you must compare like with like.

## Two ways to use P/E correctly

1. **Against its own history** - if a company usually trades at a P/E of 18 but is now at 28, ask *why*. Has growth accelerated, or is it just hype?
2. **Against sector peers** - a bank at a P/E of 12 when its peers average 18 may be a bargain (or may have a bad loan book).

## The limits of P/E - read this before you rely on it

- **Loss-making companies** have no meaningful P/E (you can't divide by negative or zero earnings).
- **One-off gains** - a company that sold a building this year shows inflated earnings and a misleadingly low P/E.
- **Debt is invisible** - two companies with the same P/E can have wildly different debt levels.
- **It's backward-looking** - trailing P/E uses last year's profit, which may not repeat.

This is why seasoned investors pair P/E with other metrics like **ROE**, **debt-to-equity**, and the **PEG ratio** (P/E adjusted for growth).

## The bottom line

The P/E ratio is a brilliant *first filter*, not a *final verdict*. Use it to shortlist stocks, then dig into the **financial statements** and business quality before investing.

> Want to screen Indian stocks by P/E instantly? Try the free [Parasram Stock Screener](/screener) with live NSE/BSE data.`,
  },

  "sip-vs-lumpsum": {
    slug: "sip-vs-lumpsum",
    title: "SIP vs Lumpsum: Which Strategy Wins in India?",
    metaDescription:
      "Should you invest via SIP or a one-time lumpsum? Compare rupee-cost averaging, risk, and returns across market cycles to choose the right strategy in India.",
    category: "investing",
    difficulty: "Beginner",
    readTime: 8,
    updated: "2026-07-01",
    keyTakeaways: [
      "A SIP invests a fixed amount at regular intervals; a lumpsum invests the whole amount at once.",
      "SIPs use rupee-cost averaging to reduce the risk of bad timing - ideal for salaried investors.",
      "Lumpsum can outperform when markets are near a bottom, but requires a large idle corpus and strong nerves.",
      "For most Indian investors building wealth from monthly income, a disciplined SIP wins on consistency.",
    ],
    related: ["mutual-funds-guide", "power-of-compounding", "tax-on-share-market-income"],
    content: `## Two ways to invest the same money

Say you have **₹1,20,000** to invest in a mutual fund this year. You have two choices:

- **Lumpsum** - invest the entire ₹1,20,000 today, in one go.
- **SIP (Systematic Investment Plan)** - invest **₹10,000 every month** for 12 months.

Both are valid. Which is better depends on market conditions and - more importantly - on *you*.

## How a SIP reduces timing risk

The magic of a SIP is **rupee-cost averaging**. Because you invest a fixed rupee amount each month, you automatically buy **more units when prices are low** and **fewer units when prices are high**:

| Month | NAV | ₹10,000 buys |
|-------|-----|--------------|
| Jan | ₹100 | 100 units |
| Feb (dip) | ₹80 | 125 units |
| Mar (rally) | ₹125 | 80 units |

Over time, your average purchase price smooths out - you never bet everything on a single day's price. This is why SIPs suit **salaried investors** who invest from monthly income and can't predict market tops or bottoms.

## When lumpsum wins

Lumpsum investing puts your full corpus to work immediately, so it captures more upside **when markets rise steadily** from the moment you invest. Historically, because markets rise more often than they fall, lumpsum *can* beat SIP over long periods - **if** you invest near a low and don't panic during dips.

The catch: lumpsum requires (a) a large amount of idle money and (b) the emotional discipline to stay invested when the market drops 20% right after you buy. Few investors have both.

## A simple decision framework

- **You earn a monthly salary** → SIP. It matches your cash flow and builds discipline.
- **You received a bonus, maturity, or windfall** → consider a **staggered lumpsum** (a "STP") - park it in a liquid fund and move it into equity over 3–6 months.
- **Markets have just crashed and you have cash** → a lumpsum can be powerful, but only invest money you won't need for 5+ years.

## The real winner: consistency

The most important factor isn't SIP vs lumpsum - it's **staying invested for the long term**. A SIP wins for most people simply because it removes emotion and keeps you investing through every market mood. Combined with the [power of compounding](/learn/power-of-compounding), a modest monthly SIP can grow into a substantial corpus over 15–20 years.

> Start a SIP from as little as ₹500/month. [Talk to Parasram India](/contact) or [open a free account](/open-account) to begin.`,
  },

  "power-of-compounding": {
    slug: "power-of-compounding",
    title: "The Power of Compounding: Why Starting Early Beats Investing More",
    metaDescription:
      "Compounding turns small, regular investments into large sums over time. Learn how it works, the Rule of 72, and why starting early matters most in India.",
    category: "investing",
    difficulty: "Beginner",
    readTime: 5,
    updated: "2026-07-01",
    keyTakeaways: [
      "Compounding means your returns start earning their own returns - growth accelerates over time.",
      "Time in the market matters more than the amount: starting 10 years earlier can double your final corpus.",
      "The Rule of 72 estimates how long money takes to double: 72 ÷ annual return %.",
      "Small monthly SIPs, left untouched for decades, can grow into crores.",
    ],
    related: ["sip-vs-lumpsum", "mutual-funds-guide", "full-service-vs-discount-broker"],
    content: `## What is compounding?

Albert Einstein reportedly called compound interest the *"eighth wonder of the world."* Whether or not he said it, the idea is powerful: **compounding is when your investment returns start generating their own returns.**

In year one you earn a return on your money. In year two you earn a return on your *original money plus year one's return*. Repeat for 20–30 years and the growth becomes exponential, not linear.

## A simple example

Invest **₹1,00,000** at a 12% annual return:

| Years | Value |
|-------|-------|
| 5 | ₹1.76 lakh |
| 10 | ₹3.11 lakh |
| 20 | ₹9.65 lakh |
| 30 | ₹29.96 lakh |

Notice how the money barely triples in the first 10 years - but grows nearly **10×** over 30 years. The last decade does the heaviest lifting. **That's why starting early is everything.**

## Starting early vs. investing more

Consider two investors:

- **Priya** starts at age 25, invests ₹5,000/month for 10 years, then stops.
- **Rahul** starts at age 35, invests ₹5,000/month for 25 years.

Even though Rahul invests **more than twice as much money over more years**, Priya often ends up with a comparable or larger corpus at 60 - purely because her money had an extra decade to compound. **Time beats amount.**

## The Rule of 72

Want a quick estimate of how long your money takes to **double**? Divide 72 by your expected annual return:

\`\`\`
72 ÷ 12% = 6 years to double
72 ÷ 8%  = 9 years to double
\`\`\`

At a 12% return, ₹1 lakh becomes ₹2 lakh in 6 years, ₹4 lakh in 12 years, ₹8 lakh in 18 years - without adding a single rupee.

## How to put compounding to work

1. **Start now** - even a small amount today beats a large amount later.
2. **Stay invested** - every withdrawal resets the compounding clock.
3. **Reinvest returns** - choose growth options over dividend payouts.
4. **Be patient** - the biggest gains come in the final years.

> A disciplined [monthly SIP](/learn/sip-vs-lumpsum) is the easiest way for most Indians to harness compounding. [Get started with Parasram India](/open-account).`,
  },

  "mutual-funds-guide": {
    slug: "mutual-funds-guide",
    title: "Mutual Funds Explained: Types, Benefits & How to Invest in India",
    metaDescription:
      "A complete beginner's guide to mutual funds in India - equity, debt, hybrid and index funds, NAV, expense ratio, SEBI categories, and how to start investing.",
    category: "basics",
    difficulty: "Beginner",
    readTime: 8,
    updated: "2026-07-01",
    keyTakeaways: [
      "A mutual fund pools money from many investors and a professional manager invests it in stocks, bonds or both.",
      "Main types: equity (growth), debt (stability), hybrid (mix) and index funds (low-cost, passive).",
      "NAV is the per-unit price; expense ratio is the annual fee - lower is better for long-term returns.",
      "Direct plans have lower fees than regular plans because they skip distributor commission.",
    ],
    related: ["sip-vs-lumpsum", "tax-on-share-market-income", "power-of-compounding"],
    content: `## What is a mutual fund?

A **mutual fund** pools money from thousands of investors and hands it to a professional **fund manager**, who invests it across a basket of stocks, bonds or other assets. When you buy a mutual fund, you own a small slice of that entire basket - instant diversification, even with just ₹500.

It's the simplest way for a beginner to invest in the market **without picking individual stocks**.

## The main types of mutual funds

| Type | Invests in | Best for |
|------|-----------|----------|
| **Equity funds** | Company shares | Long-term growth (5+ years) |
| **Debt funds** | Bonds, government securities | Stability, lower risk |
| **Hybrid funds** | Mix of equity + debt | Balanced, moderate risk |
| **Index funds** | Copy an index (e.g. Nifty 50) | Low-cost passive investing |

**Equity funds** carry the most risk but the highest long-term return potential. **Debt funds** are steadier and suit short-term goals. **Hybrid funds** balance the two. **Index funds** simply mirror an index like the Nifty 50 at very low cost - a great default for beginners.

## Key terms every investor must know

- **NAV (Net Asset Value)** - the per-unit price of the fund, updated daily. Buying at ₹100 NAV gets you 10 units for ₹1,000.
- **Expense ratio** - the annual fee the fund charges, as a % of your investment. A 0.5% ratio is excellent; 2%+ eats into long-term returns significantly.
- **AUM (Assets Under Management)** - the total money the fund manages.
- **Exit load** - a small penalty for withdrawing too soon (often within a year).

## Direct vs. regular plans - an easy way to earn more

Every mutual fund comes in two versions:

- **Regular plan** - includes a distributor's commission in the expense ratio.
- **Direct plan** - you invest directly, skipping the commission, so the expense ratio is lower.

Over 15–20 years, that seemingly small fee difference can add up to **lakhs of rupees** thanks to compounding. Direct plans are worth it if you're comfortable choosing funds yourself.

## How SEBI protects you

The Securities and Exchange Board of India (**SEBI**) strictly regulates every mutual fund - standardising categories, mandating disclosures, and capping fees. This makes Indian mutual funds one of the safest, most transparent ways to invest.

## How to start investing in mutual funds

1. **Complete your KYC** (one-time, via PAN + Aadhaar).
2. **Pick a fund** that matches your goal and risk appetite.
3. **Choose SIP or lumpsum** - a [monthly SIP](/learn/sip-vs-lumpsum) suits most beginners.
4. **Stay invested** and review once or twice a year.

> Parasram India offers direct and regular mutual funds with SIPs from ₹500/month. [Open a free account](/open-account) or [explore our services](/services).`,
  },

  "ipo-guide": {
    slug: "ipo-guide",
    title: "IPO Guide for Beginners: Process, Allotment & Listing in India",
    metaDescription:
      "Understand how IPOs work in India - DRHP, price bands, lot size, ASBA/UPI application, GMP, allotment and listing day. A clear beginner's guide for 2026.",
    category: "basics",
    difficulty: "Beginner",
    readTime: 9,
    updated: "2026-07-01",
    keyTakeaways: [
      "An IPO is when a private company sells shares to the public and lists on the NSE/BSE for the first time.",
      "You apply through your bank's ASBA/UPI - money is only blocked, not debited, until shares are allotted.",
      "Applications are in lots; oversubscribed IPOs allot via a lottery, so you may get partial or no allotment.",
      "Grey Market Premium (GMP) is an unofficial signal of demand - informative but never a guarantee.",
    ],
    related: ["how-to-buy-unlisted-shares", "demat-account", "mutual-funds-guide"],
    content: `## What is an IPO?

An **IPO (Initial Public Offering)** is the moment a private company offers its shares to the general public for the first time and gets **listed on a stock exchange** like the NSE or BSE. The company raises money to grow, and everyday investors get a chance to own a piece of it.

## The IPO journey - from filing to listing

1. **DRHP** - the company files a *Draft Red Herring Prospectus* with SEBI, disclosing its financials, risks and how it will use the money.
2. **Price band** - a range is announced (e.g. ₹100–₹105 per share). You bid within this band.
3. **Subscription window** - the IPO is open for applications, usually for **3 working days**.
4. **Allotment** - shares are allocated. If demand exceeds supply, a computerised **lottery** decides who gets them.
5. **Listing** - the stock debuts on the exchange and starts trading freely.

## Key terms you'll encounter

- **Lot size** - you can't buy a single share in an IPO; you apply in fixed *lots* (e.g. 1 lot = 100 shares).
- **ASBA / UPI** - the application method where your money is **blocked** in your bank account, not debited. It's only taken if you actually get shares.
- **GMP (Grey Market Premium)** - an unofficial, unregulated indicator of demand before listing. Useful as a *sentiment gauge*, never a promise.
- **Cut-off price** - retail investors can select this to automatically bid at the final decided price.

## How to apply for an IPO (step by step)

1. Ensure you have an active **Demat + trading account** ([here's how to open one](/learn/demat-account)).
2. Open the IPO in your broker's app or your bank's net-banking.
3. Enter the **number of lots** and your **UPI ID** (or select ASBA).
4. **Approve the mandate** on your UPI app - the amount is blocked.
5. Wait for allotment. If allotted, shares appear in your Demat account before listing day.

## Understanding allotment

When an IPO is **oversubscribed** (more applications than shares), retail investors are allotted through a lottery - you might get one lot, or none at all. Applying for more lots does **not** improve your odds in the retail category beyond a point, so bid sensibly.

## Should you invest in every IPO?

No. A listing "pop" is never guaranteed - many IPOs list flat or below their issue price. Treat an IPO like any other investment: read the DRHP, understand the business, check the valuation ([P/E ratio](/learn/pe-ratio)), and only apply if the company looks genuinely worth owning.

> Parasram India helps you apply for IPOs via UPI/ASBA. [Open a free Demat account](/open-account) to get started, or [see our services](/services).`,
  },

  "full-service-vs-discount-broker": {
    slug: "full-service-vs-discount-broker",
    title: "Full-Service vs Discount Broker in India: Which Should You Pick?",
    metaDescription:
      "Zerodha-style discount broker or a full-service broker like Parasram? Compare costs, research, support and call-to-trade to pick what fits your investing style.",
    category: "basics",
    difficulty: "Beginner",
    readTime: 7,
    updated: "2026-07-10",
    keyTakeaways: [
      "Discount brokers offer flat, low fees but little or no human support, research, or guidance.",
      "Full-service brokers charge percentage brokerage but include research, a dealer desk, branch support and personalised service.",
      "Active DIY traders often prefer discount brokers; busy professionals and first-time investors usually get more value from full-service.",
      "Many investors use both: a discount account for self-directed trades and a full-service relationship for advice and execution help.",
    ],
    related: ["demat-account", "margin-trading-facility-mtf", "tax-on-share-market-income"],
    content: `## The two broker models in India

Every stockbroker in India falls into one of two camps:

| | **Discount broker** | **Full-service broker** |
|---|---|---|
| Examples | Zerodha, Groww, Upstox | Shri Parasram Holdings, Motilal Oswal, ICICI Direct |
| Brokerage | Flat ₹0-20 per order | Percentage of trade value (e.g. 0.15% delivery) |
| Research & advice | None (DIY) | Daily research, stock recommendations, advisory |
| Order placement | App only | App **plus** dealer desk (call-to-trade) |
| Support | Chatbots, tickets | Relationship manager, branch walk-in |
| Extra services | Rare | IPO help, tax paperwork, MTF, insurance, bonds |

## When a discount broker fits

If you are comfortable researching stocks yourself, place your own orders on an app, and mainly buy and hold, a discount broker keeps costs at rock bottom. A ₹1,00,000 delivery trade costs ₹0-20 versus ~₹150 at a typical full-service rate.

## When full-service wins

The percentage brokerage buys things a flat-fee app cannot give you:

1. **A human on the phone.** A [free call-to-trade desk](/pricing) means you can run your business while your dealer executes your order - no app, no screens.
2. **Research you didn't have to do.** Daily reports, support/resistance levels and stock recommendations from SEBI-registered analysts.
3. **Someone who knows your portfolio.** Advice on rebalancing, tax-loss harvesting timing, IPO applications and paperwork.
4. **Negotiable pricing.** Full-service brokerage is rarely fixed - active clients get [custom plans](/pricing) that can approach discount-broker economics while keeping the service.

## The honest middle path

Many seasoned investors keep **both**: a discount account for high-frequency self-directed trades, and a full-service relationship for long-term holdings, guidance and the tasks an app can't do (transmission, pledging, tax paperwork).

## Cost example: the real difference

On a ₹50,000 delivery purchase:

\`\`\`
Discount broker:      ₹0-20 brokerage
Full-service (0.15%): ₹75 brokerage
Difference:           roughly the price of a coffee
\`\`\`

For occasional investors, the fee gap is small in absolute terms - what matters is whether you *use* the service layer. If you never call your broker, never read the research, and never need help, pay less. If you value your time more than ₹55 per trade, full service usually pays for itself.

> Want the service without the metro-city price tag? [See our transparent charges](/pricing) or visit the Parasram India branch at Palika Bazaar, Panipat.`,
  },

  "tax-on-share-market-income": {
    slug: "tax-on-share-market-income",
    title: "Tax on Share Market Income in India: STCG, LTCG & F&O Explained",
    metaDescription:
      "How share market income is taxed in India: 20% STCG, 12.5% LTCG above ₹1.25 lakh, F&O as business income, intraday as speculative income, plus STT and TDS.",
    category: "investing",
    difficulty: "Intermediate",
    readTime: 8,
    updated: "2026-07-10",
    keyTakeaways: [
      "Listed shares sold within 12 months attract 20% short-term capital gains tax (STCG u/s 111A).",
      "Long-term gains (held over 12 months) are taxed at 12.5% - but only on gains above ₹1.25 lakh per year.",
      "F&O profits are non-speculative business income taxed at your slab rate; intraday equity is speculative business income.",
      "Dividends are added to your income and taxed at slab; STT applies on most transactions automatically.",
    ],
    related: ["fno-basics", "pe-ratio", "full-service-vs-discount-broker"],
    content: `## The four tax buckets for market income

Indian tax law treats market income differently depending on **what** you traded and **how long** you held it. (Rates below are for FY 2025-26; always confirm with a tax professional.)

### 1. Delivery equity - capital gains

| Holding period | Tax | Notes |
|---|---|---|
| ≤ 12 months (STCG) | **20%** | Section 111A, flat rate |
| > 12 months (LTCG) | **12.5%** | Section 112A - first **₹1.25 lakh of LTCG per year is exempt** |

Example: you bought shares for ₹4,00,000 and sold after 14 months for ₹6,00,000. Gain = ₹2,00,000. Taxable LTCG = ₹2,00,000 − ₹1,25,000 = ₹75,000. Tax = ₹9,375 (plus cess).

### 2. Intraday equity - speculative business income

Buying and selling the same stock on the same day is **speculative business income**. It is added to your total income and taxed at your **slab rate**. Speculative losses can only be set off against speculative gains (carried forward 4 years).

### 3. F&O - non-speculative business income

Futures and options profits are **non-speculative business income** - also slab rate, but with useful differences:

- Losses can be set off against most other income (except salary) and carried forward **8 years**.
- Expenses (brokerage, internet, research subscriptions, advisory fees) are deductible.
- If turnover crosses limits or you declare profit below 6% of turnover, a **tax audit** may apply - this is where good record-keeping matters.

### 4. Dividends

Dividends are added to your income and taxed at your slab. Companies deduct **10% TDS** if your dividend from them exceeds ₹10,000 in a year.

## STT - the tax you pay without noticing

Securities Transaction Tax is deducted automatically on every trade:

| Transaction | STT |
|---|---|
| Equity delivery (buy & sell) | 0.1% each side |
| Equity intraday (sell side) | 0.025% |
| Futures (sell side) | 0.02% |
| Options (sell side, on premium) | 0.1% |

## Practical compliance checklist

1. **Download your P&L and capital gains statements** from your broker at year-end - these map directly to the ITR schedules.
2. Choose the right ITR form: **ITR-2** for capital gains only; **ITR-3** if you have intraday/F&O (business income).
3. Pay **advance tax** in quarterly instalments if your total tax liability exceeds ₹10,000.
4. Harvest losses before 31 March - booked losses offset gains and reduce your bill.

> Parasram India clients get help assembling capital gains statements, P&L reports and tax-filing paperwork - [one of the small tasks our branch handles](/pricing). This article is educational, not tax advice; consult a CA for your specific situation.`,
  },

  "how-to-buy-unlisted-shares": {
    slug: "how-to-buy-unlisted-shares",
    title: "How to Buy Unlisted Shares in India: Process, Risks & Taxation",
    metaDescription:
      "Step-by-step guide to buying unlisted and pre-IPO shares in India: how off-market transfers work, minimum lots, the 6-month lock-in, risks and taxation.",
    category: "investing",
    difficulty: "Intermediate",
    readTime: 7,
    updated: "2026-07-10",
    keyTakeaways: [
      "Unlisted shares are bought off-market through dealers/brokers and delivered directly to your Demat account via ISIN.",
      "Prices are negotiated, not exchange-discovered - always compare quotes and buy through a SEBI-registered intermediary.",
      "Pre-IPO shares carry a 6-month lock-in after the company lists.",
      "Held over 24 months, unlisted share gains are LTCG taxed at 12.5%; under 24 months they're taxed at your slab rate.",
    ],
    related: ["demat-account", "ipo-guide", "tax-on-share-market-income"],
    content: `## What are unlisted shares?

Unlisted shares are equity in companies that haven't (yet) listed on the NSE or BSE - think NSE itself, Tata Capital, or late-stage startups. Investors buy them hoping to enter **before** a potential IPO at a lower valuation.

## How the purchase actually works

Unlike listed stocks, there is no exchange order book. The process is an **off-market transfer**:

1. **Choose a dealer** - a broker or platform that holds or sources the shares. Work only with SEBI-registered intermediaries like [Parasram India's Unlisted Space](/unlisted-space).
2. **Get a quote** - price per share and minimum lot are negotiated, not fixed. Quotes vary between dealers, so compare.
3. **Pay and transfer** - you pay the dealer; the shares are transferred to your Demat account using the company's **ISIN** via an off-market DIS (delivery instruction slip) transaction, typically within 24-48 hours.
4. **Verify** - the holding appears in your Demat statement like any listed share.

You need an ordinary [Demat account](/learn/demat-account) - nothing special.

## The risks nobody should gloss over

- **Illiquidity** - there's no exchange to sell on. Exiting means finding a buyer (often the same dealer network) or waiting for an IPO.
- **Valuation opacity** - prices reflect dealer supply/demand, not audited market discovery. Overpaying is the most common mistake.
- **Information gaps** - unlisted companies disclose far less than listed ones.
- **Lock-in** - pre-IPO shareholders face a **6-month lock-in from the listing date**, so you cannot sell immediately after a hot IPO.
- **IPO uncertainty** - the IPO may be delayed, repriced or shelved.

A sensible allocation is a small, patient slice of your portfolio - money you won't need for years.

## How unlisted gains are taxed

| Holding period | Classification | Tax (FY 2025-26) |
|---|---|---|
| ≤ 24 months | STCG | Your slab rate |
| > 24 months | LTCG | **12.5%** |

Note the longer 24-month threshold versus 12 months for listed shares. After the company lists, the shares become listed securities and future gains follow listed-share rules.

## Why buy through a full-service broker?

The unlisted market has no SEBI order-matching protections - your counterparty **is** the trade. A registered broker gives you verified inventory, documented transfers, and a real office to walk into if anything needs fixing.

> Browse verified pre-IPO opportunities with live indicative prices at [Unlisted Space](/unlisted-space), or call the Panipat branch for current quotes.`,
  },

  "fno-basics": {
    slug: "fno-basics",
    title: "Futures and Options (F&O) Basics: A Beginner's Guide for India",
    metaDescription:
      "Understand F&O trading in India: futures and options explained, lots and expiry, SPAN margins, premiums, CE/PE, hedging vs speculation, and the risks involved.",
    category: "trading",
    difficulty: "Intermediate",
    readTime: 8,
    updated: "2026-07-10",
    keyTakeaways: [
      "Futures obligate you to buy/sell at a set price on expiry; options give you the right without the obligation.",
      "F&O trades happen in fixed lots (e.g. NIFTY = 75 units), so position sizes are large by design.",
      "Buying options risks only the premium; selling options and trading futures carry potentially unlimited risk.",
      "SEBI found 9 out of 10 individual F&O traders lose money - treat derivatives as risk-management tools first.",
    ],
    related: ["tax-on-share-market-income", "pe-ratio", "margin-trading-facility-mtf"],
    content: `## What are derivatives?

Futures and options are **contracts whose value derives from an underlying** - an index like NIFTY or a stock like Reliance. They exist for two purposes: **hedging** (insuring a portfolio) and **speculation** (betting on direction with leverage).

## Futures in 60 seconds

A futures contract locks a price today for settlement on the expiry date.

- Buy 1 lot of NIFTY futures at 24,000 → if NIFTY rises to 24,300, you gain 300 × lot size; if it falls, you lose the same way.
- You post a **margin** (SPAN + exposure, usually 10-15% of contract value) - this is the leverage, and it cuts both ways.
- Contracts expire monthly; positions are marked-to-market daily.

## Options in 60 seconds

An option is the **right, not obligation**, to buy (a **Call/CE**) or sell (a **Put/PE**) at a strike price before expiry. The buyer pays a **premium** for that right.

| You are | Max loss | Max gain |
|---|---|---|
| Option **buyer** | Premium paid | Large |
| Option **seller** | Potentially unlimited | Premium received |

Example: NIFTY at 24,000. You buy a 24,200 CE for ₹120 premium (lot 75 = ₹9,000). If NIFTY closes at 24,500, the option is worth ~₹300 → ₹22,500, a ₹13,500 profit. If NIFTY stays below 24,200, you lose the ₹9,000 - **your entire premium**.

## The vocabulary you'll meet daily

- **Lot size** - fixed quantity per contract (NIFTY 75).
- **Strike price** - the level the option references.
- **Expiry** - index options have one weekly expiry per exchange plus monthly; stock F&O is monthly.
- **OI (open interest)** - outstanding contracts; shifts in OI reveal where positions build ([see our live F&O dashboard](/fno)).
- **PCR** - put-call ratio, a sentiment gauge.

## The risk paragraph you should actually read

A SEBI study found **9 out of 10 individual traders in equity F&O incurred net losses**, averaging over a lakh per year. Leverage amplifies mistakes faster than skill develops. Sensible rules: risk a small fixed % per trade, prefer defined-risk positions (option buying/spreads) while learning, and never sell naked options with money you can't lose.

## F&O and tax

F&O income is **non-speculative business income** - see our [tax guide](/learn/tax-on-share-market-income) for how that changes your ITR.

> Check exact margins before trading with our [F&O margin calculator](/margin-calculator), and get research-backed guidance from the Parasram desk - [custom brokerage for active F&O traders](/pricing).`,
  },

  "margin-trading-facility-mtf": {
    slug: "margin-trading-facility-mtf",
    title: "What is MTF? Margin Trading Facility in India Explained Simply",
    metaDescription:
      "MTF lets you buy delivery stocks by paying part of the value while your broker funds the rest. How margins, pledging, interest and square-offs work in India.",
    category: "trading",
    difficulty: "Intermediate",
    readTime: 6,
    updated: "2026-07-10",
    keyTakeaways: [
      "MTF (Margin Trading Facility) lets you buy delivery shares by paying only part of the value; the broker funds the balance against interest.",
      "Funded shares are pledged as collateral; you keep ownership benefits like dividends.",
      "Only exchange-approved (Group-1) stocks qualify, and SEBI sets minimum margin requirements.",
      "Falling prices trigger margin calls - top up or the broker squares off. Use MTF for conviction trades, not as default leverage.",
    ],
    related: ["fno-basics", "full-service-vs-discount-broker", "demat-account"],
    content: `## MTF in one line

**Margin Trading Facility** is SEBI-regulated funding that lets you buy *delivery* shares by paying only a fraction upfront - your broker finances the rest, charging interest until you repay or sell.

## How a typical MTF trade works

1. You want ₹1,00,000 of an approved stock but deploy only ₹30,000.
2. The broker funds the remaining ₹70,000 under MTF.
3. The purchased shares are **pledged** to the broker as collateral (through the CDSL/NSDL margin-pledge system - they stay in your Demat).
4. Interest accrues daily on the funded ₹70,000 until you square off or convert to full delivery.
5. Sell whenever you like: proceeds first repay the funding + interest; the rest is yours.

## The rules that protect (and constrain) you

- **Eligible stocks only** - exchanges publish an approved (Group-1) list; speculative small-caps don't qualify.
- **Minimum margins** - SEBI mandates margin based on the stock's VaR + ELM; brokers may ask more.
- **Margin calls** - if the stock falls, your collateral value drops; you must add funds/collateral or the broker can square off the position.
- **Explicit consent** - MTF requires a one-time authorisation; positions are disclosed to exchanges daily.

## What MTF costs

Two components: **interest** on the funded amount (varies by broker and relationship) and normal brokerage/statutory charges. Because interest accrues daily, MTF suits positions with a clear thesis and time frame - not indefinite leverage.

## MTF vs F&O leverage

| | MTF | Futures |
|---|---|---|
| What you hold | Actual shares (dividends, voting) | A contract |
| Time limit | Open-ended (interest ticking) | Expiry-bound |
| Stock universe | Approved delivery list | F&O list only |
| Risk profile | Margin calls on falls | Mark-to-market daily |

MTF fits investors who want more of a stock they already believe in; [F&O](/learn/fno-basics) fits shorter, defined bets.

## When MTF makes sense - and when it doesn't

Sensible: high-conviction large-cap positions where you expect the move to outpace interest costs. Not sensible: averaging losers, chasing momentum in weak stocks, or funding money you may need on short notice.

> At Parasram India, **MTF terms and margins are structured per client** - based on your portfolio, segments and risk profile rather than a one-size sheet. [Talk to the branch](/pricing) to set up a margin relationship that fits how you invest.`,
  },
};

export const LEARN_SLUGS = Object.keys(LEARN_ARTICLES);
