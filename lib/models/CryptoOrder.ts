import mongoose, { Schema, Document } from "mongoose";

export interface ICryptoOrder {
  _id: string;
  userId: string;
  symbol: string;
  displaySymbol: string;
  side: "buy" | "sell";
  orderType: "market" | "limit";
  price: number;
  limitPrice: number;
  amount: number;
  total: number;
  fee: number;
  status: "filled" | "pending" | "cancelled";
  createdAt: Date;
  filledAt?: Date;
  market: "crypto";
  usdPrice: number;
  usdInrRate: number;
}

const CryptoOrderSchema = new Schema<ICryptoOrder>({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  symbol: { type: String, required: true },
  displaySymbol: { type: String, required: true },
  side: { type: String, required: true, enum: ["buy", "sell"] },
  orderType: { type: String, required: true, enum: ["market", "limit"] },
  price: { type: Number, required: true },
  limitPrice: { type: Number, required: true },
  amount: { type: Number, required: true },
  total: { type: Number, required: true },
  fee: { type: Number, required: true },
  status: { type: String, required: true, enum: ["filled", "pending", "cancelled"] },
  createdAt: { type: Date, default: Date.now },
  filledAt: { type: Date },
  market: { type: String, required: true, enum: ["crypto"], default: "crypto" },
  usdPrice: { type: Number, required: true },
  usdInrRate: { type: Number, required: true },
});

// Force fresh model on hot-reload to prevent OverwriteModelError in Next.js development
if (mongoose.models.CryptoOrder) {
  delete mongoose.models.CryptoOrder;
}

export const CryptoOrderModel = mongoose.model<ICryptoOrder>("CryptoOrder", CryptoOrderSchema, "cryptoorders");
