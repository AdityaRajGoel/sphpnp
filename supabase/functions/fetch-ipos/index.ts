const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type IPOEntry = {
  name: string;
  price: string;
  date: string;
  size: string;
  status: 'upcoming' | 'open' | 'listed';
  gmp: string;
  gmpUp: boolean;
  type: 'Mainboard' | 'SME';
  listingGain?: string;
  listingUp?: boolean;
  rating?: number;
};

// Strips tags to a fixed point (not just one pass) so a malformed/nested
// fragment like "<<script>script>" can't leave a live tag behind after a
// single regex sweep.
const stripTags = (s: string): string => {
  let prev: string;
  let out = s;
  do {
    prev = out;
    out = out.replace(/<[^>]*>/g, '');
  } while (out !== prev);
  return out;
};

const cleanText = (s: string) => stripTags(s).replace(/\s+/g, ' ').trim();

// Source 1: ipowatch.in - reliable, server-rendered HTML with markdown-friendly tables
async function fetchFromIPOWatch(): Promise<IPOEntry[] | null> {
  try {
    const res = await fetch('https://ipowatch.in/ipo-grey-market-premium-latest-ipo-gmp/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const html = await res.text();
    return parseIPOWatchHtml(html);
  } catch (e) {
    console.error('IPOWatch fetch error:', e);
    return null;
  }
}

function parseIPOWatchHtml(html: string): IPOEntry[] | null {
  const ipos: IPOEntry[] = [];

  try {
    // Find all tables in the page
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const tables: string[] = [];
    let match;
    while ((match = tableRegex.exec(html)) !== null) {
      tables.push(match[1]);
    }

    for (let ti = 0; ti < tables.length; ti++) {
      const tableHtml = tables[ti];
      const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      if (!rows || rows.length < 2) continue;

      // Check headers to determine table type
      const headerRow = cleanText(rows[0]).toLowerCase();

      // New format: IPO Name | IPO GMP | Trend | Price Band | Est. Listing | Date | Type | Status | Last Updated
      const isNewGMPFormat = headerRow.includes('gmp') && headerRow.includes('trend') && headerRow.includes('status');
      // Old format: IPO Name | GMP | Price | Date
      const isOldGMPFormat = !isNewGMPFormat && headerRow.includes('gmp') && headerRow.includes('ipo') && headerRow.includes('date');
      const isPerformanceTable = headerRow.includes('listing price') || headerRow.includes('ipo price');

      if (isPerformanceTable) continue;
      if (!isNewGMPFormat && !isOldGMPFormat) continue;

      for (let ri = 1; ri < rows.length; ri++) {
        const cells = rows[ri].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        if (!cells) continue;

        if (isNewGMPFormat && cells.length >= 8) {
          // New 9-column format
          const name = cleanText(cells[0])
            .replace(/&nbsp;/g, ' ')
            .replace(/\s*(IPO|Limited|Ltd\.?)\s*/gi, '')
            .trim();
          if (!name || name.length < 2 || name === '--' || name === '-') continue;

          const gmpRaw = cleanText(cells[1]);
          const priceBandRaw = cleanText(cells[3]).replace(/&nbsp;/g, ' ');
          const estListingRaw = cleanText(cells[4]);
          const dateRaw = cleanText(cells[5]);
          const typeRaw = cleanText(cells[6]).toLowerCase();
          const statusRaw = cleanText(cells[7]).toLowerCase();

          // Parse GMP
          const gmpMatch = gmpRaw.match(/₹\s*(-?\d+[\d.]*)/);
          const gmpNum = gmpMatch ? parseFloat(gmpMatch[1]) : 0;
          const isNegativeGMP = gmpRaw.includes('-') && gmpNum > 0;
          const actualGmp = isNegativeGMP ? -gmpNum : gmpNum;
          const gmpStr = `${actualGmp >= 0 ? '+' : ''}₹${Math.abs(actualGmp)}`;

          // Use explicit status column
          let status: 'upcoming' | 'open' | 'listed' = 'upcoming';
          if (statusRaw.includes('open') || statusRaw.includes('live')) {
            status = 'open';
          } else if (statusRaw.includes('listed') || statusRaw.includes('closed') || statusRaw.includes('allotment')) {
            status = 'listed';
          } else if (statusRaw.includes('upcoming') || statusRaw.includes('soon')) {
            status = 'upcoming';
          }

          // Parse listing gain from Est. Listing column
          let listingGain: string | undefined;
          let listingUp: boolean | undefined;
          if (status === 'listed') {
            const gainMatch = estListingRaw.match(/(-?\d+\.?\d*)%/);
            if (gainMatch) {
              const gainNum = parseFloat(gainMatch[1]);
              listingGain = `${gainNum >= 0 ? '+' : ''}${gainNum}%`;
              listingUp = gainNum >= 0;
            }
          }

          // Determine type from explicit Type column
          const isSME = typeRaw.includes('sme');

          // Parse price band
          const priceStr = priceBandRaw.includes('₹') ? priceBandRaw : priceBandRaw && priceBandRaw !== '-' ? `₹${priceBandRaw}` : 'TBA';

          ipos.push({
            name,
            price: priceStr === '₹-' ? 'TBA' : priceStr,
            date: dateRaw || 'TBA',
            size: '-',
            gmp: gmpStr,
            gmpUp: actualGmp >= 0,
            status,
            type: isSME ? 'SME' : 'Mainboard',
            listingGain,
            listingUp,
          });
        } else if (isOldGMPFormat && cells.length >= 4) {
          // Old 4-5 column format (fallback)
          const name = cleanText(cells[0])
            .replace(/&nbsp;/g, ' ')
            .replace(/\s*(IPO|Limited|Ltd\.?)\s*/gi, '')
            .trim();
          if (!name || name.length < 2 || name === '--' || name === '-') continue;

          const gmpRaw = cleanText(cells[1]);
          const priceRaw = cleanText(cells[2]);
          const listingGainOrDate = cleanText(cells[3]);
          const dateRaw = cells[4] ? cleanText(cells[4]) : '';

          // Parse GMP
          const gmpMatch = gmpRaw.match(/₹\s*(-?\d+[\d.]*)/);
          const gmpNum = gmpMatch ? parseFloat(gmpMatch[1]) : 0;
          const isNegativeGMP = gmpRaw.includes('-') && gmpNum > 0;
          const actualGmp = isNegativeGMP ? -gmpNum : gmpNum;
          const gmpStr = `${actualGmp >= 0 ? '+' : ''}₹${Math.abs(actualGmp)}`;

          // Parse date
          const dateStr = dateRaw || listingGainOrDate || 'TBA';

          // Parse date to determine status
          const dateForStatus = dateRaw || dateStr;
          let status: 'upcoming' | 'open' | 'listed' = 'upcoming';
          const now = new Date();
          const months: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

          let dateRange = dateForStatus.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
          if (!dateRange) {
            const altRange = dateForStatus.match(/(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*[-–]\s*(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
            if (altRange) {
              dateRange = [altRange[0], altRange[1], altRange[3], altRange[4]];
            }
          }

          if (dateRange) {
            const monthNum = months[dateRange[3].toLowerCase()];
            const startDay = parseInt(dateRange[1]);
            const endDay = parseInt(dateRange[2]);
            const year = now.getFullYear();
            const startDate = new Date(year, monthNum, startDay);
            const endDate = new Date(year, monthNum, endDay, 23, 59, 59);

            if (now >= startDate && now <= endDate) {
              status = 'open';
            } else if (now > endDate) {
              status = 'listed';
            } else {
              status = 'upcoming';
            }
          }

          // Parse listing gain if IPO is already listed
          let listingGain: string | undefined;
          let listingUp: boolean | undefined;
          if (status === 'listed') {
            const gainMatch = listingGainOrDate.match(/(-?\d+\.?\d*)%/);
            if (gainMatch) {
              const gainNum = parseFloat(gainMatch[1]);
              listingGain = `${gainNum >= 0 ? '+' : ''}${gainNum}%`;
              listingUp = gainNum >= 0;
            }
          }

          // Determine if SME by checking heading content before table in HTML
          const tablePos = html.indexOf(tableHtml);
          const beforeTable = html.substring(Math.max(0, tablePos - 500), tablePos).toLowerCase();
          const isSMESection = beforeTable.includes('sme ipo') || beforeTable.includes('sme gmp');

          ipos.push({
            name,
            price: priceRaw.includes('₹') ? priceRaw : priceRaw ? `₹${priceRaw}` : 'TBA',
            date: dateStr,
            size: '-',
            gmp: gmpStr,
            gmpUp: actualGmp >= 0,
            status,
            type: isSMESection ? 'SME' : 'Mainboard',
            listingGain,
            listingUp,
          });
        }
      }
    }

    return ipos.length > 0 ? ipos : null;
  } catch (e) {
    console.error('IPOWatch parse error:', e);
    return null;
  }
}

// Source 2: Scrape from investorgain.com
async function fetchFromInvestorGain(): Promise<IPOEntry[] | null> {
  try {
    const res = await fetch('https://www.investorgain.com/report/live-ipo-gmp/331/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    const rows: IPOEntry[] = [];
    const tableMatch = html.match(/<table[^>]*id="mainTable"[^>]*>([\s\S]*?)<\/table>/i)
      || html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
    if (!tableMatch) return null;

    const tbodyMatch = tableMatch[1].match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const tableContent = tbodyMatch ? tbodyMatch[1] : tableMatch[1];
    const trMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    if (!trMatches || trMatches.length < 1) return null;

    for (let i = 0; i < Math.min(trMatches.length, 30); i++) {
      const row = trMatches[i];
      const tdMatches = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (!tdMatches || tdMatches.length < 8) continue;

      const name = cleanText(tdMatches[0]).replace(/\s*(U|O|C|L@[\d.]+\s*\([^)]*\))\s*$/, '').trim();
      const gmpRaw = cleanText(tdMatches[1]);
      const price = cleanText(tdMatches[4]);
      const size = cleanText(tdMatches[5]);
      const openDate = cleanText(tdMatches[7]);
      const closeDate = cleanText(tdMatches[8]);

      if (!name || name.length < 2 || name === '--') continue;

      const gmpMatch = gmpRaw.match(/₹\s*\*?\*?(-?\d+[\d.]*)/);
      const gmpNum = gmpMatch ? parseFloat(gmpMatch[1]) : 0;
      const gmpStr = `${gmpNum >= 0 ? '+' : ''}₹${Math.abs(gmpNum)}`;

      const rowText = cleanText(row);
      let status: 'upcoming' | 'open' | 'listed' = 'upcoming';
      const listingMatch = cleanText(tdMatches[0]).match(/L@([\d.]+)\s*\(([^)]+)\)/);
      if (listingMatch) {
        status = 'listed';
      } else if (rowText.includes(' O ') || /\bO\b/.test(cleanText(tdMatches[0]).slice(-3))) {
        status = 'open';
      } else if (rowText.includes(' C ') || /\bC\b/.test(cleanText(tdMatches[0]).slice(-3))) {
        status = 'listed';
      }

      let dateStr = 'TBA';
      if (openDate && closeDate) {
        dateStr = `${openDate} - ${closeDate}`;
      } else if (openDate) {
        dateStr = openDate;
      }

      let listingGain: string | undefined;
      let listingUp: boolean | undefined;
      if (listingMatch) {
        listingGain = listingMatch[2];
        listingUp = !listingGain.startsWith('-');
      }

      const isSME = name.toLowerCase().includes('sme');
      const cleanName = name.replace(/\s*(NSE SME|BSE SME|NSE|BSE)\s*/gi, '').trim();

      rows.push({
        name: cleanName,
        price: price ? (price.includes('₹') ? price : `₹${price}`) : 'TBA',
        date: dateStr,
        size: size ? (size.toLowerCase().includes('cr') ? `₹${size}` : `₹${size} Cr`) : '-',
        gmp: gmpStr,
        gmpUp: gmpNum >= 0,
        status,
        type: isSME ? 'SME' : 'Mainboard',
        listingGain,
        listingUp,
      });
    }

    return rows.length > 0 ? rows : null;
  } catch (e) {
    console.log('InvestorGain error:', e);
    return null;
  }
}

// Curated fallback with REAL data (updated April 10, 2026)
function getCuratedIPOs(): IPOEntry[] {
  return [
    // Currently Open Mainboard
    { name: "Propshare Celestia", price: "₹113", date: "10-16 Apr", size: "₹782 Cr", status: "open", gmp: "+₹0", gmpUp: true, type: "Mainboard", rating: 3 },
    { name: "Om Power Transmission", price: "₹147", date: "10-14 Apr", size: "₹110 Cr", status: "open", gmp: "+₹0", gmpUp: true, type: "Mainboard", rating: 3 },

    // Currently Open SME
    { name: "Safety Controls", price: "₹88", date: "10-14 Apr", size: "₹26 Cr", status: "open", gmp: "+₹0", gmpUp: true, type: "SME" },
    { name: "Emiac Technologies", price: "₹152", date: "10-14 Apr", size: "₹38 Cr", status: "open", gmp: "+₹0", gmpUp: true, type: "SME" },

    // Upcoming
    { name: "Citius Transnet InvIT", price: "₹100", date: "15-17 Apr", size: "₹750 Cr", status: "upcoming", gmp: "+₹0", gmpUp: true, type: "Mainboard" },
    { name: "Leapfrog Engineering", price: "₹78", date: "14-16 Apr", size: "₹32 Cr", status: "upcoming", gmp: "+₹0", gmpUp: true, type: "SME" },

    // Recently Listed Mainboard
    { name: "GSP Crop Science", price: "₹320", date: "16-18 Mar", size: "-", status: "listed", gmp: "+₹0", gmpUp: true, type: "Mainboard", listingGain: "+5.2%", listingUp: true },
    { name: "SEDEMAC Mechatronics", price: "₹1,352", date: "4-6 Mar", size: "₹1,087.45 Cr", status: "listed", gmp: "+₹18", gmpUp: true, type: "Mainboard", listingGain: "+13.54%", listingUp: true },
    { name: "Rajputana Stainless", price: "₹122", date: "9-11 Mar", size: "₹254.98 Cr", status: "listed", gmp: "+₹3", gmpUp: true, type: "Mainboard", listingGain: "+2.46%", listingUp: true },
    { name: "PNGS Reva Diamond", price: "₹386", date: "24-26 Feb", size: "₹379.52 Cr", status: "listed", gmp: "-₹15", gmpUp: false, type: "Mainboard", listingGain: "-2.85%", listingUp: false },
    { name: "Clean Max Enviro", price: "₹1,053", date: "23-25 Feb", size: "₹3,079.88 Cr", status: "listed", gmp: "-₹37", gmpUp: false, type: "Mainboard", listingGain: "-8.83%", listingUp: false },
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Priority 1: IPOWatch (server-rendered, most reliable)
    console.log('Attempting IPOWatch scrape...');
    let ipos = await fetchFromIPOWatch();
    let source = 'ipowatch';

    // Priority 2: InvestorGain
    if (!ipos || ipos.length < 3) {
      console.log('IPOWatch insufficient, trying InvestorGain...');
      const igData = await fetchFromInvestorGain();
      if (igData && igData.length > (ipos?.length || 0)) {
        ipos = igData;
        source = 'investorgain';
      }
    }

    let finalIpos: IPOEntry[];

    if (ipos && ipos.length > 0) {
      // Always supplement live data with curated "listed" entries for completeness
      const liveNames = new Set(ipos.map(ipo => ipo.name.toLowerCase()));
      const listedSupplements = getCuratedIPOs().filter(
        c => c.status === 'listed' && !liveNames.has(c.name.toLowerCase())
      );
      finalIpos = [...ipos, ...listedSupplements];
      if (listedSupplements.length > 0) {
        source = `${source}+curated`;
      }
      console.log(`Using ${ipos.length} live + ${listedSupplements.length} curated listed IPOs`);
    } else {
      console.log('All live sources failed, using curated data');
      finalIpos = getCuratedIPOs();
      source = 'curated';
    }

    // Deduplicate (fuzzy - check if one name starts with another)
    const seen: string[] = [];
    finalIpos = finalIpos.filter(ipo => {
      if (!ipo.name || ipo.name.length < 2) return false;
      const key = ipo.name.toLowerCase().replace(/\s*(ipo|limited|ltd|constructions?)\s*/gi, '').trim();
      const isDup = seen.some(s => s.startsWith(key) || key.startsWith(s));
      if (isDup) return false;
      seen.push(key);
      return true;
    });

    return new Response(
      JSON.stringify({
        success: true,
        ipos: finalIpos,
        source,
        fetchedAt: new Date().toISOString(),
        count: finalIpos.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('IPO fetch error:', error);
    return new Response(
      JSON.stringify({
        success: true,
        ipos: getCuratedIPOs(),
        source: 'fallback',
        fetchedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
