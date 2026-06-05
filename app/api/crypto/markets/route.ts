import { NextResponse } from "next/server";

const COINGECKO_URL = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h";

const YAHOO_SYMBOL_MAP: Record<string, string> = {
  bitcoin:  "BTC-USD",
  ethereum: "ETH-USD",
  solana:   "SOL-USD",
  ripple:   "XRP-USD",
  dogecoin: "DOGE-USD",
  cardano:  "ADA-USD",
  avalanche: "AVAX-USD",
  polkadot: "DOT-USD",
  chainlink: "LINK-USD",
  polygon:  "POL-USD",
  litecoin: "LTC-USD",
  tron:     "TRX-USD",
  bitcoinCash: "BCH-USD",
  stellar:  "XLM-USD",
  uniswap:  "UNI-USD",
  pepe:     "PEPE-USD",
  near:     "NEAR-USD",
  aptos:    "APT-USD",
  internetComputer: "ICP-USD",
  filecoin: "FIL-USD",
};

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
  high_24h: number | null;
  low_24h: number | null;
}

interface CryptoStock {
  id: string;
  yahooSymbol: string;
  label: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number;
  high52w: null;
  low52w: null;
  prevClose: number;
  timestamp: number;
  openPrice: null;
  dayHigh: number | null;
  dayLow: number | null;
  currency: string;
}

function toYahooSymbol(coinId: string, symbol: string): string {
  if (YAHOO_SYMBOL_MAP[coinId]) return YAHOO_SYMBOL_MAP[coinId];
  return `${symbol.toUpperCase()}-USD`;
}

function transformCrypto(coin: CoinGeckoCoin): CryptoStock {
  const price = coin.current_price ?? 0;
  const changePct = coin.price_change_percentage_24h ?? 0;
  const prevClose = changePct !== 0 ? Math.round((price / (1 + changePct / 100)) * 100) / 100 : price;

  return {
    id:          coin.symbol.toUpperCase(),
    yahooSymbol: toYahooSymbol(coin.id, coin.symbol),
    label:       coin.name,
    price:       Math.round(price * 100) / 100,
    change:      Math.round((price - prevClose) * 100) / 100,
    changePct:   Math.round(changePct * 100) / 100,
    volume:      coin.total_volume ?? 0,
    marketCap:   coin.market_cap ?? 0,
    high52w:     null,
    low52w:      null,
    prevClose:   Math.round(prevClose * 100) / 100,
    timestamp:   Date.now(),
    openPrice:   null,
    dayHigh:     coin.high_24h ?? null,
    dayLow:      coin.low_24h ?? null,
    currency:    "USD",
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") ?? "all";

    const res = await fetch(COINGECKO_URL, {
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) throw new Error(`CoinGecko returned HTTP ${res.status}`);

    const data: CoinGeckoCoin[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "No crypto data returned", stocks: [] },
        { status: 503 },
      );
    }

    let stocks = data.map(transformCrypto);

    if (filter === "gainers") {
      stocks = stocks.filter(s => s.changePct > 0)
        .sort((a, b) => b.changePct - a.changePct);
    } else if (filter === "losers") {
      stocks = stocks.filter(s => s.changePct < 0)
        .sort((a, b) => a.changePct - b.changePct);
    } else {
      stocks.sort((a, b) => b.marketCap - a.marketCap);
    }

    const top = stocks.slice(0, 50);

    return NextResponse.json({
      stocks:    top,
      gainers:   top.filter(s => s.changePct > 0).length,
      losers:    top.filter(s => s.changePct < 0).length,
      count:     top.length,
      filter,
      section:   "crypto",
      timestamp: Math.floor(Date.now() / 1000),
    });

  } catch (err: any) {
    console.error("/api/crypto/markets error:", err.message);
    return NextResponse.json({ error: err.message, stocks: [] }, { status: 500 });
  }
}
