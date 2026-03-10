/**
 * Market Adapter — transforms OHLCV + technical indicators into signals[]
 * for the JtechAi math engine.
 *
 * Input:  ticker string, OHLCV array [{open,high,low,close,volume}], optional pre-computed technicals
 * Output: { signals[], entropy, primeDensity, dissolutionRate, propagationRate, barCount }
 *
 * Signal severity is σ-based: each indicator's transformed value is measured
 * in standard deviations from its rolling baseline. The SHAPE of the
 * distribution determines severity, not hardcoded thresholds.
 *
 * 12 signals across 4 universal categories:
 *   condition (momentum/oscillator): RSI, MACD histogram, Bollinger %B
 *   flow (volume dynamics):          Volume ratio, OBV slope, MFI
 *   price (trend position):          SMA50 distance, SMA200 distance, Drawdown
 *   capacity (volatility regime):    ATR percentile, Bollinger width, ADX
 */

// ================================================================
// SEVERITY FROM σ — the ONLY severity mapping
// ================================================================

/**
 * Map absolute standard deviations to severity level.
 * No hardcoded indicator values — only statistical distance matters.
 */
export function sigmaToSeverity(sigma) {
  const abs = Math.abs(sigma);
  if (abs >= 2.0) return "critical";
  if (abs >= 1.5) return "high";
  if (abs >= 1.0) return "moderate";
  return "watch";
}

// ================================================================
// HELPER: rolling statistics
// ================================================================

function rollingMean(arr, window) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

function rollingStd(arr, window) {
  const means = rollingMean(arr, window);
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    const mu = means[i];
    const variance = slice.reduce((s, v) => s + (v - mu) ** 2, 0) / slice.length;
    out.push(Math.sqrt(variance));
  }
  return out;
}

function sma(arr, period) {
  return rollingMean(arr, period);
}

/** Simple linear regression slope over window ending at each index. */
function rollingSlope(arr, window) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    const n = slice.length;
    if (n < 2) { out.push(0); continue; }
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < n; j++) {
      sumX += j;
      sumY += slice[j];
      sumXY += j * slice[j];
      sumX2 += j * j;
    }
    const denom = n * sumX2 - sumX * sumX;
    out.push(denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0);
  }
  return out;
}

/** Percentile rank of arr[i] within its trailing window. */
function rollingPercentile(arr, window) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = arr.slice(start, i + 1);
    const val = arr[i];
    const below = slice.filter(v => v < val).length;
    out.push(slice.length > 1 ? below / (slice.length - 1) : 0.5);
  }
  return out;
}

// ================================================================
// TECHNICAL INDICATOR COMPUTATION
// ================================================================

/**
 * Compute all 12 technical indicators from raw OHLCV bars.
 *
 * @param {Object[]} ohlcv - [{open, high, low, close, volume}, ...]
 * @returns {Object} Arrays of indicator values, one per bar.
 */
