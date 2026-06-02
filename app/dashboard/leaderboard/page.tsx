"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Leaderboard from "@/simulation/components/Leaderboard";

export default function LeaderboardPage() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session) router.replace("/");
  }, [session, loading]);

  if (loading || !session) return null;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "#0a0e17",
        backgroundImage: `
          linear-gradient(rgba(0,212,170,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,170,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        fontFamily: "Lato, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lato:wght@100;300;400;700;900&display=swap');
      `}</style>

      <header
        className="flex items-center justify-between px-8 py-4 sticky top-0 z-10"
        style={{ background: "rgba(10,14,23,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid #1f2937" }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm transition flex items-center gap-1.5"
            style={{ color: "#6b7280" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}
          >
            &larr; Dashboard
          </button>
          <span style={{ color: "#1f2937" }}>|</span>
          <h1 className="text-base font-bold" style={{ color: "#00d4aa", fontFamily: "Lato" }}>
            {'\uD83C\uDFC6'} Global Leaderboard
          </h1>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "#00d4aa18", color: "#00d4aa", border: "1px solid #00d4aa33" }}
          >
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
            style={{ background: "#0f1521", border: "1px solid #1f2937" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span style={{ color: "#9ca3af" }}>Updates every 5s</span>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: "#0f1521", border: "1px solid #1f2937" }}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ background: "#00d4aa22", color: "#00d4aa" }}
            >
              {session.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs" style={{ color: "#9ca3af" }}>{session.name}</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <Leaderboard />
      </div>
    </div>
  );
}
