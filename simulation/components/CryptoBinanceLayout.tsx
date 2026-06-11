"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import NSEChart from "@/simulation/components/NSEChart";
import type { TradeLot, ShortPosition, SellRecord, CoverRecord } from "@/lib/auth-types";

interface WalletLike {
  state: {
    balance: number;
    lots: TradeLot[];
    shortPositions: ShortPosition[];
    sellHistory: SellRecord[];
    coverHistory: CoverRecord[];
    totalRealizedPnL: number;
    totalShortPnL: number;
  };
  buy: (symbol: string, qty: number, price: number, stopLoss?: number, takeProfit?: number) => boolean;
  sellLot: (lotId: string, qty: number, price: number) => boolean;
  openShort: (symbol: string, qty: number, price: number, stopLoss?: number, takeProfit?: number) => boolean;
  coverShort: (positionId: string, qty: number, price: number) => boolean;
  getOpenLots: (symbol: string) => TradeLot[];
  getAllOpenLots: () => TradeLot[];
  getOpenShorts: (symbol: string) => ShortPosition[];
  getAllOpenShorts: () => ShortPosition[];
  getTotalPortfolioValue: (prices: Record<string, number>) => number;
  lastError: string | null;
  clearError: () => void;
  setStopLoss: (targetId: string, stopLoss: number, isShort: boolean) => boolean;
  setTakeProfit: (targetId: string, takeProfit: number, isShort: boolean) => boolean;
}

interface Props {
  selected: string;
  liveTick: { price: number; inrPrice: number; change: number; changePct: number; isLive: boolean; timestamp: number; error?: string | null };
  wallet: WalletLike;
  qty: number;
  setQty: (v: number) => void;
  handleBuy: (stopLoss?: number, takeProfit?: number) => void;
  handleSellClick: () => void;
  handleOpenShort: (stopLoss?: number, takeProfit?: number) => void;
  handleCoverClick: () => void;
  tradeMode: "long" | "short";
  setTradeMode: (m: "long" | "short") => void;
  tradeMsg: { text: string; ok: boolean } | null;
  marketStatus: { open: boolean; nextOpenMs: number };
  isUp: boolean;
  handleSymbolSelect: (id: string) => void;
  selectedStock: { currency?: string; label: string; isIndex?: boolean };
}

const COIN_ICONS: Record<string, string> = {
  BTC: "₿", ETH: "⟠", SOL: "S", XRP: "X", DOGE: "Ð",
  ADA: "A", AVAX: "V", DOT: "D", LINK: "L", POL: "M",
  LTC: "Ł", TRX: "T", BCH: "B", XLM: "*", UNI: "U",
  PEPE: "P", NEAR: "N", APT: "A", ICP: "I", FIL: "F",
};

function coinLabel(sym: string) {
  const s = sym.split("-")[0];
  return s;
}

