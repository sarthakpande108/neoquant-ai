// Core recommendation types
export type Recommendation = 'Buy' | 'Sell' | 'Hold';
export type Sentiment = 'Positive' | 'Negative' | 'Neutral';
export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Very High';
export type Exchange = 'NSE' | 'BSE' | 'MCX' | 'INDEX';
export type Timeframe = '1H' | '1D' | '1W';

// Extended AI analysis result
export interface AnalysisData {
  recommendation: Recommendation;
  confidence: number;           // 0.0 – 1.0
  pattern: string;
  trend: string;
  summary: string[];
  newsSentiment: Sentiment;
  newsSummary: string[];
  riskLevel: RiskLevel;
  riskScore: number;            // 1–10
  priceTarget: {
    low: number;
    high: number;
    currency: string;
  };
  supportLevels: number[];      // 2 support prices
  resistanceLevels: number[];   // 2 resistance prices
  keyIndicators: KeyIndicator[];
  fnoSignal?: FnoSignal;
  mcxPanel?: McxPanel;
  interestingFacts?: string[];
}

export interface KeyIndicator {
  name: string;   // e.g. "RSI(14)", "MACD", "SMA50"
  value: string;  // e.g. "62.4 – Bullish"
  status: 'bullish' | 'bearish' | 'neutral';
}

export interface FnoSignal {
  openInterestSignal: 'Bullish Build-up' | 'Bearish Build-up' | 'Short Covering' | 'Long Unwinding' | 'Neutral';
  pcrIndication: string;
  note: string;
}

export interface McxPanel {
  commodity: string;
  internationalRef: string;    // e.g. "COMEX Gold: $2,340/oz"
  inrUsdImpact: string;
  seasonalFactor: string;
}

// News source from Gemini grounding
export interface NewsSource {
  title: string;
  uri: string;
}

// OHLCV candle
export interface Candle {
  time: number;    // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Stock quote (live price info)
export interface StockQuote {
  ticker: string;
  name: string;
  exchange: Exchange;
  price: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume: number;
  marketCap: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  pe: number | null;
  currency: string;
  regularMarketTime: number;
  marketState: 'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | 'PREPRE' | 'POSTPOST';
}

// Watchlist item
export interface WatchlistItem {
  ticker: string;
  name: string;
  exchange: Exchange;
  addedAt: number;
}

// Historical analysis entry
export interface HistoryEntry {
  id: string;
  ticker: string;
  name: string;
  exchange: Exchange;
  analysedAt: number;
  recommendation: Recommendation;
  confidence: number;
  price: number;
}

// Ticker search result
export interface TickerInfo {
  symbol: string;       // e.g. "RELIANCE.NS"
  name: string;         // e.g. "Reliance Industries Limited"
  exchange: Exchange;
  type: 'EQUITY' | 'COMMODITY' | 'INDEX' | 'ETF';
  sector?: string;
}

// Sector data
export interface SectorData {
  name: string;
  change: number;      // % change
  topTicker: string;
  color: string;
}

// Computed technical indicators
export interface TechnicalIndicators {
  sma20: (number | null)[];
  sma50: (number | null)[];
  ema9: (number | null)[];
  rsi: (number | null)[];
  bollingerBands: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
  };
}

// Active indicator toggles
export interface IndicatorToggles {
  sma20: boolean;
  sma50: boolean;
  ema9: boolean;
  bb: boolean;
  rsi: boolean;
}