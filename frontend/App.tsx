import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { TickerTape } from './components/TickerTape';
import { StockSearch } from './components/StockSearch';
import { CandlestickChart, type CandlestickChartHandle } from './components/CandlestickChart';
import { KeyStatsBar } from './components/KeyStatsBar';
import { TechnicalPanel } from './components/TechnicalPanel';
import { AnalysisResult } from './components/AnalysisResult';
import { Watchlist } from './components/Watchlist';
import { SectorHeatmap } from './components/SectorHeatmap';
import { HistoryPanel } from './components/HistoryPanel';
import { Loader } from './components/Loader';
import { Footer } from './components/Footer';
import { AboutPage } from './components/AboutPage';
import { analyzeStockByTicker } from './services/geminiService';
import { fetchStockData, fetchMultipleQuotes } from './services/stockService';
import { computeAllIndicators, getLatestRSI, formatIndicatorsForAI } from './services/indicatorService';
import { getCachedAnalysis, setCachedAnalysis } from './services/cacheService';
import { ALL_TICKERS, TAPE_TICKERS } from './services/tickerData';
import type {
  TickerInfo, StockQuote, Candle, AnalysisData, NewsSource,
  WatchlistItem, HistoryEntry, TechnicalIndicators, IndicatorToggles, Timeframe
} from './types';

const WATCHLIST_KEY = 'marketwings_watchlist';
const HISTORY_KEY = 'marketwings_history';

