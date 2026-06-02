export interface Holding {
  symbol: string;
  qty: number;
  avgBuyPrice: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  qty: number;
  price: number;
  total: number;
  timestamp: string;
  pnl?: number;
}

export interface PortfolioState {
  balance: number;
  holdings: Holding[];
  tradeHistory: Trade[];
}
