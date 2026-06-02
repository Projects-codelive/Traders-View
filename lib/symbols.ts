export interface SymbolConfig {
  id: string;
  label: string;
  tvSymbol: string;
  isIndex: boolean;
}

export const SYMBOLS: SymbolConfig[] = [
  { id: "WIPRO",    label: "Wipro",      tvSymbol: "NSE:WIPRO",    isIndex: false },
  { id: "INFY",     label: "Infosys",    tvSymbol: "NSE:INFY",     isIndex: false },
  { id: "TCS",      label: "TCS",        tvSymbol: "NSE:TCS",      isIndex: false },
  { id: "RELIANCE", label: "Reliance",   tvSymbol: "NSE:RELIANCE", isIndex: false },
  { id: "HDFCBANK", label: "HDFC Bank",  tvSymbol: "NSE:HDFCBANK", isIndex: false },
  { id: "NIFTY",    label: "Nifty 50",   tvSymbol: "NSE:NIFTY",  isIndex: true  },
];

export function getSymbol(id: string): SymbolConfig | undefined {
  return SYMBOLS.find(s => s.id === id);
}
