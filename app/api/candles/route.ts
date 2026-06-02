import { NextRequest, NextResponse } from "next/server";

function toYahooSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  if (s.startsWith("^") || s.endsWith(".NS") || s.endsWith(".BO")) return s;
  const special: Record<string, string> = {
    "NIFTY": "^NSEI", "NIFTY50": "^NSEI",
    "SENSEX": "^BSESN", "BSESN": "^BSESN",
  };
  if (s in special) return special[s];
  return `${s}.NS`;
}

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

  const yahooSym      = toYahooSymbol(symbol);
  const yahooInterval = INTERVAL_MAP[interval] ?? "5m";
  const yahooRange    = RANGE_MAP[interval]   ?? "5d";

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
      return NextResponse.json({ error: `Yahoo Finance API unavailable (HTTP ${res.status})`, candles: [] }, { status: 503 });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];

    if (!result) {
      return NextResponse.json({ symbol: symbol.toUpperCase(), interval, candles: [] });
    }

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};

    const candles = timestamps
      .map((t, i) => ({
        time:   t,
        open:   parseFloat((quote.open?.[i]   ?? 0).toFixed(2)),
        high:   parseFloat((quote.high?.[i]   ?? 0).toFixed(2)),
        low:    parseFloat((quote.low?.[i]    ?? 0).toFixed(2)),
        close:  parseFloat((quote.close?.[i]  ?? 0).toFixed(2)),
        volume: Math.floor(quote.volume?.[i]  ?? 0),
      }))
      .filter(c => c.close > 0)
      .sort((a, b) => a.time - b.time);

    return NextResponse.json({ symbol: symbol.toUpperCase(), interval, candles });
  } catch (err: any) {
    return NextResponse.json({ error: `Candle fetch failed: ${err.message}`, candles: [] }, { status: 500 });
  }
}
