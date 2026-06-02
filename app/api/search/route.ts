import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 1) return NextResponse.json({ results: [] });

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20&newsCount=0&enableFuzzyQuery=true&enableNavLinks=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Yahoo search HTTP ${res.status}`);
    const data = await res.json();
    const quotes = data?.quotes ?? [];

    const filtered = quotes
      .filter((q: any) =>
        (q.symbol?.endsWith(".NS") || q.symbol === "^BSESN" || q.symbol === "^NSEI") &&
        q.quoteType !== "MUTUALFUND" &&
        q.quoteType !== "ETF"
      )
      .slice(0, 8)
      .map((q: any) => ({
        id:          q.symbol?.replace(".NS", "") ?? q.symbol,
        label:       q.shortname ?? q.longname ?? q.symbol,
        yahooSymbol: q.symbol,
        sector:      q.sector ?? q.industry ?? (q.symbol?.startsWith("^") ? "Index" : "NSE"),
        isIndex:     q.symbol?.startsWith("^") ?? false,
        exchange:    q.exchange ?? "NSE",
      }));

    return NextResponse.json({ results: filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, results: [] }, { status: 500 });
  }
}
