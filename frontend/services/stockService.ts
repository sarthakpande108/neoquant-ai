import type { StockQuote, Candle, Exchange, Timeframe } from '../types';
import { ALL_TICKERS } from './tickerData';

const TIMEFRAME_CONFIG: Record<Timeframe, { interval: string; range: string }> = {
  '1H': { interval: '5m', range: '1d' },
  '1D': { interval: '1d', range: '6mo' },
  '1W': { interval: '1wk', range: '1y' },
};

/**
 * Determines the exchange from a ticker symbol.
 */
function getExchange(symbol: string): Exchange {
  if (symbol.endsWith('.NS')) return 'NSE';
  if (symbol.endsWith('.BO')) return 'BSE';
  if (symbol.endsWith('.MCX') || symbol.endsWith('=F')) return 'MCX';
  if (symbol.startsWith('^')) return 'INDEX';
  return 'NSE';
}

/**
 * Resolves display name for a ticker from the local ticker list.
 * Falls back to the symbol itself when not found.
 */
function resolveTickerName(symbol: string): string {
  const found = ALL_TICKERS.find((t) => t.symbol === symbol);
  return found ? found.name : symbol;
}

// ─── Yahoo Finance v8 response shape (partial) ───────────────────────────────

interface YFMeta {
  symbol: string;
  currency: string;
  regularMarketPrice: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  averageDailyVolume3Month?: number;
  averageDailyVolume10Day?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  regularMarketTime?: number;
  marketState?: string;
}

