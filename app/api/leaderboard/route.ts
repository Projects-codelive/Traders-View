import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { LeaderboardModel } from "@/lib/models/Leaderboard";

export async function GET() {
  try {
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ error: "MongoDB is not available." }, { status: 503 });
    }

    const entries = await LeaderboardModel
      .find({})
      .sort({ totalRealizedPnL: -1 })
      .limit(10)
      .lean();

    return NextResponse.json({ entries });
  } catch (err: any) {
    console.error("Leaderboard GET error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      userId, name, totalRealizedPnL, totalTradesCount, winCount, lossCount,
      winRate, portfolioValue, lastUpdated, top5Trades,
      equityCurve, maxDrawdown, profitFactor, avgTradeDurationHours,
      assetAllocation, recentActivity, lastActiveAt, totalInvested, roiPercent,
    } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: "userId and name are required." }, { status: 400 });
    }

    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ error: "MongoDB is not available." }, { status: 503 });
    }

    await LeaderboardModel.findOneAndUpdate(
      { userId },
      {
        userId, name, totalRealizedPnL, totalTradesCount, winCount, lossCount,
        winRate, portfolioValue, lastUpdated, top5Trades,
        equityCurve, maxDrawdown, profitFactor, avgTradeDurationHours,
        assetAllocation, recentActivity, lastActiveAt, totalInvested, roiPercent,
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Leaderboard POST error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
