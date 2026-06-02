import mongoose, { Schema, Document } from "mongoose";
import { LeaderboardEntry, EquityPoint } from "@/lib/auth-types";

export interface ILeaderboardEntry extends Document, Omit<LeaderboardEntry, "top5Trades" | "equityCurve" | "assetAllocation"> {
  top5Trades: {
    sellId: string;
    lotId: string;
    symbol: string;
    qtySold: number;
    buyPrice: number;
    sellPrice: number;
    pnl: number;
    pnlPct: number;
    timestamp: string;
  }[];
  equityCurve: { time: number; value: number }[];
  assetAllocation: Record<string, number>;
}

const EquityPointSchema = new Schema({
  time: { type: Number, required: true },
  value: { type: Number, required: true },
}, { _id: false });

const LeaderboardSchema = new Schema<ILeaderboardEntry>({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  totalRealizedPnL: { type: Number, required: true, default: 0 },
  totalTradesCount: { type: Number, required: true, default: 0 },
  winCount: { type: Number, required: true, default: 0 },
  lossCount: { type: Number, required: true, default: 0 },
  winRate: { type: Number, required: true, default: 0 },
  portfolioValue: { type: Number, required: true, default: 0 },
  lastUpdated: { type: String, required: true },
  top5Trades: [{
    sellId: { type: String, required: true },
    lotId: { type: String, required: true },
    symbol: { type: String, required: true },
    qtySold: { type: Number, required: true },
    buyPrice: { type: Number, required: true },
    sellPrice: { type: Number, required: true },
    pnl: { type: Number, required: true },
    pnlPct: { type: Number, required: true },
    timestamp: { type: String, required: true },
  }],
  equityCurve: { type: [EquityPointSchema], default: [] },
  maxDrawdown: { type: Number, default: 0 },
  profitFactor: { type: Number, default: 1 },
  avgTradeDurationHours: { type: Number, default: 0 },
  assetAllocation: { type: Schema.Types.Mixed, default: {} },
  recentActivity: { type: [String], default: [] },
  lastActiveAt: { type: String, default: "" },
  totalInvested: { type: Number, default: 0 },
  roiPercent: { type: Number, default: 0 },
});

// Handle Next.js HMR — delete cached model so schema updates take effect
if (mongoose.models.Leaderboard) {
  delete mongoose.models.Leaderboard;
}
export const LeaderboardModel = mongoose.model<ILeaderboardEntry>("Leaderboard", LeaderboardSchema);
