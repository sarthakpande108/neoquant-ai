import type { Candle, TechnicalIndicators, StockQuote } from '../types';

// ─── Simple Moving Average ────────────────────────────────────────────────────

/**
 * Computes a Simple Moving Average over the provided `closes` array.
 * Returns `null` for positions where fewer than `period` data points are
 * available (i.e., the first `period - 1` entries).
 */
export function calcSMA(
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j];
    }
    result[i] = sum / period;
  }

  return result;
}

// ─── Exponential Moving Average ───────────────────────────────────────────────

/**
 * Computes an Exponential Moving Average using multiplier = 2 / (period + 1).
 * The first valid value is seeded from the SMA of the first `period` closes.
 * Returns `null` for the first `period - 1` indices.
 */
export function calcEMA(
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return result;

  const multiplier = 2 / (period + 1);

  // Seed: SMA of first `period` values
  let seed = 0;
  for (let i = 0; i < period; i++) {
    seed += closes[i];
  }
  seed /= period;
  result[period - 1] = seed;

  let prevEMA = seed;
  for (let i = period; i < closes.length; i++) {
    const ema = (closes[i] - prevEMA) * multiplier + prevEMA;
    result[i] = ema;
    prevEMA = ema;
  }

  return result;
}

// ─── Relative Strength Index ──────────────────────────────────────────────────

/**
 * Computes RSI using Wilder's smoothing method (also known as Modified Moving
 * Average / RMA). The first `period` values return null.
 *
 * Algorithm:
 *  1. Compute price changes: Δ[i] = close[i] - close[i-1]
 *  2. Seed avgGain / avgLoss as the simple average of the first `period` deltas.
 *  3. For subsequent bars: avgGain = (prevAvgGain * (period-1) + gain) / period
 *  4. RS = avgGain / avgLoss; RSI = 100 - 100 / (1 + RS)
 */
export function calcRSI(
  closes: number[],
  period: number = 14
): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  // Build change array (length = closes.length - 1)
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Seed averages using the first `period` changes
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const c = changes[i];
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;

  // First RSI value corresponds to close index `period`
  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

  // Subsequent values using Wilder's smoothing
  for (let i = period; i < changes.length; i++) {
    const c = changes[i];
    const gain = c > 0 ? c : 0;
    const loss = c < 0 ? Math.abs(c) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi =
      avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    // change[i] corresponds to close[i+1]
    result[i + 1] = rsi;
  }

  return result;
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

/**
 * Computes Bollinger Bands.
 *  Middle  = SMA(period)
 *  StdDev  = population standard deviation of the window
 *  Upper   = Middle + stdDev * multiplier
 *  Lower   = Middle - stdDev * multiplier
 *
 * Returns `null` for the first `period - 1` indices.
 */
export function calcBollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const middle: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);

    const mean = window.reduce((a, b) => a + b, 0) / period;

    const variance =
      window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);

    middle[i] = mean;
    upper[i] = mean + stdDev * sd;
    lower[i] = mean - stdDev * sd;
  }

  return { upper, middle, lower };
}

// ─── Compute All Indicators ───────────────────────────────────────────────────

/**
 * Extracts close prices from a candle array and computes all technical
 * indicators at once, returning a `TechnicalIndicators` object.
 */
export function computeAllIndicators(candles: Candle[]): TechnicalIndicators {
  const closes = candles.map((c) => c.close);

  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const ema9 = calcEMA(closes, 9);
  const rsi = calcRSI(closes, 14);
  const bollingerBands = calcBollingerBands(closes, 20, 2);

  return { sma20, sma50, ema9, rsi, bollingerBands };
}

// ─── Latest RSI Helper ────────────────────────────────────────────────────────

/**
 * Extracts the most recent non-null RSI value from the RSI array.
 * Returns `null` if no valid value exists.
 */
