import { AuthSession, LeaderboardEntry, User } from "./auth-types";

const SESSION_KEY = "pt_session";

export function saveSession(user: { id: string; name: string; email: string }) {
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getPortfolioKey(userId: string): string {
  return `trading_portfolio_${userId}`;
}

const LEADERBOARD_KEY = "sim_leaderboard";

export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    const entries: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    return entries.sort((a, b) => b.totalRealizedPnL - a.totalRealizedPnL);
  } catch {
    return [];
  }
}

export function upsertLeaderboard(entry: LeaderboardEntry) {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    const entries: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];
    const idx = entries.findIndex(e => e.userId === entry.userId);
    if (idx >= 0) entries[idx] = entry;
    else entries.push(entry);
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const fresh = entries.filter(e => new Date(e.lastUpdated).getTime() > cutoff);
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(fresh));
  } catch { /* silent */ }
}

// ── Admin auth ─────────────────────────────────────────────────────────────

const ADMIN_SESSION_KEY = "admin_session";

const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "Admin123x@";

export interface AdminSession {
  username:    string;
  loggedInAt:  string;
}

export function getAllUsers(): User[] {
  try {
    const raw = localStorage.getItem("pt_users");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function adminLogin(username: string, password: string): boolean {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const session: AdminSession = { username, loggedInAt: new Date().toISOString() };
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    return true;
  }
  return false;
}

export function getAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

// ── User management ────────────────────────────────────────────────────────

export function blockUser(userId: string): boolean {
  try {
    const users = getAllUsers();
    const idx   = users.findIndex(u => u.id === userId);
    if (idx < 0) return false;
    users[idx] = { ...users[idx], isBlocked: true };
    localStorage.setItem("pt_users", JSON.stringify(users));

    const lb = localStorage.getItem("sim_leaderboard");
    if (lb) {
      const entries = (JSON.parse(lb) as Array<Record<string, unknown>>).filter((e: Record<string, unknown>) => e.userId !== userId);
      localStorage.setItem("sim_leaderboard", JSON.stringify(entries));
    }

    const session = localStorage.getItem("pt_session");
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed.userId === userId) localStorage.removeItem("pt_session");
    }

    return true;
  } catch { return false; }
}

export function unblockUser(userId: string): boolean {
  try {
    const users = getAllUsers();
    const idx   = users.findIndex(u => u.id === userId);
    if (idx < 0) return false;
    users[idx] = { ...users[idx], isBlocked: false };
    localStorage.setItem("pt_users", JSON.stringify(users));
    return true;
  } catch { return false; }
}

export function creditBalance(userId: string, amount: number): boolean {
  try {
    const key     = `sim_wallet_${userId}`;
    const raw     = localStorage.getItem(key);
    const wallet  = raw ? JSON.parse(raw) : { balance: 10000, lots: [], sellHistory: [], totalRealizedPnL: 0, totalTradesCount: 0, winCount: 0, lossCount: 0, equityCurve: [], shortPositions: [], coverHistory: [], totalShortPnL: 0 };
    wallet.balance = parseFloat((wallet.balance + amount).toFixed(2));
    localStorage.setItem(key, JSON.stringify(wallet));
    return true;
  } catch { return false; }
}

export function debitBalance(userId: string, amount: number): boolean {
  try {
    const key    = `sim_wallet_${userId}`;
    const raw    = localStorage.getItem(key);
    if (!raw) return false;
    const wallet = JSON.parse(raw);
    if (wallet.balance < amount) return false;
    wallet.balance = parseFloat((wallet.balance - amount).toFixed(2));
    localStorage.setItem(key, JSON.stringify(wallet));
    return true;
  } catch { return false; }
}

export function getUserWallet(userId: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(`sim_wallet_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}


