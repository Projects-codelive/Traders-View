"use client";
import { useState, useEffect } from "react";
import {
  SIM_STOCKS, StockConfig,
  registerSymbol,
} from "../engine/marketData";

const CUSTOM_SYMBOLS_KEY = "pt_custom_symbols";
const HIDDEN_DEFAULTS_KEY = "pt_hidden_defaults";
export const MAX_CUSTOM_TABS = 20;

export function useSymbolRegistry() {
  const [customSymbols, setCustomSymbols] = useState<StockConfig[]>([]);
  const [hiddenDefaults, setHiddenDefaults] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SYMBOLS_KEY);
      if (raw) {
        const saved: StockConfig[] = JSON.parse(raw);
        saved.forEach(s => registerSymbol(s));
        setCustomSymbols(saved);
      }
    } catch { /* start fresh */ }
    try {
      const raw = localStorage.getItem(HIDDEN_DEFAULTS_KEY);
      if (raw) setHiddenDefaults(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  const activeTabs: StockConfig[] = [
    ...SIM_STOCKS.filter(s => !hiddenDefaults.has(s.id)),
    ...customSymbols.filter(c => !SIM_STOCKS.find(d => d.id === c.id)),
  ];

  function persistHidden(ids: Set<string>) {
    setHiddenDefaults(ids);
    localStorage.setItem(HIDDEN_DEFAULTS_KEY, JSON.stringify([...ids]));
  }

  function addSymbol(config: Omit<StockConfig, "basePrice" | "volatility" | "drift" | "lotSize" | "isPinned" | "tvSymbol">) {
    const isDefault = !!SIM_STOCKS.find(d => d.id === config.id);
    if (isDefault) {
      // Unhide if previously hidden
      if (hiddenDefaults.has(config.id)) {
        const next = new Set(hiddenDefaults);
        next.delete(config.id);
        persistHidden(next);
      }
      return;
    }
    if (customSymbols.find(c => c.id === config.id)) return;

    const isCrypto = config.sector === "Crypto";
    const full: StockConfig = {
      ...config,
      basePrice:   0,
      volatility:  0.015,
      drift:       0.00005,
      lotSize:     1,
      isPinned:    false,
      tvSymbol:    isCrypto ? config.yahooSymbol : `NSE:${config.id}`,
      currency:    isCrypto ? "USD" : "INR",
    };

    registerSymbol(full);

    const updated = [...customSymbols, full].slice(-MAX_CUSTOM_TABS);
    setCustomSymbols(updated);
    localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(updated));
  }

  function removeSymbol(id: string) {
    // If it's a default SIM_STOCK, hide it instead
    if (SIM_STOCKS.find(s => s.id === id)) {
      const next = new Set(hiddenDefaults);
      next.add(id);
      persistHidden(next);
      return;
    }
    const updated = customSymbols.filter(c => c.id !== id);
    setCustomSymbols(updated);
    localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(updated));
  }

  return { activeTabs, customSymbols, addSymbol, removeSymbol };
}
