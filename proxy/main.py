from dotenv import load_dotenv
load_dotenv(dotenv_path="../.env.local")

import requests
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import pytz
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],    
    allow_headers=["*"],
)

SYMBOL_MAP = {
    "WIPRO":    "WIPRO.NS",
    "INFY":     "INFY.NS",
    "TCS":      "TCS.NS",
    "RELIANCE": "RELIANCE.NS",
    "HDFCBANK": "HDFCBANK.NS",
    "NIFTY":    "^NSEI",
}

INTERVAL_MAP = {
    "1m":  "1m",
    "5m":  "5m",
    "30m": "30m",
    "1h":  "60m",
    "1D":  "1d",
}

RANGE_MAP = {
    "1m":  "1d",
    "5m":  "5d",
    "30m": "1mo",
    "1h":  "3mo",
    "1D":  "1y",
}


@app.get("/quote/{symbol}")
def get_quote(symbol: str):
    yahoo_sym = SYMBOL_MAP.get(symbol.upper())
    if not yahoo_sym:
        raise HTTPException(status_code=400, detail=f"Unknown symbol: {symbol}")
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?interval=1m&range=1d&includePrePost=false"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Cache-Control": "no-cache",
        }
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=503, detail="Yahoo Finance API unavailable")

        data = res.json()
        result = data["chart"]["result"][0]
        meta = result["meta"]
        timestamps = result["timestamp"]
        quote_data = result["indicators"]["quote"][0]

        if not timestamps or not quote_data.get("close") or quote_data["close"][-1] is None:
            raise HTTPException(status_code=503, detail="No market data — market may be closed")

        i = -1
        price = round(float(quote_data["close"][i]), 2)
        prev_close = round(float(meta.get("chartPreviousClose", price) or price), 2)
        change = round(price - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 3) if prev_close else 0.0

        return {
            "symbol":     symbol.upper(),
            "ltp":        price,
            "change":     change,
            "changePct":  change_pct,
            "open":       round(float(quote_data["open"][i]   or 0), 2),
            "high":       round(float(quote_data["high"][i]   or 0), 2),
            "low":        round(float(quote_data["low"][i]    or 0), 2),
            "volume":     int(quote_data["volume"][i]  or 0),
            "prevClose":  prev_close,
            "timestamp":  int(time.time()),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/candles/{symbol}")
def get_candles(
    symbol:   str,
    interval: str = Query(default="5m",  description="1m|5m|30m|1h|1D"),
):
    yahoo_sym = SYMBOL_MAP.get(symbol.upper())
    yahoo_interval = INTERVAL_MAP.get(interval, "5m")
    yahoo_range = RANGE_MAP.get(interval, "5d")

    if not yahoo_sym:
        raise HTTPException(status_code=400, detail=f"Unknown symbol: {symbol}")

    try:
        ticker = yf.Ticker(yahoo_sym)
        df = ticker.history(period=yahoo_range, interval=yahoo_interval)

        if df.empty:
            return {"symbol": symbol.upper(), "interval": interval, "candles": []}

        ist = pytz.timezone("Asia/Kolkata")
        candles = []

        for ts, row in df.iterrows():
            if hasattr(ts, "timestamp"):
                unix_ts = int(ts.timestamp())
            else:
                unix_ts = int(ts.value // 1_000_000_000)

            candles.append({
                "time":   unix_ts,
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row.get("Volume", 0)),
            })

        candles.sort(key=lambda c: c["time"])

        return {
            "symbol":   symbol.upper(),
            "interval": interval,
            "candles":  candles,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}