function detFrom(seed: number, idx: number): number {
  const s = Math.sin((seed + idx * 17.13) * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export default function CryptoBinanceLayout(props: Props) {
  const router = useRouter();
  const { selected, liveTick, wallet, handleBuy, handleSellClick, handleOpenShort, handleCoverClick, setQty } = props;

  const coinSymbol = coinLabel(selected);
  const currentPrice = liveTick.price || 0;
  const currentPriceINR = liveTick.inrPrice || 0;

  const change = liveTick.change || 0;
  const changePercent = liveTick.changePct || 0;
  const isLong = props.tradeMode === "long";
  const isShort = props.tradeMode === "short";

  // Tab states
  const [activeChartTab, setActiveChartTab] = useState("Chart");
  const [spotTab, setSpotTab] = useState("Spot");
  const [orderType, setOrderType] = useState("Limit");
  const [coinFilter, setCoinFilter] = useState("All");
  const [tradesTab, setTradesTab] = useState("Market Trades");
  const [bottomTab, setBottomTab] = useState("Holdings");
  const [orderBookTick, setOrderBookTick] = useState("0.01");

  // Order form state
  const [buyPriceINR, setBuyPriceINR] = useState(currentPriceINR);
  const [sellPriceINR, setSellPriceINR] = useState(currentPriceINR);
  const [buyAmount, setBuyAmount] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [buySliderPct, setBuySliderPct] = useState(0);
  const [sellSliderPct, setSellSliderPct] = useState(0);
  const [buyTPSL, setBuyTPSL] = useState(false);
  const [sellTPSL, setSellTPSL] = useState(false);
  const [stopLossInput, setStopLossInput] = useState("");
  const [takeProfitInput, setTakeProfitInput] = useState("");
  const [slMessage, setSlMessage] = useState<string | null>(null);
  const [coinSearch, setCoinSearch] = useState("");

  // Track price direction for order book
  const prevPrice = useRef(currentPrice);
  const [priceUp, setPriceUp] = useState(true);
  useEffect(() => {
    setPriceUp(currentPrice >= prevPrice.current);
    prevPrice.current = currentPrice;
  }, [currentPrice]);

  // Sync qty with the active amount field so handleBuy/handleOpenShort use the correct crypto qty
  useEffect(() => {
    const src = isLong ? buyAmount : sellAmount;
    const v = parseFloat(src);
    setQty(!isNaN(v) && v > 0 ? v : 0);
  }, [isLong, buyAmount, sellAmount, setQty]);

  // Stop loss / take profit monitoring — check open positions against PnL thresholds
  const priceRef = useRef(liveTick.inrPrice);
  const selectedRef = useRef(selected);
  priceRef.current = liveTick.inrPrice;
  selectedRef.current = selected;
  useEffect(() => {
    const id = setInterval(() => {
      const cp = priceRef.current;
      const sym = selectedRef.current;
      if (cp <= 0) return;
      const triggered: string[] = [];
      for (const lot of wallet.getOpenLots(sym)) {
        const upnl = (cp - lot.buyPrice) * lot.remainingQty;
        const isCrypto = lot.symbol.endsWith("-USD");
        if (isCrypto) {
          if (lot.stopLoss && upnl <= -lot.stopLoss && !triggered.includes(lot.lotId)) {
            triggered.push(lot.lotId);
            wallet.sellLot(lot.lotId, lot.remainingQty, cp);
            setSlMessage(`🔴 SL hit on ${coinSymbol} lot — sold ${lot.remainingQty} @ ₹${cp.toFixed(2)} (PnL: ${upnl.toFixed(2)})`);
          }
          if (lot.takeProfit && upnl >= lot.takeProfit && !triggered.includes(lot.lotId)) {
            triggered.push(lot.lotId);
            wallet.sellLot(lot.lotId, lot.remainingQty, cp);
            setSlMessage(`🟢 TP hit on ${coinSymbol} lot — sold ${lot.remainingQty} @ ₹${cp.toFixed(2)} (PnL: ${upnl.toFixed(2)})`);
          }
        } else {
          if (lot.stopLoss && cp <= lot.stopLoss && !triggered.includes(lot.lotId)) {
            triggered.push(lot.lotId);
            wallet.sellLot(lot.lotId, lot.remainingQty, cp);
          }
        }
      }
      for (const pos of wallet.getOpenShorts(sym)) {
        const upnl = (pos.shortPrice - cp) * pos.remainingQty;
        const isCrypto = pos.symbol.endsWith("-USD");
        if (isCrypto) {
          if (pos.stopLoss && upnl <= -pos.stopLoss && !triggered.includes(pos.positionId)) {
            triggered.push(pos.positionId);
            wallet.coverShort(pos.positionId, pos.remainingQty, cp);
            setSlMessage(`🔴 SL hit on ${coinSymbol} short — covered ${pos.remainingQty} @ ₹${cp.toFixed(2)} (PnL: ${upnl.toFixed(2)})`);
          }
          if (pos.takeProfit && upnl >= pos.takeProfit && !triggered.includes(pos.positionId)) {
            triggered.push(pos.positionId);
            wallet.coverShort(pos.positionId, pos.remainingQty, cp);
            setSlMessage(`🟢 TP hit on ${coinSymbol} short — covered ${pos.remainingQty} @ ₹${cp.toFixed(2)} (PnL: ${upnl.toFixed(2)})`);
          }
        } else {
          if (pos.stopLoss && cp >= pos.stopLoss && !triggered.includes(pos.positionId)) {
            triggered.push(pos.positionId);
            wallet.coverShort(pos.positionId, pos.remainingQty, cp);
          }
        }
      }
    }, 2000);
    return () => clearInterval(id);
  }, [wallet, coinSymbol]);

  // Auto-clear SL message after 5 seconds
  useEffect(() => {
    if (!slMessage) return;
    const id = setTimeout(() => setSlMessage(null), 5000);
    return () => clearTimeout(id);
  }, [slMessage]);

  // Simulated 24h stats (stable across renders)
  const high24h = useMemo(() => (currentPrice * 1.035).toFixed(2), [currentPrice]);
  const low24h = useMemo(() => (currentPrice * 0.965).toFixed(2), [currentPrice]);
  const vol24hETH = useMemo(() => "32,458.72", []);
  const vol24hUSD = useMemo(() => "52,847,329", []);

  interface OrderRow { price: number; amount: number; total: number; depthPct: number }

  // State to hold live order book data fetched from backend
  const [apiOrderBook, setApiOrderBook] = useState<{ bids: any[]; asks: any[]; trades?: any[] } | null>(null);
  const currentPriceRef = useRef(currentPrice);
  useEffect(() => {
    currentPriceRef.current = currentPrice;
  }, [currentPrice]);

  useEffect(() => {
    let active = true;
    const fetchBook = async () => {
      try {
        const cp = currentPriceRef.current;
        const res = await fetch(`/api/orderbook/${selected}?currentPrice=${cp}`);
        if (!res.ok) throw new Error("Fetch failed");
        const data = await res.json();
        if (active) {
          setApiOrderBook(data);
        }
      } catch (err) {
        console.error("Error fetching orderbook:", err);
      }
    };

    fetchBook();
    const interval = setInterval(fetchBook, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selected]);

  const askOrders = useMemo(() => {
    if (apiOrderBook?.asks && apiOrderBook.asks.length > 0) {
      const base = currentPrice || 1600;
      return apiOrderBook.asks.map((o: any) => ({
        price: o.price,
        amount: o.amount,
        total: o.total,
        depthPct: Math.min(o.total / (base * 20) * 100, 100)
      }));
    }

    const orders: OrderRow[] = [];
    const base = currentPrice || 1600;
    let cumTotal = 0;
    for (let i = 0; i < 14; i++) {
      const offset = (i + 1) * 0.3 + detFrom(base, i * 3) * 0.5;
      const price = base + offset;
      const amount = detFrom(base + 100, i) * 4 + 0.05;
      const total = price * amount;
      cumTotal += total;
      orders.push({ price, amount, total, depthPct: Math.min(cumTotal / (base * 20) * 100, 100) });
    }
    return orders.sort((a, b) => b.price - a.price);
  }, [apiOrderBook, currentPrice]);

  const bidOrders = useMemo(() => {
    if (apiOrderBook?.bids && apiOrderBook.bids.length > 0) {
      const base = currentPrice || 1600;
      return apiOrderBook.bids.map((o: any) => ({
        price: o.price,
        amount: o.amount,
        total: o.total,
        depthPct: Math.min(o.total / (base * 20) * 100, 100)
      }));
    }

    const orders: OrderRow[] = [];
    const base = currentPrice || 1600;
    let cumTotal = 0;
    for (let i = 0; i < 14; i++) {
      const offset = (i + 1) * 0.3 + detFrom(base + 50, i * 3) * 0.5;
      const price = Math.max(0.01, base - offset);
      const amount = detFrom(base + 200, i) * 4 + 0.05;
      const total = price * amount;
      cumTotal += total;
      orders.push({ price, amount, total, depthPct: Math.min(cumTotal / (base * 20) * 100, 100) });
    }
    return orders.sort((a, b) => b.price - a.price);
  }, [apiOrderBook, currentPrice]);

  interface CoinRow { symbol: string; displayName: string; subLabel: string; price: number; changePercent: number; isUp: boolean }

  const allCoins = useMemo(() => {
    const symbols = [
      "BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD",
      "ADA-USD", "AVAX-USD", "DOT-USD", "LINK-USD", "POL-USD",
      "LTC-USD", "TRX-USD", "BCH-USD", "XLM-USD", "UNI-USD",
      "PEPE-USD", "NEAR-USD", "APT-USD", "ICP-USD", "FIL-USD",
    ];
    return symbols.map((sym, i): CoinRow => {
      const base = currentPrice || 1600;
      const r = 1 + (Math.sin(i * 1.7) * 0.3) + ((detFrom(base, i) - 0.5) * 0.05);
      const price = sym === selected ? base : base * r * (0.5 + detFrom(base * 2, i) * 0.8);
      const change = (detFrom(base, i * 7) - 0.5) * 8;
      return {
        symbol: sym,
        displayName: sym.replace("-", "/"),
        subLabel: sym.split("-")[0],
        price: Math.max(0.01, price),
        changePercent: change,
        isUp: change >= 0,
      };
    });
  }, [currentPrice, selected]);

  const filteredCoins = useMemo(() => {
    let list = allCoins;
    if (coinSearch) {
      const q = coinSearch.toLowerCase();
      list = list.filter(c => c.symbol.toLowerCase().includes(q) || c.subLabel.toLowerCase().includes(q));
    }
    if (coinFilter === "Gainers") return list.filter(c => c.changePercent >= 0).sort((a, b) => b.changePercent - a.changePercent);
    if (coinFilter === "Losers") return list.filter(c => c.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent);
    return list;
  }, [allCoins, coinFilter, coinSearch]);

  interface MarketTradeRow { price: number; amount: number; side: string; time: string }

  const marketTrades = useMemo(() => {
    if (apiOrderBook?.trades) {
      return apiOrderBook.trades;
    }
    return [];
  }, [apiOrderBook]);

  // Top movers
  const topMovers = useMemo(() => {
    return [
      { symbol: "BTC/USDT", price: "$" + ((currentPrice || 1600) * 1.2).toFixed(2), change: 5.82 },
      { symbol: "XRP/USDT", price: "$" + ((currentPrice || 1600) * 0.3).toFixed(2), change: -3.45 },
      { symbol: "SOL/USDT", price: "$" + ((currentPrice || 1600) * 0.6).toFixed(2), change: 8.21 },
      { symbol: "DOGE/USDT", price: "$" + ((currentPrice || 1600) * 0.05).toFixed(4), change: -2.18 },
      { symbol: "ADA/USDT", price: "$" + ((currentPrice || 1600) * 0.25).toFixed(3), change: 4.73 },
    ];
  }, [currentPrice]);

  const hasShortPosition = wallet.getOpenShorts(selected).length > 0;
  const userBalance = wallet.state.balance;
  const userCoinBalance = wallet.getAllOpenLots()
    .filter(l => l.symbol === selected)
    .reduce((sum, l) => sum + l.remainingQty, 0);
  const minOrderINR = 100;
  const buyTotal = parseFloat(buyAmount || "0") * currentPriceINR;
  const sellTotal = parseFloat(sellAmount || "0") * currentPriceINR;
  const maxBuyAmount = userBalance > 0 && currentPriceINR > 0 ? userBalance / currentPriceINR : 0;

  // Compute counts for bottom tabs
  const openOrdersCount = wallet.getAllOpenLots().length + wallet.getAllOpenShorts().length;

  interface TradeRecord {
    _type: "SELL" | "COVER"; _id: string; _qty: number; _price: number;
    symbol: string; timestamp: string; pnl: number;[key: string]: unknown;
  }

  const allTrades = useMemo(() => {
    const sells: TradeRecord[] = wallet.state.sellHistory.map(t => ({
      ...t, _type: "SELL" as const, _id: t.sellId, _qty: t.qtySold, _price: t.sellPrice,
    }));
    const covers: TradeRecord[] = wallet.state.coverHistory.map(t => ({
      ...t, _type: "COVER" as const, _id: t.coverId, _qty: t.qtyCovered, _price: t.coverPrice,
    }));
    return [...sells, ...covers].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
  }, [wallet.state.sellHistory, wallet.state.coverHistory]);

  return (
    <div className="flex flex-col flex-1 bg-[#0b0e11]">
      {/* ===== MAIN 3-COLUMN LAYOUT ===== */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 130px)' }}>
        {/* ===== ORDER BOOK - LEFT PANEL ===== */}
        <div className="w-[200px] flex-shrink-0 bg-[#0b0e11] border-r border-[#2b3139] flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#2b3139]">
            <span className="text-white text-sm font-semibold">Order Book</span>
            <div className="flex gap-1">
              {["0.01", "0.1", "1"].map(t => (
                <button key={t}
                  onClick={() => setOrderBookTick(t)}
                  className={`text-[10px] px-1.5 py-0.5 border rounded transition
                  ${orderBookTick === t
                      ? "border-[#f0b90b] text-[#f0b90b]"
                      : "border-[#2b3139] text-[#848e9c] hover:text-white hover:border-[#474d57]"
                    }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-3 px-3 py-1 text-[10px] text-[#848e9c]">
            <span>Price(USDC)</span>
            <span className="text-right">Amount({coinSymbol})</span>
            <span className="text-right">Total</span>
          </div>

          {/* Sell orders (asks) */}
          <div className="flex-1 overflow-y-auto flex flex-col-reverse">
            {askOrders.map((order, i) => {
              const isEmpty = order.amount <= 0;
              return (
                <div key={i}
                  className="relative grid grid-cols-3 px-3 py-[2px] hover:bg-[#1e2329] cursor-pointer group"
                  style={{ background: isEmpty ? "transparent" : `linear-gradient(to left, rgba(246,70,93,0.12) ${order.depthPct}%, transparent 0%)` }}>
                  <span className={`${isEmpty ? "text-transparent" : "text-[#f6465d]"} text-[11px] z-10 font-medium`}>
                    {isEmpty ? "—" : order.price.toFixed(2)}
                  </span>
                  <span className={`text-right ${isEmpty ? "text-transparent" : "text-[#eaecef]"} text-[11px] z-10`}>
                    {isEmpty ? "—" : order.amount.toFixed(4)}
                  </span>
                  <span className={`text-right ${isEmpty ? "text-transparent" : "text-[#848e9c]"} text-[11px] z-10`}>
                    {isEmpty ? "—" : order.total.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Current price center line */}
          <div className="flex items-center justify-center gap-2 py-2 border-y border-[#2b3139] bg-[#13161a] flex-shrink-0">
            <span className={`text-base font-bold ${priceUp ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              {currentPrice.toFixed(2)}
            </span>
            <span className={`text-sm ${priceUp ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
              {priceUp ? "↑" : "↓"}
            </span>
            <span className="text-[#848e9c] text-xs">
              ₹{currentPriceINR.toFixed(2)}
            </span>
          </div>

          {/* Buy orders (bids) */}
          <div className="flex-1 overflow-y-auto">
            {bidOrders.map((order, i) => {
              const isEmpty = order.amount <= 0;
              return (
                <div key={i}
                  className="relative grid grid-cols-3 px-3 py-[2px] hover:bg-[#1e2329] cursor-pointer"
                  style={{ background: isEmpty ? "transparent" : `linear-gradient(to left, rgba(14,203,129,0.12) ${order.depthPct}%, transparent 0%)` }}>
                  <span className={`${isEmpty ? "text-transparent" : "text-[#0ecb81]"} text-[11px] z-10 font-medium`}>
                    {isEmpty ? "—" : order.price.toFixed(2)}
                  </span>
                  <span className={`text-right ${isEmpty ? "text-transparent" : "text-[#eaecef]"} text-[11px] z-10`}>
                    {isEmpty ? "—" : order.amount.toFixed(4)}
                  </span>
                  <span className={`text-right ${isEmpty ? "text-transparent" : "text-[#848e9c]"} text-[11px] z-10`}>
                    {isEmpty ? "—" : order.total.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== CENTER AREA ===== */}
        <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
          {/* Top: header + tabs + chart (fills remaining space) */}
          <div className="flex flex-col overflow-hidden min-h-0">
            {/* --- CRYPTO HEADER BAR --- */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#0b0e11] border-b border-[#2b3139] flex-shrink-0">
              <div className="flex items-center gap-6">
                {/* Coin icon + name */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#2b3139] flex items-center justify-center text-sm text-white font-bold">
                    {COIN_ICONS[coinSymbol] || coinSymbol.charAt(0)}
                  </div>
                  <div>
                    <div className="text-white font-bold text-base">{coinSymbol}/USDC</div>
                    <div className="text-[#848e9c] text-xs">{coinSymbol === "ETH" ? "Ethereum" : coinSymbol} Price</div>
                  </div>
                </div>

                {/* Price - USD large, INR small */}
                <div>
                  <div className="text-white font-bold text-xl">${currentPrice.toFixed(2)}</div>
                  <div className="text-[#848e9c] text-xs">
                    ₹{currentPriceINR.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </div>
                </div>

                {/* 24h change */}
                <div className={changePercent >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                  <div className="text-sm font-semibold">{changePercent >= 0 ? "+" : ""}{change.toFixed(2)}</div>
                  <div className="text-xs">{changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%</div>
                </div>

                {/* Stats */}
                {[
                  { label: "24H High", value: `$${high24h}` },
                  { label: "24H Low", value: `$${low24h}` },
                  { label: "24H Vol(" + coinSymbol + ")", value: vol24hETH },
                  { label: "24H Vol(USDT)", value: `$${parseFloat(vol24hUSD).toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
                ].map(stat => (
                  <div key={stat.label} className="flex flex-col">
                    <span className="text-[#848e9c] text-xs">{stat.label}</span>
                    <span className="text-white text-xs font-medium">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Right badges */}
              <div className="flex items-center gap-2 text-xs text-[#848e9c]">
                <span className="border border-[#2b3139] px-2 py-0.5 rounded cursor-pointer hover:border-[#474d57]">Networks ▾</span>
                <span className="border border-[#2b3139] px-2 py-0.5 rounded cursor-pointer hover:border-[#474d57]">Token Tags ▾</span>
              </div>
            </div>

            {/* Trade message toast */}
            {props.tradeMsg && (
              <div className={`px-4 py-2 text-xs font-medium ${props.tradeMsg.ok ? "bg-[#0ecb8120] text-[#0ecb81]" : "bg-[#f6465d20] text-[#f6465d]"} border-b border-[#2b3139] flex-shrink-0`}>
                {props.tradeMsg.text}
              </div>
            )}
            {slMessage && (
              <div className="px-4 py-2 text-xs font-medium bg-[#f6465d20] text-[#f6465d] border-b border-[#2b3139] flex-shrink-0">
                ⚠ {slMessage}
              </div>
            )}

            {/* --- CHART TABS BAR --- */}
            <div className="flex items-center gap-6 px-4 py-2 border-b border-[#2b3139] bg-[#0b0e11] flex-shrink-0">
              {["Chart", "Info", "Trading Data", "Trading Analysis", "Square"].map(tab => (
                <button key={tab}
                  onClick={() => setActiveChartTab(tab)}
                  className={`text-sm pb-1 transition-colors ${activeChartTab === tab
                      ? "text-white font-semibold border-b-2 border-[#f0b90b]"
                      : "text-[#848e9c] hover:text-white"
                    }`}>
                  {tab}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-3 text-[#848e9c]">
                <button className="hover:text-white text-sm">AI</button>
                <button className="hover:text-white text-sm" title="Notifications">🔔</button>
                <button className="hover:text-white text-sm" title="Fullscreen">⛶</button>
                <button className="hover:text-white text-sm" title="Settings">⚙</button>
              </div>
            </div>

            {/* --- CHART AREA --- */}
            <div className="h-[440px] overflow-hidden shrink-0">
              {activeChartTab === "Chart" && (
                <div className="h-full">
                  <NSEChart
                    key={selected}
                    symbol={selected}
                    livePrice={liveTick.price}
                    isLive={liveTick.isLive}
                  />
                </div>
              )}
              {activeChartTab === "Info" && (
                <div className="flex items-center justify-center h-full text-[#848e9c] text-sm">
                  <p>Info about {coinSymbol} - Market cap, supply, links...</p>
                </div>
              )}
              {activeChartTab === "Trading Data" && (
                <div className="flex items-center justify-center h-full text-[#848e9c] text-sm">
                  <p>Trading data for {coinSymbol}</p>
                </div>
              )}
              {activeChartTab === "Trading Analysis" && (
                <div className="flex items-center justify-center h-full text-[#848e9c] text-sm">
                  Analysis coming soon
                </div>
              )}
              {activeChartTab === "Square" && (
                <div className="flex items-center justify-center h-full text-[#848e9c] text-sm">
                  Square coming soon
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#2b3139] pb-4">
            <div className="bg-[#0b0e11]">
              {/* Tab Row 1: Spot Cross Isolated Grid */}
              <div className="flex items-center justify-between px-4 pt-2 pb-1 border-b border-[#2b3139]">
                <div className="flex gap-5">
                  {["Spot", "Cross", "Isolated", "Grid"].map(t => (
                    <button key={t}
                      className={`text-sm py-1 ${spotTab === t
                          ? "text-white font-semibold border-b-2 border-[#f0b90b]"
                          : "text-[#848e9c] hover:text-white"
                        }`}
                      onClick={() => setSpotTab(t)}>
                      {t}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[#848e9c] cursor-pointer hover:text-white">% Fee Level</span>
              </div>

              {/* Tab Row 2: Limit Market Stop Limit */}
              <div className="flex items-center gap-5 px-4 py-2">
                {["Limit", "Market", "Stop Limit"].map(t => (
                  <button key={t}
                    className={`text-sm ${orderType === t
                        ? "text-white font-semibold"
                        : "text-[#848e9c] hover:text-white"
                      }`}
                    onClick={() => setOrderType(t)}>
                    {t}{t === "Stop Limit" ? " ▾" : ""}
                  </button>
                ))}
                <span className="text-[#848e9c] cursor-help ml-1 text-sm">ⓘ</span>
                <span className={`ml-auto text-xs px-2 py-0.5 rounded font-semibold ${isLong ? "bg-[#0ecb81] text-white" : "bg-[#f6465d] text-white"}`}>
                  {isLong ? "▲ Long" : "▼ Short"}
                </span>
              </div>

              {/* Single order form */}
              <div className="p-4 flex flex-col gap-3">
                {/* Long / Short Toggle */}
                <div className="flex rounded overflow-hidden border border-[#2b3139]">
                  <button
                    onClick={() => { props.setTradeMode("long"); setStopLossInput(""); setTakeProfitInput(""); }}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${isLong
                        ? "bg-[#0ecb81] text-white"
                        : "bg-[#1e2329] text-[#848e9c] hover:text-white"
                      }`}
                  >
                    ▲ Long
                  </button>
                  <button
                    onClick={() => { props.setTradeMode("short"); setStopLossInput(""); setTakeProfitInput(""); }}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${isShort
                        ? "bg-[#f6465d] text-white"
                        : "bg-[#1e2329] text-[#848e9c] hover:text-white"
                      }`}
                  >
                    ▼ Short
                  </button>
                </div>

                {/* Price - INR */}
                <div>
                  <div className="flex items-center justify-between bg-[#1e2329] border border-[#2b3139] rounded px-3 py-2 focus-within:border-[#f0b90b] hover:border-[#474d57] transition-colors">
                    <span className="text-[#848e9c] text-xs min-w-fit">Price</span>
                    <div className="flex items-center gap-2 ml-2 flex-1">
                      <input type="number" min="0"
                        value={isLong ? buyPriceINR : sellPriceINR}
                        onChange={e => {
                          const v = parseFloat(e.target.value) || 0;
                          if (v < 0) return;
                          if (isLong) setBuyPriceINR(v);
                          else setSellPriceINR(v);
                        }}
                        className="bg-transparent text-white text-sm text-right flex-1 outline-none min-w-0"
                      />
                      <span className="text-[#848e9c] text-xs whitespace-nowrap">INR</span>
                      <div className="flex flex-col ml-1">
                        <button onClick={() => { if (isLong) setBuyPriceINR(p => p + 1); else setSellPriceINR(p => p + 1); }} className="text-[#848e9c] hover:text-white leading-none text-[10px]">▲</button>
                        <button onClick={() => { if (isLong) setBuyPriceINR(p => Math.max(0, p - 1)); else setSellPriceINR(p => Math.max(0, p - 1)); }} className="text-[#848e9c] hover:text-white leading-none text-[10px]">▼</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button onClick={() => { if (isLong) setBuyPriceINR(currentPriceINR); else setSellPriceINR(currentPriceINR); }} className="text-[10px] text-[#f0b90b] hover:text-yellow-300 font-semibold">BBO</button>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex items-center justify-between bg-[#1e2329] border border-[#2b3139] rounded px-3 py-2 focus-within:border-[#f0b90b] hover:border-[#474d57] transition-colors">
                  <span className="text-[#848e9c] text-xs">Amount</span>
                  <div className="flex items-center gap-2 ml-2 flex-1">
                    <input type="number" min="0"
                      value={isLong ? buyAmount : sellAmount}
                      onChange={e => {
                        const v = e.target.value;
                        if (v !== "" && parseFloat(v) < 0) return;
                        if (isLong) setBuyAmount(v);
                        else setSellAmount(v);
                      }}
                      placeholder="0.00000"
                      className="bg-transparent text-white text-sm text-right flex-1 outline-none min-w-0"
                    />
                    <span className="text-[#848e9c] text-xs">{coinSymbol}</span>
                    <div className="flex flex-col ml-1">
                      <button className="text-[#848e9c] hover:text-white leading-none text-[10px]">▲</button>
                      <button className="text-[#848e9c] hover:text-white leading-none text-[10px]">▼</button>
                    </div>
                  </div>
                </div>

                {/* Diamond percentage slider */}
                <div className="px-1">
                  <div className="relative">
                    <input type="range" min="0" max="100" step="25"
                      value={isLong ? buySliderPct : sellSliderPct}
                      onChange={e => {
                        const pct = Number(e.target.value);
                        if (isLong) {
                          setBuySliderPct(pct);
                          const amt = (userBalance * pct / 100) / currentPriceINR;
                          setBuyAmount(pct === 0 ? "" : amt.toFixed(6));
                        } else {
                          setSellSliderPct(pct);
                          setSellAmount(pct === 0 ? "" : (userCoinBalance * pct / 100).toFixed(6));
                        }
                      }}
                      className="w-full h-[2px] bg-[#2b3139] appearance-none accent-[#f0b90b] cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                    [&::-webkit-slider-thumb]:bg-[#f0b90b] [&::-webkit-slider-thumb]:rotate-45 [&::-webkit-slider-thumb]:rounded-none"
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    {["0%", "25%", "50%", "75%", "100%"].map(p => {
                      const pct = parseInt(p);
                      return (
                        <span key={p}
                          onClick={() => {
                            if (isLong) {
                              setBuySliderPct(pct);
                              if (pct === 0) setBuyAmount("");
                              else setBuyAmount(((userBalance * pct / 100) / currentPriceINR).toFixed(6));
                            } else {
                              setSellSliderPct(pct);
                              setSellAmount(pct === 0 ? "" : (userCoinBalance * pct / 100).toFixed(6));
                            }
                          }}
                          className="text-[10px] text-[#848e9c] hover:text-white cursor-pointer">
                          {p}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Total - INR */}
                <div className="flex items-center justify-between bg-[#1e2329] border border-[#2b3139] rounded px-3 py-2">
                  <span className="text-[#848e9c] text-xs">Total</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#848e9c] text-[10px]">Minimum ₹{minOrderINR}</span>
                    <span className="text-white text-sm">{(isLong ? buyTotal : sellTotal).toFixed(2)}</span>
                    <span className="text-[#848e9c] text-xs">INR</span>
                  </div>
                </div>

                {/* TP/SL */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isLong ? buyTPSL : sellTPSL} onChange={e => { if (isLong) setBuyTPSL(e.target.checked); else setSellTPSL(e.target.checked); }} className="w-3 h-3 accent-[#f0b90b]" />
                  <span className="text-[#848e9c] text-xs">TP/SL</span>
                </label>
            {(isLong ? buyTPSL : sellTPSL) && (
              <div className="flex gap-2">
                <input placeholder="Take Profit ₹"
                  value={takeProfitInput}
                  onChange={e => setTakeProfitInput(e.target.value)}
                  className="flex-1 bg-[#1e2329] border border-[#2b3139] rounded px-2 py-1 text-xs text-white outline-none focus:border-[#0ecb81]" />
                <input placeholder="Stop Loss ₹"
                  value={stopLossInput}
                  onChange={e => setStopLossInput(e.target.value)}
                  className="flex-1 bg-[#1e2329] border border-[#2b3139] rounded px-2 py-1 text-xs text-white outline-none focus:border-[#f6465d]" />
              </div>
            )}

                {/* Avbl / Max / Est Fee */}
                <div className="space-y-1 text-xs">
                  {isLong ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#848e9c] underline decoration-dotted cursor-pointer">Avbl ▾</span>
                        <span className="text-white">₹{userBalance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#848e9c] underline decoration-dotted cursor-pointer">Max Buy</span>
                        <span className="text-white">{maxBuyAmount.toFixed(6)} {coinSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#848e9c] underline decoration-dotted cursor-pointer">Est. Fee (0.1%)</span>
                        <span className="text-white">₹{(buyTotal * 0.001).toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#848e9c] underline decoration-dotted cursor-pointer">Avbl ▾</span>
                        <span className="text-white">{userCoinBalance.toFixed(8)} {coinSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#848e9c] underline decoration-dotted cursor-pointer">Max Sell</span>
                        <span className="text-white">₹{(userCoinBalance * sellPriceINR).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#848e9c] underline decoration-dotted cursor-pointer">Est. Fee (0.1%)</span>
                        <span className="text-white">₹{(sellTotal * 0.001).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Balance error message */}
                {(() => {
                  if (!liveTick.isLive) return <div className="text-[#f6465d] text-[11px] text-center">Price feed offline</div>;
                  if (!props.marketStatus.open) return <div className="text-[#f6465d] text-[11px] text-center">Market closed</div>;
                  if (currentPrice <= 0) return <div className="text-[#f6465d] text-[11px] text-center">No price data</div>;
                  if (isLong) {
                    if (!buyAmount || parseFloat(buyAmount) <= 0) return <div className="text-[#848e9c] text-[11px] text-center">Enter amount</div>;
                    if (buyTotal <= 0) return <div className="text-[#f6465d] text-[11px] text-center">Invalid amount</div>;
                    if (buyTotal < minOrderINR) return <div className="text-[#f6465d] text-[11px] text-center">Minimum order ₹{minOrderINR}</div>;
                    if (buyTotal > userBalance) return <div className="text-[#f6465d] text-[11px] text-center">Insufficient balance — need ₹{buyTotal.toFixed(2)}, have ₹{userBalance.toFixed(2)}</div>;
                  } else {
                    if (!sellAmount || parseFloat(sellAmount) <= 0) return <div className="text-[#848e9c] text-[11px] text-center">Enter amount</div>;
                    if (sellTotal <= 0) return <div className="text-[#f6465d] text-[11px] text-center">Invalid amount</div>;
                    if (sellTotal < minOrderINR) return <div className="text-[#f6465d] text-[11px] text-center">Minimum order ₹{minOrderINR}</div>;
                    if (sellTotal > userBalance) return <div className="text-[#f6465d] text-[11px] text-center">Insufficient margin — need ₹{sellTotal.toFixed(2)}, have ₹{userBalance.toFixed(2)}</div>;
                  }
                  return null;
                })()}

                {/* ACTION BUTTONS - always show primary + secondary like NSE layout */}
                <div className="flex gap-2">
              {isLong ? (
                <button
                  onClick={() => handleBuy(stopLossInput ? parseFloat(stopLossInput) : undefined, takeProfitInput ? parseFloat(takeProfitInput) : undefined)}
                  disabled={!liveTick.isLive || !props.marketStatus.open || currentPrice <= 0 || buyTotal <= 0 || buyTotal > userBalance}
                  className="flex-1 py-3 rounded text-sm font-semibold text-white bg-[#0ecb81] hover:bg-[#0ab36e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Buy {coinSymbol}
                </button>
              ) : (
                <button
                  onClick={() => handleOpenShort(stopLossInput ? parseFloat(stopLossInput) : undefined, takeProfitInput ? parseFloat(takeProfitInput) : undefined)}
                  disabled={!liveTick.isLive || !props.marketStatus.open || sellTotal <= 0 || sellTotal > userBalance}
                  className="flex-1 py-3 rounded text-sm font-semibold text-white bg-[#f6465d] hover:bg-[#e03050] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  SHORT — Sell to Open
                </button>
              )}
                  {isLong ? (
                    <button
                      onClick={handleSellClick}
                      disabled={!liveTick.isLive || !props.marketStatus.open || userCoinBalance <= 0}
                      className="flex-1 py-3 rounded text-sm font-semibold text-white bg-[#f6465d] hover:bg-[#e03050] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Sell {coinSymbol}
                    </button>
                  ) : (
                    <button
                      onClick={handleCoverClick}
                      disabled={!liveTick.isLive || !props.marketStatus.open || !hasShortPosition}
                      className="flex-1 py-3 rounded text-sm font-semibold text-white bg-[#4b5563] hover:bg-[#374151] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      COVER
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== RIGHT PANEL ===== */}
        <div className="w-[320px] flex-shrink-0 bg-[#0b0e11] border-l border-[#2b3139] flex flex-col h-full overflow-hidden">
          {/* Search */}
          <div className="px-3 py-1.5 border-b border-[#2b3139]">
            <input
              placeholder="Search coins..."
              value={coinSearch}
              onChange={e => setCoinSearch(e.target.value)}
              className="w-full bg-[#1e2329] border border-[#2b3139] rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#f0b90b] placeholder-[#848e9c]"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-4 px-3 py-1.5 border-b border-[#2b3139] overflow-x-auto">
            {["All", "Gainers", "Losers"].map(t => (
              <button key={t}
                onClick={() => setCoinFilter(t)}
                className={`text-sm font-medium transition-colors ${coinFilter === t
                    ? "text-white border-b-2 border-[#f0b90b]"
                    : "text-[#848e9c] hover:text-white"
                  }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-2 px-3 py-1 text-[10px] text-[#848e9c]">
            <span>Name ↑</span>
            <span className="text-right">Last Price / 24h Chg %</span>
          </div>

          {/* Coin rows */}
          <div className="flex-1 overflow-y-auto scrollbar-thin max-h-[380px]">
            {filteredCoins.map(c => (
              <div key={c.symbol}
                onClick={() => router.push(`/dashboard?symbol=${c.symbol}`)}
                className={`grid grid-cols-2 px-3 py-1.5 cursor-pointer hover:bg-[#1e2329] transition-colors ${selected === c.symbol ? "bg-[#1e2329]" : ""}`}>
                <div>
                  <div className="text-white text-xs font-medium">{c.displayName}</div>
                  <div className="text-[#848e9c] text-[10px]">{c.subLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-white text-xs">${c.price.toFixed(2)}</div>
                  <div className={`text-[10px] ${c.isUp ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                    {c.changePercent >= 0 ? "+" : ""}{c.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Market Trades / My Trades */}
          <div className="border-t border-[#2b3139] flex-shrink-0">
            <div className="flex border-b border-[#2b3139]">
              {["Market Trades", "My Trades"].map(t => (
                <button key={t}
                  onClick={() => setTradesTab(t)}
                  className={`flex-1 py-2 text-xs text-center ${tradesTab === t
                      ? "text-white font-semibold border-b-2 border-[#f0b90b]"
                      : "text-[#848e9c] hover:text-white"
                    }`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 px-3 py-0.5 text-[10px] text-[#848e9c]">
              <span>Price(USDT)</span>
              <span className="text-right">Amount({coinSymbol})</span>
              <span className="text-right">Time</span>
            </div>
            <div className="max-h-[160px] overflow-y-auto">
              {marketTrades.map((t: any, i: number) => (
                <div key={i} className="grid grid-cols-3 px-3 py-[2px]">
                  <span className={`text-[11px] ${t.side === "buy" ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                    {t.price.toFixed(2)}
                  </span>
                  <span className="text-right text-[#eaecef] text-[11px]">{t.amount.toFixed(4)}</span>
                  <span className="text-right text-[#848e9c] text-[11px]">{t.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Movers */}
          <div className="border-t border-[#2b3139] p-2 flex-shrink-0 max-h-[200px] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-xs font-semibold">Top Movers</span>
            </div>
            <div className="flex gap-2 text-[10px] mb-1 overflow-x-auto">
              {["All", "Change", "New High/Low", "Fluctuation", "Volume"].map(t => (
                <button key={t} className="text-[#848e9c] hover:text-white whitespace-nowrap">{t}</button>
              ))}
            </div>
            {topMovers.map(m => (
              <div key={m.symbol}
                className="flex justify-between items-center py-0.5 cursor-pointer hover:bg-[#1e2329] px-1 rounded">
                <div>
                  <div className="text-white text-xs">{m.symbol}</div>
                  <div className="text-[#848e9c] text-[10px]">{m.price}</div>
                </div>
                <div className={`text-xs font-semibold px-2 py-0.5 rounded ${m.change >= 0 ? "bg-[#0ecb8120] text-[#0ecb81]" : "bg-[#f6465d20] text-[#f6465d]"
                  }`}>
                  {m.change >= 0 ? "+" : ""}{m.change.toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>{/* end 3-column layout */}

      {/* ===== BOTTOM TABS ===== */}
      <div className="border-t border-[#2b3139] bg-[#0b0e11] flex-shrink-0">
        <div className="flex items-center border-b border-[#2b3139] px-4">
          {["Open Orders", "Order History", "Trade History", "Holdings", "Bots"].map(tab => (
            <button key={tab}
              onClick={() => setBottomTab(tab)}
              className={`py-3 px-4 text-xs transition-colors ${bottomTab === tab
                  ? "text-white border-b-2 border-[#f0b90b] font-semibold"
                  : "text-[#848e9c] hover:text-white"
                }`}>
              {tab}
              {tab === "Open Orders" && (
                <span className="ml-1.5 text-[#848e9c]">({openOrdersCount})</span>
              )}
            </button>
          ))}
          {bottomTab === "Open Orders" && (
            <button className="ml-auto text-xs text-[#f6465d] hover:text-red-400">Cancel All ▾</button>
          )}
        </div>

        <div className="min-h-[140px] max-h-[200px] overflow-y-auto">
          {bottomTab === "Open Orders" && (
            <div className="text-xs text-[#848e9c] p-4">
              {openOrdersCount === 0 ? (
                <p className="text-center py-6">No open orders</p>
              ) : (
                <div className="space-y-1">
                  {wallet.getAllOpenLots().map(lot => (
                    <div key={lot.lotId} className="grid grid-cols-5 px-2 py-1 hover:bg-[#1e2329] rounded">
                      <span className="text-[#0ecb81] font-medium">{lot.symbol}</span>
                      <span className="text-white">{lot.remainingQty}/{lot.originalQty}</span>
                      <span className="text-white">₹{lot.buyPrice.toFixed(2)}</span>
                      <span className="text-white">Buy</span>
                      <span className="text-[#848e9c]">{new Date(lot.buyTimestamp).toLocaleDateString("en-IN")}</span>
                    </div>
                  ))}
                  {wallet.getAllOpenShorts().map(pos => (
                    <div key={pos.positionId} className="grid grid-cols-5 px-2 py-1 hover:bg-[#1e2329] rounded">
                      <span className="text-[#f6465d] font-medium">{pos.symbol}</span>
                      <span className="text-white">{pos.remainingQty}/{pos.originalQty}</span>
                      <span className="text-white">₹{pos.shortPrice.toFixed(2)}</span>
                      <span className="text-[#f6465d]">Short</span>
                      <span className="text-[#848e9c]">{new Date(pos.openTimestamp).toLocaleDateString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {bottomTab === "Order History" && (
            <div className="text-xs p-4">
              {allTrades.length === 0 ? (
                <p className="text-center py-6 text-[#848e9c]">No order history</p>
              ) : (
                <div className="space-y-1">
                  {allTrades.slice(0, 20).map((t: TradeRecord) => (
                    <div key={t._id} className="grid grid-cols-5 px-2 py-1 hover:bg-[#1e2329] rounded text-[#848e9c]">
                      <span className={t._type === "SELL" ? "text-[#f6465d]" : "text-[#f0b90b]"}>{t._type}</span>
                      <span className="text-white">{t.symbol}</span>
                      <span>×{t._qty}</span>
                      <span>₹{t._price.toFixed(2)}</span>
                      <span className={t.pnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                        {t.pnl >= 0 ? "+" : ""}₹{t.pnl.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {bottomTab === "Trade History" && (
            <div className="text-xs p-4">
              {allTrades.length === 0 ? (
                <p className="text-center py-6 text-[#848e9c]">No trades yet</p>
              ) : (
                <div className="space-y-1">
                  {allTrades.map((t: TradeRecord) => (
                    <div key={t._id} className="grid grid-cols-6 px-2 py-1 hover:bg-[#1e2329] rounded text-[#848e9c]">
                      <span className={t._type === "SELL" ? "text-[#f6465d]" : "text-[#f0b90b]"}>{t._type}</span>
                      <span className="text-white">{t.symbol}</span>
                      <span>×{t._qty}</span>
                      <span>₹{t._price.toFixed(2)}</span>
                      <span className={t.pnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                        {t.pnl >= 0 ? "+" : ""}₹{t.pnl.toFixed(2)}
                      </span>
                      <span>{new Date(t.timestamp).toLocaleTimeString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {bottomTab === "Holdings" && (
            <div className="text-xs p-4">
              {wallet.getAllOpenLots().length === 0 && wallet.getAllOpenShorts().length === 0 ? (
                <p className="text-center py-6 text-[#848e9c]">No open positions</p>
              ) : (
                <div className="space-y-2">
                  {wallet.getAllOpenLots().map(lot => (
                    <div key={lot.lotId} className="flex justify-between items-center bg-[#1e2329] rounded px-3 py-2">
                      <div>
                        <div className="text-white font-medium">{lot.symbol}</div>
                        <div className="text-[#848e9c] text-[10px]">Qty: {lot.remainingQty} @ ₹{lot.buyPrice.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className={(((liveTick.inrPrice || lot.buyPrice) - lot.buyPrice) * lot.remainingQty) >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                          {(((liveTick.inrPrice || lot.buyPrice) - lot.buyPrice) * lot.remainingQty) >= 0 ? "+" : ""}₹{(((liveTick.inrPrice || lot.buyPrice) - lot.buyPrice) * lot.remainingQty).toFixed(2)}
                        </div>
                        <div className="text-[#848e9c] text-[10px]">
                          {(((liveTick.inrPrice || lot.buyPrice) - lot.buyPrice) / lot.buyPrice * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                  {wallet.getAllOpenShorts().map(pos => (
                    <div key={pos.positionId} className="flex justify-between items-center bg-[#1e2329] rounded px-3 py-2 border-l-2 border-[#f6465d]">
                      <div>
                        <div className="text-white font-medium">{pos.symbol} <span className="text-[#f6465d] text-[10px]">SHORT</span></div>
                        <div className="text-[#848e9c] text-[10px]">Qty: {pos.remainingQty} @ ₹{pos.shortPrice.toFixed(2)}</div>
                      </div>
                      <div className="text-right">
                        <div className={pos.shortPrice > (liveTick.inrPrice || pos.shortPrice) ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                          {pos.shortPrice > (liveTick.inrPrice || pos.shortPrice) ? "+" : ""}
                          ₹{((pos.shortPrice - (liveTick.inrPrice || pos.shortPrice)) * pos.remainingQty).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {bottomTab === "Bots" && (
            <div className="flex flex-col items-center justify-center py-10 text-[#848e9c]">
              <span className="text-3xl mb-2">🤖</span>
              <span className="text-sm">Bots coming soon</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
