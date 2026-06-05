"use client";
import { useState, useEffect, useCallback } from "react";
import { getSimStock, getAllSymbols } from "../engine/marketData";

export interface RealPriceTick {
  symbol:    string;
  price:     number;   // Original currency (USD for crypto, INR for NSE)
  inrPrice:  number;   // INR equivalent (same as price for NSE stocks)
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

// Cached USD/INR forex rate — refreshes every 60 seconds
let cachedForexRate = 83.0;
let lastForexFetch = 0;
const FOREX_REFRESH_MS = 60000;

async function getForexRate(): Promise<number> {
  const now = Date.now();
  if (now - lastForexFetch < FOREX_REFRESH_MS) return cachedForexRate;
  try {
    const res = await fetch("/api/forex/usdinr", { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (data.rate > 0) {
      cachedForexRate = data.rate;
      lastForexFetch = now;
    }
  } catch { /* keep last rate */ }
  return cachedForexRate;
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
    const querySym = stock?.yahooSymbol ?? symbol;
    const res = await fetch(`/api/quote?symbol=${querySym}`, {
      cache:  "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.ltp && data.ltp > 0) {
      const usdPrice = data.ltp;
      let inrPrice = usdPrice;
      if (stock?.sector === "Crypto") {
        const rate = await getForexRate();
        inrPrice = parseFloat((usdPrice * rate).toFixed(2));
      }
      notify(symbol, {
        symbol,
        price:     usdPrice,
        inrPrice,
        change:    data.change    ?? parseFloat((usdPrice - prev).toFixed(2)),
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
      inrPrice:  prev,
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
      symbol, price: stock?.basePrice ?? 0, inrPrice: stock?.basePrice ?? 0,
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