export function getLatestRSI(rsi: (number | null)[]): number | null {
  for (let i = rsi.length - 1; i >= 0; i--) {
    if (rsi[i] !== null) return rsi[i] as number;
  }
  return null;
}

// ─── Format Indicators for AI Prompt ─────────────────────────────────────────

/**
 * Returns a compact, human-readable summary of the latest indicator values
 * suitable for inclusion in an AI prompt.
 *
 * Example output:
 *   Latest Price: ₹1284.50 | Change: +2.30%
 *   SMA20: 1265.30 | SMA50: 1248.70
 *   EMA9: 1278.40
 *   RSI(14): 62.4 (Neutral)
 *   Bollinger Bands: Upper=1310.20 | Middle=1265.30 | Lower=1220.40
 *   52W High: ₹1608.00 | 52W Low: ₹1130.00
 *   Volume vs Avg: 1.2x (above average)
 */
export function formatIndicatorsForAI(
  candles: Candle[],
  quote: StockQuote
): string {
  if (candles.length === 0) return 'No candle data available.';

  const indicators = computeAllIndicators(candles);

  const currencySymbol = quote.currency === 'USD' ? '$' : '₹';

  // ── Price & Change ────────────────────────────────────────────────────────
  const price = quote.price;
  const prevClose = quote.previousClose;
  const changeAmt = price - prevClose;
  const changePct = prevClose !== 0 ? (changeAmt / prevClose) * 100 : 0;
  const changeStr =
    changePct >= 0
      ? `+${changePct.toFixed(2)}%`
      : `${changePct.toFixed(2)}%`;

  // ── Latest non-null indicator values ─────────────────────────────────────
  function lastNonNull(arr: (number | null)[]): number | null {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] !== null) return arr[i] as number;
    }
    return null;
  }

  const sma20Val = lastNonNull(indicators.sma20);
  const sma50Val = lastNonNull(indicators.sma50);
  const ema9Val = lastNonNull(indicators.ema9);
  const rsiVal = getLatestRSI(indicators.rsi);
  const bbUpper = lastNonNull(indicators.bollingerBands.upper);
  const bbMiddle = lastNonNull(indicators.bollingerBands.middle);
  const bbLower = lastNonNull(indicators.bollingerBands.lower);

  // ── RSI zone label ────────────────────────────────────────────────────────
  function rsiLabel(rsi: number): string {
    if (rsi >= 70) return 'Overbought';
    if (rsi <= 30) return 'Oversold';
    return 'Neutral';
  }

  // ── Volume ratio ──────────────────────────────────────────────────────────
  const vol = quote.volume;
  const avgVol = quote.avgVolume;
  let volumeStr = 'N/A';
  if (avgVol > 0) {
    const ratio = vol / avgVol;
    const label = ratio >= 1.2 ? 'above average' : ratio <= 0.8 ? 'below average' : 'average';
    volumeStr = `${ratio.toFixed(1)}x (${label})`;
  }

  const fmt = (n: number | null): string =>
    n !== null ? n.toFixed(2) : 'N/A';

  const lines: string[] = [
    `Latest Price: ${currencySymbol}${price.toFixed(2)} | Change: ${changeStr}`,
    `SMA20: ${fmt(sma20Val)} | SMA50: ${fmt(sma50Val)}`,
    `EMA9: ${fmt(ema9Val)}`,
    rsiVal !== null
      ? `RSI(14): ${rsiVal.toFixed(1)} (${rsiLabel(rsiVal)})`
      : `RSI(14): N/A`,
    `Bollinger Bands: Upper=${fmt(bbUpper)} | Middle=${fmt(bbMiddle)} | Lower=${fmt(bbLower)}`,
    `52W High: ${currencySymbol}${quote.fiftyTwoWeekHigh.toFixed(2)} | 52W Low: ${currencySymbol}${quote.fiftyTwoWeekLow.toFixed(2)}`,
    `Volume vs Avg: ${volumeStr}`,
  ];

  return lines.join('\n');
}
