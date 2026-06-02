export interface StockConfig {
  id: string;
  label: string;
  basePrice: number;    // kept for wallet display as fallback only
  volatility: number;   // kept for fallback display only
  drift: number;
  sector: string;
  lotSize: number;
  isIndex: boolean;
  tvSymbol: string;     // TradingView exchange:ticker format
}

export const SIM_STOCKS: StockConfig[] = [
  { id: "WIPRO",    label: "Wipro",      basePrice: 201.5,   volatility: 0.018, drift: 0.00005,  sector: "IT",      lotSize: 1, isIndex: false, tvSymbol: "NSE:WIPRO"    },
  { id: "INFY",     label: "Infosys",    basePrice: 1580.0,  volatility: 0.016, drift: 0.00008,  sector: "IT",      lotSize: 1, isIndex: false, tvSymbol: "NSE:INFY"     },
  { id: "TCS",      label: "TCS",        basePrice: 3920.0,  volatility: 0.014, drift: 0.00006,  sector: "IT",      lotSize: 1, isIndex: false, tvSymbol: "NSE:TCS"      },
  { id: "RELIANCE", label: "Reliance",   basePrice: 2945.0,  volatility: 0.015, drift: 0.00010,  sector: "Energy",  lotSize: 1, isIndex: false, tvSymbol: "NSE:RELIANCE" },
  { id: "HDFCBANK", label: "HDFC Bank",  basePrice: 1720.0,  volatility: 0.013, drift: 0.00007,  sector: "Banking", lotSize: 1, isIndex: false, tvSymbol: "NSE:HDFCBANK" },
  { id: "NIFTY",    label: "Nifty 50",   basePrice: 23900.0, volatility: 0.010, drift: 0.00004,  sector: "Index",   lotSize: 1, isIndex: false, tvSymbol: "NSE:NIFTY"    },
];

export function getSimStock(id: string): StockConfig | undefined {
  return SIM_STOCKS.find(s => s.id === id);
}
