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
import { TradeLot } from "@/lib/auth-types";

function currencySym(cfg: { currency?: string }): string {
  return cfg.currency === "USD" ? "$" : "\u20B9";
}

function TabStock({ symbol, isSelected, hasLots, onSelect, onRemove }: {
  symbol: string;
  isSelected: boolean;
  hasLots: boolean;
  onSelect: () => void;
  onRemove?: () => void;
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
          onClick={e => { e.stopPropagation(); onRemove(); }}
          className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-xs
                     text-gray-500 hover:text-red-400 hover:bg-red-400/20 transition flex-shrink-0"
          title="Remove tab"
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
  const csym = stock?.currency === "USD" ? "$" : "\u20B9";
  const locale = stock?.currency === "USD" ? "en-US" : "en-IN";
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

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading, logout } = useAuth();

  const [selected, setSelected] = useState("NIFTY");
  const [qty, setQty] = useState(1);
  const [tradeMsg, setTradeMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [initialSellLot, setInitialSellLot] = useState<TradeLot | null>(null);

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
  const wallet = useSimWallet(session?.userId ?? "", session?.name ?? "");
  const selectedStock = getSimStock(selected) ?? getSimStock("NIFTY")!;
  const csym = currencySym(selectedStock);
  const usdLocale = selectedStock.currency === "USD";

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

  const openLotSymbols = new Set(wallet.getAllOpenLots().map(l => l.symbol));

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

  function handleSellLot(lotId: string, qtySold: number) {
    if (!liveTick.isLive) {
      setTradeMsg({ text: "\u274C Cannot sell \u2014 price feed is unavailable right now.", ok: false });
      setTimeout(() => setTradeMsg(null), 4000);
      return;
    }
    const sellPrice = liveTick.inrPrice;
    const lot = wallet.state.lots.find(l => l.lotId === lotId);
    const ok = wallet.sellLot(lotId, qtySold, sellPrice);
    if (ok && lot) {
      const pnl = (sellPrice - lot.buyPrice) * qtySold;
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

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      <SellLotModal
        isOpen={isSellModalOpen}
        lots={wallet.getOpenLots(selected)}
        initialSelectedLot={initialSellLot}
        currentPrice={liveTick.inrPrice}
        onConfirm={handleSellLot}
        onClose={() => {
          setIsSellModalOpen(false);
          setInitialSellLot(null);
        }}
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
            <span className={`font-mono font-semibold ${wallet.state.totalRealizedPnL >= 0 ? "text-green-400" : "text-red-400"}`}>
              {wallet.state.totalRealizedPnL >= 0 ? "+" : ""}₹{wallet.state.totalRealizedPnL.toFixed(2)}
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
                  <span className={`flex items-center gap-1 text-xs ${liveTick.isLive ? "text-green-400" : "text-gray-500"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${liveTick.isLive ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}/>
                    {liveTick.isLive ? "Live" : "Offline"}
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

              {holding.length > 0 && (
                <div className="text-right text-sm">
                  <div className="text-gray-400">{holding.length} open lot{holding.length !== 1 ? "s" : ""} in {selected}</div>
                  <div className="text-gray-400">
                    Total: {holding.reduce((s, l) => s + l.remainingQty, 0)} shares
                  </div>
                </div>
              )}
            </div>

            {!liveTick.isLive && (
              <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-800/40 text-orange-300 text-xs px-3 py-2 rounded-lg mb-3">
                <span>{'\u26A0\uFE0F'}</span>
                <span>Price feed unavailable: {liveTick.error || 'Unknown error'}. Trades are disabled until price is live.</span>
              </div>
            )}

            <div className="flex items-center gap-3">
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
                  onClick={handleBuy}
                  disabled={!liveTick.isLive || tradeCost > wallet.state.balance || liveTick.price <= 0}
                  title={!liveTick.isLive ? "Price feed offline" : undefined}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition"
                >
                  BUY {'\u2014'} New Lot
                </button>
                <button
                  onClick={handleSellClick}
                  disabled={holding.length === 0}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition"
                >
                  SELL
                </button>
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

            {wallet.getAllOpenLots().length === 0 ? (
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
              </div>
            )}
          </div>

          <div className="p-4 flex-1">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Trade History</h2>
            {wallet.state.sellHistory.length === 0 ? (
              <p className="text-gray-600 text-sm">No completed trades yet.</p>
            ) : (
              <div className="space-y-2">
                {wallet.state.sellHistory.slice(0, 25).map(t => {
                  const stk = getSimStock(t.symbol);
                  const scsym = stk?.currency === "USD" ? "$" : "\u20B9";
                  return (
                  <div key={t.sellId} className="bg-gray-800 rounded-lg p-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-red-400 font-bold">SELL</span>
                      <span className="text-gray-300 font-medium">{t.symbol}</span>
                      <span className="text-gray-400">{'\u00D7'}{t.qtySold}</span>
                    </div>
                    <div className="flex justify-between text-gray-400 mt-0.5">
                      <span>@{scsym}{t.sellPrice.toFixed(2)}</span>
                      <span className={`font-bold ${t.pnl >= 0 ? "text-green-400" : "text-red-400"}`}> 
                        {t.pnl >= 0 ? "+" : ""}{scsym}{t.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-gray-600 mt-0.5">
                      {new Date(t.timestamp).toLocaleTimeString(stk?.currency === "USD" ? "en-US" : "en-IN")}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
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