export function computeTechnicals(ohlcv) {
  const n = ohlcv.length;
  const close = ohlcv.map(b => b.close);
  const high = ohlcv.map(b => b.high);
  const low = ohlcv.map(b => b.low);
  const volume = ohlcv.map(b => b.volume);
  const open = ohlcv.map(b => b.open);

  // --- RSI(14) ---
  const rsi = new Array(n).fill(50);
  if (n > 1) {
    const gains = [];
    const losses = [];
    for (let i = 1; i < n; i++) {
      const delta = close[i] - close[i - 1];
      gains.push(delta > 0 ? delta : 0);
      losses.push(delta < 0 ? -delta : 0);
    }
    let avgGain = 0, avgLoss = 0;
    const period = Math.min(14, gains.length);
    for (let i = 0; i < period; i++) {
      avgGain += gains[i];
      avgLoss += losses[i];
    }
    avgGain /= period;
    avgLoss /= period;
    if (period > 0) {
      const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
      rsi[period] = 100 - 100 / (1 + rs);
    }
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
      rsi[i + 1] = 100 - 100 / (1 + rs);
    }
    // Fill early bars with first computed value
    const firstComputed = rsi[Math.min(period, n - 1)];
    for (let i = 0; i < Math.min(period, n); i++) rsi[i] = firstComputed;
  }

  // --- MACD histogram (12/26/9) ---
  function ema(arr, period) {
    const k = 2 / (period + 1);
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      out.push(arr[i] * k + out[i - 1] * (1 - k));
    }
    return out;
  }
  const ema12 = ema(close, 12);
  const ema26 = ema(close, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);
  const macd_hist = macdLine.map((v, i) => v - signalLine[i]);

  // --- Bollinger Bands (20, 2σ) ---
  const bbMid = sma(close, 20);
  const bbStd = rollingStd(close, 20);
  const bbUpper = bbMid.map((m, i) => m + 2 * bbStd[i]);
  const bbLower = bbMid.map((m, i) => m - 2 * bbStd[i]);
  const bbpctb = close.map((c, i) => {
    const width = bbUpper[i] - bbLower[i];
    return width > 0 ? (c - bbLower[i]) / width : 0.5;
  });
  const bbwidth = bbUpper.map((u, i) => {
    return bbMid[i] > 0 ? (u - bbLower[i]) / bbMid[i] : 0;
  });

  // --- Volume ratio vs 20d avg ---
  const volSma = sma(volume, 20);
  const volratio = volume.map((v, i) => volSma[i] > 0 ? v / volSma[i] : 1);

  // --- OBV + 20-day regression slope ---
  const obv = [0];
  for (let i = 1; i < n; i++) {
    if (close[i] > close[i - 1]) obv.push(obv[i - 1] + volume[i]);
    else if (close[i] < close[i - 1]) obv.push(obv[i - 1] - volume[i]);
    else obv.push(obv[i - 1]);
  }
  const obvslope = rollingSlope(obv, 20);

  // --- MFI(14) ---
  const typicalPrice = close.map((c, i) => (high[i] + low[i] + c) / 3);
  const rawMoneyFlow = typicalPrice.map((tp, i) => tp * volume[i]);
  const mfi = new Array(n).fill(50);
  if (n > 1) {
    const period = 14;
    for (let i = period; i < n; i++) {
      let posMF = 0, negMF = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (typicalPrice[j] > typicalPrice[j - 1]) posMF += rawMoneyFlow[j];
        else negMF += rawMoneyFlow[j];
      }
      const ratio = negMF > 0 ? posMF / negMF : 100;
      mfi[i] = 100 - 100 / (1 + ratio);
    }
    const firstMFI = mfi[Math.min(period, n - 1)];
    for (let i = 0; i < Math.min(period, n); i++) mfi[i] = firstMFI;
  }

  // --- SMA distances ---
  const sma50 = sma(close, 50);
  const sma200 = sma(close, 200);
  const sma50dist = close.map((c, i) => sma50[i] > 0 ? (c - sma50[i]) / sma50[i] : 0);
  const sma200dist = close.map((c, i) => sma200[i] > 0 ? (c - sma200[i]) / sma200[i] : 0);

  // --- Drawdown from rolling 52-week (252-day) high ---
  const rollingHigh = [];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - 252 + 1);
    let maxH = -Infinity;
    for (let j = start; j <= i; j++) {
      if (high[j] > maxH) maxH = high[j];
    }
    rollingHigh.push(maxH);
  }
  const drawdown = close.map((c, i) => rollingHigh[i] > 0 ? (rollingHigh[i] - c) / rollingHigh[i] : 0);

  // --- ATR(14) + percentile over 60 days ---
  const tr = [high[0] - low[0]];
  for (let i = 1; i < n; i++) {
    tr.push(Math.max(
      high[i] - low[i],
      Math.abs(high[i] - close[i - 1]),
      Math.abs(low[i] - close[i - 1])
    ));
  }
  const atr14 = sma(tr, 14);
  const atrPctile = rollingPercentile(atr14, 60);

  // --- ADX(14) simplified ---
  // Using smoothed +DI/-DI approach
  const adx = new Array(n).fill(25);
  if (n > 2) {
    const period = 14;
    const plusDM = [0];
    const minusDM = [0];
    for (let i = 1; i < n; i++) {
      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    const smoothPlusDM = sma(plusDM, period);
    const smoothMinusDM = sma(minusDM, period);
    const smoothTR = sma(tr, period);
    const dx = [];
    for (let i = 0; i < n; i++) {
      const plusDI = smoothTR[i] > 0 ? (smoothPlusDM[i] / smoothTR[i]) * 100 : 0;
      const minusDI = smoothTR[i] > 0 ? (smoothMinusDM[i] / smoothTR[i]) * 100 : 0;
      const sumDI = plusDI + minusDI;
      dx.push(sumDI > 0 ? (Math.abs(plusDI - minusDI) / sumDI) * 100 : 0);
    }
    const adxSmooth = sma(dx, period);
    for (let i = 0; i < n; i++) adx[i] = adxSmooth[i];
  }

  return {
    rsi,
    macd_hist,
    bbpctb,
    bbwidth,
    volratio,
    obvslope,
    mfi,
    sma50dist,
    sma200dist,
    drawdown,
    atrPctile,
    adx,
  };
}

// ================================================================
// SIGNAL DEFINITIONS — 12 signals, 4 categories
// ================================================================

