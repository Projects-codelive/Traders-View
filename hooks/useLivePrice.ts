"use client";

import { useState, useEffect, useRef } from "react";

export function useLivePrice(symbol: string, intervalMs = 3000) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res = await fetch(`/api/quote?symbol=${symbol}`);
        const data = await res.json();
        if (!cancelled) {
          if (data.ltp !== undefined && data.ltp !== null && !data.error) {
            setPrice(data.ltp);
            setError(null);
          } else {
            setError(data.error ?? "Price unavailable");
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Network error");
          setLoading(false);
        }
      }
    }

    fetchPrice();
    timerRef.current = setInterval(fetchPrice, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [symbol, intervalMs]);

  return { price, loading, error };
}
