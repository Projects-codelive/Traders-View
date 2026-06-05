"use client";
import { useEffect, useState } from "react";
import { MarketStock } from "../hooks/useMarkets";

interface Props {
  stock:  MarketStock;
  rank:   number;
  onClick: (stock: MarketStock) => void;
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "\u20B9", USD: "$" };
const isUSD = (s: MarketStock) => s.currency === "USD";

function fmtCap(v: number | null, currency: string): string {
  if (!v) return "\u2014";
  const sym = CURRENCY_SYMBOLS[currency] ?? "\u20B9";
  if (v >= 1e12) return `${sym}${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `${sym}${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e7 && currency === "INR") return `${sym}${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e6 && currency === "USD") return `${sym}${(v / 1e6).toFixed(1)}M`;
  return `${sym}${v.toLocaleString(currency === "USD" ? "en-US" : "en-IN")}`;
}

function fmtVol(v: number): string {
  if (v >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3)  return `${(v / 1e3).toFixed(1)}K`;
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
  const usd     = isUSD(stock);
  const sym     = CURRENCY_SYMBOLS[stock.currency ?? "INR"] ?? "\u20B9";
  const locale  = usd ? "en-US" : "en-IN";

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
          <div className="text-xs text-gray-600 truncate">{stock.label !== stock.id ? stock.label : (usd ? "Crypto" : "NSE")}</div>
        </div>
      </div>

      <div
        className="text-right font-mono font-bold text-sm transition-colors duration-300"
        style={{ color: flash && stock.flashDir ? (stock.flashDir === "up" ? "#00d4aa" : "#ef5350") : "white" }}
      >
        {sym}{stock.price.toLocaleString(locale, { maximumFractionDigits: 2 })}
      </div>

      <div className="text-right">
        <span
          className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold"
          style={{ background: `${color}18`, color }}
        >
          {isPos ? "\u25B2" : "\u25BC"} {Math.abs(stock.changePct).toFixed(2)}%
        </span>
        <div className="text-xs text-gray-600 mt-0.5 font-mono">
          {isPos ? "+" : ""}{sym}{stock.change.toFixed(2)}
        </div>
      </div>

      <div className="text-right text-sm font-mono text-gray-400">
        {fmtVol(stock.volume)}
      </div>

      <div className="text-right text-sm font-mono text-gray-400">
        {fmtCap(stock.marketCap, stock.currency ?? "INR")}
      </div>

      <div className="px-2">
        {hasDayRange ? (
          <>
            <div className="flex justify-between text-xs text-gray-700 mb-1">
              <span>{sym}{usd ? stock.dayLow!.toFixed(2) : stock.dayLow!.toFixed(0)}</span>
              <span>{sym}{usd ? stock.dayHigh!.toFixed(2) : stock.dayHigh!.toFixed(0)}</span>
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
