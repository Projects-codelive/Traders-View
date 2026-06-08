"use client";
import { useReducer, useEffect, useState, useRef } from "react";
import { SimWalletState, TradeLot, SellRecord, ShortPosition, CoverRecord, LeaderboardEntry } from "@/lib/auth-types";
import { updateLeaderboardEntry } from "@/lib/leaderboard-api";
import { upsertLeaderboard } from "@/lib/auth";

const INITIAL_BALANCE = 200000;

const INITIAL_STATE: SimWalletState = {
  balance: INITIAL_BALANCE,
  lots: [],
  sellHistory: [],
  totalRealizedPnL: 0,
  totalTradesCount: 0,
  winCount: 0,
  lossCount: 0,
  equityCurve: [],
  shortPositions: [],
  coverHistory: [],
  totalShortPnL: 0,
  adminBalanceAdjustment: 0,
};

type Action =
  | { type: "BUY"; symbol: string; qty: number; price: number }
  | { type: "SELL_LOT"; lotId: string; qty: number; currentPrice: number }
  | { type: "OPEN_SHORT"; symbol: string; qty: number; price: number }
  | { type: "COVER_SHORT"; positionId: string; qty: number; currentPrice: number }
  | { type: "RESET" }
  | { type: "HYDRATE"; payload: SimWalletState }
  | { type: "SET_BALANCE"; balance: number }
  | { type: "SET_ADMIN_ADJUSTMENT"; adjustment: number };

