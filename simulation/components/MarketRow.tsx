"use client";
import { useEffect, useState } from "react";
import { MarketStock } from "../hooks/useMarkets";

interface Props {
  stock:  MarketStock;
  rank:   number;
  onClick: (stock: MarketStock) => void;
}

function fmtCap(v: number | null): string {
  if (!v) return "\u2014";
  if (v >= 1e12) return `\u20B9${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `\u20B9${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e7)  return `\u20B9${(v / 1e7).toFixed(1)}Cr`;
  return `\u20B9${v.toLocaleString("en-IN")}`;
}

function fmtVol(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export default function MarketRow({ stock, rank, onClick }: Props) {
  const [flash, setFlash] = useState(false);
  const [flashColor, setFlashColor] = useState("");

  useEffect(() => {
    if (!stock.flashDir) return;
    setFlashColor(stock.flashDir === "up" ? "#00d4aa22" : "#ef535022");
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(t);
  }, [stock.price, stock.flashDir]);

  const isPos   = stock.changePct >= 0;
  const color   = isPos ? "#00d4aa" : "#ef5350";

  // Day range bar
  const hasDayRange = stock.dayHigh != null && stock.dayLow != null && stock.dayHigh > stock.dayLow;
  const dayRange    = hasDayRange ? stock.dayHigh! - stock.dayLow! : 0;
  const posDay      = hasDayRange
    ? Math.min(100, Math.max(0, ((stock.price - stock.dayLow!) / dayRange) * 100))
    : 50;

  return (
    <div
      onClick={() => onClick(stock)}
      className="grid items-center px-5 py-3 cursor-pointer transition-all duration-200"
      style={{
        gridTemplateColumns: "48px 1fr 120px 110px 90px 110px 130px",
        borderBottom:  "1px solid #1a1f2e",
        background:    flash ? flashColor : "transparent",
      }}
      onMouseEnter={e => { if (!flash) e.currentTarget.style.background = "#0d1521"; }}
      onMouseLeave={e => { if (!flash) e.currentTarget.style.background = "transparent"; }}
    >
      <span className="text-gray-600 font-mono text-sm font-bold">#{rank}</span>

      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: `${color}18`, color }}
        >
          {stock.id.slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-mono font-semibold text-white truncate">{stock.id}</div>
          <div className="text-xs text-gray-600 truncate">{stock.label !== stock.id ? stock.label : "NSE"}</div>
        </div>
      </div>

      <div
        className="text-right font-mono font-bold text-sm transition-colors duration-300"
        style={{ color: flash && stock.flashDir ? (stock.flashDir === "up" ? "#00d4aa" : "#ef5350") : "white" }}
      >
        ₹{stock.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
      </div>

      <div className="text-right">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold"
          style={{ background: `${color}18`, color }}
        >
          {isPos ? "\u25B2" : "\u25BC"} {Math.abs(stock.changePct).toFixed(2)}%
        </span>
        <div className="text-xs text-gray-600 mt-0.5 font-mono">
          {isPos ? "+" : ""}₹{stock.change.toFixed(2)}
        </div>
      </div>

      <div className="text-right text-sm font-mono text-gray-400">
        {fmtVol(stock.volume)}
      </div>

      <div className="text-right text-sm font-mono text-gray-400">
        {fmtCap(stock.marketCap)}
      </div>

      <div className="px-2">
        {hasDayRange ? (
          <>
            <div className="flex justify-between text-xs text-gray-700 mb-1">
              <span>₹{stock.dayLow!.toFixed(0)}</span>
              <span>₹{stock.dayHigh!.toFixed(0)}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1f2937" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${posDay}%`, background: color }}
              />
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-gray-600">—</div>
        )}
      </div>
    </div>
  );
}
