import type { AnalysisData, NewsSource, Timeframe } from '../types';

const AI_CACHE_KEY = 'marketwings_ai_cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry {
  timestamp: number;
  analysis: AnalysisData;
  sources: NewsSource[] | null;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

function getCacheKey(ticker: string, timeframe: Timeframe, includeWebNews: boolean): string {
  return `${ticker}_${timeframe}_${includeWebNews}`;
}

function loadStore(): CacheStore {
  try {
    const data = localStorage.getItem(AI_CACHE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export function getCachedAnalysis(
  ticker: string,
  timeframe: Timeframe,
  includeWebNews: boolean
): { analysis: AnalysisData; sources: NewsSource[] | null } | null {
  const store = loadStore();
  const key = getCacheKey(ticker, timeframe, includeWebNews);
  const entry = store[key];

  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    // Delete expired entry
    delete store[key];
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(store));
    return null;
  }

  return { analysis: entry.analysis, sources: entry.sources };
}

export function setCachedAnalysis(
  ticker: string,
  timeframe: Timeframe,
  includeWebNews: boolean,
  analysis: AnalysisData,
  sources: NewsSource[] | null
) {
  const store = loadStore();
  const key = getCacheKey(ticker, timeframe, includeWebNews);
  
  store[key] = {
    timestamp: Date.now(),
    analysis,
    sources,
  };

  // Keep cache size manageable (max 20 entries)
  const keys = Object.keys(store);
  if (keys.length > 20) {
    // Delete oldest
    let oldestKey = keys[0];
    let oldestTime = store[oldestKey].timestamp;
    for (const k of keys) {
      if (store[k].timestamp < oldestTime) {
        oldestTime = store[k].timestamp;
        oldestKey = k;
      }
    }
    delete store[oldestKey];
  }

  localStorage.setItem(AI_CACHE_KEY, JSON.stringify(store));
}
