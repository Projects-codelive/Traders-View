"use client";
import { useReducer, useEffect, useState } from "react";
import { PortfolioState, Trade } from "@/lib/types";

const INITIAL_STATE: PortfolioState = {
  balance: 10000,
  holdings: [],
  tradeHistory: [],
};

const STORAGE_KEY = "trading_portfolio";

type Action =
  | { type: "BUY"; symbol: string; qty: number; price: number }
  | { type: "SELL"; symbol: string; qty: number; price: number }
  | { type: "RESET" }
  | { type: "HYDRATE"; payload: PortfolioState };

function reducer(state: PortfolioState, action: Action): PortfolioState {
  switch (action.type) {
    case "HYDRATE":
      return action.payload;

    case "BUY": {
      const INDEX_SYMBOLS = ["NIFTY"];
      if (INDEX_SYMBOLS.includes(action.symbol)) {
        throw new Error(`${action.symbol} is an index and cannot be traded.`);
      }
      const cost = action.qty * action.price;
      if (cost > state.balance) throw new Error("Insufficient balance");

      const existingIdx = state.holdings.findIndex(h => h.symbol === action.symbol);
      let newHoldings = [...state.holdings];

      if (existingIdx >= 0) {
        const old = newHoldings[existingIdx];
        const newQty = old.qty + action.qty;
        const newAvg = (old.avgBuyPrice * old.qty + action.price * action.qty) / newQty;
        newHoldings[existingIdx] = { ...old, qty: newQty, avgBuyPrice: newAvg };
      } else {
        newHoldings.push({ symbol: action.symbol, qty: action.qty, avgBuyPrice: action.price });
      }

      const trade: Trade = {
        id: Date.now().toString(),
        symbol: action.symbol,
        type: "BUY",
        qty: action.qty,
        price: action.price,
        total: cost,
        timestamp: new Date().toISOString(),
      };

      return {
        ...state,
        balance: state.balance - cost,
        holdings: newHoldings,
        tradeHistory: [trade, ...state.tradeHistory],
      };
    }

    case "SELL": {
      const holdingIdx = state.holdings.findIndex(h => h.symbol === action.symbol);
      if (holdingIdx < 0) throw new Error("No holdings found");
      const holding = state.holdings[holdingIdx];
      if (action.qty > holding.qty) throw new Error("Not enough shares to sell");

      const proceeds = action.qty * action.price;
      const costBasis = action.qty * holding.avgBuyPrice;
      const pnl = proceeds - costBasis;

      let newHoldings = [...state.holdings];
      if (action.qty === holding.qty) {
        newHoldings.splice(holdingIdx, 1);
      } else {
        newHoldings[holdingIdx] = { ...holding, qty: holding.qty - action.qty };
      }

      const trade: Trade = {
        id: Date.now().toString(),
        symbol: action.symbol,
        type: "SELL",
        qty: action.qty,
        price: action.price,
        total: proceeds,
        pnl,
        timestamp: new Date().toISOString(),
      };

      return {
        ...state,
        balance: state.balance + proceeds,
        holdings: newHoldings,
        tradeHistory: [trade, ...state.tradeHistory],
      };
    }

    case "RESET":
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

export function usePortfolio(userId?: string) {
  const storageKey = userId ? `trading_portfolio_${userId}` : STORAGE_KEY;
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const saved: PortfolioState = JSON.parse(stored);
        dispatch({ type: "HYDRATE", payload: saved });
      }
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [state, hydrated, storageKey]);

  const buy = (symbol: string, qty: number, price: number) => {
    dispatch({ type: "BUY", symbol, qty, price });
  };

  const sell = (symbol: string, qty: number, price: number) => {
    dispatch({ type: "SELL", symbol, qty, price });
  };

  const reset = () => dispatch({ type: "RESET" });

  const getTotalPnL = (currentPrices: Record<string, number>) => {
    return state.holdings.reduce((acc, h) => {
      const current = currentPrices[h.symbol] ?? h.avgBuyPrice;
      return acc + (current - h.avgBuyPrice) * h.qty;
    }, 0);
  };

  return { state, buy, sell, reset, getTotalPnL };
}
