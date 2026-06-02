import { User, AuthSession, LeaderboardEntry } from "./auth-types";

const USERS_KEY = "pt_users";
const SESSION_KEY = "pt_session";
const INITIAL_BALANCE = 100000;

export function getAllUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function findUserByEmail(email: string): User | undefined {
  return getAllUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

export interface RegisterPayload {
  name: string;
  gender: "male" | "female" | "other";
  phone: string;
  dob: string;
  email: string;
  password: string;
}

export function registerUser(payload: RegisterPayload): { success: true; user: User } | { success: false; error: string } {
  const existing = findUserByEmail(payload.email);
  if (existing) return { success: false, error: "An account with this email already exists." };

  const user: User = {
    id: crypto.randomUUID(),
    name: payload.name.trim(),
    gender: payload.gender,
    phone: payload.phone,
    dob: payload.dob,
    email: payload.email.toLowerCase().trim(),
    passwordHash: btoa(payload.password),
    createdAt: new Date().toISOString(),
  };

  const users = getAllUsers();
  users.push(user);
  saveUsers(users);

  const portfolioKey = `trading_portfolio_${user.id}`;
  if (!localStorage.getItem(portfolioKey)) {
    localStorage.setItem(portfolioKey, JSON.stringify({
      balance: INITIAL_BALANCE,
      holdings: [],
      tradeHistory: [],
    }));
  }

  return { success: true, user };
}

export function loginUser(email: string, password: string): { success: true; user: User } | { success: false; error: string } {
  const user = findUserByEmail(email);
  if (!user) return { success: false, error: "No account found with this email." };
  if (user.passwordHash !== btoa(password)) return { success: false, error: "Incorrect password." };
  return { success: true, user };
}

export function saveSession(user: User) {
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


