import React, { useMemo } from 'react';
import type { StockQuote } from '../types';

interface TickerTapeProps {
  tickers: StockQuote[];
}

const getDisplayLabel = (symbol: string): string => {
  if (symbol === '^NSEI') return 'NIFTY 50';
  if (symbol === '^BSESN') return 'SENSEX';
  if (symbol === '^NSEBANK') return 'BANK NIFTY';
  if (symbol === 'GC=F') return 'Gold';
  if (symbol === 'SI=F') return 'Silver';
  if (symbol === 'HG=F') return 'Copper';
  if (symbol === 'CL=F') return 'Crude Oil';
  if (symbol === 'NG=F') return 'Natural Gas';
  return symbol.replace('.NS', '').replace('.BO', '');
};

const formatPrice = (price: number, currency: string = 'INR') => {
  if (currency === 'USD') return `$${price.toFixed(2)}`;
  return `₹${price.toFixed(2)}`;
};

const TickerItem: React.FC<{ quote: StockQuote }> = ({ quote }) => {
  const isUp = quote.price >= quote.previousClose;
  const change = quote.price - quote.previousClose;
  const pct = quote.previousClose ? (change / quote.previousClose) * 100 : 0;
  
  return (
    <div className="inline-flex items-center gap-2 mx-3 px-3 py-1 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer group/item">
      <span className="text-sm font-extrabold text-black uppercase tracking-tight">{getDisplayLabel(quote.ticker)}</span>
      <span className="text-sm font-mono-num font-bold text-black border-l-2 border-black pl-2">
        {formatPrice(quote.price, quote.currency)}
      </span>
      <span className={`text-xs font-black tracking-tighter ${isUp ? 'text-green-600' : 'text-red-600'}`}>
        {isUp ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
      </span>
    </div>
  );
};

const SkeletonItem: React.FC = () => (
  <div className="inline-flex items-center gap-3 mx-3 px-3 py-1 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
    <div className="skeleton h-4 w-16 bg-slate-200"></div>
    <div className="skeleton h-4 w-12 bg-slate-200 border-l-2 border-black pl-2"></div>
  </div>
);

export const TickerTape: React.FC<TickerTapeProps> = ({ tickers }) => {
  const doubledTickers = useMemo(() => {
    if (tickers.length === 0) return [];
    return [...tickers, ...tickers, ...tickers];
  }, [tickers]);

  const showSkeleton = tickers.length === 0;

  return (
    <div className="w-full bg-neo-yellow border-b-4 border-black py-2 overflow-hidden relative">
      {/* Left/Right blackout gradients for brutalist depth */}
      <div className="absolute left-0 top-0 h-full w-8 z-10 pointer-events-none bg-gradient-to-r from-neo-yellow to-transparent" />
      <div className="absolute right-0 top-0 h-full w-8 z-10 pointer-events-none bg-gradient-to-l from-neo-yellow to-transparent" />

      <div className="ticker-wrap w-full">
        {showSkeleton ? (
          <div className="ticker-inner animate-ticker">
            {Array.from({ length: 15 }).map((_, i) => (
              <SkeletonItem key={i} />
            ))}
          </div>
        ) : (
          <div className="ticker-inner animate-ticker">
            {doubledTickers.map((quote, idx) => (
              <TickerItem key={`${quote.ticker}-${idx}`} quote={quote} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TickerTape;
