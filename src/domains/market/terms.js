/**
 * Financial Glossary — market domain technical terms.
 * Used by HelpHover to show tooltips on technical terms.
 */
export default {
  rsi:
    "Relative Strength Index (14-period). Momentum oscillator measuring the speed and magnitude of recent price changes on a 0-100 scale. Readings above 70 indicate overbought conditions; below 30 indicate oversold.",

  macd:
    "Moving Average Convergence Divergence. Trend-following momentum indicator showing the relationship between two exponential moving averages (12 and 26 period). The histogram measures the difference between the MACD line and its 9-period signal line.",

  bollingerBands:
    "Bollinger Bands (20-period, 2 standard deviations). Volatility envelope around a simple moving average. %B measures where price sits within the bands (0 = lower band, 1 = upper band). Width measures the distance between bands relative to the midline.",

  atr:
    "Average True Range (14-period). Volatility measure that accounts for gaps and limit moves. ATR percentile ranks current volatility against its trailing 60-day window. Rising ATR indicates expanding volatility regime.",

  adx:
    "Average Directional Index (14-period). Measures trend strength regardless of direction on a 0-100 scale. Readings above 25 indicate a trending market; below 20 indicate a range-bound market. Does not indicate trend direction.",

  obv:
    "On-Balance Volume. Cumulative volume indicator that adds volume on up-close days and subtracts on down-close days. The 20-day regression slope of OBV reveals whether volume is confirming or diverging from the price trend.",

  mfi:
    "Money Flow Index (14-period). Volume-weighted RSI that incorporates both price and volume to measure buying and selling pressure on a 0-100 scale. Often called the volume-weighted relative strength index.",

  drawdown:
    "Maximum peak-to-trough decline measured from the 52-week rolling high. Expressed as a percentage. A drawdown of 0% means price is at its 52-week high; 20% means price is 20% below that high.",

  gini:
    "Gini coefficient of the severity distribution across all signals. Ranges from 0 (all signals at the same severity) to 1 (maximum inequality). Low Gini at high mean severity indicates consolidated crisis — all signals agree the regime is stressed.",

  regime:
    "Regime classification derived from the geometry of the signal distribution. The mean-Gini coordinate determines the quadrant: low mean + low Gini = stability, high mean + low Gini = crisis consolidation, high mean + high Gini = emerging stress, low mean + high Gini = recovery.",

  trajectory:
    "Directional movement through regime space over time. Computed from the propagation-dissolution balance and transition intensity. Indicates whether the regime is accelerating, consolidating, resolving, or turbulent.",

  sigma:
    "Standard deviation distance from the rolling baseline mean. Each signal's raw value is transformed and measured in sigma units. Severity maps directly from sigma: watch (<1), moderate (1-1.5), high (1.5-2), critical (>2).",
};
