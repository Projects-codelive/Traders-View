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
      return NextResponse.json({ error: "Yahoo Finance API unavailable" }, { status: 503 });
    }

    const data = await res.json();
    const result = data.chart.result[0];
    const meta = result.meta;
    const timestamps = result.timestamp;
    const quoteData = result.indicators.quote[0];

    if (!timestamps || !quoteData.close || quoteData.close.at(-1) == null) {
      return NextResponse.json({ error: "No market data — market may be closed" }, { status: 503 });
    }

    const i = -1;
    const price = Math.round(quoteData.close[i] * 100) / 100;
    const prevClose = Math.round((meta.chartPreviousClose ?? price) * 100) / 100;
    const change = Math.round((price - prevClose) * 100) / 100;
    const changePct = prevClose ? Math.round((change / prevClose) * 10000) / 10000 : 0;

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      ltp: price,
      change,
      changePct,
      open: Math.round((quoteData.open[i] ?? 0) * 100) / 100,
      high: Math.round((quoteData.high[i] ?? 0) * 100) / 100,
      low: Math.round((quoteData.low[i] ?? 0) * 100) / 100,
      volume: Math.round(quoteData.volume[i] ?? 0),
      prevClose,
      timestamp: Math.floor(Date.now() / 1000),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
