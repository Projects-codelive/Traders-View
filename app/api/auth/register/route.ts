import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, gender, phone, dob, email, password } = body;

    if (!name || !gender || !phone || !dob || !email || !password) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ error: "MongoDB is not available." }, { status: 503 });
    }

    const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const user = await UserModel.create({
      name: name.trim(),
      gender,
      phone,
      dob,
      email: email.toLowerCase().trim(),
      passwordHash: btoa(password),
      createdAt: new Date().toISOString(),
      isBlocked: false,
      balance: 10000,
      lots: [],
      sellHistory: [],
      totalRealizedPnL: 0,
      totalTradesCount: 0,
      winCount: 0,
      lossCount: 0,
      equityCurve: [],
      shortPositions: [],
      coverHistory: [],
      totalShortPnL: 0,
      adminBalanceAdjustment: 0,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
