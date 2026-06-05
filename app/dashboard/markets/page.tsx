"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useMarkets, FilterMode, SortMode, SectionKey, MarketStock, MarketType } from "@/simulation/hooks/useMarkets";
import MarketRow from "@/simulation/components/MarketRow";
import { registerSymbol, SIM_STOCKS } from "@/simulation/engine/marketData";
import { MAX_CUSTOM_TABS } from "@/simulation/hooks/useSymbolRegistry";

const SECTION_OPTIONS: { key: SectionKey; label: string }[] = [
  { key: "FOSec",        label: "F&O Stocks"    },
  { key: "allSec",       label: "All NSE"        },
  { key: "NIFTY",        label: "Nifty 50"       },
  { key: "NIFTYNEXT50",  label: "Nifty Next 50"  },
  { key: "BANKNIFTY",    label: "Bank Nifty"     },
];

export default function MarketsPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  const [marketType, setMarketType] = useState<MarketType>("indian");
  const [filter,  setFilter]  = useState<FilterMode>("all");
  const [section, setSection] = useState<SectionKey>("FOSec");
  const [sort,    setSort]    = useState<SortMode>("changePct");

  const { loading: mLoading, error, lastFetch, countdown, fetchMarkets, getFiltered, gainersCount, losersCount } = useMarkets(filter, section, marketType);

  if (loading || !session) return null;

  const isCrypto = marketType === "crypto";
  const displayList = getFiltered(sort);
  const topGainer   = [...displayList].sort((a, b) => b.changePct - a.changePct)[0];

  function handleFilterChange(f: FilterMode) {
    setFilter(f);
  }

  function handleSectionChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSection(e.target.value as SectionKey);
  }

  function handleMarketTypeChange(t: MarketType) {
    setMarketType(t);
    setFilter("all");
    setSort("changePct");
  }

  function handleStockClick(stock: MarketStock) {
    const usd = stock.currency === "USD";
    const config = {
      id:          stock.id,
      label:       stock.label !== stock.id ? stock.label : stock.id,
      yahooSymbol: stock.yahooSymbol,
      basePrice:   stock.price,
      volatility:  0.015,
      drift:       0.00005,
      sector:      usd ? "Crypto" : "NSE",
      lotSize:     1,
      isIndex:     false,
      isPinned:    false,
      tvSymbol:    usd ? `COINBASE:${stock.id}` : `NSE:${stock.id}`,
      currency:    stock.currency ?? (usd ? "USD" : "INR"),
    };
    registerSymbol(config);
    if (!SIM_STOCKS.find(s => s.id === stock.id)) {
      try {
        const raw = localStorage.getItem("pt_custom_symbols");
        const existing = raw ? JSON.parse(raw) : [];
        if (!existing.find((s: any) => s.id === stock.id)) {
          const updated = [...existing, config].slice(-MAX_CUSTOM_TABS);
          localStorage.setItem("pt_custom_symbols", JSON.stringify(updated));
        }
      } catch {}
    }
    router.push(`/dashboard?symbol=${stock.id}`);
  }

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "#0a0e17",
        backgroundImage: `linear-gradient(rgba(0,212,170,0.02) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,212,170,0.02) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      <header
        className="flex items-center justify-between px-8 py-4 sticky top-0 z-20"
        style={{ background: "rgba(10,14,23,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1f2937" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-500 hover:text-white transition flex items-center gap-1.5"
          >
            {"\u2190"} Dashboard
          </button>
          <span className="text-gray-800">|</span>
          <h1 className="text-base font-bold" style={{ color: "#00d4aa" }}>
            {isCrypto ? "\uD83D\uDCC8" : "\uD83C\uDDEE\uD83C\uDDF3"} {isCrypto ? "Crypto Markets" : "Indian Markets"}
          </h1>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: isCrypto ? "#f7931a20" : "#00d4aa18", color: isCrypto ? "#f7931a" : "#00d4aa", border: `1px solid ${isCrypto ? "#f7931a44" : "#00d4aa33"}` }}
          >
            {isCrypto ? "CoinGecko" : "NSE LIVE"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Market type toggle */}
          <div
            className="flex items-center gap-1 rounded-lg p-0.5"
            style={{ background: "#0f1521", border: "1px solid #1f2937" }}
          >
            <button
              onClick={() => handleMarketTypeChange("indian")}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition"
              style={{
                background: !isCrypto ? "#1f2937" : "transparent",
                color: !isCrypto ? "#fff" : "#6b7280",
              }}
            >
              {"\uD83C\uDDEE\uD83C\uDDF3"} Indian
            </button>
            <button
              onClick={() => handleMarketTypeChange("crypto")}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition"
              style={{
                background: isCrypto ? "#1f2937" : "transparent",
                color: isCrypto ? "#fff" : "#6b7280",
              }}
            >
              {"\uD83D\uDCC8"} Crypto
            </button>
          </div>

          <div
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "#0f1521", border: "1px solid #1f2937" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-gray-500">Refreshing in</span>
            <span className="font-mono font-bold text-teal-400">{countdown}s</span>
            <button
              onClick={fetchMarkets}
              className="ml-1 text-gray-600 hover:text-teal-400 transition font-mono"
              title="Refresh now"
            >
              {"\u21BB"}
            </button>
          </div>

          {lastFetch && (
            <span className="text-xs text-gray-600">
              Updated {lastFetch.toLocaleTimeString(isCrypto ? "en-US" : "en-IN")}
            </span>
          )}

          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: "#0f1521", border: "1px solid #1f2937" }}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: "#00d4aa22", color: "#00d4aa" }}
            >
              {session.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-gray-400">{session.name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {(isCrypto ? [
            { label: "Cryptocurrencies Tracked",  value: displayList.length.toString(), sub: "Top 100 by Market Cap",                                                                      color: "#f7931a" },
            { label: "Top Gainer (24h)",           value: topGainer ? `${topGainer.id} +${topGainer.changePct.toFixed(2)}%` : "\u2014",                                                      sub: topGainer ? `$${topGainer.price.toFixed(2)}` : "Loading\u2026", color: "#f7931a" },
            { label: "Market Sentiment",           value: `${gainersCount}\u2191  ${losersCount}\u2193`,                                                                                     sub: gainersCount > losersCount ? "Bullish \uD83D\uDCC8" : losersCount > gainersCount ? "Bearish \uD83D\uDCC9" : "Neutral", color: gainersCount > losersCount ? "#00d4aa" : "#ef5350" },
          ] : [
            { label: "NSE Stocks Tracked",         value: displayList.length.toString(), sub: section === "FOSec" ? "F&O Universe" : section === "allSec" ? "All NSE" : section === "NIFTY" ? "Nifty 50" : section === "NIFTYNEXT50" ? "Nifty Next 50" : "Bank Nifty", color: "#00d4aa" },
            { label: "Top Gainer Today",           value: topGainer ? `${topGainer.id} +${topGainer.changePct.toFixed(2)}%` : "\u2014",                                                      sub: topGainer ? `\u20B9${topGainer.price.toFixed(2)}` : "Loading\u2026", color: "#00d4aa" },
            { label: "Market Sentiment",           value: `${gainersCount}\u2191  ${losersCount}\u2193`,                                                                                     sub: gainersCount > losersCount ? "Bullish \uD83D\uDCC8" : losersCount > gainersCount ? "Bearish \uD83D\uDCC9" : "Neutral", color: gainersCount > losersCount ? "#00d4aa" : "#ef5350" },
          ]).map(card => (
            <div
              key={card.label}
              className="rounded-xl px-5 py-4"
              style={{ background: "#0d1117", border: "1px solid #1f2937" }}
            >
              <div className="text-xs text-gray-500 mb-1">{card.label}</div>
              <div className="text-xl font-bold font-mono" style={{ color: card.color }}>{card.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{card.sub}</div>
            </div>
          ))}
        </div>

        <div
          className="flex items-center justify-between px-5 py-3 rounded-xl mb-3"
          style={{ background: "#0d1117", border: "1px solid #1f2937" }}
        >
          <div className="flex items-center gap-1">
            {(["all", "gainers", "losers"] as FilterMode[]).map(f => (
              <button
                key={f}
                onClick={() => handleFilterChange(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize"
                style={{
                  background: filter === f
                    ? f === "gainers" ? "#00d4aa22" : f === "losers" ? "#ef535022" : "#1f2937"
                    : "transparent",
                  color: filter === f
                    ? f === "gainers" ? "#00d4aa"   : f === "losers" ? "#ef5350"   : "#fff"
                    : "#6b7280",
                  border: `1px solid ${filter === f
                    ? f === "gainers" ? "#00d4aa44" : f === "losers" ? "#ef535044" : "#374151"
                    : "transparent"}`,
                }}
              >
                {f === "all" ? `All (${displayList.length})` :
                 f === "gainers" ? `\u25B2 Gainers (${gainersCount})` :
                 `\u25BC Losers (${losersCount})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {!isCrypto && (
              <>
                <span>Index:</span>
                <select
                  value={section}
                  onChange={handleSectionChange}
                  className="rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none cursor-pointer"
                  style={{ background: "#0f1521", border: "1px solid #1f2937" }}
                >
                  {SECTION_OPTIONS.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                <span className="text-gray-700">|</span>
              </>
            )}
            <span>Sort by:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
              className="rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none cursor-pointer"
              style={{ background: "#0f1521", border: "1px solid #1f2937" }}
            >
              {isCrypto ? (
                <>
                  <option value="changePct">24h Change %</option>
                  <option value="volume">Volume (24h)</option>
                  <option value="marketCap">Market Cap</option>
                  <option value="price">Price</option>
                </>
              ) : (
                <>
                  <option value="changePct">Day Change %</option>
                  <option value="volume">Volume</option>
                  <option value="marketCap">Market Cap</option>
                  <option value="price">Price</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Column headers */}
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1f2937" }}>
          <div
            className="grid px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-600"
            style={{
              gridTemplateColumns: "48px 1fr 120px 110px 90px 110px 130px",
              background: "#0d1117",
              borderBottom: "1px solid #1f2937",
            }}
          >
            <span>#</span>
            <span>{isCrypto ? "Coin" : "Company"}</span>
            <span className="text-right">{isCrypto ? "Price" : "LTP"}</span>
            <span className="text-right">{isCrypto ? "24h Change" : "Day Change"}</span>
            <span className="text-right">{isCrypto ? "Vol (24h)" : "Volume"}</span>
            <span className="text-right">Mkt Cap</span>
            <span className="pl-2">Day Range</span>
          </div>

          {mLoading && (
            <div
              className="flex flex-col items-center justify-center py-24 gap-4"
              style={{ background: "#0a0e17" }}
            >
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-gray-500 text-sm">
                {isCrypto ? "Fetching crypto data\u2026" : "Fetching NSE market data\u2026"}
              </div>
              <div className="text-gray-700 text-xs">
                {isCrypto ? "Loading from CoinGecko" : "This may take 5\u201310 seconds"}
              </div>
            </div>
          )}

          {error && !mLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3" style={{ background: "#0a0e17" }}>
              <span className="text-4xl">{"\uD83D\uDCE1"}</span>
              <div className="text-gray-500 text-sm">Failed to load market data</div>
              <div className="text-gray-700 text-xs max-w-xs text-center">{error}</div>
              <button
                onClick={fetchMarkets}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-medium transition"
                style={{ background: "#00d4aa22", color: "#00d4aa", border: "1px solid #00d4aa44" }}
              >
                Retry
              </button>
            </div>
          )}

          {!mLoading && !error && displayList.map((stock, i) => (
            <MarketRow
              key={stock.id}
              stock={stock}
              rank={i + 1}
              onClick={handleStockClick}
            />
          ))}

          {!mLoading && !error && displayList.length === 0 && (
            <div className="text-center py-16 text-gray-600 text-sm" style={{ background: "#0a0e17" }}>
              No results match the current filter.
            </div>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-4">
          Click any {isCrypto ? "cryptocurrency" : "stock"} to open its live chart on the dashboard with full buy/sell functionality.
          Data sourced from {isCrypto ? "CoinGecko" : "NSE"}.
        </p>
      </div>
    </div>
  );
}
