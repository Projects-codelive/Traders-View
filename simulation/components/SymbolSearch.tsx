"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { StockConfig } from "../engine/marketData";

interface SearchResult {
  id:          string;
  label:       string;
  yahooSymbol: string;
  sector:      string;
  isIndex:     boolean;
}

interface Props {
  onSelect: (result: SearchResult) => void;
}

export default function SymbolSearch({ onSelect }: Props) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<SearchResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const inputRef   = useRef<HTMLInputElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, doSearch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(r: SearchResult) {
    onSelect(r);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div ref={dropRef} className="relative" style={{ width: 260 }}>
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{ background: "#0f1521", border: "1px solid #1f2937" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          placeholder="Search stocks & crypto..."
          className="bg-transparent outline-none text-sm text-gray-300 placeholder-gray-600 w-full"
          style={{ fontFamily: "DM Mono, monospace" }}
        />
        {loading && (
          <div className="w-3 h-3 border border-teal-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {query && !loading && (
          <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="text-gray-600 hover:text-gray-400 text-sm leading-none flex-shrink-0">&times;</button>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          className="absolute top-full left-0 mt-1 w-full rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ background: "#0d1117", border: "1px solid #1f2937", maxHeight: 320, overflowY: "auto" }}
        >
          {results.map((r, i) => (
            <div
              key={r.id}
              onClick={() => handleSelect(r)}
              className="flex items-center justify-between px-3 py-2.5 cursor-pointer transition hover:bg-gray-800/50"
              style={{ borderBottom: i < results.length - 1 ? "1px solid #1a1f2e" : "none" }}
            >
              <div>
                <div className="text-sm font-mono font-medium text-white">{r.id}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate" style={{ maxWidth: 170 }}>{r.label}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{
                    background: r.isIndex ? "#3b4ea833" : "#00d4aa18",
                    color:      r.isIndex ? "#7c6ee0"   : "#00d4aa",
                  }}
                >
                  {r.isIndex ? "INDEX" : r.sector?.slice(0, 10) ?? "NSE"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && !loading && query.length > 0 && results.length === 0 && (
        <div
          className="absolute top-full left-0 mt-1 w-full rounded-xl px-4 py-3 text-sm text-gray-600 z-50"
          style={{ background: "#0d1117", border: "1px solid #1f2937" }}
        >
          No results for "{query}"
        </div>
      )}
    </div>
  );
}
