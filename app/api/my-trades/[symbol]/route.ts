import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CryptoOrderModel } from "@/lib/models/CryptoOrder";

function normalizeSymbol(input: string) {
  return input.replace("/", "-");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  if (!symbol) {
    return NextResponse.json({ error: "symbol parameter is required" }, { status: 400 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
  }

  const normalizedSymbol = normalizeSymbol(symbol);

  try {
    const db = await connectDB();
    if (!db) {
      throw new Error("Database connection failed");
    }

    const filledTrades = await CryptoOrderModel.find({
      userId,
      symbol: normalizedSymbol,
      status: "filled",
      market: "crypto",
    })
    .sort({ filledAt: -1 })
    .limit(100)
    .lean();

    const formattedTrades = filledTrades.map(t => {
      const time = t.filledAt ? new Date(t.filledAt) : new Date(t.createdAt);
      return {
        price: t.usdPrice ?? t.price,
        amount: t.amount,
        side: t.side,
        time: time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
    });

    return NextResponse.json({ trades: formattedTrades });
  } catch (error: any) {
    console.error("Error fetching user trades:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