interface YFQuoteData {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

interface YFChartResult {
  meta: YFMeta;
  timestamp?: number[];
  indicators?: {
    quote?: YFQuoteData[];
  };
}

interface YFChartResponse {
  chart: {
    result?: YFChartResult[];
    error?: { code: string; description: string } | null;
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildUrl(ticker: string, interval: string, range: string): string {
  return `/api/yahoo/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`;
}

function parseQuote(symbol: string, meta: YFMeta): StockQuote {
  const prevClose =
    meta.previousClose ??
    meta.regularMarketPreviousClose ??
    meta.chartPreviousClose ??
    meta.regularMarketPrice;

  const marketState = (meta.marketState ?? 'CLOSED') as StockQuote['marketState'];

  return {
    ticker: symbol,
    name: resolveTickerName(symbol),
    exchange: getExchange(symbol),
    price: meta.regularMarketPrice,
    previousClose: prevClose,
    open: meta.regularMarketOpen ?? meta.regularMarketPrice,
    dayHigh: meta.regularMarketDayHigh ?? meta.regularMarketPrice,
    dayLow: meta.regularMarketDayLow ?? meta.regularMarketPrice,
    volume: meta.regularMarketVolume ?? 0,
    avgVolume:
      meta.averageDailyVolume3Month ?? meta.averageDailyVolume10Day ?? 0,
    marketCap: meta.marketCap ?? 0,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? meta.regularMarketPrice,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? meta.regularMarketPrice,
    pe: meta.trailingPE ?? null,
    currency: meta.currency ?? 'INR',
    regularMarketTime: meta.regularMarketTime ?? Math.floor(Date.now() / 1000),
    marketState,
  };
}

function parseCandles(result: YFChartResult): Candle[] {
  const timestamps = result.timestamp ?? [];
  const quoteData = result.indicators?.quote?.[0];

  if (!quoteData || timestamps.length === 0) return [];

  const candles: Candle[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quoteData.open?.[i];
    const high = quoteData.high?.[i];
    const low = quoteData.low?.[i];
    const close = quoteData.close?.[i];
    const volume = quoteData.volume?.[i];

    // Skip candles with null OHLC values
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null
    ) {
      continue;
    }

    candles.push({
      time: timestamps[i],
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
    });
  }

  return candles;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches a live quote and OHLCV candles for a ticker in one network round-trip.
 */
export async function fetchStockData(
  ticker: string,
  timeframe: Timeframe
): Promise<{ quote: StockQuote; candles: Candle[] }> {
  // 1. Try Angel One Backend First
  try {
    const { interval, range } = TIMEFRAME_CONFIG[timeframe];
    // We map range to a naive to/from date for simplicity in demo
    // The backend handles the interval string mapping
    const toDate = new Date();
    const fromDate = new Date();
    if (range === '1d') fromDate.setDate(fromDate.getDate() - 2);
    else if (range === '6mo') fromDate.setMonth(fromDate.getMonth() - 6);
    else if (range === '1y') fromDate.setFullYear(fromDate.getFullYear() - 1);
    
    const fromStr = fromDate.toISOString().slice(0, 16).replace('T', ' ');
    const toStr = toDate.toISOString().slice(0, 16).replace('T', ' ');
    
    let backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    if (!backendUrl.startsWith('http')) backendUrl = 'https://' + backendUrl;
    const [quoteRes, histRes] = await Promise.all([
      fetch(`${backendUrl}/api/quote/${ticker}`),
      fetch(`${backendUrl}/api/history/${ticker}?interval=${interval}&fromdate=${fromStr}&todate=${toStr}`)
    ]);

    if (quoteRes.ok && histRes.ok) {
      const quote = await quoteRes.json();
      const candles = await histRes.json();
      return { quote, candles };
    }
  } catch (err) {
    console.warn(`Angel One fetch failed for ${ticker}, falling back to Yahoo Finance:`, err);
  }

  // 2. Fallback to Yahoo Finance
  const { interval, range } = TIMEFRAME_CONFIG[timeframe];
  const url = buildUrl(ticker, interval, range);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance request failed: ${response.status} ${response.statusText} for ${ticker}`
    );
  }

  const data: YFChartResponse = await response.json();

  if (data.chart.error) {
    throw new Error(
      `Yahoo Finance error for ${ticker}: ${data.chart.error.description}`
    );
  }

  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error(`No data returned for ticker: ${ticker}`);
  }

  const quote = parseQuote(ticker, result.meta);
  const candles = parseCandles(result);

  return { quote, candles };
}

/**
 * Fetches just the live quote for a single ticker (uses a 1-day range with
 * daily interval to minimise payload size while still getting meta fields).
 */
export async function fetchQuote(ticker: string): Promise<StockQuote> {
  // 1. Try Angel One Backend First
  try {
    let backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    if (!backendUrl.startsWith('http')) backendUrl = 'https://' + backendUrl;
    const res = await fetch(`${backendUrl}/api/quote/${ticker}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // console.warn(`Angel One quote failed for ${ticker}, falling back to Yahoo Finance`);
  }

  // 2. Fallback to Yahoo Finance
  const url = buildUrl(ticker, '1d', '5d');

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance request failed: ${response.status} ${response.statusText} for ${ticker}`
    );
  }

  const data: YFChartResponse = await response.json();

  if (data.chart.error) {
    throw new Error(
      `Yahoo Finance error for ${ticker}: ${data.chart.error.description}`
    );
  }

  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error(`No data returned for ticker: ${ticker}`);
  }

  return parseQuote(ticker, result.meta);
}

/**
 * Fetches quotes for multiple tickers sequentially with a 100ms gap between
 * each request to avoid hitting Yahoo Finance rate limits. Failed fetches are
 * silently skipped so a single bad ticker does not block the rest.
 */
export async function fetchMultipleQuotes(
  tickers: string[]
): Promise<StockQuote[]> {
  const results: StockQuote[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];

    try {
      const quote = await fetchQuote(ticker);
      results.push(quote);
    } catch (err) {
      console.warn(`[fetchMultipleQuotes] Skipping ${ticker}:`, err);
    }

    // Throttle between requests (skip delay after the last ticker)
    if (i < tickers.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Dynamically search for tickers using the Yahoo Finance search API.
 * Maps results to our TickerInfo format. Filters to Indian exchanges mostly.
 */
export async function searchTickers(query: string): Promise<import('../types').TickerInfo[]> {
  if (!query || query.trim().length < 2) return [];
  
  const url = `/api/yahoo/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const quotes = data.quotes || [];
    
    // Map Yahoo quote to our TickerInfo
    return quotes
      .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'INDEX')
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        exchange: getExchange(q.symbol),
        type: q.quoteType,
        sector: q.sectorDisp || q.industryDisp || 'Unknown'
      }));
  } catch (err) {
    console.error('Yahoo Finance search error:', err);
    return [];
  }
}
