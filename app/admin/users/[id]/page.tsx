"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAdminSession, getUserWallet, blockUser, unblockUser } from "@/lib/auth";
import { createChart, AreaSeries, ColorType, LineStyle } from "lightweight-charts";
import axios from "axios";
import AdminActionHistory from "@/components/AdminActionHistory";

const RS = '\u20B9';

function EquityChart({ curve }: { curve: { time: number; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || curve.length < 2) return;
    ref.current.innerHTML = "";
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#6b7280", fontSize: 10, attributionLogo: false },
      grid:   { vertLines: { visible: false }, horzLines: { color: "#1a2e22", style: LineStyle.Dotted } },
      rightPriceScale: { borderVisible: false, textColor: "#6b7280" },
      timeScale: { borderVisible: false, timeVisible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { color: "#1a3020" } },
      width:  ref.current.clientWidth,
      height: ref.current.clientHeight,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#00d4aa", topColor: "rgba(0,212,170,0.2)",
      bottomColor: "rgba(0,212,170,0)", lineWidth: 2,
    });
    const data = curve.map(p => ({ time: Math.floor(p.time / 1000) as any, value: p.value }));
    for (let i = data.length - 1; i > 0; i--) {
      if (data[i].time === data[i - 1].time) data.splice(i, 1);
    }
    series.setData(data);
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (ref.current) chart.applyOptions({ width: ref.current.clientWidth }); });
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [curve]);

  if (curve.length < 2) {
    return <div className="flex items-center justify-center h-full text-xs text-gray-600">No trade history yet</div>;
  }
  return <div ref={ref} className="w-full h-full" />;
}

