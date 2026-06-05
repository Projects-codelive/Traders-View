import { NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const FALLBACK_RATE = 83.0;

export async function GET() {
  try {
    const url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDINR=X";
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ rate: FALLBACK_RATE, source: "fallback" });
    }

    const json = await res.json();
    const r = json?.quoteResponse?.result?.[0];
    const rate = r?.regularMarketPrice;

    if (!rate || rate <= 0) {
      return NextResponse.json({ rate: FALLBACK_RATE, source: "fallback" });
    }

    return NextResponse.json({ rate: parseFloat(rate.toFixed(2)), source: "yahoo" });
  } catch {
    return NextResponse.json({ rate: FALLBACK_RATE, source: "fallback" });
  }
}
