export interface StockConfig {
  id:           string;
  label:        string;
  yahooSymbol:  string;
  basePrice:    number;
  volatility:   number;
  drift:        number;
  sector:       string;
  lotSize:      number;
  isIndex:      boolean;
  isPinned:     boolean;
  tvSymbol:     string;
}

const DEFAULT_STOCKS_LIST: StockConfig[] = [
  { id: "WIPRO",    label: "Wipro",       yahooSymbol: "WIPRO.NS",    basePrice: 201.5,   volatility: 0.018, drift: 0.00005,  sector: "IT",      lotSize: 1, isIndex: false, isPinned: true, tvSymbol: "NSE:WIPRO"    },
  { id: "INFY",     label: "Infosys",     yahooSymbol: "INFY.NS",     basePrice: 1580.0,  volatility: 0.016, drift: 0.00008,  sector: "IT",      lotSize: 1, isIndex: false, isPinned: true, tvSymbol: "NSE:INFY"     },
  { id: "TCS",      label: "TCS",         yahooSymbol: "TCS.NS",      basePrice: 3920.0,  volatility: 0.014, drift: 0.00006,  sector: "IT",      lotSize: 1, isIndex: false, isPinned: true, tvSymbol: "NSE:TCS"      },
  { id: "RELIANCE", label: "Reliance",    yahooSymbol: "RELIANCE.NS", basePrice: 2945.0,  volatility: 0.015, drift: 0.00010,  sector: "Energy",  lotSize: 1, isIndex: false, isPinned: true, tvSymbol: "NSE:RELIANCE" },
  { id: "HDFCBANK", label: "HDFC Bank",   yahooSymbol: "HDFCBANK.NS", basePrice: 1720.0,  volatility: 0.013, drift: 0.00007,  sector: "Banking", lotSize: 1, isIndex: false, isPinned: true, tvSymbol: "NSE:HDFCBANK" },
  { id: "NIFTY",    label: "Nifty 50",    yahooSymbol: "^NSEI",       basePrice: 23900.0, volatility: 0.010, drift: 0.00004,  sector: "Index",   lotSize: 1, isIndex: true,  isPinned: true, tvSymbol: "NSE:NIFTY"    },
  { id: "SENSEX",   label: "Sensex",      yahooSymbol: "^BSESN",      basePrice: 79000.0, volatility: 0.010, drift: 0.00004,  sector: "Index",   lotSize: 1, isIndex: true,  isPinned: true, tvSymbol: "BSE:SENSEX"   },
];

const symbolRegistry = new Map<string, StockConfig>(
  DEFAULT_STOCKS_LIST.map(s => [s.id, s])
);

export const SIM_STOCKS = DEFAULT_STOCKS_LIST;

export function getSimStock(id: string): StockConfig | undefined {
  return symbolRegistry.get(id);
}

export function getAllSymbols(): StockConfig[] {
  return Array.from(symbolRegistry.values());
}

export function registerSymbol(config: StockConfig) {
  symbolRegistry.set(config.id, config);
}

export function isSymbolRegistered(id: string): boolean {
  return symbolRegistry.has(id);
}