function nanoid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function reducer(state: SimWalletState, action: Action): SimWalletState {
  switch (action.type) {

    case "BUY": {
      const cost = parseFloat((action.qty * action.price).toFixed(2));
      if (cost <= 0) throw new Error("Invalid trade amount.");
      if (cost > state.balance) throw new Error(
        `Insufficient balance. Need ₹${cost.toFixed(2)}, have ₹${state.balance.toFixed(2)}.`
      );
      if (action.qty < 1) throw new Error("Quantity must be at least 1.");

      const newLot: TradeLot = {
        lotId: nanoid(),
        symbol: action.symbol,
        buyPrice: action.price,
        originalQty: action.qty,
        remainingQty: action.qty,
        buyTimestamp: new Date().toISOString(),
        isClosed: false,
      };

      return {
        ...state,
        balance: parseFloat((state.balance - cost).toFixed(2)),
        lots: [...state.lots, newLot],
      };
    }

    case "SELL_LOT": {
      const lotIdx = state.lots.findIndex(l => l.lotId === action.lotId);
      if (lotIdx < 0) throw new Error("Lot not found.");
      const lot = state.lots[lotIdx];
      if (lot.isClosed) throw new Error("This lot is already fully sold.");
      if (action.qty < 1) throw new Error("Quantity must be at least 1.");
      if (action.qty > lot.remainingQty) throw new Error(
        `Only ${lot.remainingQty} shares remaining in this lot.`
      );

      const proceeds = parseFloat((action.qty * action.currentPrice).toFixed(2));
      const costBasis = parseFloat((action.qty * lot.buyPrice).toFixed(2));
      const pnl = parseFloat((proceeds - costBasis).toFixed(2));
      const pnlPct = parseFloat(((pnl / costBasis) * 100).toFixed(2));

      const sellRecord: SellRecord = {
        sellId: nanoid(),
        lotId: lot.lotId,
        symbol: lot.symbol,
        qtySold: action.qty,
        buyPrice: lot.buyPrice,
        sellPrice: action.currentPrice,
        pnl,
        pnlPct,
        timestamp: new Date().toISOString(),
      };

      const newRemainingQty = lot.remainingQty - action.qty;
      const updatedLots = [...state.lots];
      updatedLots[lotIdx] = {
        ...lot,
        remainingQty: newRemainingQty,
        isClosed: newRemainingQty === 0,
      };

      const newBalance = parseFloat((state.balance + proceeds).toFixed(2));
      const openLotsValue = updatedLots
        .filter(l => !l.isClosed)
        .reduce((sum, l) => sum + l.remainingQty * l.buyPrice, 0);
      const portfolioSnapshot = parseFloat((newBalance + openLotsValue).toFixed(2));
      const curveBefore = state.equityCurve.length === 0
        ? [{ time: Date.now() - 1000, value: INITIAL_BALANCE }]
        : state.equityCurve;
      const newEquityCurve = [
        ...curveBefore,
        { time: Date.now(), value: portfolioSnapshot }
      ].slice(-200);

      return {
        ...state,
        balance: newBalance,
        lots: updatedLots,
        sellHistory: [sellRecord, ...state.sellHistory],
        totalRealizedPnL: parseFloat((state.totalRealizedPnL + pnl).toFixed(2)),
        totalTradesCount: state.totalTradesCount + 1,
        winCount: pnl > 0 ? state.winCount + 1 : state.winCount,
        lossCount: pnl < 0 ? state.lossCount + 1 : state.lossCount,
        equityCurve: newEquityCurve,
      };
    }

    case "OPEN_SHORT": {
      if (action.qty < 1)
        throw new Error("Quantity must be at least 1.");

      const marginRequired = parseFloat((action.qty * action.price).toFixed(2));
      if (marginRequired > state.balance)
        throw new Error(
          `Insufficient margin. Need \u20B9${marginRequired.toFixed(2)}, have \u20B9${state.balance.toFixed(2)}.`
        );

      const position: ShortPosition = {
        positionId:    nanoid(),
        symbol:        action.symbol,
        shortPrice:    action.price,
        originalQty:   action.qty,
        remainingQty:  action.qty,
        marginBlocked: marginRequired,
        openTimestamp: new Date().toISOString(),
        isClosed:      false,
      };

      return {
        ...state,
        balance:        parseFloat((state.balance - marginRequired).toFixed(2)),
        shortPositions: [...state.shortPositions, position],
      };
    }

    case "COVER_SHORT": {
      const posIdx = state.shortPositions.findIndex(p => p.positionId === action.positionId);
      if (posIdx < 0)
        throw new Error("Short position not found.");

      const pos = state.shortPositions[posIdx];
      if (pos.isClosed)
        throw new Error("This short position is already closed.");
      if (action.qty < 1)
        throw new Error("Quantity must be at least 1.");
      if (action.qty > pos.remainingQty)
        throw new Error(`Only ${pos.remainingQty} shares remaining in this short.`);

      const pnl     = parseFloat(((pos.shortPrice - action.currentPrice) * action.qty).toFixed(2));
      const costBasis = parseFloat((pos.shortPrice * action.qty).toFixed(2));
      const pnlPct  = parseFloat(((pnl / costBasis) * 100).toFixed(2));

      const marginForThisCover = parseFloat((pos.shortPrice * action.qty).toFixed(2));
      const balanceCredit      = parseFloat((marginForThisCover + pnl).toFixed(2));

      const coverRecord: CoverRecord = {
        coverId:    nanoid(),
        positionId: pos.positionId,
        symbol:     pos.symbol,
        qtyCovered: action.qty,
        shortPrice: pos.shortPrice,
        coverPrice: action.currentPrice,
        pnl,
        pnlPct,
        timestamp:  new Date().toISOString(),
      };

      const newRemainingQty = pos.remainingQty - action.qty;
      const updatedPositions = [...state.shortPositions];
      updatedPositions[posIdx] = {
        ...pos,
        remainingQty: newRemainingQty,
        isClosed:     newRemainingQty === 0,
      };

      const openLongValue  = state.lots.filter(l => !l.isClosed).reduce((s, l) => s + l.remainingQty * l.buyPrice, 0);
      const openShortMargin = updatedPositions.filter(p => !p.isClosed).reduce((s, p) => s + p.remainingQty * p.shortPrice, 0);
      const newBalance     = parseFloat((state.balance + balanceCredit).toFixed(2));
      const portfolioSnap  = parseFloat((newBalance + openLongValue + openShortMargin).toFixed(2));
      const newEquityCurve = [...state.equityCurve, { time: Date.now(), value: portfolioSnap }].slice(-200);

      const newShortPnL    = parseFloat((state.totalShortPnL + pnl).toFixed(2));

      return {
        ...state,
        balance:          newBalance,
        shortPositions:   updatedPositions,
        coverHistory:     [coverRecord, ...state.coverHistory],
        totalShortPnL:    newShortPnL,
        totalTradesCount: state.totalTradesCount + 1,
        winCount:         pnl > 0 ? state.winCount + 1 : state.winCount,
        lossCount:        pnl < 0 ? state.lossCount + 1 : state.lossCount,
        equityCurve:      newEquityCurve,
      };
    }

    case "RESET": {
      const openLotsValue = state.lots
        .filter(l => !l.isClosed)
        .reduce((sum, l) => sum + l.remainingQty * l.buyPrice, 0);
      const snapshot = parseFloat((INITIAL_BALANCE + openLotsValue).toFixed(2));
      const newCurve = [
        ...state.equityCurve,
        { time: Date.now(), value: snapshot }
      ].slice(-200);
      return { ...state, balance: INITIAL_BALANCE, equityCurve: newCurve };
    }

    case "SET_BALANCE":
      return { ...state, balance: action.balance };

    case "SET_ADMIN_ADJUSTMENT":
      return { ...state, adminBalanceAdjustment: action.adjustment };

    case "HYDRATE": {
      const hydrated = { ...INITIAL_STATE, ...action.payload, equityCurve: action.payload.equityCurve ?? [] };
      // Backfill equity curve from sell history for existing wallets
      if (hydrated.equityCurve.length === 0 && hydrated.sellHistory.length > 0) {
        let balance = INITIAL_BALANCE;
        const chronological = [...hydrated.sellHistory].reverse();
        const points: { time: number; value: number }[] = [];
        for (const s of chronological) {
          if (points.length === 0) {
            points.push({ time: new Date(s.timestamp).getTime() - 1000, value: INITIAL_BALANCE });
          }
          balance += s.pnl;
          points.push({ time: new Date(s.timestamp).getTime(), value: parseFloat((balance).toFixed(2)) });
        }
        hydrated.equityCurve = points;
      }
      return hydrated;
    }

    default:
      return state;
  }
}

