import React from 'react';
import type { WatchlistItem, StockQuote, TickerInfo } from '../types';

interface WatchlistProps {
  watchlist: WatchlistItem[];
  quotes: Map<string, StockQuote>;
  onSelectTicker: (ticker: TickerInfo) => void;
  onRemove: (ticker: string) => void;
  currentTicker: string | null;
}

const ExchangeBadge: React.FC<{ exchange: string }> = ({ exchange }) => {
  const colors: Record<string, { bg: string }> = {
    NSE: { bg: '#bfdbfe' },
    BSE: { bg: '#e9d5ff' },
    MCX: { bg: '#fde047' },
    INDEX: { bg: '#e5e7eb' },
  };
  const cfg = colors[exchange] || colors.NSE;
  return (
    <span
      className="text-[10px] font-black text-black px-1.5 py-0.5 rounded border-[2px] border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
      style={{ background: cfg.bg }}
    >
      {exchange}
    </span>
  );
};

const BookmarkEmptyIcon = () => (
  <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);

export const Watchlist: React.FC<WatchlistProps> = ({
  watchlist,
  quotes,
  onSelectTicker,
  onRemove,
  currentTicker,
}) => {
  // Sort most recently added first
  const sorted = [...watchlist].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <div className="neo-card-flat bg-white p-3 flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-1 border-b-[3px] border-black">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-black uppercase">⭐ Watchlist</span>
          {watchlist.length > 0 && (
            <span
              className="text-[10px] font-black text-black px-1.5 py-0.5 rounded-full border-[2px] border-black"
              style={{ background: '#bfdbfe' }}
            >
              {watchlist.length}
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border-[3px] border-black bg-neo-yellow shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <BookmarkEmptyIcon />
          </div>
          <p className="text-xs font-bold text-slate-600 text-center leading-relaxed">
            Add stocks to watchlist<br />to track them here
          </p>
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col gap-1.5 overflow-y-auto scroll-panel flex-1">
        {sorted.map((item) => {
          const quote = quotes.get(item.ticker);
          const isSelected = currentTicker === item.ticker;

          const price = quote?.price;
          const prevClose = quote?.previousClose;
          const changePct =
            price != null && prevClose != null && prevClose !== 0
              ? ((price - prevClose) / prevClose) * 100
              : null;
          const isUp = changePct != null ? changePct >= 0 : null;

          const handleSelect = () => {
            onSelectTicker({
              symbol: item.ticker,
              name: item.name,
              exchange: item.exchange,
              type: item.exchange === 'MCX' ? 'COMMODITY' : 'EQUITY',
            });
          };

          return (
            <div
              key={item.ticker}
              className={`group relative rounded px-3 py-2.5 cursor-pointer animate-fade-in border-[2px] transition-transform ${
                isSelected 
                  ? 'bg-neo-lime border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-[2px]' 
                  : 'bg-white hover:bg-neo-yellow border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
              }`}
              onClick={handleSelect}
            >
              {/* Positive/Negative dot */}
              {isUp != null && (
                <span
                  className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-black"
                  style={{ background: isUp ? '#22c55e' : '#ef4444' }}
                />
              )}

              <div className="pl-3 flex items-center justify-between gap-2">
                {/* Left: name + exchange */}
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-black uppercase truncate max-w-[80px]">
                      {item.name}
                    </span>
                    <ExchangeBadge exchange={item.exchange} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 truncate">{item.ticker}</span>
                </div>

                {/* Right: price + change */}
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className="font-mono-num text-xs font-black text-black">
                    {price != null
                      ? `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                      : '—'}
                  </span>
                  {changePct != null ? (
                    <span
                      className="font-mono-num text-[10px] font-black"
                      style={{ color: isUp ? '#16a34a' : '#dc2626' }}
                    >
                      {isUp ? '+' : ''}{changePct.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600">—</span>
                  )}
                </div>
              </div>

              {/* Remove button — appears on hover */}
              <button
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-2 border-black"
                style={{ background: '#f43f5e', color: '#000', fontSize: '12px', fontWeight: 900 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.ticker);
                }}
                title="Remove from watchlist"
                aria-label={`Remove ${item.name} from watchlist`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
