"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSimStock, registerSymbol } from "@/simulation/engine/marketData";
import { useRealPrice, setSymbolPriority } from "@/simulation/hooks/useRealPrice";
import { useSimWallet } from "@/simulation/hooks/useSimWallet";
import { useSymbolRegistry } from "@/simulation/hooks/useSymbolRegistry";
import SymbolSearch from "@/simulation/components/SymbolSearch";
import NSEChart from "@/simulation/components/NSEChart";
import SellLotModal from "@/simulation/components/SellLotModal";
import { TradeLot, ShortPosition } from "@/lib/auth-types";
import { getMarketStatus, formatDuration } from "@/lib/marketHours";

function currencySym(cfg: { currency?: string }): string {
  return cfg.currency === "USD" ? "$" : "\u20B9";
}

function TabStock({ symbol, isSelected, hasLots, onSelect, onRemove, removeDisabled }: {
  symbol: string;
  isSelected: boolean;
  hasLots: boolean;
  onSelect: () => void;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const tick = useRealPrice(symbol);
  const cfg = getSimStock(symbol)!;
  const isUp = tick.changePct >= 0;
  const isLive = tick.isLive && tick.price > 0;
  const csym = currencySym(cfg);

  return (
    <div className="relative group flex items-center gap-0 flex-shrink-0">
      <button
        onClick={onSelect}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap
          ${isSelected
            ? cfg.isIndex ? "bg-cyan-500 text-white" : "bg-green-500 text-black"
            : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
          }`}
      >
        <span className="font-semibold">{cfg.label}</span>
        {isLive && (
          <>
            <span className={`text-xs font-mono ${isUp ? (isSelected ? "text-green-900" : "text-green-400") : isSelected ? "text-red-900" : "text-red-400"}`}>
              {csym}{tick.price.toFixed(2)}
            </span>
            <span className={`text-[10px] ${isUp ? (isSelected ? "text-green-900" : "text-green-400") : isSelected ? "text-red-900" : "text-red-400"}`}>
              {isUp ? "▲" : "▼"}{Math.abs(tick.changePct).toFixed(2)}%
            </span>
          </>
        )}
        {!isLive && tick.price > 0 && (
          <span className="text-xs text-gray-500">{csym}{tick.price.toFixed(2)}</span>
        )}
        {!tick.isLive && tick.error && (
          <span className="text-xs text-gray-600">—</span>
        )}
      </button>
      {hasLots && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-yellow-400 rounded-full" />
      )}
      {onRemove && (
        <button
          onClick={e => {
            e.stopPropagation();
            if (!removeDisabled) onRemove();
          }}
          disabled={removeDisabled}
          className={`ml-1 w-5 h-5 rounded-full flex items-center justify-center text-xs transition flex-shrink-0
            ${removeDisabled
              ? "text-gray-700 cursor-not-allowed"
              : "text-gray-500 hover:text-red-400 hover:bg-red-400/20"
            }`}
          title={removeDisabled ? "Close positions first" : "Remove tab"}
        >
          ×
        </button>
      )}
    </div>
  );
}

function HoldingLot({ lot, onSell }: { lot: TradeLot; onSell: (lot: TradeLot) => void }) {
  const tick = useRealPrice(lot.symbol);
  const cp = tick.inrPrice > 0 ? tick.inrPrice : lot.buyPrice;
  const upnl = parseFloat(((cp - lot.buyPrice) * lot.remainingQty).toFixed(2));
  const isProfit = upnl >= 0;
  const stock = getSimStock(lot.symbol);
  const csym = "\u20B9";
  const locale = "en-IN";
  const buyDate = new Date(lot.buyTimestamp).toLocaleDateString(locale, { day: "2-digit", month: "short" });
  const buyTime = new Date(lot.buyTimestamp).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      onClick={() => onSell(lot)}
      className="bg-gray-800 rounded-xl p-3 cursor-pointer hover:bg-gray-700 transition group"
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-white">{lot.symbol}</span>
            <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded font-mono">
              {lot.remainingQty}/{lot.originalQty}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {buyDate} {buyTime} {'\u00B7'} {csym}{lot.buyPrice.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold font-mono ${isProfit ? "text-green-400" : "text-red-400"}`}>
            {isProfit ? "+" : ""}{csym}{upnl.toFixed(2)}
          </div>
          <div className={`text-xs ${isProfit ? "text-green-600" : "text-red-600"}`}>
            {isProfit ? "▲" : "▼"}{Math.abs(((cp - lot.buyPrice) / lot.buyPrice) * 100).toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-600 group-hover:text-green-500 mt-1.5 transition">
        Tap to sell from this lot {'\u2192'}
      </div>
    </div>
  );
}

function ShortPositionCard({ position, onCover }: { position: ShortPosition; onCover: (pos: ShortPosition) => void }) {
  const tick = useRealPrice(position.symbol);
  const cp = tick.inrPrice > 0 ? tick.inrPrice : position.shortPrice;
  const upnl = parseFloat(((position.shortPrice - cp) * position.remainingQty).toFixed(2));
  const isProfit = upnl >= 0;
  const buyDate = new Date(position.openTimestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const buyTime = new Date(position.openTimestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      onClick={() => onCover(position)}
      className="bg-gray-800 rounded-xl p-3 cursor-pointer hover:bg-gray-700 transition group"
      style={{ border: "1px solid #ef535033" }}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-bold px-1 py-0.5 rounded uppercase"
              style={{ background: "#ef535022", color: "#ef5350" }}
            >
              SHORT
            </span>
            <span className="font-semibold text-sm text-white">{position.symbol}</span>
            <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded font-mono">
              {position.remainingQty}/{position.originalQty}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {buyDate} {buyTime} {'\u00B7'} {'\u20B9'}{position.shortPrice.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold font-mono ${isProfit ? "text-green-400" : "text-red-400"}`}>
            {isProfit ? "+" : ""}{'\u20B9'}{upnl.toFixed(2)}
          </div>
          <div className={`text-xs ${isProfit ? "text-green-600" : "text-red-600"}`}>
            {isProfit ? "\u25BC price fell" : "\u25B2 price rose"}
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-600 group-hover:text-red-400 mt-1.5 transition">
        Tap to cover this short {'\u2192'}
      </div>
    </div>
  );
}

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading, logout } = useAuth();

  const [selected, setSelected] = useState("NIFTY");
  const [qty, setQty] = useState(1);
  const [tradeMsg, setTradeMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [initialSellLot, setInitialSellLot] = useState<TradeLot | null>(null);
  const [sellLotTarget, setSellLotTarget] = useState<TradeLot | null>(null);
  type TradeMode = "long" | "short";
  const [tradeMode, setTradeMode] = useState<TradeMode>("long");

  useEffect(() => {
    if (!loading && !session) router.replace("/");
  }, [session, loading]);

  // Read ?symbol= URL param on mount (set by markets page)
  useEffect(() => {
    const sym = searchParams.get("symbol");
    if (!sym) return;
    const s = sym.toUpperCase();
    if (getSimStock(s)) {
      setSelected(s);
      setSymbolPriority(s);
    }
  }, []);

  useEffect(() => {
    setSymbolPriority(selected);
  }, [selected]);

  // Hooks MUST be before the early return to comply with Rules of Hooks
  const { activeTabs, removeSymbol, addSymbol } = useSymbolRegistry();
  const liveTick = useRealPrice(selected);
  const wallet = useSimWallet(session?.userId ?? "", session?.name ?? "", () => {
    logout();
    router.push("/");
  });
  const selectedStock = getSimStock(selected) ?? getSimStock("NIFTY")!;
  const csym = currencySym(selectedStock);
  const usdLocale = selectedStock.currency === "USD";
  const marketStatus = getMarketStatus(selectedStock.sector);

  // Live countdown when market is closed
  const [countdownLabel, setCountdownLabel] = useState("");
  const [countdownMs, setCountdownMs] = useState(0);
  useEffect(() => {
    if (marketStatus.open) { setCountdownLabel(""); setCountdownMs(0); return; }
    const id = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, marketStatus.nextOpenMs - now);
      setCountdownMs(remaining);
      setCountdownLabel(formatDuration(remaining));
    }, 1000);
    return () => clearInterval(id);
  }, [marketStatus.open, marketStatus.nextOpenMs]);

  // Ensure URL symbol is synced into activeTabs (backup if markets page missed it)
  useEffect(() => {
    const sym = searchParams.get("symbol");
    if (!sym) return;
    const s = sym.toUpperCase();
    if (!activeTabs.some(t => t.id === s) && getSimStock(s)) {
      // Skip if markets page already saved it (prevents overwriting localStorage)
      try {
        const raw = localStorage.getItem("pt_custom_symbols");
        const existing = raw ? JSON.parse(raw) : [];
        if (existing.find((x: any) => x.id === s)) return;
      } catch {}
      const stock = getSimStock(s)!;
      addSymbol({
        id: stock.id,
        label: stock.label,
        yahooSymbol: stock.yahooSymbol,
        sector: stock.sector,
        isIndex: stock.isIndex,
      });
    }
  }, []);

  if (loading || !session) return null;

  const holding = wallet.getOpenLots(selected);
  const isIndex = selectedStock.isIndex;
  const tradeCost = parseFloat((qty * liveTick.inrPrice).toFixed(2));

  const openLotSymbols = new Set([
    ...wallet.getAllOpenLots().map(l => l.symbol),
    ...wallet.state.shortPositions.filter(p => !p.isClosed).map(p => p.symbol),
  ]);

  const currentPrices: Record<string, number> = {};
  activeTabs.forEach(s => {
    currentPrices[s.id] = s.basePrice;
  });

  const portfolioValue = wallet.getTotalPortfolioValue(currentPrices);
  const isUp = liveTick.changePct >= 0;

  function handleSymbolSelect(id: string) {
    setSelected(id);
    setQty(1);
    setTradeMsg(null);
    setTradeMode("long");
  }

  function handleSearchSelect(result: {
    id: string; label: string; yahooSymbol: string;
    sector: string; isIndex: boolean;
  }) {
    const isCrypto = result.sector === "Crypto";
    registerSymbol({
      id:          result.id,
      label:       result.label,
      yahooSymbol: result.yahooSymbol,
      basePrice:   0,
      volatility:  0.015,
      drift:       0.00005,
      sector:      result.sector,
      lotSize:     1,
      isIndex:     result.isIndex,
      isPinned:    false,
      tvSymbol:    isCrypto ? result.yahooSymbol : `NSE:${result.id}`,
      currency:    isCrypto ? "USD" : "INR",
    });
    addSymbol(result);
    handleSymbolSelect(result.id);
  }

  function handleBuy() {
    if (!liveTick.isLive) return;
    const buyPrice = liveTick.inrPrice;
    const ok = wallet.buy(selected, qty, buyPrice);
    const totalCost = (qty * buyPrice).toFixed(2);
    const isCryptoStock = selectedStock.currency === "USD";
    let pricePart: string;
    if (isCryptoStock) {
      pricePart = "$" + liveTick.price.toFixed(2) + " (\u20B9" + buyPrice.toFixed(2) + ")";
    } else {
      pricePart = "\u20B9" + buyPrice.toFixed(2);
    }
    setTradeMsg(ok
      ? { text: "\u2705 New lot: " + qty + " \u00D7 " + selected + " @ " + pricePart + " | Cost \u20B9" + totalCost, ok: true }
      : { text: "\u274C " + wallet.lastError, ok: false }
    );
    setTimeout(() => { setTradeMsg(null); wallet.clearError(); }, 4000);
  }

  function handleSellClick() {
    const symbolLots = wallet.getOpenLots(selected);
    if (symbolLots.length === 0) {
      setTradeMsg({ text: `\u274C You do not own any positions of ${selected} to sell.`, ok: false });
      setTimeout(() => setTradeMsg(null), 4000);
      return;
    }
    if (symbolLots.length === 1) {
      handleSellLot(symbolLots[0].lotId, symbolLots[0].remainingQty);
      return;
    }
    setInitialSellLot(null);
    setIsSellModalOpen(true);
  }

  function handleCoverClick() {
    const shortPositions = wallet.getOpenShorts(selected);
    if (shortPositions.length === 0) {
      setTradeMsg({ text: `\u274C No open short positions of ${selected} to cover.`, ok: false });
      setTimeout(() => setTradeMsg(null), 4000);
      return;
    }
    if (shortPositions.length === 1) {
      handleCoverShort(shortPositions[0].positionId, shortPositions[0].remainingQty);
      return;
    }
    setInitialSellLot(null);
    setIsSellModalOpen(true);
  }

  function handleSellLot(lotId: string, qtySold: number) {
    if (!liveTick.isLive) {
      setTradeMsg({ text: "\u274C Cannot sell \u2014 price feed is unavailable right now.", ok: false });
      setTimeout(() => setTradeMsg(null), 4000);
      return;
    }
    const sellPrice = liveTick.inrPrice;
    const lot = wallet.state.lots.find(l => l.lotId === lotId);
    const ok = wallet.sellLot(lotId, qtySold, sellPrice);
    if (ok) {
      const hasRemaining = wallet.getOpenLots(selected).length > 0 || wallet.getOpenShorts(selected).length > 0;
      if (!hasRemaining) {
        const sim = getSimStock(selected);
        if (sim && !sim.isPinned) removeSymbol(selected);
      }
      const pnl = (sellPrice - (lot?.buyPrice ?? 0)) * qtySold;
      const pnlStr = (pnl >= 0 ? "+" : "") + "\u20B9" + pnl.toFixed(2);
      const isCryptoStock = selectedStock.currency === "USD";
      let pricePart: string;
      if (isCryptoStock) {
        pricePart = "$" + liveTick.price.toFixed(2) + " (\u20B9" + sellPrice.toFixed(2) + ")";
      } else {
        pricePart = "\u20B9" + sellPrice.toFixed(2);
      }
      setTradeMsg({
        text: "\u2705 Sold " + qtySold + " \u00D7 " + selected + " @ " + pricePart + " | P&L: " + pnlStr,
        ok: pnl >= 0,
      });
    } else {
      setTradeMsg({ text: "\u274C " + wallet.lastError, ok: false });
    }
    setTimeout(() => { setTradeMsg(null); wallet.clearError(); }, 4000);
  }

  function handleOpenShort() {
    if (!liveTick.isLive) return;
    const ok = wallet.openShort(selected, qty, liveTick.inrPrice);
    const cost = (qty * liveTick.inrPrice).toFixed(2);
    setTradeMsg(ok
      ? { text: "\uD83D\uDD3B Short opened: " + qty + " \u00D7 " + selected + " @ \u20B9" + liveTick.inrPrice.toFixed(2) + " | Margin: \u20B9" + cost, ok: true }
      : { text: "\u274C " + wallet.lastError, ok: false }
    );
    setTimeout(() => { setTradeMsg(null); wallet.clearError(); }, 4000);
  }

  function handleCoverShort(positionId: string, qty: number) {
    if (!liveTick.isLive) {
      setTradeMsg({ text: "\u274C Price feed offline \u2014 cannot cover.", ok: false });
      setTimeout(() => setTradeMsg(null), 4000);
      return;
    }
    const pos = wallet.state.shortPositions.find(p => p.positionId === positionId);
    const ok  = wallet.coverShort(positionId, qty, liveTick.inrPrice);
    if (ok && pos) {
      const hasRemaining = wallet.getOpenLots(selected).length > 0 || wallet.getOpenShorts(selected).length > 0;
      if (!hasRemaining) {
        const sim = getSimStock(selected);
        if (sim && !sim.isPinned) removeSymbol(selected);
      }
      const pnl = (pos.shortPrice - liveTick.inrPrice) * qty;
      setTradeMsg({
        text: "\u2705 Covered " + qty + " \u00D7 " + pos.symbol + " @ \u20B9" + liveTick.inrPrice.toFixed(2) + " | P&L: " + (pnl >= 0 ? "+" : "") + "\u20B9" + pnl.toFixed(2),
        ok: pnl >= 0,
      });
    } else {
      setTradeMsg({ text: "\u274C " + wallet.lastError, ok: false });
    }
    setTimeout(() => { setTradeMsg(null); wallet.clearError(); }, 4000);
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      <SellLotModal
        isOpen={isSellModalOpen || sellLotTarget !== null}
        lots={sellLotTarget
          ? [sellLotTarget]
          : tradeMode === "short"
            ? wallet.getOpenShorts(selected).map(pos => ({
                lotId: pos.positionId,
                symbol: pos.symbol,
                buyPrice: pos.shortPrice,
                originalQty: pos.originalQty,
                remainingQty: pos.remainingQty,
                buyTimestamp: pos.openTimestamp,
                isClosed: pos.isClosed,
              }))
            : wallet.getOpenLots(selected)
        }
        initialSelectedLot={sellLotTarget || initialSellLot}
        currentPrice={liveTick.inrPrice}
        marketOpen={marketStatus.open}
        onConfirm={(lotId, qty) => {
          const isShortCover = sellLotTarget !== null || tradeMode === "short";
          if (isShortCover) {
            handleCoverShort(lotId, qty);
          } else {
            handleSellLot(lotId, qty);
          }
        }}
        onClose={() => {
          setIsSellModalOpen(false);
          setInitialSellLot(null);
          setSellLotTarget(null);
        }}
        isShort={sellLotTarget !== null || tradeMode === "short"}
      />

      <header className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-green-400 flex-shrink-0 flex items-center gap-2">
            <img src="/logo3.png" alt="Play" className="w-32 h-16 rounded" />
            {/* Play */}
          </h1>
          <SymbolSearch onSelect={handleSearchSelect} />
        </div>

        <div className="flex items-center gap-5 text-sm">
          <div>
            <span className="text-gray-400">Balance </span>
            <span className="font-mono font-semibold text-white">₹{wallet.state.balance.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-400">Portfolio </span>
            <span className={`font-mono font-semibold ${portfolioValue >= 10000 ? "text-green-400" : "text-red-400"}`}>
              ₹{portfolioValue.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Realized P&L </span>
            <span className={`font-mono font-semibold ${(wallet.state.totalRealizedPnL + wallet.state.totalShortPnL) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {(wallet.state.totalRealizedPnL + wallet.state.totalShortPnL) >= 0 ? "+" : ""}₹{(wallet.state.totalRealizedPnL + wallet.state.totalShortPnL).toFixed(2)}
            </span>
          </div>

          <button
            onClick={() => router.push("/dashboard/leaderboard")}
            className="text-xs bg-yellow-700/80 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg font-medium transition"
          >
            {'\uD83C\uDFC6'} Leaderboard
          </button>
          <button
            onClick={() => router.push("/dashboard/markets")}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
            style={{ background: "#00d4aa18", color: "#00d4aa", border: "1px solid #00d4aa33" }}
          >
            {'\uD83C\uDDEE\uD83C\uDDF3'} Markets
          </button>
          <div className="flex items-center gap-2 bg-gray-800 rounded-full px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-xs font-bold">
              {session.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-gray-300 text-xs font-medium">{session.name}</span>
          </div>

          <button
            onClick={() => { logout(); router.push("/"); }}
            className="text-xs text-red-400 hover:text-red-300 transition"
          >
            Sign Out
          </button>

          <button
            onClick={wallet.reset}
            className="text-xs text-gray-600 hover:text-gray-400 underline transition"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        <div className="flex flex-col flex-1 p-4 gap-3 min-w-0">

          <div className="flex gap-1.5 overflow-x-auto flex-shrink-0 pb-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 transparent" }}>
            {[
              ...activeTabs.filter(t => openLotSymbols.has(t.id)),
              ...activeTabs.filter(t => !openLotSymbols.has(t.id)),
            ].map(s => (
              <TabStock
                key={s.id}
                symbol={s.id}
                isSelected={selected === s.id}
                hasLots={openLotSymbols.has(s.id)}
                onSelect={() => handleSymbolSelect(s.id)}
                onRemove={!s.isPinned ? () => { removeSymbol(s.id); if (selected === s.id) handleSymbolSelect("WIPRO"); } : undefined}
                removeDisabled={openLotSymbols.has(s.id)}
              />
            ))}
          </div>

          <div className="flex-1 rounded-xl overflow-hidden border border-gray-800 min-h-0" style={{ maxHeight: 580 }}>
            <NSEChart
              key={selected}
              symbol={selected}
              livePrice={liveTick.price}
              isLive={liveTick.isLive}
            />
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex-shrink-0">

            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{selected} {'\u00B7'} LTP</span>
                  <span className={`flex items-center gap-1 text-xs ${liveTick.isLive && marketStatus.open ? "text-green-400" : !marketStatus.open ? "text-orange-400" : "text-gray-500"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${liveTick.isLive && marketStatus.open ? "bg-green-400 animate-pulse" : !marketStatus.open ? "bg-orange-400" : "bg-gray-600"}`}/>
                    {liveTick.isLive && marketStatus.open ? "Live" : !marketStatus.open ? "Closed" : "Offline"}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold font-mono">
                    {liveTick.price > 0
                      ? usdLocale
                        ? `$${liveTick.price.toFixed(2)}`
                        : `\u20B9${liveTick.price.toFixed(2)}`
                      : "\u2014"}
                  </span>
                  {usdLocale && liveTick.inrPrice > 0 && (
                    <span className="text-sm font-mono text-gray-500">{`(\u20B9${liveTick.inrPrice.toFixed(2)})`}</span>
                  )}
                  {liveTick.isLive && liveTick.price > 0 && (
                    <span className={`text-sm font-medium ${isUp ? "text-green-400" : "text-red-400"}`}>
                      {isUp ? "\u25B2" : "\u25BC"} {Math.abs(liveTick.change).toFixed(2)} ({Math.abs(liveTick.changePct).toFixed(2)}%)
                    </span>
                  )}
                  {!liveTick.isLive && liveTick.error && (
                    <span className="text-xs text-red-400">{liveTick.error}</span>
                  )}
                </div>
                {liveTick.isLive && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(liveTick.timestamp).toLocaleTimeString(usdLocale ? "en-US" : "en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                )}
              </div>

              {!marketStatus.open && (
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-orange-500 font-mono tracking-wider">{'\u23F1'} OPENS IN</div>
                  <div className="text-lg font-bold font-mono text-orange-400 tabular-nums">{countdownLabel}</div>
                </div>
              )}

              {holding.length > 0 && (
                <div className="text-right text-sm">
                  <div className="text-gray-400">{holding.length} open lot{holding.length !== 1 ? "s" : ""} in {selected}</div>
                  <div className="text-gray-400">
                    Total: {holding.reduce((s, l) => s + l.remainingQty, 0)} shares
                  </div>
                </div>
              )}
            </div>

            {!marketStatus.open && (
              <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-800/40 text-orange-300 text-xs px-3 py-2 rounded-lg mb-3 font-bold">
                <span>{'\u26A0\uFE0F'}</span>
                <span>Market is close and going to start in {countdownLabel}</span>
              </div>
            )}
            {!liveTick.isLive && marketStatus.open && (
              <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-800/40 text-orange-300 text-xs px-3 py-2 rounded-lg mb-3">
                <span>{'\u26A0\uFE0F'}</span>
                <span>Price feed unavailable: {liveTick.error || 'Unknown error'}. Trades are disabled until price is live.</span>
              </div>
            )}

            <div className="flex items-center gap-3">
                <div
                  className="flex rounded-lg overflow-hidden flex-shrink-0"
                  style={{ border: "1px solid #374151" }}
                >
                  <button
                    onClick={() => setTradeMode("long")}
                    className="px-3 py-1.5 text-xs font-bold transition"
                    style={{
                      background: tradeMode === "long" ? "#22c55e" : "#1f2937",
                      color:      tradeMode === "long" ? "#000"    : "#6b7280",
                    }}
                  >
                    {'\u25B2'} Long
                  </button>
                  <button
                    onClick={() => setTradeMode("short")}
                    className="px-3 py-1.5 text-xs font-bold transition"
                    style={{
                      background:  tradeMode === "short" ? "#ef5350" : "#1f2937",
                      color:       tradeMode === "short" ? "#fff"    : "#6b7280",
                      borderLeft:  "1px solid #374151",
                    }}
                  >
                    {'\u25BC'} Short
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    onFocus={e => e.target.select()}
                    className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm font-mono focus:outline-none focus:border-green-500"
                  />
                </div>
                {liveTick.price > 0 && (
                  <span className="text-gray-400 text-sm font-mono">= {`\u20B9`}{tradeCost.toFixed(2)}</span>
                )}
                <span className={`text-xs ${tradeCost > wallet.state.balance ? "text-red-400" : "text-gray-600"}`}>
                  {tradeCost > wallet.state.balance
                    ? `\u26A0 Need \u20B9${(tradeCost - wallet.state.balance).toFixed(2)} more`
                    : `Balance: \u20B9${wallet.state.balance.toFixed(2)}`
                  }
                </span>
                <button
                  onClick={tradeMode === "long" ? handleBuy : handleOpenShort}
                  disabled={!liveTick.isLive || tradeCost > wallet.state.balance || liveTick.price <= 0 || !marketStatus.open}
                  className="flex-1 font-bold py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  style={{
                    background: tradeMode === "long" ? "#22c55e" : "#ef5350",
                  }}
                >
                  {tradeMode === "long" ? "BUY \u2014 New Lot" : "SHORT \u2014 Sell to Open"}
                </button>
                {tradeMode === "short" ? (
                  <button
                    onClick={handleCoverClick}
                    disabled={wallet.getOpenShorts(selected).length === 0 || !marketStatus.open}
                    className="flex-1 font-bold py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    style={{ background: "#6366f1" }}
                  >
                    COVER
                  </button>
                ) : (
                  <button
                    onClick={handleSellClick}
                    disabled={holding.length === 0 || !marketStatus.open}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition"
                  >
                    SELL
                  </button>
                )}
              </div>

            {tradeMsg && (
              <div className={`mt-3 text-sm px-3 py-2 rounded-lg ${tradeMsg.ok
                ? "bg-green-900/40 border border-green-800/40 text-green-300"
                : "bg-red-900/40 border border-red-800/40 text-red-300"}`}>
                {tradeMsg.text}
              </div>
            )}
          </div>
        </div>

        <aside className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto flex-shrink-0">

          <div className="p-4 border-b border-gray-800">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Holdings (by lot)</h2>
              <span className="text-xs text-gray-600">{wallet.getAllOpenLots().length} lots</span>
            </div>

            {wallet.getAllOpenLots().length === 0 && wallet.getAllOpenShorts().length === 0 ? (
              <p className="text-gray-600 text-sm">No open positions.</p>
            ) : (
              <div className="space-y-2">
                {wallet.getAllOpenLots().map(lot => (
                  <HoldingLot
                    key={lot.lotId}
                    lot={lot}
                    onSell={lot => { handleSymbolSelect(lot.symbol); setInitialSellLot(lot); setIsSellModalOpen(true); }}
                  />
                ))}
                {wallet.getAllOpenShorts().map(pos => (
                  <ShortPositionCard
                    key={pos.positionId}
                    position={pos}
                    onCover={(p) => {
                      setSelected(p.symbol);
                      setQty(1);
                      setTradeMsg(null);
                      setSellLotTarget({
                        lotId: p.positionId,
                        symbol: p.symbol,
                        buyPrice: p.shortPrice,
                        originalQty: p.originalQty,
                        remainingQty: p.remainingQty,
                        buyTimestamp: p.openTimestamp,
                        isClosed: p.isClosed,
                      });
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="p-4 flex-1">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Trade History</h2>
            {(() => {
              const sells = wallet.state.sellHistory.map(t => ({ ...t, _type: "SELL" as const, _id: t.sellId, _qty: t.qtySold, _price: t.sellPrice }));
              const covers = wallet.state.coverHistory.map(t => ({ ...t, _type: "COVER" as const, _id: t.coverId, _qty: t.qtyCovered, _price: t.coverPrice }));
              const all = [...sells, ...covers].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 25);
              return all.length === 0 ? (
                <p className="text-gray-600 text-sm">No completed trades yet.</p>
              ) : (
                <div className="space-y-2">
                  {all.map(t => (
                  <div key={t._id} className="bg-gray-800 rounded-lg p-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className={t._type === "SELL" ? "text-red-400 font-bold" : "text-orange-400 font-bold"}>{t._type}</span>
                      <span className="text-gray-300 font-medium">{t.symbol}</span>
                      <span className="text-gray-400">{'\u00D7'}{t._qty}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 mt-0.5">
                      <span>@{'\u20B9'}{t._price.toFixed(2)}</span>
                      <span className={`font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}> 
                        {t.pnl >= 0 ? "+" : ""}{'\u20B9'}{t.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      {new Date(t.timestamp).toLocaleTimeString("en-IN")}
                    </div>
                  </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}
