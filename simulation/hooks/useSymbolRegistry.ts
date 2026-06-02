"use client";
import { useState, useEffect } from "react";
import {
  SIM_STOCKS, StockConfig,
  registerSymbol,
} from "../engine/marketData";

const CUSTOM_SYMBOLS_KEY = "pt_custom_symbols";
const MAX_CUSTOM_TABS = 5;

export function useSymbolRegistry() {
  const [customSymbols, setCustomSymbols] = useState<StockConfig[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SYMBOLS_KEY);
      if (raw) {
        const saved: StockConfig[] = JSON.parse(raw);
        saved.forEach(s => registerSymbol(s));
        setCustomSymbols(saved);
      }
    } catch { /* start fresh */ }
  }, []);

  const activeTabs: StockConfig[] = [
    ...SIM_STOCKS,
    ...customSymbols.filter(c => !SIM_STOCKS.find(d => d.id === c.id)),
  ];

  function addSymbol(config: Omit<StockConfig, "basePrice" | "volatility" | "drift" | "lotSize" | "isPinned" | "tvSymbol">) {
    if (SIM_STOCKS.find(d => d.id === config.id)) return;
    if (customSymbols.find(c => c.id === config.id)) return;

    const full: StockConfig = {
      ...config,
      basePrice:   0,
      volatility:  0.015,
      drift:       0.00005,
      lotSize:     1,
      isPinned:    false,
      tvSymbol:    config.isIndex ? `NSE:${config.id}` : `NSE:${config.id}`,
    };

    registerSymbol(full);

    const updated = [...customSymbols, full].slice(-MAX_CUSTOM_TABS);
    setCustomSymbols(updated);
    localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(updated));
  }

  function removeSymbol(id: string) {
    const updated = customSymbols.filter(c => c.id !== id);
    setCustomSymbols(updated);
    localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(updated));
  }

  return { activeTabs, customSymbols, addSymbol, removeSymbol };
}
