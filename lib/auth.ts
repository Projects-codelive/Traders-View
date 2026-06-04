import { AuthSession, LeaderboardEntry } from "./auth-types";

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


