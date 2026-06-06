export interface User {
  id: string;
  name: string;
  gender: "male" | "female" | "other";
  phone: string;
  dob: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  loggedInAt: string;
}

export interface TradeLot {
  lotId: string;
  symbol: string;
  buyPrice: number;
  originalQty: number;
  remainingQty: number;
  buyTimestamp: string;
  isClosed: boolean;
}

export interface SellRecord {
  sellId: string;
  lotId: string;
  symbol: string;
  qtySold: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  pnlPct: number;
  timestamp: string;
}

export interface EquityPoint {
  time: number;
  value: number;
}

export interface ShortPosition {
  positionId:    string;
  symbol:        string;
  shortPrice:    number;
  originalQty:   number;
  remainingQty:  number;
  marginBlocked: number;
  openTimestamp: string;
  isClosed:      boolean;
}

export interface CoverRecord {
  coverId:       string;
  positionId:    string;
  symbol:        string;
  qtyCovered:    number;
  shortPrice:    number;
  coverPrice:    number;
  pnl:           number;
  pnlPct:        number;
  timestamp:     string;
}

export interface SimWalletState {
  balance:           number;
  lots:              TradeLot[];
  sellHistory:       SellRecord[];
  totalRealizedPnL:  number;
  totalTradesCount:  number;
  winCount:          number;
  lossCount:         number;
  equityCurve:       EquityPoint[];
  shortPositions:    ShortPosition[];
  coverHistory:      CoverRecord[];
  totalShortPnL:     number;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  totalRealizedPnL: number;
  totalTradesCount: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  portfolioValue: number;
  lastUpdated: string;
  top5Trades: SellRecord[];
  equityCurve: EquityPoint[];
  maxDrawdown: number;
  profitFactor: number;
  avgTradeDurationHours: number;
  assetAllocation: Record<string, number>;
  recentActivity: string[];
  lastActiveAt: string;
  totalInvested: number;
  roiPercent: number;
}
