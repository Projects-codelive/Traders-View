import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export async function GET() {
  try {
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const users = await UserModel.find({}).lean();
    const mapped = users.map((u: any) => ({
      id:                u._id.toString(),
      name:              u.name,
      gender:            u.gender,
      phone:             u.phone,
      dob:               u.dob,
      email:             u.email,
      passwordHash:      u.passwordHash,
      createdAt:         u.createdAt,
      isBlocked:         u.isBlocked ?? false,
      balance:           u.balance ?? 10000,
      lots:              u.lots ?? [],
      sellHistory:       u.sellHistory ?? [],
      totalRealizedPnL:  u.totalRealizedPnL ?? 0,
      totalTradesCount:  u.totalTradesCount ?? 0,
      winCount:          u.winCount ?? 0,
      lossCount:         u.lossCount ?? 0,
      equityCurve:       u.equityCurve ?? [],
      shortPositions:    u.shortPositions ?? [],
      coverHistory:      u.coverHistory ?? [],
      totalShortPnL:     u.totalShortPnL ?? 0,
    }));

    return NextResponse.json({ users: mapped });
  } catch (err: any) {
    console.error("Admin users fetch error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
