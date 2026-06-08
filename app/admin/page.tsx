"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminSession, clearAdminSession, blockUser, unblockUser } from "@/lib/auth";
import { User } from "@/lib/auth-types";
import axios from "axios";
import AdminActionHistory from "@/components/AdminActionHistory";

const RS = '\u20B9';

export default function AdminPage() {
  const router = useRouter();
  const [users,   setUsers]   = useState<User[]>([]);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<"all" | "active" | "blocked">("all");
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!getAdminSession()) { router.replace("/admin/login"); return; }
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await axios.get("/api/admin/users");
      setUsers(res.data.users);
    } catch {
      const raw = localStorage.getItem("pt_users");
      setUsers(raw ? JSON.parse(raw) : []);
    }
    setLoading(false);
  }

  async function handleBlock(userId: string) {
    try {
      await axios.patch(`/api/admin/users/${userId}`, { action: "block" });
      blockUser(userId); // keep localStorage in sync for login block check
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: true } : u));
    } catch {}
  }

  async function handleUnblock(userId: string) {
    try {
      await axios.patch(`/api/admin/users/${userId}`, { action: "unblock" });
      unblockUser(userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBlocked: false } : u));
    } catch {}
  }

  function handleLogout() {
    clearAdminSession();
    router.push("/admin/login");
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()) || u.id.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "active" && !u.isBlocked) || (filter === "blocked" && u.isBlocked);
    return matchSearch && matchFilter;
  });

  const activeCount  = users.filter(u => !u.isBlocked).length;
  const blockedCount = users.filter(u => u.isBlocked).length;
  const totalVol     = users.reduce((s, u) => {
    return s + Math.abs((u as any).totalRealizedPnL ?? 0) + Math.abs((u as any).totalShortPnL ?? 0);
  }, 0);

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "#080d0b", fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <header
        className="flex items-center justify-between px-8 py-4"
        style={{ background: "#0a1410", borderBottom: "1px solid #1a2e22" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold" style={{ color: "#00d4aa" }}>Play</span>
          <span
            className="text-xs px-2 py-0.5 rounded font-mono"
            style={{ background: "#00d4aa18", color: "#00d4aa", border: "1px solid #00d4aa33" }}
          >
            ADMIN
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm px-4 py-1.5 rounded-lg transition font-medium"
          style={{ background: "#1a0a0a", color: "#ef5350", border: "1px solid #ef535033" }}
        >
          Sign Out
        </button>
      </header>

      <div className="px-8 py-6">

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#00d4aa" }} />
              <span className="text-xs tracking-widest font-mono" style={{ color: "#00d4aa" }}>SYSTEM OPERATIONAL</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Admin Command Center</h1>
            <p className="text-gray-500 text-sm mt-1">Real-time oversight of all users, trade volumes, and account status.</p>
          </div>

          <div className="flex gap-3">
            {[
              { label: "TOTAL USERS",  value: users.length.toString(),          color: "#fff"     },
              { label: "ACTIVE",       value: activeCount.toString(),            color: "#00d4aa"  },
              { label: "BLOCKED",      value: blockedCount.toString(),           color: "#ef5350"  },
              { label: "TOTAL VOL",    value: `${RS}${(totalVol/1000).toFixed(1)}K`, color: "#00d4aa" },
            ].map(s => (
              <div
                key={s.label}
                className="px-5 py-3 rounded-xl text-center"
                style={{ background: "#0d1a14", border: "1px solid #1a2e22", minWidth: 90 }}
              >
                <div className="text-xs text-gray-600 tracking-wider font-mono">{s.label}</div>
                <div className="text-xl font-bold mt-0.5 font-mono" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
            <button
              onClick={() => setShowHistory(true)}
              className="px-4 py-3 rounded-xl text-xs font-semibold transition flex items-center gap-2"
              style={{ background: "#0d1a14", color: "#00d4aa", border: "1px solid #00d4aa33", whiteSpace: "nowrap" }}
            >
              {'\u{1F4CB}'} Credit/Debit History
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: "#0d1a14", border: "1px solid #1a2e22", width: 280 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Filter by name, email, or ID..."
                className="bg-transparent outline-none text-sm text-gray-300 placeholder-gray-600 w-full"
              />
            </div>

            <div
              className="flex rounded-lg overflow-hidden"
              style={{ border: "1px solid #1a2e22" }}
            >
              {(["all", "active", "blocked"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-4 py-2 text-xs font-medium capitalize transition"
                  style={{
                    background: filter === f ? "#00d4aa22" : "#0d1a14",
                    color:      filter === f ? "#00d4aa"   : "#6b7280",
                    borderRight: f !== "blocked" ? "1px solid #1a2e22" : "none",
                  }}
                >
                  {f === "all" ? "All" : f === "active" ? "Active" : "Blocked"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #1a2e22" }}>
          <div
            className="grid px-6 py-3 text-sm font-mono tracking-wider text-gray-600"
            style={{ gridTemplateColumns: "120px 1fr 220px 100px 140px 120px", background: "#0a1410", borderBottom: "1px solid #1a2e22" }}
          >
            <span>USER ID</span>
            <span>NAME</span>
            <span>EMAIL ADDRESS</span>
            <span>STATUS</span>
            <span className="text-right">BALANCE</span>
            <span className="text-right">ACTION</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20" style={{ background: "#080d0b" }}>
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "#00d4aa", borderTopColor: "transparent" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-600" style={{ background: "#080d0b" }}>No users found.</div>
          ) : (
            filtered.map((user: any, i) => {
              const balance = user.balance ?? 10000;
              return (
                <div
                  key={user.id}
                  className="grid items-center px-6 py-4 cursor-pointer transition"
                  style={{
                    gridTemplateColumns: "120px 1fr 220px 100px 140px 120px",
                    background:   "transparent",
                    borderBottom: i < filtered.length - 1 ? "1px solid #1a2e22" : "none",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#0d1a14"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <span className="text-xs font-mono text-gray-500">
                    #{user.id.slice(0, 8).toUpperCase()}
                  </span>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: "#0f2a21", color: "#00d4aa" }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-white">{user.name}</span>
                  </div>

                  <span className="text-sm text-gray-400 truncate">{user.email}</span>

                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full font-mono"
                    style={{
                      background: user.isBlocked ? "#2a0a0a" : "#0a2a1a",
                      color:      user.isBlocked ? "#ef5350" : "#00d4aa",
                      border:     `1px solid ${user.isBlocked ? "#ef535033" : "#00d4aa33"}`,
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: user.isBlocked ? "#ef5350" : "#00d4aa" }} />
                    {user.isBlocked ? "BLOCKED" : "ACTIVE"}
                  </span>

                  <span className="text-right font-mono font-semibold text-white">
                    {RS}{balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </span>

                  <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                      className="p-1.5 rounded-lg transition hover:bg-gray-700 text-gray-500 hover:text-white"
                      title="Edit user"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      onClick={() => user.isBlocked ? handleUnblock(user.id) : handleBlock(user.id)}
                      className="p-1.5 rounded-lg transition"
                      style={{
                        background: user.isBlocked ? "#0a2a1a" : "#1a0a0a",
                        color:      user.isBlocked ? "#00d4aa" : "#ef5350",
                      }}
                      title={user.isBlocked ? "Unblock" : "Block"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {user.isBlocked
                          ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                          : <circle cx="12" cy="12" r="10"/>
                        }
                        {!user.isBlocked && <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>}
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-gray-600 mt-3 ml-1">
            Showing {filtered.length} of {users.length} users
          </p>
        )}
      </div>

      <AdminActionHistory open={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
}
