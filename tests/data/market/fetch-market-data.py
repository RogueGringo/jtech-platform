#!/usr/bin/env python3
"""
Fetch real historical OHLCV data from Yahoo Finance and compute technicals.

Downloads 5 backtest event datasets with full technical indicator suite.
All data is real — zero synthetic data.

Source: Yahoo Finance via yfinance
Author: mr.white@jtech.ai + Claude Code
"""

import os
import numpy as np
import pandas as pd
import yfinance as yf

# ---------------------------------------------------------------------------
# Event definitions
# ---------------------------------------------------------------------------
EVENTS = [
    {"name": "gfc-2008-spy",    "ticker": "SPY",  "start": "2007-07-01", "end": "2009-06-30"},
    {"name": "covid-2020-spy",  "ticker": "SPY",  "start": "2019-12-01", "end": "2020-06-30"},
    {"name": "svb-2023-kre",    "ticker": "KRE",  "start": "2022-12-01", "end": "2023-06-30"},
    {"name": "nvda-2023-nvda",  "ticker": "NVDA", "start": "2022-12-01", "end": "2024-03-30"},
    {"name": "gme-2021-gme",    "ticker": "GME",  "start": "2020-12-01", "end": "2021-06-30"},
]

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------------------
# Technical indicator functions (pandas/numpy, Wilder smoothing)
# ---------------------------------------------------------------------------

def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """RSI with Wilder (exponential) smoothing."""
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def compute_macd_hist(close: pd.Series) -> pd.Series:
    """MACD histogram: (EMA12 - EMA26) - EMA9(signal)."""
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd - signal


def compute_bbands(close: pd.Series, period: int = 20, num_std: float = 2.0):
    """Bollinger Bands %B and bandwidth."""
    sma = close.rolling(period).mean()
    std = close.rolling(period).std()
    upper = sma + num_std * std
    lower = sma - num_std * std
    pctb = (close - lower) / (upper - lower)
    width = (upper - lower) / sma
    return pctb, width


def compute_volume_ratio(volume: pd.Series, period: int = 20) -> pd.Series:
    """Volume relative to its 20-day SMA."""
    return volume / volume.rolling(period).mean()


def compute_sma_dist(close: pd.Series, period: int) -> pd.Series:
    """Percent distance from SMA."""
    sma = close.rolling(period).mean()
    return (close - sma) / sma * 100


def compute_atr(high: pd.Series, low: pd.Series, close: pd.Series,
                period: int = 14) -> pd.Series:
    """Average True Range with Wilder smoothing."""
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()


def compute_atr_pctile(high: pd.Series, low: pd.Series, close: pd.Series,
                       atr_period: int = 14, rank_window: int = 60) -> pd.Series:
    """ATR(14) percentile rank over trailing 60 days."""
    atr = compute_atr(high, low, close, atr_period)
    return atr.rolling(rank_window).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1], raw=False
    )


def compute_drawdown(close: pd.Series, window: int = 252) -> pd.Series:
    """Drawdown from rolling 252-day high, in percent."""
    rolling_max = close.rolling(window, min_periods=1).max()
    return (close - rolling_max) / rolling_max * 100


def compute_adx(high: pd.Series, low: pd.Series, close: pd.Series,
                period: int = 14) -> pd.Series:
    """ADX: smoothed absolute difference of DI+ and DI- / sum, x100."""
    prev_high = high.shift(1)
    prev_low = low.shift(1)
    prev_close = close.shift(1)

    plus_dm = (high - prev_high).clip(lower=0)
    minus_dm = (prev_low - low).clip(lower=0)
    # Zero out whichever is smaller
    plus_dm[plus_dm < minus_dm] = 0
    minus_dm[minus_dm < plus_dm] = 0

    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)

    atr = tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    plus_di = 100 * plus_dm.ewm(alpha=1 / period, min_periods=period, adjust=False).mean() / atr
    minus_di = 100 * minus_dm.ewm(alpha=1 / period, min_periods=period, adjust=False).mean() / atr

    dx = (plus_di - minus_di).abs() / (plus_di + minus_di) * 100
    adx = dx.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    return adx


def compute_mfi(high: pd.Series, low: pd.Series, close: pd.Series,
                volume: pd.Series, period: int = 14) -> pd.Series:
    """Money Flow Index (14)."""
    tp = (high + low + close) / 3
    mf = tp * volume
    delta = tp.diff()

    pos_mf = mf.where(delta > 0, 0)
    neg_mf = mf.where(delta < 0, 0)

    pos_sum = pos_mf.rolling(period).sum()
    neg_sum = neg_mf.rolling(period).sum()

    mfr = pos_sum / neg_sum
    return 100 - (100 / (1 + mfr))


def compute_obv_slope(close: pd.Series, volume: pd.Series,
                      period: int = 20) -> pd.Series:
    """OBV cumulative, then 20-day rolling linear regression slope."""
    direction = close.diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
    obv = (direction * volume).cumsum()

    def linreg_slope(arr):
        x = np.arange(len(arr))
        if np.all(np.isnan(arr)):
            return np.nan
        coeffs = np.polyfit(x, arr, 1)
        return coeffs[0]

    return obv.rolling(period).apply(linreg_slope, raw=True)


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def compute_technicals(df: pd.DataFrame) -> pd.DataFrame:
    """Add all technical columns to an OHLCV DataFrame."""
    c, h, l, v = df["Close"], df["High"], df["Low"], df["Volume"]

    df["rsi"] = compute_rsi(c)
    df["macd_hist"] = compute_macd_hist(c)

    pctb, width = compute_bbands(c)
    df["bband_pctb"] = pctb
    df["bband_width"] = width

    df["volume_ratio"] = compute_volume_ratio(v)
    df["sma50_dist"] = compute_sma_dist(c, 50)
    df["sma200_dist"] = compute_sma_dist(c, 200)
    df["atr_pctile"] = compute_atr_pctile(h, l, c)
    df["drawdown"] = compute_drawdown(c)
    df["adx"] = compute_adx(h, l, c)
    df["mfi"] = compute_mfi(h, l, c, v)
    df["obv_slope"] = compute_obv_slope(c, v)

    return df


def fetch_and_save(event: dict) -> None:
    """Download OHLCV from Yahoo Finance, compute technicals, save CSV."""
    name = event["name"]
    print(f"Fetching {name}...", end=" ", flush=True)

    ticker = yf.Ticker(event["ticker"])
    df = ticker.history(start=event["start"], end=event["end"], auto_adjust=False)

    if df.empty:
        print(f"WARNING: no data returned for {name}")
        return

    # Normalise index to date strings
    df.index = pd.to_datetime(df.index).strftime("%Y-%m-%d")
    df.index.name = "date"

    # Keep only OHLCV columns (drop Dividends, Stock Splits, etc.)
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()

    # Compute all technicals
    df = compute_technicals(df)

    # Fill NaN with 0, round to 6 decimals
    df = df.fillna(0).round(6)

    out_path = os.path.join(OUT_DIR, f"{name}.csv")
    df.to_csv(out_path)
    print(f"Saved {len(df)} rows -> {out_path}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for event in EVENTS:
        fetch_and_save(event)
    print("\nDone. All data from Yahoo Finance — zero synthetic data.")


if __name__ == "__main__":
    main()
