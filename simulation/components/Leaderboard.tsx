"use client";
import { useState, useEffect, useRef } from "react";
import { LeaderboardEntry } from "@/lib/auth-types";
import { fetchLeaderboard } from "@/lib/leaderboard-api";
import { createChart, AreaSeries, ColorType, LineStyle, type Time } from "lightweight-charts";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtPnL(v: number): string {
  return `${v >= 0 ? "+" : ""}\u20B9${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function Sparkline({ curve }: { curve: { time: number; value: number }[] }) {
  if (curve.length < 2) {
    return <span className="text-gray-700 text-xs">\u2014</span>;
  }
  const w = 80, h = 28;
  const vals = curve.map(p => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const isUp = vals[vals.length - 1] >= vals[0];
  const color = isUp ? "#00d4aa" : "#ef5350";
  const fillId = `grad-${Math.random().toString(36).slice(2)}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EquityCurveChart({ curve }: { curve: { time: number; value: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || curve.length < 1) return;
    ref.current.innerHTML = "";

    const chart = createChart(ref.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#6b7280",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#1f2937", style: LineStyle.Dotted } },
      rightPriceScale: { borderVisible: false, textColor: "#6b7280", scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderVisible: false, timeVisible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { color: "#374151" } },
      width: ref.current.clientWidth,
      height: ref.current.clientHeight,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#00d4aa",
      topColor: "rgba(0,212,170,0.25)",
      bottomColor: "rgba(0,212,170,0.0)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
    });

    const points = curve.length === 1
      ? [{ time: curve[0].time - 1000, value: curve[0].value }, { time: curve[0].time, value: curve[0].value }]
      : curve;
    const data: { time: Time; value: number }[] = [];
    let prevSec = -1;
    for (const p of points) {
      let sec = Math.floor(p.time / 1000);
      if (sec <= prevSec) sec = prevSec + 1;
      prevSec = sec;
      data.push({ time: sec as Time, value: p.value });
    }
    series.setData(data);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth, height: ref.current.clientHeight });
    });
    ro.observe(ref.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, [curve]);

  if (curve.length < 1) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm">
        No trade history yet
      </div>
    );
  }

  return <div ref={ref} className="w-full h-full" />;
}