export function useSimWallet(userId: string, userName: string, onBlocked?: () => void) {
  const STORAGE_KEY = `sim_wallet_${userId}`;

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const payload = JSON.parse(raw);
        dispatch({ type: "HYDRATE", payload });
        // Sync existing wallet to MongoDB on page load
        const wallet = { ...INITIAL_STATE, ...payload, equityCurve: payload.equityCurve ?? [] };
        const hasData = wallet.lots.length > 0 || wallet.sellHistory.length > 0
                     || wallet.shortPositions.length > 0 || wallet.coverHistory.length > 0;
        if (userId && hasData) {
          fetch("/api/sync-wallet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, wallet }),
          }).then(async (res) => {
            const data = await res.json();
            if (data.isBlocked && onBlocked) onBlocked();
            if (data.balance !== undefined && Math.abs(data.balance - stateRef.current.balance) > 0.01) {
              dispatch({ type: "SET_BALANCE", balance: data.balance });
            }
            if (data.adminBalanceAdjustment !== undefined && data.adminBalanceAdjustment !== stateRef.current.adminBalanceAdjustment) {
              dispatch({ type: "SET_ADMIN_ADJUSTMENT", adjustment: data.adminBalanceAdjustment });
            }
          }).catch(e => console.error("wallet sync failed:", e));
        }
      }
    } catch { /* start fresh */ }
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  // Sync leaderboard to localStorage + MongoDB (fire-and-forget, non-blocking)
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    const allTrades = [
      ...state.sellHistory.map(t => ({ ...t, _type: "long" as const })),
      ...state.coverHistory.map(t => ({ ...t, _type: "short" as const, qtySold: t.qtyCovered, sellPrice: t.coverPrice })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const top5 = [...allTrades]
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5) as SellRecord[];

    const totalRealizedPnL = parseFloat((state.totalRealizedPnL + state.totalShortPnL).toFixed(2));

    const totalWins = allTrades.filter(s => s.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const totalLosses = Math.abs(allTrades.filter(s => s.pnl < 0).reduce((s, t) => s + t.pnl, 0));
    const profitFactor = totalLosses > 0
      ? parseFloat((totalWins / totalLosses).toFixed(2))
      : totalWins > 0 ? 999 : 1;

    const values = state.equityCurve.map(p => p.value);
    let peak = INITIAL_BALANCE, maxDD = 0;
    for (const v of values) {
      if (v > peak) peak = v;
      const dd = (peak - v) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }

    const allDurations = [
      ...state.sellHistory.map(s => {
        const buyLot = state.lots.find(l => l.lotId === s.lotId);
        if (!buyLot) return 0;
        return (new Date(s.timestamp).getTime() - new Date(buyLot.buyTimestamp).getTime()) / 3_600_000;
      }),
      ...state.coverHistory.map(c => {
        const pos = state.shortPositions.find(p => p.positionId === c.positionId);
        if (!pos) return 0;
        return (new Date(c.timestamp).getTime() - new Date(pos.openTimestamp).getTime()) / 3_600_000;
      }),
    ].filter(h => h > 0);
    const avgDur = allDurations.length > 0
      ? parseFloat((allDurations.reduce((a, b) => a + b, 0) / allDurations.length).toFixed(1))
      : 0;

    // Asset allocation: total cost invested per symbol across ALL trades (long + short)
    const costBySymbol: Record<string, number> = {};
    for (const lot of state.lots) {
      const cost = lot.originalQty * lot.buyPrice;
      costBySymbol[lot.symbol] = (costBySymbol[lot.symbol] ?? 0) + cost;
    }
    for (const pos of state.shortPositions) {
      const cost = pos.originalQty * pos.shortPrice;
      costBySymbol[pos.symbol] = (costBySymbol[pos.symbol] ?? 0) + cost;
    }
    const totalCostAll = Object.values(costBySymbol).reduce((s, v) => s + v, 0);
    const assetAllocation: Record<string, number> = {};
    if (totalCostAll > 0) {
      for (const [sym, cost] of Object.entries(costBySymbol)) {
        assetAllocation[sym] = parseFloat(((cost / totalCostAll) * 100).toFixed(1));
      }
    }

    const recentActivity = allTrades.slice(0, 3).map(t =>
      `${t.pnl >= 0 ? "📈" : "📉"} ${t._type === "long" ? "Sold" : "Covered"} ${t.qtySold}×${t.symbol} ${t.pnl >= 0 ? "+" : ""}₹${t.pnl.toFixed(0)}`
    );

    const openLots = state.lots.filter(l => !l.isClosed);
    const openLotsValue = openLots.reduce((s, l) => s + l.remainingQty * l.buyPrice, 0);
    const openShortMargin = state.shortPositions.filter(p => !p.isClosed).reduce((s, p) => s + p.remainingQty * p.shortPrice, 0);
    const totalInvested = openLotsValue + openShortMargin;
    const portfolioValue = parseFloat((state.balance + openLotsValue + openShortMargin).toFixed(2));
    const roiPercent = totalCostAll > 0
      ? parseFloat((totalRealizedPnL / totalCostAll * 100).toFixed(2))
      : 0;
    const lastActiveAt = allTrades[0]?.timestamp ?? state.lots[state.lots.length - 1]?.buyTimestamp ?? state.shortPositions[state.shortPositions.length - 1]?.openTimestamp ?? new Date().toISOString();

    const entry: LeaderboardEntry = {
      userId,
      name: userName,
      totalRealizedPnL,
      totalTradesCount: state.totalTradesCount,
      winCount: state.winCount,
      lossCount: state.lossCount,
      winRate: state.totalTradesCount > 0
        ? parseFloat(((state.winCount / state.totalTradesCount) * 100).toFixed(1))
        : 0,
      portfolioValue,
      lastUpdated: new Date().toISOString(),
      top5Trades: top5,
      equityCurve: state.equityCurve,
      maxDrawdown: parseFloat((-maxDD).toFixed(2)),
      profitFactor,
      avgTradeDurationHours: avgDur,
      assetAllocation,
      recentActivity,
      lastActiveAt,
      totalInvested,
      roiPercent,
    };

    upsertLeaderboard(entry);
    updateLeaderboardEntry(entry);
  }, [state, hydrated, userId]);

  // Periodic sync every 60s to pick up admin balance adjustments
  useEffect(() => {
    if (!hydrated || !userId) return;
    const interval = setInterval(() => {
      syncWallet(stateRef.current);
    }, 60000);
    return () => clearInterval(interval);
  }, [hydrated, userId]);

  // Immediately sync the given wallet to MongoDB
  function syncWallet(wallet: SimWalletState) {
    const hasTradeData = wallet.lots.length > 0 || wallet.sellHistory.length > 0
                      || wallet.shortPositions.length > 0 || wallet.coverHistory.length > 0;
    if (userId && hasTradeData) {
      fetch("/api/sync-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, wallet }),
      }).then(async (res) => {
        const data = await res.json();
        if (data.isBlocked && onBlocked) onBlocked();
        if (data.balance !== undefined && Math.abs(data.balance - stateRef.current.balance) > 0.01) {
          dispatch({ type: "SET_BALANCE", balance: data.balance });
        }
        if (data.adminBalanceAdjustment !== undefined && data.adminBalanceAdjustment !== stateRef.current.adminBalanceAdjustment) {
          dispatch({ type: "SET_ADMIN_ADJUSTMENT", adjustment: data.adminBalanceAdjustment });
        }
      }).catch(e => console.error("wallet sync failed:", e));
    }
  }

  function buy(symbol: string, qty: number, price: number): boolean {
    try {
      const newState = reducer(state, { type: "BUY", symbol, qty, price });
      dispatch({ type: "BUY", symbol, qty, price });
      setLastError(null);
      syncWallet(newState);
      return true;
    } catch (e: any) {
      setLastError(e.message);
      return false;
    }
  }

  function sellLot(lotId: string, qty: number, currentPrice: number): boolean {
    try {
      const newState = reducer(state, { type: "SELL_LOT", lotId, qty, currentPrice });
      dispatch({ type: "SELL_LOT", lotId, qty, currentPrice });
      setLastError(null);
      syncWallet(newState);
      return true;
    } catch (e: any) {
      setLastError(e.message);
      return false;
    }
  }

  function reset() {
    const newState = reducer(state, { type: "RESET" });
    dispatch({ type: "RESET" });
    setLastError(null);
    syncWallet(newState);
  }

  function clearError() { setLastError(null); }

  function getOpenLots(symbol: string): TradeLot[] {
    return state.lots.filter(l => l.symbol === symbol && !l.isClosed);
  }

  function getAllOpenLots(): TradeLot[] {
    return state.lots.filter(l => !l.isClosed);
  }

  function getUnrealizedPnLForLot(lot: TradeLot, currentPrice: number): number {
    return parseFloat(((currentPrice - lot.buyPrice) * lot.remainingQty).toFixed(2));
  }

  function getTotalPortfolioValue(currentPrices: Record<string, number>): number {
    const holdingsValue = state.lots
      .filter(l => !l.isClosed)
      .reduce((sum, l) => {
        const cp = currentPrices[l.symbol] ?? l.buyPrice;
        return sum + cp * l.remainingQty;
      }, 0);
    return parseFloat((state.balance + holdingsValue).toFixed(2));
  }

  function openShort(symbol: string, qty: number, price: number): boolean {
    try {
      const newState = reducer(state, { type: "OPEN_SHORT", symbol, qty, price });
      dispatch({ type: "OPEN_SHORT", symbol, qty, price });
      setLastError(null);
      syncWallet(newState);
      return true;
    } catch (e: any) {
      setLastError(e.message);
      return false;
    }
  }

  function coverShort(positionId: string, qty: number, currentPrice: number): boolean {
    try {
      const newState = reducer(state, { type: "COVER_SHORT", positionId, qty, currentPrice });
      dispatch({ type: "COVER_SHORT", positionId, qty, currentPrice });
      setLastError(null);
      syncWallet(newState);
      return true;
    } catch (e: any) {
      setLastError(e.message);
      return false;
    }
  }

  function getOpenShorts(symbol: string): ShortPosition[] {
    return state.shortPositions.filter(p => p.symbol === symbol && !p.isClosed);
  }

  function getAllOpenShorts(): ShortPosition[] {
    return state.shortPositions.filter(p => !p.isClosed);
  }

  function getShortPnL(pos: ShortPosition, currentPrice: number): number {
    return parseFloat(((pos.shortPrice - currentPrice) * pos.remainingQty).toFixed(2));
  }

  return {
    state,
    hydrated,
    lastError,
    buy,
    sellLot,
    reset,
    clearError,
    getOpenLots,
    getAllOpenLots,
    getUnrealizedPnLForLot,
    getTotalPortfolioValue,
    openShort,
    coverShort,
    getOpenShorts,
    getAllOpenShorts,
    getShortPnL,
  };
}
