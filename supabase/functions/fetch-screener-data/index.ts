import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildStockRow, groupRowsByShape } from "../_shared/screener-row.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ~200 major NSE stocks across sectors
const NSE_SYMBOLS: { symbol: string; yahoo: string; name: string; sector: string }[] = [
  // Banking & Finance
  { symbol: "HDFCBANK", yahoo: "HDFCBANK.NS", name: "HDFC Bank", sector: "Banking" },
  { symbol: "ICICIBANK", yahoo: "ICICIBANK.NS", name: "ICICI Bank", sector: "Banking" },
  { symbol: "SBIN", yahoo: "SBIN.NS", name: "State Bank of India", sector: "Banking" },
  { symbol: "KOTAKBANK", yahoo: "KOTAKBANK.NS", name: "Kotak Mahindra Bank", sector: "Banking" },
  { symbol: "AXISBANK", yahoo: "AXISBANK.NS", name: "Axis Bank", sector: "Banking" },
  { symbol: "INDUSINDBK", yahoo: "INDUSINDBK.NS", name: "IndusInd Bank", sector: "Banking" },
  { symbol: "BANKBARODA", yahoo: "BANKBARODA.NS", name: "Bank of Baroda", sector: "Banking" },
  { symbol: "PNB", yahoo: "PNB.NS", name: "Punjab National Bank", sector: "Banking" },
  { symbol: "FEDERALBNK", yahoo: "FEDERALBNK.NS", name: "Federal Bank", sector: "Banking" },
  { symbol: "IDFCFIRSTB", yahoo: "IDFCFIRSTB.NS", name: "IDFC First Bank", sector: "Banking" },
  { symbol: "AUBANK", yahoo: "AUBANK.NS", name: "AU Small Finance Bank", sector: "Banking" },
  { symbol: "BANDHANBNK", yahoo: "BANDHANBNK.NS", name: "Bandhan Bank", sector: "Banking" },
  { symbol: "CANBK", yahoo: "CANBK.NS", name: "Canara Bank", sector: "Banking" },
  { symbol: "UNIONBANK", yahoo: "UNIONBANK.NS", name: "Union Bank of India", sector: "Banking" },

  // NBFC
  { symbol: "BAJFINANCE", yahoo: "BAJFINANCE.NS", name: "Bajaj Finance", sector: "NBFC" },
  { symbol: "BAJAJFINSV", yahoo: "BAJAJFINSV.NS", name: "Bajaj Finserv", sector: "NBFC" },
  { symbol: "CHOLAFIN", yahoo: "CHOLAFIN.NS", name: "Cholamandalam Investment", sector: "NBFC" },
  { symbol: "MUTHOOTFIN", yahoo: "MUTHOOTFIN.NS", name: "Muthoot Finance", sector: "NBFC" },
  { symbol: "SHRIRAMFIN", yahoo: "SHRIRAMFIN.NS", name: "Shriram Finance", sector: "NBFC" },
  { symbol: "M&MFIN", yahoo: "M&MFIN.NS", name: "Mahindra & Mahindra Financial", sector: "NBFC" },
  { symbol: "POONAWALLA", yahoo: "POONAWALLA.NS", name: "Poonawalla Fincorp", sector: "NBFC" },

  // IT
  { symbol: "TCS", yahoo: "TCS.NS", name: "Tata Consultancy Services", sector: "IT" },
  { symbol: "INFY", yahoo: "INFY.NS", name: "Infosys", sector: "IT" },
  { symbol: "HCLTECH", yahoo: "HCLTECH.NS", name: "HCL Technologies", sector: "IT" },
  { symbol: "WIPRO", yahoo: "WIPRO.NS", name: "Wipro", sector: "IT" },
  { symbol: "TECHM", yahoo: "TECHM.NS", name: "Tech Mahindra", sector: "IT" },
  { symbol: "LTIM", yahoo: "LTIM.NS", name: "LTIMindtree", sector: "IT" },
  { symbol: "PERSISTENT", yahoo: "PERSISTENT.NS", name: "Persistent Systems", sector: "IT" },
  { symbol: "COFORGE", yahoo: "COFORGE.NS", name: "Coforge", sector: "IT" },
  { symbol: "MPHASIS", yahoo: "MPHASIS.NS", name: "Mphasis", sector: "IT" },
  { symbol: "LTTS", yahoo: "LTTS.NS", name: "L&T Technology Services", sector: "IT" },

  // Energy
  { symbol: "RELIANCE", yahoo: "RELIANCE.NS", name: "Reliance Industries", sector: "Energy" },
  { symbol: "ONGC", yahoo: "ONGC.NS", name: "Oil & Natural Gas Corp", sector: "Energy" },
  { symbol: "IOC", yahoo: "IOC.NS", name: "Indian Oil Corp", sector: "Energy" },
  { symbol: "BPCL", yahoo: "BPCL.NS", name: "Bharat Petroleum", sector: "Energy" },
  { symbol: "GAIL", yahoo: "GAIL.NS", name: "GAIL India", sector: "Energy" },
  { symbol: "NTPC", yahoo: "NTPC.NS", name: "NTPC", sector: "Energy" },
  { symbol: "POWERGRID", yahoo: "POWERGRID.NS", name: "Power Grid Corp", sector: "Energy" },
  { symbol: "ADANIGREEN", yahoo: "ADANIGREEN.NS", name: "Adani Green Energy", sector: "Energy" },
  { symbol: "TATAPOWER", yahoo: "TATAPOWER.NS", name: "Tata Power", sector: "Energy" },
  { symbol: "ADANIPOWER", yahoo: "ADANIPOWER.NS", name: "Adani Power", sector: "Energy" },
  { symbol: "NHPC", yahoo: "NHPC.NS", name: "NHPC", sector: "Energy" },
  { symbol: "COALINDIA", yahoo: "COALINDIA.NS", name: "Coal India", sector: "Energy" },
  { symbol: "PETRONET", yahoo: "PETRONET.NS", name: "Petronet LNG", sector: "Energy" },

  // Automobiles
  { symbol: "MARUTI", yahoo: "MARUTI.NS", name: "Maruti Suzuki", sector: "Auto" },
  { symbol: "TATAMOTORS", yahoo: "TATAMOTORS.NS", name: "Tata Motors", sector: "Auto" },
  { symbol: "M&M", yahoo: "M&M.NS", name: "Mahindra & Mahindra", sector: "Auto" },
  { symbol: "BAJAJ-AUTO", yahoo: "BAJAJ-AUTO.NS", name: "Bajaj Auto", sector: "Auto" },
  { symbol: "HEROMOTOCO", yahoo: "HEROMOTOCO.NS", name: "Hero MotoCorp", sector: "Auto" },
  { symbol: "EICHERMOT", yahoo: "EICHERMOT.NS", name: "Eicher Motors", sector: "Auto" },
  { symbol: "ASHOKLEY", yahoo: "ASHOKLEY.NS", name: "Ashok Leyland", sector: "Auto" },
  { symbol: "TVSMOTOR", yahoo: "TVSMOTOR.NS", name: "TVS Motor", sector: "Auto" },
  { symbol: "BALKRISIND", yahoo: "BALKRISIND.NS", name: "Balkrishna Industries", sector: "Auto" },
  { symbol: "MOTHERSON", yahoo: "MOTHERSON.NS", name: "Motherson Sumi", sector: "Auto" },

  // Pharma & Healthcare
  { symbol: "SUNPHARMA", yahoo: "SUNPHARMA.NS", name: "Sun Pharma", sector: "Pharma" },
  { symbol: "DRREDDY", yahoo: "DRREDDY.NS", name: "Dr. Reddy's Labs", sector: "Pharma" },
  { symbol: "CIPLA", yahoo: "CIPLA.NS", name: "Cipla", sector: "Pharma" },
  { symbol: "DIVISLAB", yahoo: "DIVISLAB.NS", name: "Divi's Laboratories", sector: "Pharma" },
  { symbol: "APOLLOHOSP", yahoo: "APOLLOHOSP.NS", name: "Apollo Hospitals", sector: "Pharma" },
  { symbol: "TORNTPHARM", yahoo: "TORNTPHARM.NS", name: "Torrent Pharma", sector: "Pharma" },
  { symbol: "LUPIN", yahoo: "LUPIN.NS", name: "Lupin", sector: "Pharma" },
  { symbol: "AUROPHARMA", yahoo: "AUROPHARMA.NS", name: "Aurobindo Pharma", sector: "Pharma" },
  { symbol: "BIOCON", yahoo: "BIOCON.NS", name: "Biocon", sector: "Pharma" },
  { symbol: "MAXHEALTH", yahoo: "MAXHEALTH.NS", name: "Max Healthcare", sector: "Pharma" },
  { symbol: "ZYDUSLIFE", yahoo: "ZYDUSLIFE.NS", name: "Zydus Lifesciences", sector: "Pharma" },
  { symbol: "ALKEM", yahoo: "ALKEM.NS", name: "Alkem Laboratories", sector: "Pharma" },

  // FMCG
  { symbol: "HINDUNILVR", yahoo: "HINDUNILVR.NS", name: "Hindustan Unilever", sector: "FMCG" },
  { symbol: "ITC", yahoo: "ITC.NS", name: "ITC", sector: "FMCG" },
  { symbol: "NESTLEIND", yahoo: "NESTLEIND.NS", name: "Nestle India", sector: "FMCG" },
  { symbol: "BRITANNIA", yahoo: "BRITANNIA.NS", name: "Britannia Industries", sector: "FMCG" },
  { symbol: "DABUR", yahoo: "DABUR.NS", name: "Dabur India", sector: "FMCG" },
  { symbol: "MARICO", yahoo: "MARICO.NS", name: "Marico", sector: "FMCG" },
  { symbol: "GODREJCP", yahoo: "GODREJCP.NS", name: "Godrej Consumer Products", sector: "FMCG" },
  { symbol: "COLPAL", yahoo: "COLPAL.NS", name: "Colgate-Palmolive", sector: "FMCG" },
  { symbol: "TATACONSUM", yahoo: "TATACONSUM.NS", name: "Tata Consumer Products", sector: "FMCG" },
  { symbol: "PGHH", yahoo: "PGHH.NS", name: "Procter & Gamble Hygiene", sector: "FMCG" },
  { symbol: "UBL", yahoo: "UBL.NS", name: "United Breweries", sector: "FMCG" },
  { symbol: "VBL", yahoo: "VBL.NS", name: "Varun Beverages", sector: "FMCG" },

  // Metals & Mining
  { symbol: "TATASTEEL", yahoo: "TATASTEEL.NS", name: "Tata Steel", sector: "Metals" },
  { symbol: "JSWSTEEL", yahoo: "JSWSTEEL.NS", name: "JSW Steel", sector: "Metals" },
  { symbol: "HINDALCO", yahoo: "HINDALCO.NS", name: "Hindalco Industries", sector: "Metals" },
  { symbol: "VEDL", yahoo: "VEDL.NS", name: "Vedanta", sector: "Metals" },
  { symbol: "NMDC", yahoo: "NMDC.NS", name: "NMDC", sector: "Metals" },
  { symbol: "SAIL", yahoo: "SAIL.NS", name: "Steel Authority of India", sector: "Metals" },
  { symbol: "JINDALSTEL", yahoo: "JINDALSTEL.NS", name: "Jindal Steel & Power", sector: "Metals" },
  { symbol: "NATIONALUM", yahoo: "NATIONALUM.NS", name: "National Aluminium", sector: "Metals" },

  // Infra & Construction
  { symbol: "LT", yahoo: "LT.NS", name: "Larsen & Toubro", sector: "Infra" },
  { symbol: "ADANIENT", yahoo: "ADANIENT.NS", name: "Adani Enterprises", sector: "Infra" },
  { symbol: "ADANIPORTS", yahoo: "ADANIPORTS.NS", name: "Adani Ports", sector: "Infra" },
  { symbol: "ULTRACEMCO", yahoo: "ULTRACEMCO.NS", name: "UltraTech Cement", sector: "Infra" },
  { symbol: "GRASIM", yahoo: "GRASIM.NS", name: "Grasim Industries", sector: "Infra" },
  { symbol: "SHREECEM", yahoo: "SHREECEM.NS", name: "Shree Cement", sector: "Infra" },
  { symbol: "AMBUJACEM", yahoo: "AMBUJACEM.NS", name: "Ambuja Cements", sector: "Infra" },
  { symbol: "ACC", yahoo: "ACC.NS", name: "ACC Cement", sector: "Infra" },
  { symbol: "DLF", yahoo: "DLF.NS", name: "DLF", sector: "Infra" },
  { symbol: "GODREJPROP", yahoo: "GODREJPROP.NS", name: "Godrej Properties", sector: "Infra" },
  { symbol: "OBEROIRLTY", yahoo: "OBEROIRLTY.NS", name: "Oberoi Realty", sector: "Infra" },
  { symbol: "IRCTC", yahoo: "IRCTC.NS", name: "IRCTC", sector: "Infra" },

  // Telecom & Media
  { symbol: "BHARTIARTL", yahoo: "BHARTIARTL.NS", name: "Bharti Airtel", sector: "Telecom" },
  { symbol: "IDEA", yahoo: "IDEA.NS", name: "Vodafone Idea", sector: "Telecom" },
  { symbol: "ZEEL", yahoo: "ZEEL.NS", name: "Zee Entertainment", sector: "Telecom" },
  { symbol: "DELHIVERY", yahoo: "DELHIVERY.NS", name: "Delhivery", sector: "Telecom" },

  // Insurance
  { symbol: "SBILIFE", yahoo: "SBILIFE.NS", name: "SBI Life Insurance", sector: "Insurance" },
  { symbol: "HDFCLIFE", yahoo: "HDFCLIFE.NS", name: "HDFC Life Insurance", sector: "Insurance" },
  { symbol: "ICICIPRULI", yahoo: "ICICIPRULI.NS", name: "ICICI Prudential Life", sector: "Insurance" },
  { symbol: "ICICIGI", yahoo: "ICICIGI.NS", name: "ICICI Lombard GIC", sector: "Insurance" },
  { symbol: "NIACL", yahoo: "NIACL.NS", name: "New India Assurance", sector: "Insurance" },
  { symbol: "STARHEALTH", yahoo: "STARHEALTH.NS", name: "Star Health Insurance", sector: "Insurance" },

  // Chemicals
  { symbol: "PIDILITIND", yahoo: "PIDILITIND.NS", name: "Pidilite Industries", sector: "Chemicals" },
  { symbol: "SOLARINDS", yahoo: "SOLARINDS.NS", name: "Solar Industries", sector: "Chemicals" },
  { symbol: "SRF", yahoo: "SRF.NS", name: "SRF Ltd", sector: "Chemicals" },
  { symbol: "UPL", yahoo: "UPL.NS", name: "UPL", sector: "Chemicals" },
  { symbol: "ATUL", yahoo: "ATUL.NS", name: "Atul Ltd", sector: "Chemicals" },
  { symbol: "DEEPAKNTR", yahoo: "DEEPAKNTR.NS", name: "Deepak Nitrite", sector: "Chemicals" },

  // Consumer Durables
  { symbol: "TITAN", yahoo: "TITAN.NS", name: "Titan Company", sector: "Consumer" },
  { symbol: "HAVELLS", yahoo: "HAVELLS.NS", name: "Havells India", sector: "Consumer" },
  { symbol: "VOLTAS", yahoo: "VOLTAS.NS", name: "Voltas", sector: "Consumer" },
  { symbol: "WHIRLPOOL", yahoo: "WHIRLPOOL.NS", name: "Whirlpool of India", sector: "Consumer" },
  { symbol: "CROMPTON", yahoo: "CROMPTON.NS", name: "Crompton Greaves", sector: "Consumer" },
  { symbol: "PAGEIND", yahoo: "PAGEIND.NS", name: "Page Industries", sector: "Consumer" },
  { symbol: "TRENT", yahoo: "TRENT.NS", name: "Trent", sector: "Consumer" },
  { symbol: "DMART", yahoo: "DMART.NS", name: "Avenue Supermarts", sector: "Consumer" },

  // Defence & PSU
  { symbol: "HAL", yahoo: "HAL.NS", name: "Hindustan Aeronautics", sector: "Defence" },
  { symbol: "BEL", yahoo: "BEL.NS", name: "Bharat Electronics", sector: "Defence" },
  { symbol: "BHEL", yahoo: "BHEL.NS", name: "Bharat Heavy Electricals", sector: "Defence" },
  { symbol: "IRFC", yahoo: "IRFC.NS", name: "Indian Railway Finance", sector: "Defence" },
  { symbol: "RECLTD", yahoo: "RECLTD.NS", name: "REC Ltd", sector: "Defence" },
  { symbol: "PFC", yahoo: "PFC.NS", name: "Power Finance Corp", sector: "Defence" },
  { symbol: "CONCOR", yahoo: "CONCOR.NS", name: "Container Corp", sector: "Defence" },

  // Tech / New Age
  { symbol: "ZOMATO", yahoo: "ZOMATO.NS", name: "Zomato", sector: "Tech" },
  { symbol: "PAYTM", yahoo: "PAYTM.NS", name: "One97 Communications", sector: "Tech" },
  { symbol: "NYKAA", yahoo: "NYKAA.NS", name: "FSN E-Commerce", sector: "Tech" },
  { symbol: "POLICYBZR", yahoo: "POLICYBZR.NS", name: "PB Fintech", sector: "Tech" },
  { symbol: "INDIGRID", yahoo: "INDIGRID.NS", name: "India Grid Trust", sector: "Tech" },

  // Diversified / Others
  { symbol: "ASIANPAINT", yahoo: "ASIANPAINT.NS", name: "Asian Paints", sector: "Diversified" },
  { symbol: "BERGEPAINT", yahoo: "BERGEPAINT.NS", name: "Berger Paints", sector: "Diversified" },
  { symbol: "SIEMENS", yahoo: "SIEMENS.NS", name: "Siemens India", sector: "Diversified" },
  { symbol: "ABB", yahoo: "ABB.NS", name: "ABB India", sector: "Diversified" },
  { symbol: "CUMMINSIND", yahoo: "CUMMINSIND.NS", name: "Cummins India", sector: "Diversified" },
  { symbol: "CGPOWER", yahoo: "CGPOWER.NS", name: "CG Power", sector: "Diversified" },
  { symbol: "HINDPETRO", yahoo: "HINDPETRO.NS", name: "Hindustan Petroleum", sector: "Diversified" },
  { symbol: "INDIGO", yahoo: "INDIGO.NS", name: "InterGlobe Aviation", sector: "Diversified" },
  { symbol: "SBICARD", yahoo: "SBICARD.NS", name: "SBI Cards", sector: "Diversified" },
  { symbol: "MCDOWELL", yahoo: "MCDOWELL-N.NS", name: "United Spirits", sector: "Diversified" },
  { symbol: "TATACOMM", yahoo: "TATACOMM.NS", name: "Tata Communications", sector: "Diversified" },
  { symbol: "TATAELXSI", yahoo: "TATAELXSI.NS", name: "Tata Elxsi", sector: "Diversified" },
  { symbol: "POLYCAB", yahoo: "POLYCAB.NS", name: "Polycab India", sector: "Diversified" },
  { symbol: "KAYNES", yahoo: "KAYNES.NS", name: "Kaynes Technology", sector: "Diversified" },
  { symbol: "DIXON", yahoo: "DIXON.NS", name: "Dixon Technologies", sector: "Diversified" },
  { symbol: "LTFOODS", yahoo: "LTFOODS.NS", name: "LT Foods", sector: "Diversified" },
  { symbol: "JUBLFOOD", yahoo: "JUBLFOOD.NS", name: "Jubilant FoodWorks", sector: "Diversified" },
  { symbol: "LICI", yahoo: "LICI.NS", name: "Life Insurance Corp", sector: "Insurance" },
  { symbol: "JIOFIN", yahoo: "JIOFIN.NS", name: "Jio Financial Services", sector: "NBFC" },
  { symbol: "LODHA", yahoo: "LODHA.NS", name: "Macrotech Developers", sector: "Infra" },
  { symbol: "MANKIND", yahoo: "MANKIND.NS", name: "Mankind Pharma", sector: "Pharma" },
  { symbol: "JSWENERGY", yahoo: "JSWENERGY.NS", name: "JSW Energy", sector: "Energy" },
  { symbol: "CAMS", yahoo: "CAMS.NS", name: "Computer Age Mgmt", sector: "Diversified" },
  { symbol: "CDSL", yahoo: "CDSL.NS", name: "Central Depository Services", sector: "Diversified" },
  { symbol: "BSE", yahoo: "BSE.NS", name: "BSE Ltd", sector: "Diversified" },
  { symbol: "SONACOMS", yahoo: "SONACOMS.NS", name: "Sona BLW Precision", sector: "Auto" },
  { symbol: "APLAPOLLO", yahoo: "APLAPOLLO.NS", name: "APL Apollo Tubes", sector: "Metals" },
  { symbol: "SUPREMEIND", yahoo: "SUPREMEIND.NS", name: "Supreme Industries", sector: "Diversified" },
  { symbol: "HONAUT", yahoo: "HONAUT.NS", name: "Honeywell Automation", sector: "Diversified" },
  { symbol: "OFSS", yahoo: "OFSS.NS", name: "Oracle Financial Services", sector: "IT" },
  { symbol: "IRB", yahoo: "IRB.NS", name: "IRB Infrastructure", sector: "Infra" },
  { symbol: "RVNL", yahoo: "RVNL.NS", name: "Rail Vikas Nigam", sector: "Defence" },
  { symbol: "IRCON", yahoo: "IRCON.NS", name: "Ircon International", sector: "Defence" },
  { symbol: "MAZDOCK", yahoo: "MAZDOCK.NS", name: "Mazagon Dock Shipbuilders", sector: "Defence" },
  { symbol: "COCHINSHIP", yahoo: "COCHINSHIP.NS", name: "Cochin Shipyard", sector: "Defence" },
  { symbol: "HUDCO", yahoo: "HUDCO.NS", name: "HUDCO", sector: "NBFC" },
  { symbol: "IREDA", yahoo: "IREDA.NS", name: "IREDA", sector: "Energy" },
  { symbol: "NBCC", yahoo: "NBCC.NS", name: "NBCC India", sector: "Infra" },
  { symbol: "SJVN", yahoo: "SJVN.NS", name: "SJVN Ltd", sector: "Energy" },
  { symbol: "IDBI", yahoo: "IDBI.NS", name: "IDBI Bank", sector: "Banking" },
  { symbol: "CENTRALBK", yahoo: "CENTRALBK.NS", name: "Central Bank of India", sector: "Banking" },
  { symbol: "IOB", yahoo: "IOB.NS", name: "Indian Overseas Bank", sector: "Banking" },
  { symbol: "UCOBANK", yahoo: "UCOBANK.NS", name: "UCO Bank", sector: "Banking" },
  { symbol: "BANKINDIA", yahoo: "BANKINDIA.NS", name: "Bank of India", sector: "Banking" },
  { symbol: "MAHABANK", yahoo: "MAHABANK.NS", name: "Bank of Maharashtra", sector: "Banking" },
  { symbol: "TATACHEM", yahoo: "TATACHEM.NS", name: "Tata Chemicals", sector: "Chemicals" },
  { symbol: "TATAMETALI", yahoo: "TATAMETALI.NS", name: "Tata Metaliks", sector: "Metals" },
  { symbol: "TATAINVEST", yahoo: "TATAINVEST.NS", name: "Tata Investment Corp", sector: "NBFC" },
  { symbol: "PATANJALI", yahoo: "PATANJALI.NS", name: "Patanjali Foods", sector: "FMCG" },
  { symbol: "AWL", yahoo: "AWL.NS", name: "Adani Wilmar", sector: "FMCG" },
  { symbol: "ADANITRANS", yahoo: "ADANITRANS.NS", name: "Adani Energy Solutions", sector: "Energy" },
  { symbol: "ATGL", yahoo: "ATGL.NS", name: "Adani Total Gas", sector: "Energy" },
  { symbol: "YESBANK", yahoo: "YESBANK.NS", name: "Yes Bank", sector: "Banking" },
  { symbol: "SUZLON", yahoo: "SUZLON.NS", name: "Suzlon Energy", sector: "Energy" },
  { symbol: "MRF", yahoo: "MRF.NS", name: "MRF Ltd", sector: "Auto" },
  { symbol: "3MINDIA", yahoo: "3MINDIA.NS", name: "3M India", sector: "Diversified" },
  { symbol: "BOSCHLTD", yahoo: "BOSCHLTD.NS", name: "Bosch", sector: "Auto" },
];

