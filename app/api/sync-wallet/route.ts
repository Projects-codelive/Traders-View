import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { CryptoOrderModel } from "@/lib/models/CryptoOrder";

async function getUSDINRRate(): Promise<number> {
  try {
    const url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDINR=X";
    const res = await fetch(url, {
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", 
        Accept: "application/json" 
      },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return 83.0;
    const json = await res.json();
    const rate = json?.quoteResponse?.result?.[0]?.regularMarketPrice;
    return rate && rate > 0 ? parseFloat(rate.toFixed(2)) : 83.0;
  } catch {
    return 83.0;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, wallet } = body;

    if (!userId || !wallet) {
      return NextResponse.json({ error: "userId and wallet are required." }, { status: 400 });
    }

    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ error: "MongoDB is not available." }, { status: 503 });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Detect if admin modified the balance since last sync
    const lastSynced = user.lastSyncedBalance ?? 0;
    const adminModified = Math.abs(lastSynced - (user.balance ?? 0)) > 0.01;

    if (adminModified) {
      // Admin changed the balance — keep MongoDB's balance, don't overwrite
      user.lastSyncedBalance = user.balance;
    } else {
      // Normal sync — overwrite balance from wallet
      user.balance = wallet.balance ?? 10000;
      user.lastSyncedBalance = user.balance;
    }

    // Fetch live forex rate
    const usdInrRate = await getUSDINRRate();

    // Detect and save new transactions to the cryptoorders collection
    const existingLotIds = new Set((user.lots || []).map((l: any) => l.lotId));
    const incomingLots = wallet.lots || [];
    const newLots = incomingLots.filter((l: any) => !existingLotIds.has(l.lotId));

    for (const lot of newLots) {
      if (lot.symbol.endsWith("-USD")) {
        const usdPrice = lot.buyPrice / usdInrRate;
        try {
          const txTime = lot.buyTimestamp ? new Date(lot.buyTimestamp) : new Date();
          const duplicate = await CryptoOrderModel.findOne({
            userId: user._id.toString(),
            symbol: lot.symbol,
            side: "buy",
            amount: lot.originalQty,
            price: lot.buyPrice,
            createdAt: { $gte: new Date(txTime.getTime() - 2000), $lte: new Date(txTime.getTime() + 2000) },
          });
          if (duplicate) {
            console.log(`Deduplicated lot: ${lot.lotId} matches ${duplicate._id}`);
            continue;
          }

          await CryptoOrderModel.create({
            _id: lot.lotId,
            userId: user._id.toString(),
            symbol: lot.symbol,
            displaySymbol: lot.symbol.replace("-", "/"),
            side: "buy",
            orderType: "limit",
            price: lot.buyPrice,
            limitPrice: lot.buyPrice,
            amount: lot.originalQty,
            total: lot.originalQty * lot.buyPrice,
            fee: parseFloat((lot.originalQty * lot.buyPrice * 0.001).toFixed(2)),
            status: "filled",
            createdAt: txTime,
            filledAt: txTime,
            market: "crypto",
            usdPrice: parseFloat(usdPrice.toFixed(2)),
            usdInrRate,
          });
        } catch (err: any) {
          if (!err.message.includes("E11000")) throw err;
        }
      }
    }

    const existingSellIds = new Set((user.sellHistory || []).map((s: any) => s.sellId));
    const incomingSells = wallet.sellHistory || [];
    const newSells = incomingSells.filter((s: any) => !existingSellIds.has(s.sellId));

    for (const sell of newSells) {
      if (sell.symbol.endsWith("-USD")) {
        const usdPrice = sell.sellPrice / usdInrRate;
        try {
          const txTime = sell.timestamp ? new Date(sell.timestamp) : new Date();
          const duplicate = await CryptoOrderModel.findOne({
            userId: user._id.toString(),
            symbol: sell.symbol,
            side: "sell",
            amount: sell.qtySold,
            price: sell.sellPrice,
            createdAt: { $gte: new Date(txTime.getTime() - 2000), $lte: new Date(txTime.getTime() + 2000) },
          });
          if (duplicate) {
            console.log(`Deduplicated sell: ${sell.sellId} matches ${duplicate._id}`);
            continue;
          }

          await CryptoOrderModel.create({
            _id: sell.sellId,
            userId: user._id.toString(),
            symbol: sell.symbol,
            displaySymbol: sell.symbol.replace("-", "/"),
            side: "sell",
            orderType: "market",
            price: sell.sellPrice,
            limitPrice: 0,
            amount: sell.qtySold,
            total: sell.qtySold * sell.sellPrice,
            fee: parseFloat((sell.qtySold * sell.sellPrice * 0.001).toFixed(2)),
            status: "filled",
            createdAt: txTime,
            filledAt: txTime,
            market: "crypto",
            usdPrice: parseFloat(usdPrice.toFixed(2)),
            usdInrRate,
          });
        } catch (err: any) {
          if (!err.message.includes("E11000")) throw err;
        }
      }
    }

    const existingShortIds = new Set((user.shortPositions || []).map((s: any) => s.positionId));
    const incomingShorts = wallet.shortPositions || [];
    const newShorts = incomingShorts.filter((s: any) => !existingShortIds.has(s.positionId));

    for (const pos of newShorts) {
      if (pos.symbol.endsWith("-USD")) {
        const usdPrice = pos.shortPrice / usdInrRate;
        try {
          const txTime = pos.openTimestamp ? new Date(pos.openTimestamp) : new Date();
          const duplicate = await CryptoOrderModel.findOne({
            userId: user._id.toString(),
            symbol: pos.symbol,
            side: "sell",
            amount: pos.originalQty,
            price: pos.shortPrice,
            createdAt: { $gte: new Date(txTime.getTime() - 2000), $lte: new Date(txTime.getTime() + 2000) },
          });
          if (duplicate) {
            console.log(`Deduplicated short: ${pos.positionId} matches ${duplicate._id}`);
            continue;
          }

          await CryptoOrderModel.create({
            _id: pos.positionId,
            userId: user._id.toString(),
            symbol: pos.symbol,
            displaySymbol: pos.symbol.replace("-", "/"),
            side: "sell",
            orderType: "limit",
            price: pos.shortPrice,
            limitPrice: pos.shortPrice,
            amount: pos.originalQty,
            total: pos.originalQty * pos.shortPrice,
            fee: parseFloat((pos.originalQty * pos.shortPrice * 0.001).toFixed(2)),
            status: "filled",
            createdAt: txTime,
            filledAt: txTime,
            market: "crypto",
            usdPrice: parseFloat(usdPrice.toFixed(2)),
            usdInrRate,
          });
        } catch (err: any) {
          if (!err.message.includes("E11000")) throw err;
        }
      }
    }

    const existingCoverIds = new Set((user.coverHistory || []).map((c: any) => c.coverId));
    const incomingCovers = wallet.coverHistory || [];
    const newCovers = incomingCovers.filter((c: any) => !existingCoverIds.has(c.coverId));

    for (const cover of newCovers) {
      if (cover.symbol.endsWith("-USD")) {
        const usdPrice = cover.coverPrice / usdInrRate;
        try {
          const txTime = cover.timestamp ? new Date(cover.timestamp) : new Date();
          const duplicate = await CryptoOrderModel.findOne({
            userId: user._id.toString(),
            symbol: cover.symbol,
            side: "buy",
            amount: cover.qtyCovered,
            price: cover.coverPrice,
            createdAt: { $gte: new Date(txTime.getTime() - 2000), $lte: new Date(txTime.getTime() + 2000) },
          });
          if (duplicate) {
            console.log(`Deduplicated cover: ${cover.coverId} matches ${duplicate._id}`);
            continue;
          }

          await CryptoOrderModel.create({
            _id: cover.coverId,
            userId: user._id.toString(),
            symbol: cover.symbol,
            displaySymbol: cover.symbol.replace("-", "/"),
            side: "buy",
            orderType: "market",
            price: cover.coverPrice,
            limitPrice: 0,
            amount: cover.qtyCovered,
            total: cover.qtyCovered * cover.coverPrice,
            fee: parseFloat((cover.qtyCovered * cover.coverPrice * 0.001).toFixed(2)),
            status: "filled",
            createdAt: txTime,
            filledAt: txTime,
            market: "crypto",
            usdPrice: parseFloat(usdPrice.toFixed(2)),
            usdInrRate,
          });
        } catch (err: any) {
          if (!err.message.includes("E11000")) throw err;
        }
      }
    }

    user.lots = wallet.lots ?? [];
    user.sellHistory = wallet.sellHistory ?? [];
    user.totalRealizedPnL = wallet.totalRealizedPnL ?? 0;
    user.totalTradesCount = wallet.totalTradesCount ?? 0;
    user.winCount = wallet.winCount ?? 0;
    user.lossCount = wallet.lossCount ?? 0;
    user.equityCurve = wallet.equityCurve ?? [];
    user.shortPositions = wallet.shortPositions ?? [];
    user.coverHistory = wallet.coverHistory ?? [];
    user.totalShortPnL = wallet.totalShortPnL ?? 0;

    await user.save();

    return NextResponse.json({
      success: true,
      isBlocked: user.isBlocked ?? false,
      balance: user.balance,
      adminBalanceAdjustment: user.adminBalanceAdjustment ?? 0,
    });
  } catch (err: unknown) {
    console.error("Sync wallet error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
