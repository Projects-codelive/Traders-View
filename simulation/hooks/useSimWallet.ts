"use client";
import { useReducer, useEffect, useState } from "react";
import { SimWalletState, TradeLot, SellRecord, LeaderboardEntry } from "@/lib/auth-types";
import { updateLeaderboardEntry } from "@/lib/leaderboard-api";
import { upsertLeaderboard } from "@/lib/auth";

const INITIAL_BALANCE = 100000;

const INITIAL_STATE: SimWalletState = {
  balance: INITIAL_BALANCE,
  lots: [],
  sellHistory: [],
  totalRealizedPnL: 0,
  totalTradesCount: 0,
  winCount: 0,
  lossCount: 0,
  equityCurve: [],
};

type Action =
  | { type: "BUY"; symbol: string; qty: number; price: number }
  | { type: "SELL_LOT"; lotId: string; qty: number; currentPrice: number }
  | { type: "RESET" }
  | { type: "HYDRATE"; payload: SimWalletState };

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

    case "RESET":
      return { ...INITIAL_STATE };

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

export function useSimWallet(userId: string, userName: string) {
  const STORAGE_KEY = `sim_wallet_${userId}`;

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", payload: JSON.parse(raw) });
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

    const top5 = [...state.sellHistory]
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);

    const allSells = state.sellHistory;
    const totalWins = allSells.filter(s => s.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const totalLosses = Math.abs(allSells.filter(s => s.pnl < 0).reduce((s, t) => s + t.pnl, 0));
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

    const durationsHours = allSells
      .map(s => {
        const buyLot = state.lots.find(l => l.lotId === s.lotId);
        if (!buyLot) return 0;
        return (new Date(s.timestamp).getTime() - new Date(buyLot.buyTimestamp).getTime()) / 3_600_000;
      })
      .filter(h => h > 0);
    const avgDur = durationsHours.length > 0
      ? parseFloat((durationsHours.reduce((a, b) => a + b, 0) / durationsHours.length).toFixed(1))
      : 0;

    // Asset allocation: total cost invested per symbol across ALL trades
    const costBySymbol: Record<string, number> = {};
    for (const lot of state.lots) {
      const cost = lot.originalQty * lot.buyPrice;
      costBySymbol[lot.symbol] = (costBySymbol[lot.symbol] ?? 0) + cost;
    }
    const totalCostAll = Object.values(costBySymbol).reduce((s, v) => s + v, 0);
    const assetAllocation: Record<string, number> = {};
    if (totalCostAll > 0) {
      for (const [sym, cost] of Object.entries(costBySymbol)) {
        assetAllocation[sym] = parseFloat(((cost / totalCostAll) * 100).toFixed(1));
      }
    }

    const recentActivity = allSells.slice(0, 3).map(s =>
      `${s.pnl >= 0 ? "📈" : "📉"} Sold ${s.qtySold}×${s.symbol} ${s.pnl >= 0 ? "+" : ""}₹${s.pnl.toFixed(0)}`
    );

    const openLots = state.lots.filter(l => !l.isClosed);
    const openLotsValue = openLots.reduce((s, l) => s + l.remainingQty * l.buyPrice, 0);
    const totalInvested = openLotsValue;
    const portfolioValue = parseFloat((state.balance + openLotsValue).toFixed(2));
    const roiPercent = totalCostAll > 0
      ? parseFloat((state.totalRealizedPnL / totalCostAll * 100).toFixed(2))
      : 0;
    const lastActiveAt = allSells[0]?.timestamp ?? state.lots[state.lots.length - 1]?.buyTimestamp ?? new Date().toISOString();

    const entry: LeaderboardEntry = {
      userId,
      name: userName,
      totalRealizedPnL: state.totalRealizedPnL,
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
  }, [state, hydrated]);

  function buy(symbol: string, qty: number, price: number): boolean {
    try {
      dispatch({ type: "BUY", symbol, qty, price });
      setLastError(null);
      return true;
    } catch (e: any) {
      setLastError(e.message);
      return false;
    }
  }

  function sellLot(lotId: string, qty: number, currentPrice: number): boolean {
    try {
      dispatch({ type: "SELL_LOT", lotId, qty, currentPrice });
      setLastError(null);
      return true;
    } catch (e: any) {
      setLastError(e.message);
      return false;
    }
  }

  function reset() {
    dispatch({ type: "RESET" });
    setLastError(null);
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
  };
}
