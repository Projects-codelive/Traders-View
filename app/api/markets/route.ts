import { NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36";

const NSE_GAINERS_URL = "https://www.nseindia.com/api/live-analysis-variations?index=gainers";
const NSE_LOSERS_URL  = "https://www.nseindia.com/api/live-analysis-variations?index=loosers";
// NOTE: NSE intentionally misspells "loosers" — do not change this

const FETCH_HEADERS = {
  "User-Agent": UA,
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://www.nseindia.com/market-data/top-gainers-losers",
};

interface NseRawStock {
  symbol: string;
  series?: string;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  ltp: number;           // Last traded price — THIS is the correct price field
  prev_price: number;    // Previous close
  net_price: number;     // % change (same as perChange)
  perChange: number;     // % change
  trade_quantity?: number;
  turnover?: number;
  market_type?: string;
}

interface MarketStock {
  id: string;
  yahooSymbol: string;
  label: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: null;
  high52w: number | null;
  low52w: number | null;
  prevClose: number;
  timestamp: number;
  openPrice: number | null;
  dayHigh: number | null;
  dayLow: number | null;
}

// Preferred section for "best performers" view — FOSec has the broadest
// F&O universe (liquid large/mid caps), which is closest to what Groww shows
const PREFERRED_SECTION = "FOSec";
// Fallback priority if preferred section is empty
const SECTION_PRIORITY = ["FOSec", "allSec", "NIFTYNEXT50", "NIFTY", "BANKNIFTY"];

function parseNseResponse(json: Record<string, any>, wantSection?: string): NseRawStock[] {
  // Try preferred/requested section first
  const trySection = (key: string): NseRawStock[] => {
    const data = json?.[key]?.data;
    if (Array.isArray(data) && data.length > 0) return data;
    return [];
  };

  if (wantSection) {
    const result = trySection(wantSection);
    if (result.length) return result;
  }

  for (const section of SECTION_PRIORITY) {
    const result = trySection(section);
    if (result.length) return result;
  }
  return [];
}

function transformStock(item: NseRawStock): MarketStock {
  const price     = Number(item.ltp)          || 0;
  const prevClose = Number(item.prev_price)   || 0;
  const changePct = Number(item.perChange)    || Number(item.net_price) || 0;
  const change    = prevClose > 0 ? Math.round((price - prevClose) * 100) / 100 : 0;

  return {
    id:          item.symbol,
    yahooSymbol: `${item.symbol}.NS`,
    label:       item.symbol,   // NSE doesn't return company name in this endpoint
    price:       Math.round(price * 100) / 100,
    change:      change,
    changePct:   Math.round(changePct * 1000) / 1000,
    volume:      Number(item.trade_quantity) || 0,
    marketCap:   null,
    high52w:     null,          // Not available in this endpoint
    low52w:      null,
    prevClose:   Math.round(prevClose * 100) / 100,
    timestamp:   Date.now(),
    openPrice:   item.open_price  ? Math.round(Number(item.open_price)  * 100) / 100 : null,
    dayHigh:     item.high_price  ? Math.round(Number(item.high_price)  * 100) / 100 : null,
    dayLow:      item.low_price   ? Math.round(Number(item.low_price)   * 100) / 100 : null,
  };
}

async function fetchNseData(url: string): Promise<Record<string, any>> {
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`NSE returned HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter  = searchParams.get("filter") ?? "gainers"; // "gainers" | "losers" | "all"
    const section = searchParams.get("section") ?? PREFERRED_SECTION;

    // For "all" we fetch both endpoints and merge, deduplicating by symbol
    if (filter === "all") {
      const [gainersJson, losersJson] = await Promise.all([
        fetchNseData(NSE_GAINERS_URL),
        fetchNseData(NSE_LOSERS_URL),
      ]);

      const seen = new Set<string>();
      const stocks: MarketStock[] = [];

      for (const item of [...parseNseResponse(gainersJson, section), ...parseNseResponse(losersJson, section)]) {
        if (seen.has(item.symbol)) continue;
        seen.add(item.symbol);
        stocks.push(transformStock(item));
      }

      // Sort by absolute changePct descending so biggest movers appear first
      stocks.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
      const top50 = stocks.slice(0, 50);

      return NextResponse.json({
        stocks:    top50,
        gainers:   top50.filter(s => s.changePct > 0).length,
        losers:    top50.filter(s => s.changePct < 0).length,
        count:     top50.length,
        filter,
        section,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    // Single endpoint fetch (gainers or losers)
    const url  = filter === "losers" ? NSE_LOSERS_URL : NSE_GAINERS_URL;
    const json = await fetchNseData(url);
    const raw  = parseNseResponse(json, section);

    if (!raw.length) {
      return NextResponse.json(
        { error: "No data returned from NSE — market may be closed", stocks: [] },
        { status: 503 },
      );
    }

    const stocks = raw.slice(0, 50).map(transformStock);

    // Gainers are already sorted desc by NSE; losers come sorted asc (most negative first)
    // Normalise: always biggest absolute change first
    stocks.sort((a, b) =>
      filter === "losers"
        ? a.changePct - b.changePct          // most negative first
        : b.changePct - a.changePct          // most positive first
    );

    return NextResponse.json({
      stocks,
      gainers:   stocks.filter(s => s.changePct > 0).length,
      losers:    stocks.filter(s => s.changePct < 0).length,
      count:     stocks.length,
      filter,
      section,
      timestamp: Math.floor(Date.now() / 1000),
    });

  } catch (err: any) {
    console.error("/api/markets error:", err.message);
    return NextResponse.json({ error: err.message, stocks: [] }, { status: 500 });
  }
}
