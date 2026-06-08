import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { AdminActionModel } from "@/lib/models/AdminAction";

export async function GET(req: NextRequest) {
  try {
    const db = await connectDB();
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const userId = req.nextUrl.searchParams.get("userId");
    const filter = userId ? { userId } : {};
    const actions = await AdminActionModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();

    return NextResponse.json({ actions });
  } catch (err: any) {
    console.error("Admin actions fetch error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
