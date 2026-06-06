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
  currency?:    string; // "INR" | "USD" — defaults to "INR"
}

const DEFAULT_STOCKS_LIST: StockConfig[] = [
  { id: "WIPRO",    label: "Wipro",       yahooSymbol: "WIPRO.NS",    basePrice: 201.5,   volatility: 0.018, drift: 0.00005,  sector: "IT",      lotSize: 1, isIndex: false, isPinned: true,  tvSymbol: "NSE:WIPRO",    currency: "INR" },
  { id: "INFY",     label: "Infosys",     yahooSymbol: "INFY.NS",     basePrice: 1580.0,  volatility: 0.016, drift: 0.00008,  sector: "IT",      lotSize: 1, isIndex: false, isPinned: true,  tvSymbol: "NSE:INFY",     currency: "INR" },
  { id: "TCS",      label: "TCS",         yahooSymbol: "TCS.NS",      basePrice: 3920.0,  volatility: 0.014, drift: 0.00006,  sector: "IT",      lotSize: 1, isIndex: false, isPinned: true,  tvSymbol: "NSE:TCS",      currency: "INR" },
  { id: "NIFTY",    label: "Nifty 50",    yahooSymbol: "^NSEI",       basePrice: 23900.0, volatility: 0.010, drift: 0.00004,  sector: "Index",   lotSize: 1, isIndex: true,  isPinned: true,  tvSymbol: "NSE:NIFTY",    currency: "INR" },
  { id: "SENSEX",   label: "Sensex",      yahooSymbol: "^BSESN",      basePrice: 79000.0, volatility: 0.010, drift: 0.00004,  sector: "Index",   lotSize: 1, isIndex: true,  isPinned: true,  tvSymbol: "BSE:SENSEX",   currency: "INR" },
  { id: "BTC-USD",  label: "Bitcoin",     yahooSymbol: "BTC-USD",     basePrice: 67000.0, volatility: 0.035, drift: 0.0001,   sector: "Crypto",  lotSize: 1, isIndex: false, isPinned: false, tvSymbol: "COINBASE:BTCUSD", currency: "USD" },
  { id: "ETH-USD",  label: "Ethereum",    yahooSymbol: "ETH-USD",     basePrice: 3400.0,  volatility: 0.030, drift: 0.0001,   sector: "Crypto",  lotSize: 1, isIndex: false, isPinned: false, tvSymbol: "COINBASE:ETHUSD", currency: "USD" },
];

const symbolRegistry = new Map<string, StockConfig>(
  DEFAULT_STOCKS_LIST.map(s => [s.id, s])
);

export const SIM_STOCKS = DEFAULT_STOCKS_LIST.filter(s => s.sector !== "Crypto");

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