function loadWatchlist(): WatchlistItem[] {
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveWatchlist(watchlist: WatchlistItem[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
}

function loadHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveHistory(history: HistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

function getMarketStatus(): 'OPEN' | 'CLOSED' | 'PRE' {
  const now = new Date();
  const istOffset = 5.5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + istOffset * 60000);
  const day = ist.getDay();
  const hours = ist.getHours();
  const mins = ist.getMinutes();
  const totalMins = hours * 60 + mins;
  if (day === 0 || day === 6) return 'CLOSED';
  if (totalMins >= 555 && totalMins < 915) return 'PRE';   // 9:15 AM
  if (totalMins >= 915 && totalMins < 930) return 'OPEN';  // 9:15 – 3:30 PM  
  if (totalMins >= 915 && totalMins <= 930) return 'OPEN';
  if (totalMins > 555 && totalMins < 915) return 'PRE';
  if (totalMins >= 915 && totalMins <= 930) return 'OPEN';
  // 9:15 (555) to 15:30 (930)
  if (totalMins >= 555 && totalMins <= 930) {
    if (totalMins < 915) return 'PRE';
    return 'OPEN';
  }
  return 'CLOSED';
}

// Re-compute properly
function computeMarketStatus(): 'OPEN' | 'CLOSED' | 'PRE' {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const day = ist.getDay();
  if (day === 0 || day === 6) return 'CLOSED';
  const totalMins = ist.getHours() * 60 + ist.getMinutes();
  if (totalMins >= 555 && totalMins < 915) return 'PRE';
  if (totalMins >= 915 && totalMins <= 930) return 'OPEN';
  return 'CLOSED';
}

function App() {
  const [page, setPage] = useState<'home' | 'about'>('home');

  // Market state
  const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED' | 'PRE'>(computeMarketStatus());
  const [tapeTickers, setTapeTickers] = useState<StockQuote[]>([]);

  // Current stock state
  const [currentTicker, setCurrentTicker] = useState<TickerInfo | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators>({ sma20: [], sma50: [], ema9: [], rsi: [], bollingerBands: { upper: [], middle: [], lower: [] } });
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [indicatorToggles, setIndicatorToggles] = useState<IndicatorToggles>({
    sma20: true, sma50: true, ema9: false, bb: false, rsi: true
  });

  // Data loading states
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // AI Analysis state
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [sources, setSources] = useState<NewsSource[] | null>(null);
  const [includeWebNews, setIncludeWebNews] = useState(false);

  // Sidebar state
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(loadWatchlist);
  const [watchlistQuotes, setWatchlistQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [recentSearches, setRecentSearches] = useState<TickerInfo[]>([]);

  // Panel visibility on mobile
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeSidePanel, setActiveSidePanel] = useState<'watchlist' | 'heatmap' | 'history'>('watchlist');

  const analysisRef = useRef<HTMLDivElement>(null);
  const chartComponentRef = useRef<CandlestickChartHandle>(null);

  // Market status updater
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(computeMarketStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load ticker tape quotes on mount
  useEffect(() => {
    const loadTape = async () => {
      try {
        const quotes = await fetchMultipleQuotes(TAPE_TICKERS);
        setTapeTickers(quotes);
      } catch (e) {
        console.error('Ticker tape load failed:', e);
      }
    };
    loadTape();
    const interval = setInterval(loadTape, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  // Load watchlist quotes
  useEffect(() => {
    if (watchlist.length === 0) return;
    const loadWatchlistQuotes = async () => {
      const tickers = watchlist.map(w => w.ticker);
      try {
        const quotes = await fetchMultipleQuotes(tickers);
        const map = new Map<string, StockQuote>();
        quotes.forEach(q => map.set(q.ticker, q));
        setWatchlistQuotes(map);
      } catch (e) {
        console.error('Watchlist quotes failed:', e);
      }
    };
    loadWatchlistQuotes();
  }, [watchlist]);

  // Load chart data when ticker or timeframe changes
  const loadChartData = useCallback(async (ticker: TickerInfo, tf: Timeframe) => {
    setIsLoadingChart(true);
    setChartError(null);
    setCandles([]);
    setQuote(null);
    setAnalysis(null);
    setSources(null);
    setAnalysisError(null);

    try {
      const { quote: q, candles: c } = await fetchStockData(ticker.symbol, tf);
      setQuote(q);
      setCandles(c);
      const ind = computeAllIndicators(c);
      setIndicators(ind);
    } catch (e) {
      console.error('Chart data failed:', e);
      setChartError(e instanceof Error ? e.message : 'Failed to load market data. Please check the ticker and try again.');
    } finally {
      setIsLoadingChart(false);
    }
  }, []);

  const handleSelectTicker = useCallback(async (ticker: TickerInfo) => {
    setCurrentTicker(ticker);
    setTimeframe('1D');
    setRecentSearches(prev => {
      const filtered = prev.filter(t => t.symbol !== ticker.symbol);
      return [ticker, ...filtered].slice(0, 5);
    });
    await loadChartData(ticker, '1D');
  }, [loadChartData]);

  const handleTimeframeChange = useCallback(async (tf: Timeframe) => {
    if (!currentTicker) return;
    setTimeframe(tf);
    await loadChartData(currentTicker, tf);
  }, [currentTicker, loadChartData]);

  const handleIndicatorToggle = useCallback((key: keyof IndicatorToggles) => {
    setIndicatorToggles(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    if (!currentTicker || !quote || candles.length === 0) return;
    setIsLoadingAnalysis(true);
    setAnalysisError(null);
    setAnalysis(null);
    setSources(null);

    try {
      const cached = getCachedAnalysis(currentTicker.symbol, timeframe, includeWebNews);
      if (cached) {
        setAnalysis(cached.analysis);
        if (cached.sources) setSources(cached.sources);
        setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
        setIsLoadingAnalysis(false);
        return;
      }

      const indicatorSummary = formatIndicatorsForAI(candles, quote);
      const chartImage = chartComponentRef.current?.getScreenshot() || undefined;
      
      const { analysis: a, sources: s } = await analyzeStockByTicker(currentTicker.symbol, indicatorSummary, quote, timeframe, includeWebNews, chartImage);
      if (a) {
        setCachedAnalysis(currentTicker.symbol, timeframe, includeWebNews, a, s);
        setAnalysis(a);
        // Add to history
        const entry: HistoryEntry = {
          id: Date.now().toString(),
          ticker: currentTicker.symbol,
          name: currentTicker.name,
          exchange: currentTicker.exchange,
          analysedAt: Date.now(),
          recommendation: a.recommendation,
          confidence: a.confidence,
          price: quote.price,
        };
        setHistory(prev => {
          const updated = [entry, ...prev].slice(0, 20);
          saveHistory(updated);
          return updated;
        });
        // Scroll to analysis
        setTimeout(() => analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
      if (s) setSources(s);
    } catch (e) {
      console.error('Analysis failed:', e);
      setAnalysisError(e instanceof Error ? e.message : 'AI analysis failed. Please try again.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  }, [currentTicker, quote, candles]);

  const handleAddToWatchlist = useCallback(() => {
    if (!currentTicker) return;
    setWatchlist(prev => {
      if (prev.some(w => w.ticker === currentTicker.symbol)) return prev;
      const updated = [{
        ticker: currentTicker.symbol,
        name: currentTicker.name,
        exchange: currentTicker.exchange,
        addedAt: Date.now(),
      }, ...prev];
      saveWatchlist(updated);
      return updated;
    });
  }, [currentTicker]);

  const handleRemoveFromWatchlist = useCallback((ticker: string) => {
    setWatchlist(prev => {
      const updated = prev.filter(w => w.ticker !== ticker);
      saveWatchlist(updated);
      return updated;
    });
  }, []);

  const isInWatchlist = currentTicker ? watchlist.some(w => w.ticker === currentTicker.symbol) : false;

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    const tickerInfo = ALL_TICKERS.find(t => t.symbol === entry.ticker) ?? {
      symbol: entry.ticker,
      name: entry.name,
      exchange: entry.exchange,
      type: 'EQUITY' as const,
    };
    handleSelectTicker(tickerInfo);
  }, [handleSelectTicker]);

  const handleSectorClick = useCallback((sector: string) => {
    const sectorTopTickers: Record<string, string> = {
      'Banking': 'HDFCBANK.NS', 'IT': 'TCS.NS', 'Energy': 'RELIANCE.NS',
      'Metal': 'TATASTEEL.NS', 'Pharma': 'SUNPHARMA.NS', 'Automobile': 'MARUTI.NS',
      'FMCG': 'HINDUNILVR.NS', 'Infrastructure': 'LT.NS', 'Consumer': 'TITAN.NS', 'NBFC': 'BAJFINANCE.NS',
    };
    const symbol = sectorTopTickers[sector];
    if (symbol) {
      const info = ALL_TICKERS.find(t => t.symbol === symbol);
      if (info) handleSelectTicker(info);
    }
  }, [handleSelectTicker]);

  const latestRsi = getLatestRSI(indicators.rsi);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <Header currentPage={page} setPage={setPage} marketStatus={marketStatus} />

      {/* Ticker Tape */}
      {page === 'home' && <TickerTape tickers={tapeTickers} />}

      <main className="flex-grow container mx-auto px-3 md:px-6 py-4 max-w-screen-2xl">
        {page === 'about' ? (
          <div className="max-w-3xl mx-auto">
            <div className="neo-card p-6 md:p-8">
              <AboutPage />
            </div>
          </div>
        ) : (
          <div className="flex gap-4">
            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Search Bar */}
              <StockSearch
                onSelectTicker={handleSelectTicker}
                isLoading={isLoadingChart}
                recentSearches={recentSearches}
              />

              {/* Current ticker info + actions */}
              {currentTicker && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between animate-fade-in neo-card-flat p-3 mb-4 gap-3 sm:gap-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h2 className="text-xl font-bold text-black uppercase tracking-tight">{currentTicker.name}</h2>
                    <span className={`text-xs font-black px-2 py-0.5 rounded border-2 border-black uppercase ${
                      currentTicker.exchange === 'NSE' ? 'bg-neo-blue text-black' :
                      currentTicker.exchange === 'BSE' ? 'bg-neo-purple text-black' :
                      currentTicker.exchange === 'MCX' ? 'bg-neo-orange text-black' :
                      'bg-slate-200 text-black'
                    }`}>{currentTicker.exchange}</span>
                    <span className="text-slate-600 font-bold text-sm font-mono">{currentTicker.symbol}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleAddToWatchlist}
                      disabled={isInWatchlist}
                      className={`px-3 py-1.5 text-sm uppercase font-bold transition-all hidden sm:block ${
                        isInWatchlist
                          ? 'bg-neo-yellow text-black border-2 border-black opacity-50 cursor-default rounded'
                          : 'neo-btn bg-white hover:bg-neo-yellow'
                      }`}
                    >
                      {isInWatchlist ? '⭐ Watching' : '☆ Watchlist'}
                    </button>

                    <label className="flex items-center gap-2 px-3 py-1.5 border-2 border-black bg-white rounded cursor-pointer hover:bg-slate-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-black cursor-pointer"
                        checked={includeWebNews}
                        onChange={(e) => setIncludeWebNews(e.target.checked)}
                      />
                      <span className="text-xs font-black uppercase whitespace-nowrap">Deep Search</span>
                    </label>

                    <button
                      onClick={handleRunAnalysis}
                      disabled={isLoadingAnalysis || isLoadingChart || candles.length === 0}
                      className="px-4 sm:px-5 py-1.5 text-xs sm:text-sm uppercase bg-neo-pink text-black neo-btn flex items-center gap-2"
                    >
                      {isLoadingAnalysis ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Analysing...
                        </span>
                      ) : '🤖 Run NeoQuant'}
                    </button>
                  </div>
                </div>
              )}

              {/* Chart error */}
              {chartError && (
                <div className="p-4 bg-red-100 border-4 border-red-500 text-red-900 rounded-xl font-bold text-sm animate-fade-in shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                  <span className="font-extrabold uppercase tracking-wider">⚠ Data Error: </span>{chartError}
                </div>
              )}

              {/* Candlestick Chart */}
              {(currentTicker || isLoadingChart) && (
                <div className="neo-card overflow-hidden">
                  <CandlestickChart
                    ref={chartComponentRef}
                    candles={candles}
                    indicators={indicators}
                    toggles={indicatorToggles}
                    timeframe={timeframe}
                    onTimeframeChange={handleTimeframeChange}
                    ticker={currentTicker?.symbol ?? ''}
                    isLoading={isLoadingChart}
                    supportLevels={analysis?.supportLevels}
                    resistanceLevels={analysis?.resistanceLevels}
                  />
                </div>
              )}

              {/* Key Stats Bar */}
              {(currentTicker || isLoadingChart) && (
                <KeyStatsBar quote={quote} isLoading={isLoadingChart} />
              )}

              {/* Technical Panel */}
              {candles.length > 0 && (
                <div className="neo-card p-4">
                  <TechnicalPanel
                    toggles={indicatorToggles}
                    onToggle={handleIndicatorToggle}
                    latestRsi={latestRsi}
                    candles={candles}
                  />
                </div>
              )}

              {/* Analysis Loading */}
              {isLoadingAnalysis && (
                <div className="neo-card p-8 flex flex-col items-center gap-4 animate-fade-in bg-neo-purple">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-black border-t-white animate-spin-slow" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl">🤖</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-black text-xl font-black uppercase tracking-tight">NeoQuant AI is analysing...</p>
                    <p className="text-black font-medium mt-1">Fetching live news, computing technicals, generating insights</p>
                  </div>
                </div>
              )}

              {/* Analysis Error */}
              {analysisError && (
                <div className="p-4 bg-red-100 border-4 border-red-500 text-red-900 rounded-xl font-bold text-sm animate-fade-in shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
                  <span className="font-extrabold uppercase tracking-wider">⚠ Analysis Error: </span>{analysisError}
                </div>
              )}

              {/* Analysis Result */}
              {analysis && quote && (
                <div ref={analysisRef}>
                  <AnalysisResult result={analysis} sources={sources} quote={quote} />
                </div>
              )}

              {/* Welcome state */}
              {!currentTicker && !isLoadingChart && (
                <div className="neo-card p-6 sm:p-12 flex flex-col items-center gap-4 sm:gap-6 text-center animate-fade-in bg-neo-lime overflow-hidden">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-full bg-white border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all">
                    <svg className="w-10 h-10 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-black mb-2 uppercase tracking-tight">Search any NSE, BSE or MCX instrument</h2>
                    <p className="text-black font-bold max-w-md mx-auto">Type a company name or ticker symbol above. Get live candlestick charts and AI-powered technical analysis in seconds.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['RELIANCE.NS', 'TCS.NS', '^NSEI', 'GC=F', 'HDFCBANK.NS', 'CL=F'].map(sym => {
                      const info = ALL_TICKERS.find(t => t.symbol === sym);
                      return info ? (
                        <button
                          key={sym}
                          onClick={() => handleSelectTicker(info)}
                          className="neo-btn bg-white px-4 py-2 text-sm text-black transition-all"
                        >
                          {info.name.split(' ')[0]} <span className="text-slate-500 font-mono text-[10px] ml-1">{sym}</span>
                        </button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="hidden lg:flex flex-col gap-4 w-72 xl:w-80 flex-shrink-0">
              {/* Sidebar Tabs */}
              <div className="flex neo-card-flat bg-white overflow-hidden p-1 gap-1">
                {(['watchlist', 'heatmap', 'history'] as const).map(panel => (
                  <button
                    key={panel}
                    onClick={() => setActiveSidePanel(panel)}
                    className={`flex-1 py-2 rounded border-2 text-xs font-bold uppercase transition-all ${
                      activeSidePanel === panel
                        ? 'bg-black text-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white text-slate-500 border-transparent hover:text-black hover:border-black'
                    }`}
                  >
                    {panel === 'watchlist' ? '⭐ Watchlist' : panel === 'heatmap' ? '🔥 Sectors' : '🕒 History'}
                  </button>
                ))}
              </div>

              {activeSidePanel === 'watchlist' && (
                <Watchlist
                  watchlist={watchlist}
                  quotes={watchlistQuotes}
                  onSelectTicker={handleSelectTicker}
                  onRemove={handleRemoveFromWatchlist}
                  currentTicker={currentTicker?.symbol ?? null}
                />
              )}
              {activeSidePanel === 'heatmap' && (
                <SectorHeatmap onSectorClick={handleSectorClick} />
              )}
              {activeSidePanel === 'history' && (
                <HistoryPanel
                  history={history}
                  onSelectEntry={handleHistorySelect}
                  onClear={() => { setHistory([]); saveHistory([]); }}
                />
              )}
            </div>
          </div>
        )}

        {/* Mobile sidebar panels */}
        {page === 'home' && (
          <div className="lg:hidden mt-4 grid grid-cols-1 gap-4">
            <SectorHeatmap onSectorClick={handleSectorClick} />
            <Watchlist
              watchlist={watchlist}
              quotes={watchlistQuotes}
              onSelectTicker={handleSelectTicker}
              onRemove={handleRemoveFromWatchlist}
              currentTicker={currentTicker?.symbol ?? null}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;