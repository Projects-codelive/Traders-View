import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  gender: "male" | "female" | "other";
  phone: string;
  dob: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  isBlocked: boolean;
  balance: number;
  lots: any[];
  sellHistory: any[];
  totalRealizedPnL: number;
  totalTradesCount: number;
  winCount: number;
  lossCount: number;
  equityCurve: any[];
  shortPositions: any[];
  coverHistory: any[];
  totalShortPnL: number;
  adminBalanceAdjustment: number;
  lastSyncedBalance: number;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  gender: { type: String, required: true, enum: ["male", "female", "other"] },
  phone: { type: String, required: true },
  dob: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: String, required: true },
  isBlocked: { type: Boolean, default: false },
  balance: { type: Number, default: 10000 },
  lots: { type: [Schema.Types.Mixed], default: [] },
  sellHistory: { type: [Schema.Types.Mixed], default: [] },
  totalRealizedPnL: { type: Number, default: 0 },
  totalTradesCount: { type: Number, default: 0 },
  winCount: { type: Number, default: 0 },
  lossCount: { type: Number, default: 0 },
  equityCurve: { type: [Schema.Types.Mixed], default: [] },
  shortPositions: { type: [Schema.Types.Mixed], default: [] },
  coverHistory: { type: [Schema.Types.Mixed], default: [] },
  totalShortPnL: { type: Number, default: 0 },
  adminBalanceAdjustment: { type: Number, default: 0 },
  lastSyncedBalance: { type: Number, default: 0 },
});

// Force fresh model on every import (Next.js dev hot-reload)
if (mongoose.models.User) {
  delete mongoose.models.User;
}
export const UserModel = mongoose.model<IUser>("User", UserSchema);
