"use client";
import { useState, useEffect, useRef, useCallback } from "react";

export interface MarketStock {
  id:          string;
  yahooSymbol: string;
  label:       string;
  price:       number;
  change:      number;
  changePct:   number;
  volume:      number;
  marketCap:   number | null;
  high52w:     number | null;
  low52w:      number | null;
  prevClose:   number;
  timestamp:   number;
  openPrice:   number | null;
  dayHigh:     number | null;
  dayLow:      number | null;
  flashDir?:   "up" | "down" | null;
}

export type FilterMode = "all" | "gainers" | "losers";
export type SortMode   = "changePct" | "volume" | "marketCap" | "price";
export type SectionKey = "FOSec" | "allSec" | "NIFTY" | "NIFTYNEXT50" | "BANKNIFTY";

export function useMarkets(filter: FilterMode, section: SectionKey) {
  const [stocks,        setStocks]        = useState<MarketStock[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [lastFetch,     setLastFetch]     = useState<Date | null>(null);
  const [countdown,     setCountdown]     = useState(10);
  const [gainersCount,  setGainersCount]  = useState(0);
  const [losersCount,   setLosersCount]   = useState(0);
  const prevPrices = useRef<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const url  = `/api/markets?filter=${filter}&section=${section}`;
      const res  = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.stocks?.length) throw new Error("No market data returned");

      setGainersCount(data.gainers ?? 0);
      setLosersCount(data.losers ?? 0);

      const withFlash: MarketStock[] = data.stocks.map((s: MarketStock) => {
        const prev = prevPrices.current[s.id];
        const dir  = prev === undefined ? null : s.price > prev ? "up" : s.price < prev ? "down" : null;
        prevPrices.current[s.id] = s.price;
        return { ...s, flashDir: dir };
      });

      setStocks(withFlash);
      setLastFetch(new Date());
      setError(null);
      setCountdown(10);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, section]);

  useEffect(() => {
    fetchMarkets();
    timerRef.current = setInterval(fetchMarkets, 10000);

    countRef.current = setInterval(() => {
      setCountdown(p => p <= 1 ? 10 : p - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [fetchMarkets]);

  function getFiltered(sort: SortMode): MarketStock[] {
    const list = [...stocks];
    list.sort((a, b) => {
      if (sort === "changePct")  return b.changePct  - a.changePct;
      if (sort === "volume")     return (b.volume     ?? 0) - (a.volume    ?? 0);
      if (sort === "marketCap")  return (b.marketCap  ?? 0) - (a.marketCap ?? 0);
      if (sort === "price")      return b.price       - a.price;
      return 0;
    });
    return list;
  }

  return { stocks, loading, error, lastFetch, countdown, fetchMarkets, getFiltered, gainersCount, losersCount };
}