// Get Yahoo Finance crumb + cookies for authenticated API access
async function getYahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  const initRes = await fetch("https://fc.yahoo.com", {
    redirect: "manual",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const setCookies = initRes.headers.getSetCookie?.() || [];
  const cookieStr = setCookies.map(c => c.split(";")[0]).join("; ");

  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Cookie": cookieStr,
    },
  });
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes("<!DOCTYPE")) throw new Error("Failed to get Yahoo crumb");
  return { crumb, cookie: cookieStr };
}

// Use Yahoo v7 quote API with crumb authentication
async function fetchBatchQuotes(symbols: string[], crumb: string, cookie: string): Promise<Map<string, any>> {
  const results = new Map();
  const symbolStr = symbols.join(",");
  try {
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolStr)}&crumb=${encodeURIComponent(crumb)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Cookie": cookie,
      },
    });
    if (res.ok) {
      const json = await res.json();
      const quotes = json?.quoteResponse?.result || [];
      for (const q of quotes) {
        results.set(q.symbol, q);
      }
      return results;
    }
    console.log(`v7 quote returned ${res.status}, trying v8 fallback`);
  } catch (e) {
    console.log("v7 quote failed, trying v8 chart fallback");
  }

  // Fallback: fetch individually via v8 chart API
  await Promise.all(symbols.map(async (sym) => {
    try {
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${sym}?range=5d&interval=1d&includePrePost=false&crumb=${encodeURIComponent(crumb)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Cookie": cookie,
        },
      });
      if (!res.ok) return;
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) return;
      const meta = result.meta;
      results.set(sym, {
        symbol: sym,
        regularMarketPrice: meta.regularMarketPrice ?? 0,
        regularMarketChange: (meta.regularMarketPrice ?? 0) - (meta.chartPreviousClose ?? meta.previousClose ?? 0),
        regularMarketChangePercent: meta.chartPreviousClose ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100 : 0,
        regularMarketVolume: result.indicators?.quote?.[0]?.volume?.slice(-1)?.[0] ?? 0,
        regularMarketDayHigh: result.indicators?.quote?.[0]?.high?.slice(-1)?.[0] ?? 0,
        regularMarketDayLow: result.indicators?.quote?.[0]?.low?.slice(-1)?.[0] ?? 0,
        regularMarketOpen: result.indicators?.quote?.[0]?.open?.slice(-1)?.[0] ?? 0,
        regularMarketPreviousClose: meta.chartPreviousClose ?? meta.previousClose ?? 0,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
        // The v8 chart API has no market-cap field at all — leave marketCap
        // unset (rather than sentinel 0) so buildStockRow can tell "Yahoo
        // didn't give us a market cap this run" apart from "Yahoo reported
        // zero," and skip writing over a previously good stored value.
        trailingPE: 0,
      });
    } catch { /* ignore parse errors */ }
  }));
  return results;
}

