"use client";
import { useState, useEffect } from "react";
import { TradeLot } from "@/lib/auth-types";

interface Props {
  isOpen: boolean;
  lots: TradeLot[];
  initialSelectedLot: TradeLot | null;
  currentPrice: number;
  onConfirm: (lotId: string, qty: number) => void;
  onClose: () => void;
}

export default function SellLotModal({
  isOpen,
  lots,
  initialSelectedLot,
  currentPrice,
  onConfirm,
  onClose,
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
      setQty(1);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialSelectedLot]);

  const activeLot = lots.find((l) => l.lotId === selectedLotId) || lots[0];

  // Clamp quantity if selected lot or its remaining quantity changes
  const remainingQty = activeLot?.remainingQty;
  useEffect(() => {
    if (activeLot) {
      setQty((prev) => Math.max(1, Math.min(activeLot.remainingQty, prev)));
      setError("");
    }
  }, [selectedLotId, remainingQty]);

  if (!isOpen || lots.length === 0 || !activeLot) return null;

  const pnlPerShare = parseFloat((currentPrice - activeLot.buyPrice).toFixed(2));
  const estimatedPnL = parseFloat((pnlPerShare * qty).toFixed(2));
  const proceeds = parseFloat((currentPrice * qty).toFixed(2));
  const isProfit = estimatedPnL >= 0;

  function handleQtyChange(val: number) {
    const clamped = Math.max(1, Math.min(activeLot.remainingQty, val || 1));
    setQty(clamped);
    setError("");
  }

  function handleConfirm() {
    if (qty < 1) {
      setError("Qty must be at least 1.");
      return;
    }
    if (qty > activeLot.remainingQty) {
      setError(`Max ${activeLot.remainingQty} shares available.`);
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
            <h2 className="text-lg font-bold text-white">Sell {activeLot.symbol}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choose an entry lot to sell shares from
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
                const lotPnL = (currentPrice - lot.buyPrice) * lot.remainingQty;
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
                          {lot.remainingQty} Share{lot.remainingQty !== 1 && "s"}{" "}
                          @ ₹{lot.buyPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-bold font-mono ${
                          isLotProfit ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {isLotProfit ? "+" : ""}₹{lotPnL.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {((currentPrice - lot.buyPrice) / lot.buyPrice * 100).toFixed(2)}%
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
              { label: "Lot Buy Price", value: `₹${activeLot.buyPrice.toFixed(2)}` },
              { label: "Current Price", value: `₹${currentPrice.toFixed(2)}` },
              { label: "Lot Shares Held", value: `${activeLot.remainingQty}` },
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
              Quantity to Sell
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQtyChange(qty - 1)}
                disabled={qty <= 1}
                className="w-9 h-9 rounded-lg bg-gray-850 hover:bg-gray-800 disabled:opacity-30 text-white font-bold text-lg flex items-center justify-center transition border border-gray-750"
              >
                &minus;
              </button>
              <input
                type="number"
                value={qty}
                min={1}
                max={activeLot.remainingQty}
                onChange={(e) => handleQtyChange(parseInt(e.target.value))}
                className="flex-1 bg-gray-855 border border-gray-750 rounded-lg px-3 py-2 text-white font-mono text-center text-lg focus:outline-none focus:border-yellow-500"
              />
              <button
                type="button"
                onClick={() => handleQtyChange(qty + 1)}
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
                Sell All
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
                  const target = Math.max(1, Math.round(activeLot.remainingQty * ratio));
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
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Estimated Proceeds</div>
                <div className="text-lg font-bold font-mono text-white">
                  ₹{proceeds.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">P&L on this sale</div>
                <div
                  className={`text-lg font-bold font-mono ${
                    isProfit ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isProfit ? "+" : ""}₹{estimatedPnL.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">P&L per share</div>
                <div
                  className={`text-sm font-bold font-mono ${
                    isProfit ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isProfit ? "+" : ""}₹{pnlPerShare.toFixed(2)}
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
              {activeLot.remainingQty - qty} share
              {activeLot.remainingQty - qty !== 1 ? "s" : ""} will remain in this
              lot after sale.
            </p>
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm transition"
            >
              Confirm Sell
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
