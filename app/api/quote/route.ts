import { NextRequest, NextResponse } from "next/server";

const SYMBOL_MAP: Record<string, string> = {
  "WIPRO":    "WIPRO.NS",
  "INFY":     "INFY.NS",
  "TCS":      "TCS.NS",
  "RELIANCE": "RELIANCE.NS",
  "HDFCBANK": "HDFCBANK.NS",
  "NIFTY":    "^NSEI",
};

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "WIPRO";
  const yahooSym = SYMBOL_MAP[symbol.toUpperCase()];

  if (!yahooSym) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}` }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=1m&range=1d&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance API unavailable (HTTP ${res.status})` }, { status: 503 });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ error: "Yahoo Finance returned empty data" }, { status: 503 });
    }

    const meta = result.meta ?? {};
    const price = parseFloat((meta.regularMarketPrice ?? 0).toFixed(2));
    const prevClose = parseFloat((meta.previousClose ?? meta.chartPreviousClose ?? price).toFixed(2));
    const change = parseFloat((price - prevClose).toFixed(2));
    const changePct = prevClose > 0 ? parseFloat(((change / prevClose) * 100).toFixed(3)) : 0;

    const quoteData = result.indicators?.quote?.[0] ?? {};

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      ltp: price || 0,
      change,
      changePct,
      open: parseFloat((quoteData.open?.[0] ?? 0).toFixed(2)),
      high: parseFloat((quoteData.high?.[0] ?? 0).toFixed(2)),
      low: parseFloat((quoteData.low?.[0] ?? 0).toFixed(2)),
      volume: Math.floor(quoteData.volume?.[0] ?? 0),
      prevClose,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Quote fetch failed: ${err.message}` }, { status: 500 });
  }
}
