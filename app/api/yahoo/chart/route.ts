import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const symbol   = req.nextUrl.searchParams.get("symbol");
  const interval = req.nextUrl.searchParams.get("interval") ?? "5m";
  const range    = req.nextUrl.searchParams.get("range")    ?? "1d";

  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();

    const result   = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const quote    = result?.indicators?.quote?.[0] ?? {};
    const opens:   number[] = quote.open   ?? [];
    const highs:   number[] = quote.high   ?? [];
    const lows:    number[] = quote.low    ?? [];
    const closes:  number[] = quote.close  ?? [];
    const volumes: number[] = quote.volume ?? [];

    const candles = timestamps
      .map((t, i) => ({
        time:   t,
        open:   parseFloat((opens[i]   ?? 0).toFixed(2)),
        high:   parseFloat((highs[i]   ?? 0).toFixed(2)),
        low:    parseFloat((lows[i]    ?? 0).toFixed(2)),
        close:  parseFloat((closes[i]  ?? 0).toFixed(2)),
        volume: Math.floor(volumes[i]  ?? 0),
      }))
      .filter(c => c.open > 0 && c.close > 0)
      .sort((a, b) => a.time - b.time);

    return NextResponse.json({ candles });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, candles: [] }, { status: 500 });
  }
}
