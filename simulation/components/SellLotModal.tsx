"use client";
import { useState, useEffect } from "react";
import { TradeLot } from "@/lib/auth-types";
import { getSimStock } from "../engine/marketData";

interface Props {
  isOpen: boolean;
  lots: TradeLot[];
  initialSelectedLot: TradeLot | null;
  currentPrice: number;
  onConfirm: (lotId: string, qty: number) => void;
  onClose: () => void;
  isShort?: boolean;
  marketOpen: boolean;
  initialQty?: number;
}

export default function SellLotModal({
  isOpen,
  lots,
  initialSelectedLot,
  currentPrice,
  onConfirm,
  onClose,
  isShort,
  marketOpen,
  initialQty,
}: Props) {
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [error, setError] = useState("");

  // Initialize selected lot ID and qty
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedLot) {
        setSelectedLotId(initialSelectedLot.lotId);
      } else if (lots.length > 0) {
        setSelectedLotId(lots[0].lotId);
      } else {
        setSelectedLotId("");
      }
      setQty(initialQty !== undefined ? initialQty : 1);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialSelectedLot]);

  const activeLot = lots.find((l) => l.lotId === selectedLotId) || lots[0];
  const isCrypto = activeLot ? (activeLot.symbol.endsWith("-USD") || activeLot.symbol.endsWith("-USDT") || activeLot.symbol.endsWith("-USDC")) : false;
  const quoteLabel = activeLot?.symbol.endsWith("-USDT") ? "USDT" : (activeLot?.symbol.endsWith("-USDC") || activeLot?.symbol.endsWith("-USD") ? "USDC" : "INR");
  const minQty = isCrypto ? 0.000001 : 1;
  const step = isCrypto ? 0.0001 : 1;
  const baseAsset = isCrypto && activeLot ? activeLot.symbol.split("-")[0] : "Share";

  // Clamp quantity if selected lot or its remaining quantity changes
  const remainingQty = activeLot?.remainingQty;
  useEffect(() => {
    if (activeLot) {
      setQty((prev) => Math.max(minQty, Math.min(activeLot.remainingQty, prev)));
      setError("");
    }
  }, [selectedLotId, remainingQty, minQty]);

  if (!isOpen || lots.length === 0 || !activeLot) return null;

  const stockCfg = getSimStock(activeLot.symbol);
  const csym = "\u20B9";
  const decimals = 2;

  const pnlPerShare = parseFloat((isShort ? activeLot.buyPrice - currentPrice : currentPrice - activeLot.buyPrice).toFixed(decimals));
  const estimatedPnL = parseFloat((pnlPerShare * qty).toFixed(decimals));
  const proceeds = isShort
    ? parseFloat((qty * (2 * activeLot.buyPrice - currentPrice)).toFixed(decimals))
    : parseFloat((currentPrice * qty).toFixed(decimals));
  const isProfit = estimatedPnL >= 0;

  function handleQtyChange(val: number) {
    const clamped = Math.max(minQty, Math.min(activeLot.remainingQty, val || minQty));
    setQty(clamped);
    setError("");
  }

  function handleConfirm() {
    if (qty < minQty) {
      setError(`Qty must be at least ${minQty}.`);
      return;
    }
    if (qty > activeLot.remainingQty) {
      setError(`Max ${activeLot.remainingQty} available.`);
      return;
    }
    onConfirm(activeLot.lotId, qty);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800 bg-gray-950/40">
          <div>
            <h2 className="text-lg font-bold text-white">{isShort ? "Cover Short" : "Sell"} {activeLot.symbol}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isShort ? "Choose a short position to cover" : isCrypto ? "Choose an entry lot to sell from" : "Choose an entry lot to sell shares from"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-2xl leading-none transition"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Lots selector list */}
          <div className="space-y-2">
            <span className="text-[10px] text-gray-500 block font-semibold uppercase tracking-wider">
              Available Trade Lots ({lots.length})
            </span>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {lots.map((lot) => {
                const isSelected = lot.lotId === selectedLotId;
                const buyDate = new Date(lot.buyTimestamp).toLocaleDateString(
                  "en-IN",
                  {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                );
                const lotPnL = (isShort ? lot.buyPrice - currentPrice : currentPrice - lot.buyPrice) * lot.remainingQty;
                const isLotProfit = lotPnL >= 0;

                return (
                  <div
                    key={lot.lotId}
                    onClick={() => setSelectedLotId(lot.lotId)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition
                      ${
                        isSelected
                          ? "bg-yellow-955/10 border-yellow-500/60 shadow-lg shadow-yellow-955/5"
                          : "bg-gray-800/60 border-gray-750 hover:bg-gray-800 hover:border-gray-700"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="sell-lot-select"
                        checked={isSelected}
                        onChange={() => setSelectedLotId(lot.lotId)}
                        className="accent-yellow-500 cursor-pointer"
                      />
                      <div>
                        <div className="text-[10px] text-gray-500">{buyDate}</div>
                        <div className="text-sm font-semibold text-white mt-0.5">
                        {isCrypto
                          ? `${lot.remainingQty.toFixed(4)} ${baseAsset}`
                          : `${lot.remainingQty} Share${lot.remainingQty !== 1 ? "s" : ""}`}{" "}
                        @ {csym}{lot.buyPrice.toFixed(decimals)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold font-mono ${
                          isLotProfit ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {isLotProfit ? "+" : ""}{csym}{lotPnL.toFixed(decimals)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {((isShort ? lot.buyPrice - currentPrice : currentPrice - lot.buyPrice) / lot.buyPrice * 100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Info card for selected lot */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: isShort ? "Short Price" : "Lot Buy Price", value: `${csym}${activeLot.buyPrice.toFixed(decimals)}` },
              { label: "Current Price", value: `${csym}${currentPrice.toFixed(decimals)}` },
              { label: isCrypto ? `Lot ${baseAsset} Held` : "Lot Shares Held", value: isCrypto ? `${activeLot.remainingQty.toFixed(4)}` : `${activeLot.remainingQty}` },
            ].map((s) => (
              <div key={s.label} className="bg-gray-850 border border-gray-800 rounded-xl p-3 text-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{s.label}</div>
                <div className="text-sm font-bold text-white font-mono">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Qty Input controls */}
          <div>
            <label className="text-xs text-gray-400 block font-semibold uppercase tracking-wider mb-1.5">
              {isShort ? "Quantity to Cover" : isCrypto ? `Quantity to Sell (${baseAsset})` : "Quantity to Sell"}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQtyChange(parseFloat((qty - step).toFixed(6)))}
                disabled={qty <= minQty}
                className="w-9 h-9 rounded-lg bg-gray-850 hover:bg-gray-800 disabled:opacity-30 text-white font-bold text-lg flex items-center justify-center transition border border-gray-750"
              >
                &minus;
              </button>
              <input
                type="number"
                value={qty}
                min={minQty}
                max={activeLot.remainingQty}
                step={step}
                onChange={(e) => handleQtyChange(parseFloat(e.target.value || "0"))}
                className="flex-1 bg-gray-855 border border-gray-750 rounded-lg px-3 py-2 text-white font-mono text-center text-lg focus:outline-none focus:border-yellow-500"
              />
              <button
                type="button"
                onClick={() => handleQtyChange(parseFloat((qty + step).toFixed(6)))}
                disabled={qty >= activeLot.remainingQty}
                className="w-9 h-9 rounded-lg bg-gray-855 hover:bg-gray-800 disabled:opacity-30 text-white font-bold text-lg flex items-center justify-center transition border border-gray-750"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => handleQtyChange(activeLot.remainingQty)}
                className="text-xs font-semibold text-yellow-400 hover:text-yellow-300 px-2 transition"
              >
                {isShort ? "Cover All" : "Sell All"}
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
          </div>

          {/* Ratio Selector Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider mr-1">Ratios:</span>
            {[0.25, 0.5, 0.75, 1.0].map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => {
                  const raw = activeLot.remainingQty * ratio;
                  const target = isCrypto
                    ? parseFloat(raw.toFixed(6))
                    : Math.max(1, Math.round(raw));
                  setQty(target);
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition border border-gray-750"
              >
                {ratio * 100}%
              </button>
            ))}
          </div>

          {/* Proceeds Breakdown Card */}
          <div
            className={`rounded-xl border p-4 ${
              isProfit
                ? "bg-green-950/20 border-green-800/40"
                : "bg-red-950/20 border-red-800/40"
            }`}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{isShort ? "Estimated Credit" : "Estimated Proceeds"}</div>
                <div className="text-lg font-bold font-mono text-white">
                  {csym}{proceeds.toFixed(decimals)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{isShort ? "P&L on this cover" : "P&L on this sale"}</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    isProfit ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isProfit ? "+" : ""}{csym}{estimatedPnL.toFixed(decimals)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">{isCrypto ? `P&L per ${baseAsset}` : "P&L per share"}</div>
                <div
                  className={`text-sm font-bold font-mono ${
                    isProfit ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isProfit ? "+" : ""}{csym}{pnlPerShare.toFixed(decimals)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Return Pct %</div>
                <div
                  className={`text-sm font-bold font-mono ${
                    isProfit ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isProfit ? "+" : ""}
                  {((pnlPerShare / activeLot.buyPrice) * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {activeLot.remainingQty - qty > 0 && (
            <p className="text-[10px] text-gray-500 text-center">
              {isCrypto
                ? `${parseFloat((activeLot.remainingQty - qty).toFixed(6))} ${baseAsset}`
                : `${activeLot.remainingQty - qty} share${activeLot.remainingQty - qty !== 1 ? "s" : ""}`}{" "}
              will remain in this lot after sale.
            </p>
          )}

          {!marketOpen && (
            <p className="text-[10px] text-orange-400 text-center mb-2 font-bold">{'\u26A0\uFE0F'} Market is closed</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-sm transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!marketOpen}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isShort ? "Confirm Cover" : "Confirm Sell"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
