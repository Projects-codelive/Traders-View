"use client";
import { useState, useEffect, useCallback } from "react";
import { getSimStock, getAllSymbols } from "../engine/marketData";

export interface RealPriceTick {
  symbol:    string;
  price:     number;
  change:    number;
  changePct: number;
  open:      number;
  high:      number;
  low:       number;
  volume:    number;
  timestamp: number;
  isLive:    boolean;
  error:     string | null;
}

const priceStore: Record<string, RealPriceTick> = {};
const storeListeners: Map<string, Set<(t: RealPriceTick) => void>> = new Map();

function notify(symbol: string, tick: RealPriceTick) {
  priceStore[symbol] = tick;
  storeListeners.get(symbol)?.forEach(fn => fn(tick));
}

export function subscribePriceStore(symbol: string, fn: (t: RealPriceTick) => void) {
  if (!storeListeners.has(symbol)) storeListeners.set(symbol, new Set());
  storeListeners.get(symbol)!.add(fn);
}

export function unsubscribePriceStore(symbol: string, fn: (t: RealPriceTick) => void) {
  storeListeners.get(symbol)?.delete(fn);
}

async function doFetch(symbol: string): Promise<void> {
  const stock = getSimStock(symbol);
  const prev  = priceStore[symbol]?.price ?? stock?.basePrice ?? 0;

  try {
    const res = await fetch(`/api/quote?symbol=${symbol}`, {
      cache:  "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.ltp && data.ltp > 0) {
      notify(symbol, {
        symbol,
        price:     data.ltp,
        change:    data.change    ?? parseFloat((data.ltp - prev).toFixed(2)),
        changePct: data.changePct ?? 0,
        open:      data.open      ?? 0,
        high:      data.high      ?? 0,
        low:       data.low       ?? 0,
        volume:    data.volume    ?? 0,
        timestamp: Date.now(),
        isLive:    true,
        error:     null,
      });
    } else {
      throw new Error(data.error ?? "No price returned");
    }
  } catch (err: any) {
    notify(symbol, {
      symbol,
      price:     prev,
      change:    0, changePct: 0,
      open: 0, high: 0, low: 0, volume: 0,
      timestamp: Date.now(),
      isLive:    false,
      error:     err.message,
    });
  }
}

const activeTimers: Map<string, ReturnType<typeof setInterval | typeof setTimeout>> = new Map();

export function setSymbolPriority(activeSymbol: string) {
  activeTimers.forEach(t => { try { clearInterval(t as any); clearTimeout(t as any); } catch {} });
  activeTimers.clear();

  doFetch(activeSymbol);
  activeTimers.set(activeSymbol, setInterval(() => doFetch(activeSymbol), 400));

  getAllSymbols()
    .filter(s => s.id !== activeSymbol)
    .forEach((s, i) => {
      const delay = (i + 1) * 3000;
      const t = setTimeout(() => {
        doFetch(s.id);
        const bgTimer = setInterval(() => doFetch(s.id), 2000);
        activeTimers.set(s.id, bgTimer);
      }, delay);
      activeTimers.set(`_delay_${s.id}`, t as any);
    });
}

export function useRealPrice(symbol: string): RealPriceTick {
  const stock = getSimStock(symbol);
  const [tick, setTick] = useState<RealPriceTick>(
    () => priceStore[symbol] ?? {
      symbol, price: stock?.basePrice ?? 0,
      change: 0, changePct: 0,
      open: 0, high: 0, low: 0, volume: 0,
      timestamp: Date.now(), isLive: false, error: null,
    }
  );

  const handler = useCallback((t: RealPriceTick) => setTick(t), []);

  useEffect(() => {
    subscribePriceStore(symbol, handler);
    if (priceStore[symbol]) setTick(priceStore[symbol]);
    return () => unsubscribePriceStore(symbol, handler);
  }, [symbol, handler]);

  return tick;
}
