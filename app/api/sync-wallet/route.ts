import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

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