export default function AdminUserPage() {
  const router   = useRouter();
  const params   = useParams();
  const userId   = params.id as string;

  const [user,        setUser]        = useState<any>(null);
  const [amount,      setAmount]      = useState("");
  const [actionMsg,   setActionMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [amountError, setAmountError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!getAdminSession()) { router.replace("/admin/login"); return; }
    loadData();
  }, [userId]);

  async function loadData() {
    try {
      const res = await axios.get("/api/admin/users");
      const found = res.data.users.find((u: any) => u.id === userId);
      if (!found) { router.replace("/admin"); return; }
      setUser(found);

      // Sync local wallet to MongoDB only if MongoDB has NO trade data at all
      // (prevents overwriting fresh short-trade data with stale localStorage from admin's browser)
      const hasAnyTrades = (found.lots?.length ?? 0) > 0 || (found.sellHistory?.length ?? 0) > 0
                        || (found.shortPositions?.length ?? 0) > 0 || (found.coverHistory?.length ?? 0) > 0;
      if (!hasAnyTrades) {
        const localWallet = getUserWallet(userId);
        if (localWallet) {
          await axios.patch(`/api/admin/users/${userId}`, { action: "sync-wallet", wallet: localWallet }).catch(() => {});
          const res2 = await axios.get("/api/admin/users");
          const updated = res2.data.users.find((u: any) => u.id === userId);
          if (updated) setUser(updated);
        }
      }
    } catch {
      router.replace("/admin");
    }
  }

  async function handleBlock() {
    try {
      await axios.patch(`/api/admin/users/${userId}`, { action: "block" });
      blockUser(userId);
      setUser((prev: any) => prev ? { ...prev, isBlocked: true } : prev);
      showMsg("User blocked. Account frozen and removed from leaderboard.", true);
    } catch {
      showMsg("Block failed.", false);
    }
  }

  async function handleUnblock() {
    try {
      await axios.patch(`/api/admin/users/${userId}`, { action: "unblock" });
      unblockUser(userId);
      setUser((prev: any) => prev ? { ...prev, isBlocked: false } : prev);
      showMsg("User unblocked. Full access restored.", true);
    } catch {
      showMsg("Unblock failed.", false);
    }
  }

  async function handleCredit() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setAmountError("Enter a valid positive amount."); return; }
    try {
      const res = await axios.patch(`/api/admin/users/${userId}`, { action: "credit", amount: amt });
      setUser((prev: any) => prev ? { ...prev, balance: res.data.balance } : prev);
      setAmount("");
      showMsg(`${RS}${amt.toFixed(2)} credited.`, true);
    } catch {
      showMsg("Credit failed.", false);
    }
    setAmountError("");
  }

  async function handleDebit() {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setAmountError("Enter a valid positive amount."); return; }
    const bal = user?.balance ?? 0;
    if (amt > bal) { setAmountError(`Cannot debit more than current balance ${RS}${bal.toFixed(2)}.`); return; }
    try {
      const res = await axios.patch(`/api/admin/users/${userId}`, { action: "debit", amount: amt });
      setUser((prev: any) => prev ? { ...prev, balance: res.data.balance } : prev);
      setAmount("");
      showMsg(`${RS}${amt.toFixed(2)} debited.`, true);
    } catch {
      showMsg("Debit failed.", false);
    }
    setAmountError("");
  }

  function showMsg(text: string, ok: boolean) {
    setActionMsg({ text, ok });
    setTimeout(() => setActionMsg(null), 4000);
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080d0b" }}>
      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "#00d4aa", borderTopColor: "transparent" }} />
    </div>
  );

  const balance      = user.balance ?? 10000;
  const totalPnL     = (user.totalRealizedPnL ?? 0) + (user.totalShortPnL ?? 0);
  const totalTrades  = user.totalTradesCount ?? 0;
  const winCount     = user.winCount ?? 0;
  const lossCount    = user.lossCount ?? 0;
  const winRate      = totalTrades > 0 ? ((winCount / totalTrades) * 100).toFixed(1) : "0.0";
  const equityCurve  = user.equityCurve ?? [];
  const sellHistory  = user.sellHistory ?? [];
  const coverHistory = user.coverHistory ?? [];
  const openLots     = (user.lots ?? []).filter((l: any) => !l.isClosed);
  const marginUsed   = openLots.reduce((s: number, l: any) => s + (l.remainingQty ?? 0) * (l.buyPrice ?? 0), 0);
  const buyingPower  = Math.max(0, balance - marginUsed);
  const joinDate     = new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const avgHoldHours = equityCurve.length > 0
    ? sellHistory.reduce((s: number, t: any) => {
        const lot = (user.lots ?? []).find((l: any) => l.lotId === t.lotId);
        if (!lot) return s;
        return s + (new Date(t.timestamp).getTime() - new Date(lot.buyTimestamp).getTime()) / 3600000;
      }, 0) / Math.max(1, sellHistory.length ?? 1)
    : 0;
  const peakValue = equityCurve.length > 0 ? Math.max(...equityCurve.map((p: any) => p.value)) : 10000;

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "#080d0b", fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <header
        className="flex items-center justify-between px-8 py-4"
        style={{ background: "#0a1410", borderBottom: "1px solid #1a2e22" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition"
          >
            {'\u2190'} Back
          </button>
          <span className="text-gray-700">|</span>
          <span className="text-sm text-gray-500">
            Admin Console &gt; User Management &gt;
            <span className="text-white ml-1">ID: #{userId.slice(0, 8).toUpperCase()}</span>
          </span>
        </div>
        <button
          onClick={() => { router.push("/admin/login"); }}
          className="text-sm px-4 py-1.5 rounded-lg"
          style={{ background: "#1a0a0a", color: "#ef5350", border: "1px solid #ef535033" }}
        >
          Sign Out
        </button>
      </header>

      <div className="px-8 py-6">

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: "#0f2a21", color: "#00d4aa", border: "1px solid #00d4aa33" }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{user.name}</h1>
            <p className="text-xs text-gray-500">Admin Console &gt; User Management &gt; ID: #{userId.slice(0,8).toUpperCase()}</p>
          </div>
          <div className="ml-auto">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full font-mono"
              style={{
                background: user.isBlocked ? "#2a0a0a" : "#0a2a1a",
                color:      user.isBlocked ? "#ef5350" : "#00d4aa",
                border:     `1px solid ${user.isBlocked ? "#ef535033" : "#00d4aa33"}`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: user.isBlocked ? "#ef5350" : "#00d4aa" }} />
              {user.isBlocked ? "BLOCKED" : "ACTIVE"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">

          <div className="rounded-2xl p-6" style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}>
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span style={{ color: "#00d4aa" }}>{'\u{1F464}'}</span> Personal Details
            </h2>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div>
                <div className="text-sm text-gray-600 mb-1">EMAIL ADDRESS</div>
                <div className="text-gray-300">{user.email}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">PHONE NUMBER</div>
                <div className="text-gray-300">+91 {user.phone}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">JOINING DATE</div>
                <div className="text-gray-300">{joinDate}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">GENDER</div>
                <div className="text-gray-300 capitalize">{user.gender}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">DATE OF BIRTH</div>
                <div className="text-gray-300">{new Date(user.dob).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">STATUS</div>
                <span style={{ color: user.isBlocked ? "#ef5350" : "#00d4aa" }}>
                  {user.isBlocked ? '\u25CF Blocked' : '\u25CF Active'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}>
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span style={{ color: "#00d4aa" }}>{'\u{1F4B0}'}</span> Financial Status
            </h2>
            <div className="mb-4">
              <div className="text-xs text-gray-600 mb-1">CURRENT BALANCE</div>
              <div className="text-3xl font-bold font-mono" style={{ color: "#00d4aa" }}>
                {RS}{balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="px-3 py-2 rounded-xl" style={{ background: "#0a1410" }}>
                <div className="text-sm text-gray-600">Margin Used</div>
                <div className="text-base font-mono font-semibold text-white mt-0.5">
                  {RS}{marginUsed.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="px-3 py-2 rounded-xl" style={{ background: "#0a1410" }}>
                <div className="text-sm text-gray-600">Buying Power</div>
                <div className="text-base font-mono font-semibold text-white mt-0.5">
                  {RS}{buyingPower.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6 mb-4" style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}>
          <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span style={{ color: "#00d4aa" }}>{'\u{1F4CA}'}</span> Trade Statistics
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Trades",  value: totalTrades.toString(),                               color: "#fff"     },
                { label: "Win Rate",      value: `${winRate}%`,                                         color: parseFloat(winRate) >= 50 ? "#00d4aa" : "#ef5350" },
                { label: "Net P&L",       value: `${totalPnL >= 0 ? "+" : ""}${RS}${totalPnL.toFixed(2)}`, color: totalPnL >= 0 ? "#00d4aa" : "#ef5350" },
                { label: "Avg. Holding",  value: `${avgHoldHours.toFixed(1)}h`,                         color: "#fff"     },
              ].map(s => (
                <div key={s.label} className="px-4 py-3 rounded-xl" style={{ background: "#0a1410" }}>
                  <div className="text-sm text-gray-600 mb-1">{s.label}</div>
                  <div className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden relative" style={{ background: "#0a1410", minHeight: 180 }}>
              {equityCurve.length >= 2 && (
                <div
                  className="absolute top-3 left-4 text-xs font-mono px-2 py-0.5 rounded z-10"
                  style={{ background: "#00d4aa22", color: "#00d4aa", border: "1px solid #00d4aa33" }}
                >
                  +{RS}{(peakValue - 10000).toFixed(0)} (Peak)
                </div>
              )}
              <EquityChart curve={equityCurve} />
            </div>
          </div>
        </div>

        {(sellHistory.length > 0 || coverHistory.length > 0) && (
          <div className="rounded-2xl p-6 mb-4" style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}>
            <h2 className="text-sm font-bold text-white mb-4">Recent Trade History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #1a2e22" }} className="text-gray-600">
                    <th className="text-left pb-3 font-medium">SYMBOL</th>
                    <th className="text-left pb-3 font-medium">TYPE</th>
                    <th className="text-right pb-3 font-medium">QTY</th>
                    <th className="text-right pb-3 font-medium">ENTRY PRICE</th>
                    <th className="text-right pb-3 font-medium">EXIT PRICE</th>
                    <th className="text-right pb-3 font-medium">P&L</th>
                    <th className="text-right pb-3 font-medium">DATE</th>
                    <th className="text-right pb-3 font-medium">TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sellHistory.map((t: any) => ({ ...t, _type: "LONG", _id: t.sellId, _qty: t.qtySold, _entry: t.buyPrice, _exit: t.sellPrice })),
                     ...coverHistory.map((t: any) => ({ ...t, _type: "SHORT", _id: t.coverId, _qty: t.qtyCovered, _entry: t.shortPrice, _exit: t.coverPrice })),
                    ].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 12).map((t: any) => (
                    <tr key={t._id} style={{ borderBottom: "1px solid #1a2e1280" }}>
                      <td className="py-3 font-mono font-semibold text-white">{t.symbol}</td>
                      <td className="py-3">
                        <span className="text-xs px-2 py-1 rounded" style={{
                          background: t._type === "LONG" ? "#0a2a1a" : "#2a1a0a",
                          color: t._type === "LONG" ? "#00d4aa" : "#f5a623",
                        }}>{t._type}</span>
                      </td>
                      <td className="py-3 text-right text-gray-400">{t._qty}</td>
                      <td className="py-3 text-right text-gray-400">{RS}{t._entry?.toFixed(2) ?? '\u2014'}</td>
                      <td className="py-3 text-right text-gray-400">{RS}{t._exit?.toFixed(2) ?? '\u2014'}</td>
                      <td className="py-3 text-right font-mono font-bold" style={{ color: t.pnl >= 0 ? "#00d4aa" : "#ef5350" }}>
                        {t.pnl >= 0 ? "+" : ""}{RS}{t.pnl?.toFixed(2) ?? "0"}
                      </td>
                      <td className="py-3 text-right text-gray-600">{new Date(t.timestamp).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 text-right text-gray-600 font-mono">{new Date(t.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">

          <div className="rounded-2xl p-6" style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}>
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span style={{ color: "#00d4aa" }}>{'\u{1F6E1}\uFE0F'}</span> Account Control
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Blocking freezes the account, prevents login, and removes the user from the leaderboard. Unblocking restores full access.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleBlock}
                disabled={!!user.isBlocked}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition disabled:opacity-30 flex items-center justify-center gap-2"
                style={{ background: "#2a0a0a", color: "#ef5350", border: "1px solid #ef535033" }}
              >
                {'\u{1F6AB}'} Block User
              </button>
              <button
                onClick={handleUnblock}
                disabled={!user.isBlocked}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition disabled:opacity-30 flex items-center justify-center gap-2"
                style={{ background: "#0a2a1a", color: "#00d4aa", border: "1px solid #00d4aa33" }}
              >
                {'\u2705'} Unblock User
              </button>
            </div>
          </div>

          <div className="rounded-2xl p-6" style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}>
            <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <span style={{ color: "#00d4aa" }}>{'\u{1F4B0}'}</span> Balance Management
              <button
                onClick={() => setShowHistory(true)}
                className="ml-auto text-xs underline underline-offset-2 transition"
                style={{ color: "#00d4aa", opacity: 0.7 }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}
              >
                Credit & Debit History
              </button>
            </h2>
            <div className="mb-3">
              <div
                className="flex items-center px-4 py-3 rounded-xl"
                style={{ background: "#0a1410", border: `1px solid ${amountError ? "#ef535044" : "#1a2e22"}` }}
              >
                <span className="text-gray-500 text-sm mr-2 font-mono">{RS}</span>
                <input
                  type="number"
                  value={amount}
                  min={0}
                  onChange={e => { setAmount(e.target.value); setAmountError(""); }}
                  placeholder="0.00"
                  className="bg-transparent outline-none text-white font-mono text-sm w-full placeholder-gray-600"
                />
              </div>
              {amountError && <p className="text-red-400 text-xs mt-1">{amountError}</p>}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCredit}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5"
                style={{ background: "#0a2a1a", color: "#00d4aa", border: "1px solid #00d4aa33" }}
              >
                + Credit Balance
              </button>
              <button
                onClick={handleDebit}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5"
                style={{ background: "#1a1a0a", color: "#f5a623", border: "1px solid #f5a62333" }}
              >
                {'\u2212'} Debit Balance
              </button>
            </div>
          </div>
        </div>

        {actionMsg && (
          <div
            className="fixed bottom-6 right-6 px-5 py-3 rounded-xl text-sm font-medium shadow-2xl z-50"
            style={{
              background: actionMsg.ok ? "#0a2a1a" : "#2a0a0a",
              border:     `1px solid ${actionMsg.ok ? "#00d4aa44" : "#ef535044"}`,
              color:      actionMsg.ok ? "#00d4aa"   : "#ef5350",
            }}
          >
            {actionMsg.text}
          </div>
        )}
      </div>

      <AdminActionHistory
        open={showHistory}
        onClose={() => setShowHistory(false)}
        userId={userId}
        title={`Credit & Debit History - ${user.name}`}
      />
    </div>
  );
}