// buildStockRow, hasUsableMarketCap and groupRowsByShape live in
// ../_shared/screener-row.ts — pulled out so this pure row-building and
// price/pe/day-range guarding logic (which used to write a bare `?? 0` over
// good stored values whenever Yahoo's quote was missing a sub-field, e.g.
// the MCDOWELL/ZOMATO price-stuck-at-0 defect) can be unit tested directly,
// the same reason ratios.ts and period.ts live in _shared rather than inline
// in their sync functions.

async function processBatch(stocks: typeof NSE_SYMBOLS, crumb: string, cookie: string, batchSize = 15, delayMs = 400) {
  const results: any[] = [];
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    const yahooSymbols = batch.map(s => s.yahoo);
    const quoteMap = await fetchBatchQuotes(yahooSymbols, crumb, cookie);

    for (const stock of batch) {
      const q = quoteMap.get(stock.yahoo);
      if (q) results.push(buildStockRow(stock, q));
    }

    if (i + batchSize < stocks.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

const BOT_USER_AGENTS = [
  "googlebot", "bingbot", "yandexbot", "duckduckbot", "slurp", "baiduspider", "ia_archiver",
  "facebot", "facebookexternalhit", "twitterbot", "rogerbot", "linkedinbot", "embedly", 
  "quora link preview", "showyoubot", "outbrain", "pinterest/0.", "developers.google.com/+/web/snippet",
  "slackbot", "vkShare", "W3C_Validator", "redditbot", "Applebot", "WhatsApp", "flipboard", 
  "Tumblr", "bitlybot", "SkypeShell", "TelegramBot", "Skype", "node-fetch", "axios", "python-requests"
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const userAgent = req.headers.get("user-agent")?.toLowerCase() || "";
  if (BOT_USER_AGENTS.some(bot => userAgent.includes(bot))) {
    console.warn(`[Blocked] Bot detected: ${userAgent}`);
    return new Response(JSON.stringify({ success: false, error: "Bot access denied. Data scraping is prohibited." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: existing } = await sb
      .from("screener_stocks")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);

    const lastUpdate = existing?.[0]?.updated_at;
    const isFresh = lastUpdate && (Date.now() - new Date(lastUpdate).getTime()) < 5 * 60 * 1000;

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const forceRefresh = body.refresh === true;
    const requestedSymbol = body.symbol?.toUpperCase();
    const searchQuery = body.query?.trim();

    // New: Chart Data Fetching
    if (requestedSymbol && body.range) {
      console.log(`Fetching chart for: ${requestedSymbol} (${body.range})`);
      const range = body.range || "3mo";
      const interval = ["1d", "5d"].includes(range) ? "15m" : ["1mo", "3mo"].includes(range) ? "1h" : "1d";
      
      const yahooSym = NSE_SYMBOLS.find(s => s.symbol === requestedSymbol)?.yahoo || 
                      (requestedSymbol.includes(".") ? requestedSymbol : `${requestedSymbol}.NS`);
      
      const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?range=${range}&interval=${interval}&includePrePost=false`;
      const cRes = await fetch(chartUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });

      if (cRes.ok) {
        const cJson = await cRes.ok ? await cRes.json() : null;
        const result = cJson?.chart?.result?.[0];
        if (result) {
          const timestamps = result.timestamp || [];
          const quotes = result.indicators?.quote?.[0] || {};
          const chartData = timestamps.map((t: number, i: number) => ({
            t: t * 1000,
            o: quotes.open?.[i] || 0,
            h: quotes.high?.[i] || 0,
            l: quotes.low?.[i] || 0,
            c: quotes.close?.[i] || 0,
            v: quotes.volume?.[i] || 0,
          })).filter((p: any) => p.c > 0);

          return new Response(JSON.stringify({ success: true, chartData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // New: Dynamic Search Action
    if (searchQuery && searchQuery.length >= 2) {
      console.log(`Live searching for: ${searchQuery}`);
      const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQuery)}&quotesCount=20&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
      const sRes = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      
      if (sRes.ok) {
        const sJson = await sRes.json();
        const results = (sJson.quotes || [])
          .filter((q: any) => q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO"))
          .map((q: any) => ({
            symbol: q.symbol.split(".")[0],
            yahoo: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            sector: q.sector || q.quoteType || "India Exchange"
          }));
        
        console.log(`Found ${results.length} results on exchanges`);
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (requestedSymbol) {
      console.log(`Searching/Updating dynamic symbol: ${requestedSymbol}`);
      // Search results identify the venue as e.g. RELIANCE.NS or RELIANCE.BO,
      // while our curated universe keys NSE rows by the bare symbol. Preserve
      // the known sector for either listing, but retain the exchange suffix as
      // the storage key for a dynamically selected BSE result.
      const baseSymbol = requestedSymbol.replace(/\.(?:NS|BO)$/, "");
      const stockInfo = NSE_SYMBOLS.find(s => s.symbol === baseSymbol);
      
      try {
        const { crumb, cookie } = await getYahooCrumb();
        const yahooSym = stockInfo?.yahoo || (requestedSymbol.includes(".") ? requestedSymbol : `${requestedSymbol}.NS`);
        const quoteMap = await fetchBatchQuotes([yahooSym], crumb, cookie);
        const q = quoteMap.get(yahooSym);
        
        if (q) {
          const discoveredStock = { 
            symbol: requestedSymbol, 
            yahoo: yahooSym, 
            name: q.shortName || q.longName || stockInfo?.name || requestedSymbol, 
            // quoteType is an instrument class such as "EQUITY", not a sector.
            sector: stockInfo?.sector || "General"
          };
          const row = buildStockRow(discoveredStock, q);
          // A single-row upsert has no shape-mixing risk (see groupRowsByShape
          // below for the batch case), but a column buildStockRow omitted
          // here is still worth logging: it means this run leaves whatever
          // was already stored for that column untouched rather than writing
          // a fresh value.
          const omittedColumns = ["price", "change", "change_pct", "pe", "high_52", "low_52",
            "volume", "day_high", "day_low", "open_price", "prev_close", "market_cap"]
            .filter(col => !(col in row));
          if (omittedColumns.length > 0) {
            console.warn(
              `[quote-fields] No usable ${omittedColumns.join(", ")} from Yahoo for ${requestedSymbol}; leaving existing stored value(s) untouched.`
            );
          }
          // postgrest-js resolves with an { error } object on failure rather
          // than throwing, so a bare await here would silently swallow it.
          const { error: upsertError } = await sb.from("screener_stocks").upsert(row, { onConflict: "symbol" });
          if (upsertError) {
            console.error(`Upsert failed for ${requestedSymbol}:`, upsertError.message);
          }
          return new Response(JSON.stringify({ success: true, stocks: [row] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        console.error("Direct fetch failed for", requestedSymbol, e.message);
      }
    }

    if (!isFresh || forceRefresh) {
      console.log(`Fetching ${NSE_SYMBOLS.length} stocks from Yahoo Finance...`);
      const { crumb, cookie } = await getYahooCrumb();
      const stockData = await processBatch(NSE_SYMBOLS, crumb, cookie, 5, 500);
      console.log(`Got data for ${stockData.length} stocks`);

      if (stockData.length > 0) {
        // Group rows by shape before upserting. buildStockRow omits price,
        // change, change_pct, pe, high_52, low_52, volume, day_high, day_low,
        // open_price, prev_close and market_cap individually whenever Yahoo's
        // quote had no usable value for that field this run (see
        // ../_shared/screener-row.ts). Rows that omit different columns must
        // never share a batch: PostgREST's bulk upsert derives one fixed
        // column list per call, so mixing shapes would either error or fill
        // a "missing" row's omitted column with NULL — overwriting whatever
        // good value is already stored (the MCDOWELL/ZOMATO price-stuck-at-0
        // defect this grouping exists to close). groupRowsByShape buckets by
        // the exact key set each row carries, so every call in a batch
        // references only the columns every row in it actually has.
        const shapeGroups = groupRowsByShape(stockData);
        const incomplete = stockData.filter(row =>
          !["price", "change", "change_pct", "pe", "high_52", "low_52", "volume",
            "day_high", "day_low", "open_price", "prev_close", "market_cap"]
            .every(col => col in row)
        );
        if (incomplete.length > 0) {
          console.warn(
            `[quote-fields] ${incomplete.length}/${stockData.length} symbols had one or more unusable quote fields from Yahoo this run — existing stored values preserved for those columns: ${incomplete.map(r => r.symbol).join(", ")}`
          );
        }

        for (const rows of shapeGroups) {
          const shapeLabel = Object.keys(rows[0]).sort().join(",");
          for (let i = 0; i < rows.length; i += 50) {
            const batch = rows.slice(i, i + 50);
            // postgrest-js resolves with an { error } object rather than
            // throwing on failure — check it explicitly on every write.
            const { error } = await sb
              .from("screener_stocks")
              .upsert(batch, { onConflict: "symbol" });
            if (error) console.error(`Upsert error (shape ${shapeLabel}, batch starting at ${i}):`, error.message);
          }
        }
      }
    }

    const { data: stocks, error } = await sb
      .from("screener_stocks")
      .select("*")
      .order("market_cap", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      stocks: stocks || [],
      count: stocks?.length || 0,
      cached: isFresh && !forceRefresh,
      updated_at: stocks?.[0]?.updated_at || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
