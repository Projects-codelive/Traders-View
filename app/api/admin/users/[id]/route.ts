import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { UserModel } from "@/lib/models/User";
import { AdminActionModel } from "@/lib/models/AdminAction";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const body = await req.json();

    const user = await UserModel.findById(id);
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Block / Unblock
    if (body.action === "block") {
      user.isBlocked = true;
      await user.save();
      return NextResponse.json({ success: true, isBlocked: true });
    }

    if (body.action === "unblock") {
      user.isBlocked = false;
      await user.save();
      return NextResponse.json({ success: true, isBlocked: false });
    }

    // Credit balance (modifies user.balance directly, resets adminBalanceAdjustment)
    if (body.action === "credit" && typeof body.amount === "number") {
      const balanceBefore = user.balance ?? 10000;
      user.balance = parseFloat((balanceBefore + body.amount).toFixed(2));
      user.adminBalanceAdjustment = 0;
      await user.save();
      await AdminActionModel.create({
        userId: user._id.toString(),
        userName: user.name,
        userEmail: user.email,
        action: "credit",
        amount: body.amount,
        signedAmount: body.amount,
        balanceBefore,
        balanceAfter: user.balance,
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, balance: user.balance });
    }

    // Debit balance (modifies user.balance directly, resets adminBalanceAdjustment)
    if (body.action === "debit" && typeof body.amount === "number") {
      const current = user.balance ?? 10000;
      if (current < body.amount) {
        return NextResponse.json({ error: "Insufficient balance." }, { status: 400 });
      }
      const balanceBefore = current;
      user.balance = parseFloat((current - body.amount).toFixed(2));
      user.adminBalanceAdjustment = 0;
      await user.save();
      await AdminActionModel.create({
        userId: user._id.toString(),
        userName: user.name,
        userEmail: user.email,
        action: "debit",
        amount: body.amount,
        signedAmount: -body.amount,
        balanceBefore,
        balanceAfter: user.balance,
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, balance: user.balance });
    }

    // Sync wallet from localStorage (called from admin client)
    if (body.action === "sync-wallet") {
      const wallet = body.wallet;
      if (!wallet) {
        return NextResponse.json({ error: "Wallet data required." }, { status: 400 });
      }
      user.balance = wallet.balance ?? 10000;
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
      return NextResponse.json({ success: true, balance: user.balance });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("Admin user update error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