const SIGNAL_DEFS = [
  // condition (momentum/oscillator)
  { id: "mkt_rsi",     category: "condition", tech: "rsi",       transform: v => (v - 50) / 50 },
  { id: "mkt_macd",    category: "condition", tech: "macd_hist", transform: v => v },
  { id: "mkt_bbpctb",  category: "condition", tech: "bbpctb",    transform: v => (v - 0.5) / 0.5 },

  // flow (volume dynamics)
  { id: "mkt_volratio", category: "flow", tech: "volratio",  transform: v => v - 1 },
  { id: "mkt_obvslope", category: "flow", tech: "obvslope",  transform: v => v },
  { id: "mkt_mfi",      category: "flow", tech: "mfi",       transform: v => (v - 50) / 50 },

  // price (trend position)
  { id: "mkt_sma50",     category: "price", tech: "sma50dist",  transform: v => v },
  { id: "mkt_sma200",    category: "price", tech: "sma200dist", transform: v => v },
  { id: "mkt_drawdown",  category: "price", tech: "drawdown",   transform: v => v },  // already positive = dissolution

  // capacity (volatility regime)
  { id: "mkt_atr",     category: "capacity", tech: "atrPctile", transform: v => (v - 0.5) / 0.5 },
  { id: "mkt_bbwidth", category: "capacity", tech: "bbwidth",   transform: v => v },
  { id: "mkt_adx",     category: "capacity", tech: "adx",       transform: v => (v - 25) / 25 },
];

// ================================================================
// SHANNON ENTROPY — over severity distribution
// ================================================================

function computeSeverityEntropy(signals) {
  const counts = { critical: 0, high: 0, moderate: 0, watch: 0 };
  for (const s of signals) counts[s.severity] = (counts[s.severity] || 0) + 1;
  const total = signals.length;
  if (total === 0) return 0;
  let S = 0;
  for (const c of Object.values(counts)) {
    if (c > 0) {
      const p = c / total;
      S -= p * Math.log2(p);
    }
  }
  return S;
}

// ================================================================
// MAIN ADAPTER — OHLCV → signals[]
// ================================================================

/**
 * Transform OHLCV + technicals into signals[] for the math engine.
 *
 * @param {string} ticker - Ticker symbol (for signal naming)
 * @param {Object[]} ohlcv - [{open, high, low, close, volume}, ...]
 * @param {Object} [technicals] - Pre-computed technicals (or null to compute)
 * @param {number} [baselineWindow=60] - Rolling window for σ baseline
 * @returns {Object} { signals[], entropy, primeDensity, dissolutionRate, propagationRate, barCount }
 */
export function marketToSignals(ticker, ohlcv, technicals, baselineWindow = 60) {
  if (!ohlcv || ohlcv.length === 0) {
    return { signals: [], entropy: 0, primeDensity: 0, dissolutionRate: 0, propagationRate: 0, barCount: 0 };
  }

  const techs = technicals || computeTechnicals(ohlcv);
  const lastIdx = ohlcv.length - 1;

  // For each signal: transform the latest value, compute σ from rolling baseline
  const signals = [];
  let dissCount = 0;
  let propCount = 0;

  for (const def of SIGNAL_DEFS) {
    const series = techs[def.tech];
    if (!series || series.length === 0) continue;

    // Transform entire series for σ calculation
    const transformed = series.map(v => def.transform(v));
    const currentVal = transformed[lastIdx];

    // Rolling baseline: mean and std of transformed values over window
    const start = Math.max(0, lastIdx - baselineWindow + 1);
    const window = transformed.slice(start, lastIdx + 1);
    const mu = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mu) ** 2, 0) / window.length;
    const std = Math.sqrt(variance);

    const sigma = std > 0 ? (currentVal - mu) / std : 0;
    const severity = sigmaToSeverity(sigma);

    signals.push({
      id: def.id,
      category: def.category,
      severity,
      numeric: currentVal,
      sigma,
    });

    // Dissolution/propagation counting
    if (def.category === "price" || def.category === "condition") {
      // For price/condition: negative sigma = dissolution, positive = propagation
      if (sigma < -1.5) dissCount++;
      if (sigma > 1.5) propCount++;
    } else {
      // For flow/capacity: extreme in either direction = dissolution
      if (Math.abs(sigma) > 1.5) dissCount++;
    }
  }

  const totalSignals = signals.length;
  const totalVectors = dissCount + propCount;

  return {
    signals,
    entropy: computeSeverityEntropy(signals),
    primeDensity: totalSignals > 0 ? dissCount / totalSignals : 0,
    dissolutionRate: totalVectors > 0 ? dissCount / totalVectors : 0,
    propagationRate: totalVectors > 0 ? propCount / totalVectors : 0,
    barCount: ohlcv.length,
  };
}

// ================================================================
// MARKET CATEGORY KEYS — for cross-coherence
// ================================================================

export const MARKET_CATEGORIES = ["condition", "flow", "price", "capacity"];
