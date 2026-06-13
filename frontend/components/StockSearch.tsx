import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type { TickerInfo, Exchange } from '../types';
import { ALL_TICKERS } from '../services/tickerData';
import { searchTickers as searchYahoo } from '../services/stockService';

// ── Props ─────────────────────────────────────────────────────────────────────

interface StockSearchProps {
  onSelectTicker: (ticker: TickerInfo) => void;
  isLoading: boolean;
  recentSearches: TickerInfo[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RESULTS = 8;
const DEBOUNCE_MS = 200;

const EXCHANGE_BADGE: Record<Exchange, string> = {
  NSE: 'bg-neo-blue text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  BSE: 'bg-neo-purple text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  MCX: 'bg-neo-orange text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  INDEX: 'bg-slate-300 text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
};

const TYPE_BADGE: Record<TickerInfo['type'], string> = {
  EQUITY: 'bg-neo-green text-black border-2 border-black',
  COMMODITY: 'bg-neo-yellow text-black border-2 border-black',
  INDEX: 'bg-white text-black border-2 border-black',
  ETF: 'bg-neo-pink text-black border-2 border-black',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const normalise = (s: string) => s.toLowerCase().replace(/[.\-_]/g, '');

const searchLocalTickers = (query: string): TickerInfo[] => {
  const q = normalise(query.trim());
  if (!q) return [];

  const scored = ALL_TICKERS.map((t) => {
    const sym = normalise(t.symbol);
    const name = normalise(t.name);
    let score = 0;
    if (sym === q) score = 100;
    else if (sym.startsWith(q)) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (sym.includes(q)) score = 40;
    else if (name.includes(q)) score = 20;
    return { t, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTS)
    .map((x) => x.t);
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ExchangeBadge: React.FC<{ exchange: Exchange }> = ({ exchange }) => (
  <span
    className={`text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full tracking-wider leading-none ${EXCHANGE_BADGE[exchange]}`}
  >
    {exchange}
  </span>
);

const TypeTag: React.FC<{ type: TickerInfo['type'] }> = ({ type }) => (
  <span
    className={`text-[0.6rem] font-semibold px-1.5 py-0.5 rounded tracking-wide leading-none ${TYPE_BADGE[type]}`}
  >
    {type}
  </span>
);

interface ResultRowProps {
  ticker: TickerInfo;
  isActive: boolean;
  onMouseEnter: () => void;
  onSelect: () => void;
}

const ResultRow: React.FC<ResultRowProps> = ({
  ticker,
  isActive,
  onMouseEnter,
  onSelect,
}) => (
  <button
    type="button"
    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100 border-b-2 border-black last:border-b-0 ${
      isActive
        ? 'bg-neo-lime'
        : 'bg-white hover:bg-neo-yellow'
    }`}
    onMouseEnter={onMouseEnter}
    onMouseDown={(e) => {
      e.preventDefault(); // Prevent blur before click fires
      onSelect();
    }}
  >
    {/* Name + symbol column */}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-black text-black uppercase tracking-tight truncate leading-tight">
        {ticker.name}
      </p>
      <p className="font-mono-num font-bold text-xs text-slate-600 mt-0.5 truncate">
        {ticker.symbol}
      </p>
    </div>

    {/* Right badges */}
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {ticker.sector && (
        <span className="hidden sm:inline text-[0.6rem] font-bold text-black uppercase truncate max-w-[80px]">
          {ticker.sector}
        </span>
      )}
      <TypeTag type={ticker.type} />
      <ExchangeBadge exchange={ticker.exchange} />
    </div>
  </button>
);

// ── Loading Spinner ───────────────────────────────────────────────────────────

const Spinner: React.FC = () => (
  <svg
    className="animate-spin h-5 w-5 text-black"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

// ── Search Icon ───────────────────────────────────────────────────────────────

const SearchIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
    />
  </svg>
);

// ── Main Component ────────────────────────────────────────────────────────────

export const StockSearch: React.FC<StockSearchProps> = ({
  onSelectTicker,
  isLoading,
  recentSearches,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults] = useState<TickerInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Debounce ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
      setActiveIndex(-1);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // ── Results ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isActive = true;

    async function doSearch() {
      if (!debouncedQuery.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      // 1. Get local results
      const local = searchLocalTickers(debouncedQuery);
      if (isActive) setResults(local);

      // 2. Fetch from Yahoo if local is empty or small
      try {
        const remote = await searchYahoo(debouncedQuery);
        if (!isActive) return;
        
        // Merge without duplicates
        const merged = [...local];
        const existingSymbols = new Set(local.map(t => t.symbol));
        
        for (const r of remote) {
          if (!existingSymbols.has(r.symbol) && merged.length < MAX_RESULTS) {
            merged.push(r);
            existingSymbols.add(r.symbol);
          }
        }
        setResults(merged);
      } catch (err) {
        console.error(err);
      } finally {
        if (isActive) setIsSearching(false);
      }
    }

    doSearch();

    return () => {
      isActive = false;
    };
  }, [debouncedQuery]);

  const showRecents =
    isFocused && inputValue.trim() === '' && recentSearches.length > 0;
  const showResults = isFocused && debouncedQuery.trim() !== '';
  const isDropdownOpen = showRecents || showResults;

  const activeList: TickerInfo[] = showResults
    ? results
    : showRecents
    ? recentSearches
    : [];

  // ── Keyboard navigation ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isDropdownOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, activeList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeList[activeIndex]) {
          e.preventDefault();
          handleSelect(activeList[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    },
    [isDropdownOpen, activeIndex, activeList]
  );

  const handleSelect = useCallback(
    (ticker: TickerInfo) => {
      onSelectTicker(ticker);
      setInputValue('');
      setDebouncedQuery('');
      setIsFocused(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    },
    [onSelectTicker]
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Input wrapper */}
      <div
        className={`relative flex items-center neo-card-flat bg-white transition-all duration-200 ${
          isFocused
            ? 'shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] -translate-y-1'
            : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        {/* Search icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <SearchIcon className="h-6 w-6 text-black" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Small delay so onMouseDown in ResultRow fires first
            setTimeout(() => setIsFocused(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search stocks, commodities... (e.g. Reliance, GOLD, NIFTY 50)"
          className="w-full bg-transparent text-xl font-bold px-5 py-4 pl-12 pr-12 text-black placeholder-slate-400 outline-none rounded-xl"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search stocks"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
        />

        {/* Right slot: spinner or clear button */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {(isLoading || isSearching) && <Spinner />}
          {!(isLoading || isSearching) && inputValue && (
            <button
              type="button"
              onClick={() => {
                setInputValue('');
                setDebouncedQuery('');
                inputRef.current?.focus();
              }}
              className="text-black hover:text-red-500 transition-colors bg-neo-yellow border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] p-0.5"
              aria-label="Clear search"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      <div
        ref={dropdownRef}
        className={`search-dropdown !bg-white !border-4 !border-black !rounded-xl !shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mt-2 transition-all duration-200 ${
          isDropdownOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
        role="listbox"
        aria-label="Search results"
      >
        {/* ── Recent searches ─────────────────────────────────────────────── */}
        {showRecents && (
          <>
            <div className="px-4 py-2 border-b-4 border-black bg-slate-100">
              <p className="text-[0.65rem] font-black text-black uppercase tracking-widest">
                Recent Searches
              </p>
            </div>
            {recentSearches.map((ticker, i) => (
              <ResultRow
                key={ticker.symbol}
                ticker={ticker}
                isActive={activeIndex === i}
                onMouseEnter={() => setActiveIndex(i)}
                onSelect={() => handleSelect(ticker)}
              />
            ))}
          </>
        )}

        {/* ── Live results ────────────────────────────────────────────────── */}
        {showResults && results.length > 0 && (
          <>
            <div className="px-4 py-2 border-b-4 border-black bg-slate-100">
              <p className="text-[0.65rem] font-black text-black uppercase tracking-widest">
                Results
              </p>
            </div>
            {results.map((ticker, i) => (
              <ResultRow
                key={ticker.symbol}
                ticker={ticker}
                isActive={activeIndex === i}
                onMouseEnter={() => setActiveIndex(i)}
                onSelect={() => handleSelect(ticker)}
              />
            ))}
          </>
        )}

        {/* ── No results ──────────────────────────────────────────────────── */}
        {showResults && results.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-bold text-black">
              No results for{' '}
              <span className="font-black bg-neo-lime px-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                "{debouncedQuery}"
              </span>
            </p>
            <p className="text-xs font-bold text-slate-500 mt-2">
              Try a ticker symbol like RELIANCE.NS or keyword like "bank"
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockSearch;
