"use client";
import { useState, useEffect } from "react";
import axios from "axios";

const RS = '\u20B9';

interface AdminAction {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: "credit" | "debit";
  amount: number;
  signedAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId?: string;
  title?: string;
}

export default function AdminActionHistory({ open, onClose, userId, title }: Props) {
  const [actions, setActions] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "credit" | "debit">("all");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearch("");
    setTypeFilter("all");
    const url = userId ? `/api/admin/actions?userId=${userId}` : "/api/admin/actions";
    axios.get(url).then(res => {
      setActions(res.data.actions);
    }).catch(() => {
      setActions([]);
    }).finally(() => setLoading(false));
  }, [open, userId]);

  const filtered = actions.filter(a => {
    if (typeFilter !== "all" && a.action !== typeFilter) return false;
    if (search && !userId) {
      const q = search.toLowerCase();
      if (!a.userName.toLowerCase().includes(q) && !a.userEmail.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        style={{ background: "#0d1a14", border: "1px solid #1a2e22" }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid #1a2e22" }}
        >
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{'\u{1F4CB}'}</span>
            {title ?? "Credit & Debit History"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {!userId && (
          <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: "1px solid #1a2e22" }}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1"
              style={{ background: "#0a1410", border: "1px solid #1a2e22" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="bg-transparent outline-none text-sm text-gray-300 placeholder-gray-600 w-full"
              />
            </div>
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #1a2e22" }}>
              {(["all", "credit", "debit"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className="px-4 py-2 text-sm font-medium capitalize transition"
                  style={{
                    background: typeFilter === f ? "#00d4aa22" : "#0d1a14",
                    color:      typeFilter === f ? "#00d4aa"   : "#6b7280",
                    borderRight: f !== "debit" ? "1px solid #1a2e22" : "none",
                  }}
                >
                  {f === "all" ? "All" : f === "credit" ? "Credit" : "Debit"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#00d4aa", borderTopColor: "transparent" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-600 text-sm">No credit/debit history found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #1a2e22" }} className="text-gray-600">
                  {!userId && <th className="text-left pb-3 font-medium">USER</th>}
                  <th className="text-left pb-3 font-medium">TYPE</th>
                  <th className="text-right pb-3 font-medium">AMOUNT</th>
                  <th className="text-right pb-3 font-medium">BEFORE</th>
                  <th className="text-right pb-3 font-medium">AFTER</th>
                  <th className="text-right pb-3 font-medium">DATE & TIME</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a._id} style={{ borderBottom: "1px solid #1a2e1280" }}>
                    {!userId && (
                      <td className="py-3 text-white font-medium">
                        <div>{a.userName}</div>
                        <div className="text-gray-600 font-mono text-xs">{a.userEmail}</div>
                      </td>
                    )}
                    <td className="py-3">
                      <span className="text-xs px-2 py-1 rounded" style={{
                        background: a.action === "credit" ? "#0a2a1a" : "#2a0a0a",
                        color: a.action === "credit" ? "#00d4aa" : "#ef5350",
                      }}>
                        {a.action === "credit" ? "CREDIT" : "DEBIT"}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-sm" style={{
                      color: a.signedAmount >= 0 ? "#00d4aa" : "#ef5350",
                    }}>
                      {a.signedAmount >= 0 ? "+" : ""}{RS}{a.amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right font-mono text-gray-400 text-sm">
                      {RS}{a.balanceBefore.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right font-mono text-white text-sm">
                      {RS}{a.balanceAfter.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-right text-gray-500 whitespace-nowrap text-sm">
                      {new Date(a.createdAt).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