function AllocationDonut({ allocation, closedLabel, pnlLabel }: { allocation: Record<string, number>; closedLabel?: string; pnlLabel?: boolean }) {
  const COLORS = ["#00d4aa", "#f5a623", "#ef5350", "#7c6ee0", "#60a5fa"];
  const entries = Object.entries(allocation).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div className="text-gray-600 text-sm text-center py-4">{closedLabel ?? "No open positions"}</div>;
  }

  const r = 52, cx = 70, cy = 70, stroke = 18;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = entries.map(([sym, pct], i) => {
    const dash = (pct / 100) * circumference;
    const gap = circumference - dash;
    const seg = { sym, pct, color: COLORS[i % COLORS.length], dasharray: `${dash} ${gap}`, offset };
    offset += dash;
    return seg;
  });

  const topAsset = entries[0];

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f2937" strokeWidth={stroke} />
          {segments.map((seg, i) => (
            <circle
              key={seg.sym}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={seg.dasharray}
              strokeDashoffset={-seg.offset}
              style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
            />
          ))}
          <text x={cx} y={cy - 5} textAnchor="middle" fill="#9ca3af" fontSize="9" fontFamily="Lato">{pnlLabel ? "Top Stock" : "Top Asset"}</text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="#00d4aa" fontSize="12" fontWeight="600" fontFamily="Lato">
            {topAsset[0]}
          </text>
        </svg>
      </div>

      <div className="space-y-2 flex-1">
        {segments.map(seg => (
          <div key={seg.sym} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
              <span className="text-gray-300 font-medium">{seg.sym}</span>
            </div>
            <span className="text-gray-400 font-mono text-xs">{seg.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraderProfile({
  entry, rank, onClose,
}: {
  entry: LeaderboardEntry; rank: number; onClose: () => void;
}) {
  const badgeLabel = rank === 1 ? "GOLD ALPHA" : rank === 2 ? "SILVER ELITE" : rank === 3 ? "BRONZE MASTER" : "PRO TRADER";
  const badgeColor = rank === 1 ? "#f5a623" : rank === 2 ? "#9ba8b4" : rank === 3 ? "#cd7f32" : "#00d4aa";
  const initial = entry.name.charAt(0).toUpperCase();

  const rawAlloc = entry.assetAllocation ?? {};
  const hasAlloc = Object.keys(rawAlloc).length > 0;
  const effectiveAlloc = hasAlloc ? rawAlloc : (() => {
    const acts = entry.recentActivity ?? [];
    const symbols: Record<string, number> = {};
    for (const a of acts) {
      const m = a.match(/×(\w+)/);
      if (m) symbols[m[1]] = (symbols[m[1]] ?? 0) + 1;
    }
    const total = Object.values(symbols).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const sym of Object.keys(symbols)) {
        symbols[sym] = parseFloat(((symbols[sym] / total) * 100).toFixed(1));
      }
      return symbols;
    }
    const top = entry.top5Trades?.[0];
    if (top) return { [top.symbol]: 100 };
    return {};
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d1117", border: "1px solid #1f2937" }}
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${badgeColor}33, ${badgeColor}66)`, border: `1px solid ${badgeColor}55` }}
            >
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Lato" }}>{entry.name}</h2>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44` }}
                >
                  {badgeLabel}
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1">
                Paper trader &middot; {entry.totalTradesCount} completed trades &middot;
                Last active {timeAgo(entry.lastActiveAt ?? entry.lastUpdated)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xl leading-none mt-1">&times;</button>
        </div>

        <div className="grid grid-cols-5 divide-x divide-gray-800 border-b border-gray-800">
          {[
            { label: "Total PNL", value: fmtPnL(entry.totalRealizedPnL), color: entry.totalRealizedPnL >= 0 ? "#00d4aa" : "#ef5350" },
            { label: "ROI", value: `${entry.roiPercent >= 0 ? "+" : ""}${entry.roiPercent?.toFixed(2) ?? "0"}%`, color: entry.roiPercent >= 0 ? "#00d4aa" : "#ef5350" },
            { label: "Win Rate", value: `${entry.winRate}%`, color: entry.winRate >= 50 ? "#00d4aa" : "#ef5350" },
            { label: "Max Drawdown", value: `${entry.maxDrawdown?.toFixed(1) ?? "0"}%`, color: "#ef5350" },
            { label: "Profit Factor", value: entry.profitFactor?.toFixed(2) ?? "\u2014", color: (entry.profitFactor ?? 0) >= 1.5 ? "#00d4aa" : "#9ca3af" },
          ].map(s => (
            <div key={s.label} className="px-4 py-4 text-center">
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="font-bold text-sm" style={{ fontFamily: "Lato", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="p-6 grid grid-cols-3 gap-5">

          <div className="col-span-2">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">Equity Curve</h3>
              <p className="text-xs text-gray-500">Portfolio value over all trades</p>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ height: 200, background: "#0a0e17", border: "1px solid #1f2937" }}
            >
              <EquityCurveChart curve={entry.equityCurve ?? []} />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Asset Allocation</h3>
              <AllocationDonut allocation={effectiveAlloc} closedLabel={entry.totalTradesCount > 0 ? "All positions closed" : "No open positions"} pnlLabel={!hasAlloc && entry.totalTradesCount > 0} />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Advanced Metrics</h3>
              <div className="space-y-2">
                {[
                  { label: "Avg Trade Duration", value: `${entry.avgTradeDurationHours?.toFixed(1) ?? "\u2014"}h` },
                  { label: "Wins / Losses", value: `${entry.winCount}W \u00B7 ${entry.lossCount}L` },
                  { label: "Total Trades", value: String(entry.totalTradesCount) },
                ].map(m => (
                  <div key={m.label} className="flex justify-between items-center px-3 py-1.5 rounded-lg" style={{ background: "#0f1521" }}>
                    <span className="text-xs text-gray-500">{m.label}</span>
                    <span className="text-xs font-mono text-gray-200">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {(entry.recentActivity ?? []).length > 0 && (
          <div className="px-6 pb-6 border-t border-gray-800 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h3>
            <div className="space-y-2">
              {entry.recentActivity.map((act, i) => {
                const parts = act.split(" ");
                const isProfit = parts[0] === "\uD83D\uDCC8";
                const qtySym = (parts[2] ?? "").split("\u00D7");
                const qty = qtySym[0] ?? "";
                const sym = qtySym[1] ?? "";
                const pnlRaw = (parts[3] ?? "").replace("\u20B9", "");
                const pnlVal = parseInt(pnlRaw) || 0;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition"
                    style={{ background: "#0f1521", border: "1px solid #1a2035" }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isProfit ? "#00d4aa18" : "#ef535018" }}
                    >
                      <span style={{ fontSize: 14, color: isProfit ? "#00d4aa" : "#ef5350" }}>{isProfit ? "\u25B2" : "\u25BC"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white" style={{ fontFamily: "Lato" }}>{sym}</span>
                        <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{qty} shares</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">Sold {timeAgo(entry.lastActiveAt ?? entry.lastUpdated)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold font-mono" style={{ color: isProfit ? "#00d4aa" : "#ef5350" }}>
                        {pnlVal >= 0 ? "+" : ""}{"\u20B9"}{Math.abs(pnlVal).toLocaleString("en-IN")}
                      </div>
                      <div
                        className="text-xs font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block"
                        style={{ background: isProfit ? "#00d4aa18" : "#ef535018", color: isProfit ? "#00d4aa" : "#ef5350" }}
                      >
                        {isProfit ? "Profit" : "Loss"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [selRank, setSelRank] = useState(0);

  useEffect(() => {
    function load() { fetchLeaderboard().then(data => setEntries(data.slice(0, 10))); }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const total = entries.length;

  const podium = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardEntry[];
  const podiumRanks = [2, 1, 3];

  const BADGE_STYLES = {
    1: { label: "CURRENT CHAMPION", sub: "Gold Alpha", border: "#f5a62355", bg: "#f5a62308", glow: "0 0 30px #f5a62322", color: "#f5a623" },
    2: { label: "RANK 2", sub: "Silver Elite", border: "#9ba8b455", bg: "#9ba8b408", glow: "none", color: "#9ba8b4" },
    3: { label: "RANK 3", sub: "Bronze Master", border: "#cd7f3255", bg: "#cd7f3208", glow: "none", color: "#cd7f32" },
  } as const;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Lato" }}>Global Leaderboard</h2>
          <p className="text-gray-500 text-sm mt-0.5">Top {total} traders by realized P&amp;L</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Active Traders  </span>
            <span className="font-mono font-bold text-teal-400">{total}</span>
          </div>
        </div>
      </div>

      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {podium.map((entry, i) => {
            const rank = podiumRanks[i];
            const style = BADGE_STYLES[rank as 1 | 2 | 3];
            const isGold = rank === 1;
            return (
              <div
                key={entry.userId}
                onClick={() => { setSelected(entry); setSelRank(rank); }}
                className={`rounded-2xl p-5 cursor-pointer transition hover:scale-[1.02] ${isGold ? "row-start-1" : ""}`}
                style={{
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  boxShadow: style.glow,
                  order: isGold ? -1 : undefined,
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold"
                    style={{ background: `${style.color}22`, color: style.color, border: `1px solid ${style.color}44` }}
                  >
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-right">
                    <div className="text-xs" style={{ color: style.color }}>{style.label}</div>
                    <div className="text-sm font-bold mt-0.5" style={{ color: style.color, fontFamily: "Lato" }}>
                      {style.sub}
                    </div>
                  </div>
                </div>

                <div className="text-lg font-bold text-white mb-1" style={{ fontFamily: "Lato" }}>
                  {entry.name}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <div className="text-xs text-gray-500">30D PNL</div>
                    <div className="font-bold mt-0.5 font-mono" style={{ color: entry.totalRealizedPnL >= 0 ? "#00d4aa" : "#ef5350" }}>
                      {fmtPnL(entry.totalRealizedPnL)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ROI</div>
                    <div className="font-bold mt-0.5 font-mono" style={{ color: entry.totalRealizedPnL >= 0 ? "#00d4aa" : "#ef5350" }}>
                      {entry.roiPercent >= 0 ? "+" : ""}{entry.roiPercent?.toFixed(1) ?? "0"}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1f2937" }}>
          <div
            className="grid text-xs text-gray-500 font-medium uppercase tracking-wider px-5 py-3"
            style={{ gridTemplateColumns: "60px 1fr 160px 100px 100px 100px", background: "#0d1117", borderBottom: "1px solid #1f2937" }}
          >
            <span>Rank</span>
            <span>Trader</span>
            <span className="text-right">Total PNL</span>
            <span className="text-right">ROI %</span>
            <span className="text-right">Win Rate</span>
            <span className="text-right">Performance</span>
          </div>

          {rest.map((entry, i) => {
            const rank = i + 4;
            const isPos = entry.totalRealizedPnL >= 0;
            return (
              <div
                key={entry.userId}
                onClick={() => { setSelected(entry); setSelRank(rank); }}
                className="grid items-center px-5 py-3.5 cursor-pointer transition hover:bg-gray-800/30"
                style={{
                  gridTemplateColumns: "60px 1fr 160px 100px 100px 100px",
                  borderBottom: i < rest.length - 1 ? "1px solid #1f2937" : "none",
                }}
              >
                <span className="text-gray-500 font-mono font-bold text-sm">#{rank}</span>

                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "#1a2035", color: "#00d4aa" }}
                  >
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white" style={{ fontFamily: "Lato" }}>{entry.name}</div>
                    <div className="text-xs text-gray-600">Last active: {timeAgo(entry.lastActiveAt ?? entry.lastUpdated)}</div>
                  </div>
                </div>

                <div className="text-right font-mono font-bold text-sm" style={{ color: isPos ? "#00d4aa" : "#ef5350" }}>
                  {fmtPnL(entry.totalRealizedPnL)}
                </div>

                <div className="text-right">
                  <span
                    className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                    style={{
                      background: isPos ? "#00d4aa18" : "#ef535018",
                      color: isPos ? "#00d4aa" : "#ef5350",
                    }}
                  >
                    {isPos ? "+" : ""}{entry.roiPercent?.toFixed(1) ?? "0"}%
                  </span>
                </div>

                <div className="text-right text-sm font-mono text-gray-300">
                  {entry.winRate.toFixed(1)}%
                </div>

                <div className="flex justify-end">
                  <Sparkline curve={entry.equityCurve ?? []} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && (
        <div className="text-center py-20" style={{ color: "#374151" }}>
          <div className="text-5xl mb-4">{'\uD83C\uDFC6'}</div>
          <p className="text-gray-600">No traders yet. Complete a sell trade to appear here.</p>
        </div>
      )}

      {selected && (
        <TraderProfile
          entry={selected}
          rank={selRank}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
