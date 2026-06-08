import { NextRequest, NextResponse } from "next/server";

function toYahooSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  if (s.startsWith("^") || s.endsWith(".NS") || s.endsWith(".BO") || s.includes("-")) return s;
  const special: Record<string, string> = {
    "NIFTY": "^NSEI", "NIFTY50": "^NSEI",
    "SENSEX": "^BSESN", "BSESN": "^BSESN",
  };
  if (s in special) return special[s];
  return `${s}.NS`;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface QuoteResult {
  ltp: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  prevClose: number;
}

async function fetchQuoteV7(yahooSym: string): Promise<QuoteResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSym}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.quoteResponse?.result?.[0];
    if (!r) return null;
    const price = parseFloat((r.regularMarketPrice ?? 0).toFixed(2));
    if (price <= 0) return null;
    const prevClose = parseFloat((r.regularMarketPreviousClose ?? 0).toFixed(2));
    return {
      ltp: price,
      change: parseFloat((r.regularMarketChange ?? 0).toFixed(2)),
      changePct: parseFloat((r.regularMarketChangePercent ?? 0).toFixed(3)),
      open: parseFloat((r.regularMarketOpen ?? 0).toFixed(2)),
      high: parseFloat((r.regularMarketDayHigh ?? 0).toFixed(2)),
      low: parseFloat((r.regularMarketDayLow ?? 0).toFixed(2)),
      volume: Math.floor(r.regularMarketVolume ?? 0),
      prevClose: prevClose || price,
    };
  } catch {
    return null;
  }
}

async function fetchChartFallback(yahooSym: string): Promise<QuoteResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1m&range=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta ?? {};
    const price = parseFloat((meta.regularMarketPrice ?? 0).toFixed(2));
    if (price <= 0) return null;
    const prevClose = parseFloat((meta.previousClose ?? meta.chartPreviousClose ?? price).toFixed(2));
    const quoteData = result.indicators?.quote?.[0] ?? {};
    return {
      ltp: price,
      change: parseFloat((price - prevClose).toFixed(2)),
      changePct: prevClose > 0 ? parseFloat((((price - prevClose) / prevClose) * 100).toFixed(3)) : 0,
      open: parseFloat((quoteData.open?.[0] ?? 0).toFixed(2)),
      high: parseFloat((quoteData.high?.[0] ?? 0).toFixed(2)),
      low: parseFloat((quoteData.low?.[0] ?? 2).toFixed(2)),
      volume: Math.floor(quoteData.volume?.[0] ?? 0),
      prevClose,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "WIPRO";
  const yahooSym = toYahooSymbol(symbol);

  // Try v8 chart endpoint first (v7 quote now returns 401), fall back to v7
  let data = await fetchChartFallback(yahooSym);
  if (!data) data = await fetchQuoteV7(yahooSym);
  if (!data) {
    return NextResponse.json({ error: `No data available for ${symbol}` }, { status: 503 });
  }

  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    ...data,
    timestamp: Date.now(),
  });
}
