import { NextRequest, NextResponse } from "next/server";

const SYMBOL_MAP: Record<string, string> = {
  "WIPRO":    "WIPRO.NS",
  "INFY":     "INFY.NS",
  "TCS":      "TCS.NS",
  "RELIANCE": "RELIANCE.NS",
  "HDFCBANK": "HDFCBANK.NS",
  "NIFTY":    "^NSEI",
};

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "30m": "30m",
  "1h": "60m",
  "1D": "1d",
};

const RANGE_MAP: Record<string, string> = {
  "1m":  "1d",
  "5m":  "5d",
  "30m": "1mo",
  "1h":  "3mo",
  "1D":  "1y",
};

export async function GET(req: NextRequest) {
  const symbol   = req.nextUrl.searchParams.get("symbol")   ?? "WIPRO";
  const interval = req.nextUrl.searchParams.get("interval") ?? "5m";

  const yahooSym      = SYMBOL_MAP[symbol.toUpperCase()];
  const yahooInterval = INTERVAL_MAP[interval] ?? "5m";
  const yahooRange    = RANGE_MAP[interval]   ?? "5d";

  if (!yahooSym) {
    return NextResponse.json({ error: `Unknown symbol: ${symbol}`, candles: [] }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${yahooInterval}&range=${yahooRange}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Yahoo Finance API unavailable", candles: [] }, { status: 503 });
    }

    const data = await res.json();
    const result = data.chart.result[0];
    const timestamps: number[] = result.timestamp;
    const quoteData = result.indicators.quote[0];

    if (!timestamps || timestamps.length === 0) {
      return NextResponse.json({ symbol: symbol.toUpperCase(), interval, candles: [] });
    }

    const candles = timestamps
      .map((t, i) => ({
        time:   t,
        open:   Math.round((quoteData.open[i]   ?? 0) * 100) / 100,
        high:   Math.round((quoteData.high[i]   ?? 0) * 100) / 100,
        low:    Math.round((quoteData.low[i]    ?? 0) * 100) / 100,
        close:  Math.round((quoteData.close[i]  ?? 0) * 100) / 100,
        volume: Math.round(quoteData.volume[i]  ?? 0),
      }))
      .filter(c => c.close !== 0);

    candles.sort((a, b) => a.time - b.time);

    return NextResponse.json({ symbol: symbol.toUpperCase(), interval, candles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, candles: [] }, { status: 500 });
  }
}
