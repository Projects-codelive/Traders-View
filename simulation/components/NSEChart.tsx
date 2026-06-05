"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSimStock } from "../engine/marketData";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  IChartApi,
  ISeriesApi,
  Time,
  TickMarkType,
} from "lightweight-charts";

interface Candle {
  time:   number;
  open:   number;
  high:   number;
  low:    number;
  close:  number;
  volume: number;
}

interface OHLCVDisplay {
  open:  number;
  high:  number;
  low:   number;
  close: number;
  volume: number;
}

interface Props {
  symbol:      string;
  livePrice:   number;
  isLive:      boolean;
}

const TIMEFRAMES = [
  { label: "1m",  value: "1m"  },
  { label: "5m",  value: "5m"  },
  { label: "30m", value: "30m" },
  { label: "1h",  value: "1h"  },
  { label: "1D",  value: "1D"  },
];

export default function NSEChart({ symbol, livePrice, isLive }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const chartRef      = useRef<IChartApi | null>(null);
  const candleRef     = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef     = useRef<ISeriesApi<"Histogram"> | null>(null);

  const lastCandleRef  = useRef<Candle | null>(null);

  const [timeframe,      setTimeframe]  = useState("1m");
  const [loading,        setLoading]    = useState(true);
  const [error,          setError]      = useState<string | null>(null);
  const [ohlcv,          setOhlcv]      = useState<OHLCVDisplay | null>(null);
  const [candleData,     setCandleData] = useState<Candle[]>([]);
  const gmtoffsetRef = useRef(0);

  function fmtTime(timestamp: number, tickMarkType: TickMarkType): string {
    const d = new Date((timestamp + gmtoffsetRef.current) * 1000);
    switch (tickMarkType) {
      case TickMarkType.Year:
        return String(d.getUTCFullYear());
      case TickMarkType.Month: {
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return months[d.getUTCMonth()] + " " + d.getUTCFullYear();
      }
      case TickMarkType.DayOfMonth:
        return d.getUTCDate() + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
      default: {
        const hh = d.getUTCHours().toString().padStart(2, "0");
        const mm = d.getUTCMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
      }
    }
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background:  { type: ColorType.Solid, color: "#0f1117" },
        textColor:   "#9ca3af",
        fontSize:    11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#1a1f2e", style: LineStyle.Dotted },
        horzLines: { color: "#1a1f2e", style: LineStyle.Dotted },
      },
      localization: {
        timeFormatter: (time: unknown) => {
          const t = typeof time === "number" ? time : Number(time);
          if (isNaN(t)) return String(time);
          const d = new Date((t + gmtoffsetRef.current) * 1000);
          const dd = String(d.getUTCDate()).padStart(2, "0");
          const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const hh = d.getUTCHours().toString().padStart(2, "0");
          const mi = d.getUTCMinutes().toString().padStart(2, "0");
          return `${dd} ${months[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(-2)} ${hh}:${mi}`;
        },
        dateFormat: "dd MMM 'yy",
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color:       "#4b5563",
          width:       1,
          style:       LineStyle.Dashed,
          labelVisible: true,
        },
        horzLine: {
          color:        "#4b5563",
          width:        1,
          style:        LineStyle.Dashed,
          labelVisible: true,
        },
      },
      rightPriceScale: {
        borderColor: "#1f2937",
        textColor:   "#9ca3af",
        scaleMargins: { top: 0.1, bottom: 0.3 },
      },
      timeScale: {
        borderColor:    "#1f2937",
        timeVisible:    true,
        secondsVisible: false,
        fixLeftEdge:    true,
        fixRightEdge:   true,
        tickMarkFormatter: (time: number, tickMarkType: TickMarkType) => fmtTime(time, tickMarkType),
      },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         "#26a69a",
      downColor:       "#ef5350",
      borderUpColor:   "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor:     "#26a69a",
      wickDownColor:   "#ef5350",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat:     { type: "volume" },
      priceScaleId:    "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.seriesData) return;
      const candlePoint = param.seriesData.get(candleSeries) as any;
      const volPoint    = param.seriesData.get(volumeSeries) as any;
      if (candlePoint) {
        setOhlcv({
          open:   candlePoint.open,
          high:   candlePoint.high,
          low:    candlePoint.low,
          close:  candlePoint.close,
          volume: volPoint?.value ?? 0,
        });
      }
    });

    chartRef.current  = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current  = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  const loadCandles = useCallback(async () => {
    if (!candleRef.current || !volumeRef.current) return;
    setLoading(true);
    setError(null);

    const stock = getSimStock(symbol);
    const querySym = stock?.yahooSymbol ?? symbol;

    try {
      const res = await fetch(
        `/api/candles?symbol=${querySym}&interval=${timeframe}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.candles || data.candles.length === 0) {
        setError("No candle data — market may be closed or outside trading hours.");
        setLoading(false);
        return;
      }

      gmtoffsetRef.current = data.gmtoffset ?? 0;

      const candles: Candle[] = data.candles;
      setCandleData(candles);

      candleRef.current.setData(
        candles.map(c => ({
          time:  c.time as Time,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        }))
      );

      volumeRef.current.setData(
        candles.map(c => ({
          time:  c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(38,166,154,0.5)" : "rgba(239,83,80,0.5)",
        }))
      );

      const last = candles[candles.length - 1];
      setOhlcv({ open: last.open, high: last.high, low: last.low, close: last.close, volume: last.volume });
      lastCandleRef.current = { ...last };

      chartRef.current?.timeScale().fitContent();
      setLoading(false);

    } catch (err: any) {
      setError(err.message ?? "Failed to load chart data");
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  useEffect(() => {
    if (!candleRef.current || !livePrice || livePrice <= 0 || !lastCandleRef.current) return;
    if (!isLive) return;

    const last = lastCandleRef.current;
    const newHigh = Math.max(last.high, livePrice);
    const newLow  = Math.min(last.low,  livePrice);

    lastCandleRef.current = { ...last, high: newHigh, low: newLow, close: livePrice };

    candleRef.current.update({
      time:  last.time as Time,
      open:  last.open,
      high:  newHigh,
      low:   newLow,
      close: livePrice,
    });
  }, [livePrice, isLive]);

  function fmtVol(v: number): string {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
    if (v >= 1_000_000)    return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000)        return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
  }

  const isPositive = ohlcv ? ohlcv.close >= ohlcv.open : true;

  return (
    <div className="flex flex-col h-full bg-[#0f1117] rounded-xl overflow-hidden">

      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/60 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-gray-400 font-semibold">{symbol} · {getSimStock(symbol)?.sector === "Crypto" ? "Crypto" : "NSE"}</span>
          {ohlcv ? (
            <>
              <span className="text-gray-500">O <span className="text-gray-200">{ohlcv.open.toFixed(2)}</span></span>
              <span className="text-gray-500">H <span className="text-green-400">{ohlcv.high.toFixed(2)}</span></span>
              <span className="text-gray-500">L <span className="text-red-400">{ohlcv.low.toFixed(2)}</span></span>
              <span className="text-gray-500">C <span className={isPositive ? "text-green-400" : "text-red-400"}>{ohlcv.close.toFixed(2)}</span></span>
              <span className="text-gray-500">V <span className="text-gray-300">{fmtVol(ohlcv.volume)}</span></span>
            </>
          ) : (
            <span className="text-gray-600">Loading…</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition
                ${timeframe === tf.value
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
                }`}
            >
              {tf.label}
            </button>
          ))}
          <button
            onClick={loadCandles}
            className="ml-2 px-2 py-1 text-xs text-gray-600 hover:text-gray-400 transition"
            title="Refresh chart"
          >
            ↻
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="w-full h-full" />

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f1117]/90 gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 text-sm">Loading {symbol} · {timeframe}</span>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f1117]/90 gap-3">
            <span className="text-4xl">📭</span>
            <span className="text-gray-400 text-sm text-center max-w-xs">{error}</span>
            <button
              onClick={loadCandles}
              className="mt-2 px-4 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg transition"
            >
              Retry
            </button>
          </div>
        )}

        {isLive && !loading && !error && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-gray-900/80 px-2 py-1 rounded-full text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400">Live</span>
          </div>
        )}
      </div>
    </div>
  );
}
