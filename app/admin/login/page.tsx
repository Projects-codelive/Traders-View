"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminLogin, getAdminSession } from "@/lib/auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    if (getAdminSession()) router.replace("/admin");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    await new Promise(r => setTimeout(r, 600));
    const ok = adminLogin(username.trim(), password);
    if (ok) {
      router.push("/admin");
    } else {
      setError("Invalid credentials. Access denied.");
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background: "radial-gradient(ellipse at top, #0d1f1a 0%, #080d0b 60%, #050808 100%)",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center mb-6"
        style={{ background: "#0f2a21", border: "1px solid #00d4aa33" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00d4aa" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>

      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-widest text-white">
          PAPER TRADER <span style={{ color: "#00d4aa" }}>ADMIN</span>
        </h1>
        <p className="text-xs tracking-widest mt-1" style={{ color: "#4b5563" }}>
          RESTRICTED TERMINAL ACCESS
        </p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-xs tracking-widest mb-2" style={{ color: "#6b7280" }}>USERNAME</label>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "#0a1410", border: `1px solid ${error ? "#ef535066" : "#1f2f24"}` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(""); }}
                placeholder="Enter username"
                className="bg-transparent outline-none text-sm text-gray-300 placeholder-gray-600 w-full"
                style={{ fontFamily: "DM Mono" }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs tracking-widest mb-2" style={{ color: "#6b7280" }}>PASSWORD</label>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "#0a1410", border: `1px solid ${error ? "#ef535066" : "#1f2f24"}` }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter security key"
                className="bg-transparent outline-none text-sm text-gray-300 placeholder-gray-600 flex-1"
                style={{ fontFamily: "DM Mono" }}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="text-gray-600 hover:text-gray-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {showPass
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
          </div>

          <div
            className="flex items-start gap-3 px-3 py-3 rounded-xl text-xs"
            style={{ background: "#0a1a12", border: "1px solid #1a3020", color: "#6b7280" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00d4aa55" strokeWidth="2" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Authorization required for admin access. All activity is logged under NSE/BSE compliance protocols.</span>
          </div>

          {error && (
            <div className="text-xs text-red-400 text-center px-3 py-2 rounded-lg" style={{ background: "#2a0a0a", border: "1px solid #ef535033" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full py-3.5 rounded-xl font-bold tracking-widest text-sm transition disabled:opacity-50"
            style={{ background: loading ? "#00a07a" : "#00d4aa", color: "#000" }}
          >
            {loading ? "AUTHENTICATING\u2026" : "AUTHENTICATE \u2192"}
          </button>
        </form>

        <div className="flex justify-between text-xs mt-6" style={{ color: "#374151" }}>
          <span>ADMIN_AUTH</span>
          <span>Admin // Admin123x@</span>
        </div>
      </div>

      <p className="text-xs mt-8 tracking-widest" style={{ color: "#374151" }}>
        &copy; {new Date().getFullYear()} PAPER TRADER SYSTEMS. ALL RIGHTS RESERVED.
      </p>
    </div>
  );
}
