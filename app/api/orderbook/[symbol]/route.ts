import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CryptoOrderModel } from "@/lib/models/CryptoOrder";

function normalizeSymbol(input: string) {
  return input.replace("/", "-").replace("USDT", "USD").replace("USDC", "USD");
}

function detFrom(seed: number, idx: number): number {
  const s = Math.sin((seed + idx * 17.13) * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const YAHOO_FALLBACKS: Record<string, number> = {
  "BTC-USD": 67000,
  "ETH-USD": 3500,
  "SOL-USD": 150,
  "XRP-USD": 0.50,
  "DOGE-USD": 0.15,
  "ADA-USD": 0.45,
  "AVAX-USD": 35,
  "DOT-USD": 6,
  "LINK-USD": 15,
  "POL-USD": 0.5,
  "LTC-USD": 80,
  "TRX-USD": 0.12,
  "BCH-USD": 450,
  "XLM-USD": 0.11,
  "UNI-USD": 7.5,
  "PEPE-USD": 0.000012,
  "NEAR-USD": 6.0,
  "APT-USD": 9.0,
  "ICP-USD": 10.0,
  "FIL-USD": 5.5,
};

function clipOutliers(levels: { price: number; amount: number }[]) {
  if (levels.length === 0) return levels;
  const amounts = levels.map(l => l.amount);
  const n = amounts.length;
  const mean = amounts.reduce((a, b) => a + b, 0) / n;
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cap = mean + 2 * stdDev;
  return levels.map(l => ({
    ...l,
    amount: l.amount > cap ? cap : l.amount,
  }));
}

// Global cache for raw DB queries to protect MongoDB
declare global {
  var rawDbCache: Map<string, { activeOrders: any[]; filledTrades: any[]; expiresAt: number }> | undefined;
}

const dbCache = global.rawDbCache ?? new Map();
if (!global.rawDbCache) {
  global.rawDbCache = dbCache;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  if (!symbol) {
    return NextResponse.json({ error: "symbol parameter is required" }, { status: 400 });
  }

  const normalizedSymbol = normalizeSymbol(symbol);

  const currentPriceParam = req.nextUrl.searchParams.get("currentPrice");
  let currentPrice = currentPriceParam ? parseFloat(currentPriceParam) : 0;
  if (!currentPrice || isNaN(currentPrice)) {
    currentPrice = YAHOO_FALLBACKS[normalizedSymbol] ?? 100;
  }

  try {
    const db = await connectDB();
    if (!db) {
      throw new Error("Database connection failed");
    }

    // Check cache for raw DB results
    let cached = dbCache.get(normalizedSymbol);
    let activeOrders: any[], filledTrades: any[];

    if (cached && Date.now() < cached.expiresAt) {
      activeOrders = cached.activeOrders;
      filledTrades = cached.filledTrades;
    } else {
      activeOrders = await CryptoOrderModel.find({
        symbol: normalizedSymbol,
        status: "pending",
        orderType: "limit",
        market: "crypto",
      }).lean();

      filledTrades = await CryptoOrderModel.find({
        symbol: normalizedSymbol,
        status: "filled",
        market: "crypto",
      })
      .sort({ filledAt: -1 })
      .limit(100)
      .lean();

      dbCache.set(normalizedSymbol, {
        activeOrders,
        filledTrades,
        expiresAt: Date.now() + 1000 // Cache raw DB queries for 1s
      });
    }

    const mergedBids = new Map<number, number>();
    const mergedAsks = new Map<number, number>();

    // Merge active pending limit orders
    for (const order of activeOrders) {
      const price = parseFloat(order.usdPrice.toFixed(2));
      const amount = order.amount;
      if (order.side === "buy") {
        mergedBids.set(price, (mergedBids.get(price) ?? 0) + amount);
      } else if (order.side === "sell") {
        mergedAsks.set(price, (mergedAsks.get(price) ?? 0) + amount);
      }
    }

    // Merge filled trades
    for (const trade of filledTrades) {
      const price = parseFloat(trade.usdPrice.toFixed(2));
      const amount = trade.amount;
      if (trade.side === "buy") {
        mergedBids.set(price, (mergedBids.get(price) ?? 0) + amount);
      } else if (trade.side === "sell") {
        mergedAsks.set(price, (mergedAsks.get(price) ?? 0) + amount);
      }
    }

    // Convert merged maps to arrays and sort
    const realBids = Array.from(mergedBids.entries())
      .map(([price, amount]) => ({ price, amount }))
      .sort((a, b) => b.price - a.price); // Descending (highest first)

    const realAsks = Array.from(mergedAsks.entries())
      .map(([price, amount]) => ({ price, amount }))
      .sort((a, b) => a.price - b.price); // Ascending (lowest first)

    // Generate synthetic bid prices starting from currentPrice - 0.01, decrementing by 0.01, skipping real bid prices
    const realBidPrices = new Set(realBids.map(b => b.price));
    const syntheticBids = [];
    let candidateBidPrice = currentPrice - 0.01;
    while (syntheticBids.length < 14 - Math.min(realBids.length, 14)) {
      const roundedPrice = parseFloat(candidateBidPrice.toFixed(2));
      if (roundedPrice > 0 && !realBidPrices.has(roundedPrice)) {
        syntheticBids.push({
          price: roundedPrice,
          amount: 0,
          synthetic: true
        });
      }
      candidateBidPrice -= 0.01;
    }

    const bidRows = [
      ...realBids.slice(0, 14).map(b => ({ ...b, synthetic: false })),
      ...syntheticBids
    ];
    bidRows.sort((a, b) => b.price - a.price);

    // Generate synthetic ask prices starting from currentPrice + 0.01, incrementing by 0.01, skipping real ask prices
    const realAskPrices = new Set(realAsks.map(a => a.price));
    const syntheticAsks = [];
    let candidateAskPrice = currentPrice + 0.01;
    while (syntheticAsks.length < 14 - Math.min(realAsks.length, 14)) {
      const roundedPrice = parseFloat(candidateAskPrice.toFixed(2));
      if (!realAskPrices.has(roundedPrice)) {
        syntheticAsks.push({
          price: roundedPrice,
          amount: 0,
          synthetic: true
        });
      }
      candidateAskPrice += 0.01;
    }

    const askRows = [
      ...realAsks.slice(0, 14).map(a => ({ ...a, synthetic: false })),
      ...syntheticAsks
    ];
    askRows.sort((a, b) => b.price - a.price);

    // Cumulative totals
    // Bids sorted descending: index 0 (highest) to index 13 (lowest). We accumulate index 0 downwards.
    let bidCumTotal = 0;
    const formattedBids = [];
    for (let i = 0; i < 14; i++) {
      const row = bidRows[i];
      bidCumTotal += row.price * row.amount;
      formattedBids.push({
        price: row.price,
        amount: parseFloat(row.amount.toFixed(4)),
        total: parseFloat(bidCumTotal.toFixed(2)),
        ...(row.synthetic ? { synthetic: true } : {}),
      });
    }

    // Asks sorted descending: index 0 (highest) to index 13 (lowest). We accumulate from index 13 (lowest) upwards.
    let askCumTotal = 0;
    const formattedAsks = new Array(14);
    for (let i = 13; i >= 0; i--) {
      const row = askRows[i];
      askCumTotal += row.price * row.amount;
      formattedAsks[i] = {
        price: row.price,
        amount: parseFloat(row.amount.toFixed(4)),
        total: parseFloat(askCumTotal.toFixed(2)),
        ...(row.synthetic ? { synthetic: true } : {}),
      };
    }

    // Format last 100 trades
    const recentTradesList = filledTrades.slice(0, 100);
    const formattedTrades = recentTradesList.map(t => {
      const time = t.filledAt ? new Date(t.filledAt) : new Date(t.createdAt);
      return {
        price: t.usdPrice ?? t.price,
        amount: t.amount,
        side: t.side,
        time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
    });

    const fresh = {
      symbol: normalizedSymbol,
      bids: formattedBids,
      asks: formattedAsks,
      trades: formattedTrades,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(fresh);

  } catch (error: any) {
    console.error("Order book computation error, returning synthetic fallback:", error.message);
    
    // Fallback response using 100% synthetic generation if DB goes offline
    const askPrices = Array.from({ length: 14 }, (_, i) => parseFloat((currentPrice + 0.01 + i * 0.01).toFixed(2)));
    const bidPrices = Array.from({ length: 14 }, (_, i) => parseFloat((currentPrice - 0.01 - i * 0.01).toFixed(2)));

    let askCumTotal = 0;
    const syntheticAsks = askPrices.map((price, i) => {
      const amount = 0;
      askCumTotal += price * amount;
      return {
        price,
        amount: parseFloat(amount.toFixed(4)),
        total: parseFloat(askCumTotal.toFixed(2)),
        synthetic: true,
      };
    });

    let bidCumTotal = 0;
    const syntheticBids = bidPrices.map((price, i) => {
      const amount = 0;
      bidCumTotal += price * amount;
      return {
        price,
        amount: parseFloat(amount.toFixed(4)),
        total: parseFloat(bidCumTotal.toFixed(2)),
        synthetic: true,
      };
    });

    syntheticAsks.sort((a, b) => b.price - a.price);
    syntheticBids.sort((a, b) => b.price - a.price);

    return NextResponse.json({
      symbol: normalizedSymbol,
      bids: syntheticBids,
      asks: syntheticAsks,
      trades: [],
      lastUpdated: new Date().toISOString(),
      error: error.message,
    });
  }
}
