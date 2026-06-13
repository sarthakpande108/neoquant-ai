import React from 'react';
import type { HistoryEntry } from '../types';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onSelectEntry: (entry: HistoryEntry) => void;
  onClear: () => void;
}

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}min ago`;
  return 'Just now';
}

const RecBadge: React.FC<{ rec: string }> = ({ rec }) => {
  const cfg =
    rec === 'Buy'
      ? { bg: '#bbf7d0' }
      : rec === 'Sell'
      ? { bg: '#fecdd3' }
      : { bg: '#e5e7eb' };

  return (
    <span
      className="indicator-badge text-[10px] font-black tracking-widest text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      style={{ background: cfg.bg, border: `2px solid #000` }}
    >
      {rec.toUpperCase()}
    </span>
  );
};

const ExchangeBadge: React.FC<{ exchange: string }> = ({ exchange }) => {
  const colors: Record<string, { bg: string }> = {
    NSE:   { bg: '#bfdbfe' },
    BSE:   { bg: '#e9d5ff' },
    MCX:   { bg: '#fde047' },
    INDEX: { bg: '#e5e7eb' },
  };
  const cfg = colors[exchange] || colors.NSE;
  return (
    <span
      className="text-[9px] font-black text-black px-1.5 py-0.5 rounded border-[2px] border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
      style={{ background: cfg.bg }}
    >
      {exchange}
    </span>
  );
};

const EmptyIcon = () => (
  <svg className="w-10 h-10 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onSelectEntry, onClear }) => {
  const displayHistory = history.slice(0, 10);

  return (
    <div className="neo-card-flat bg-white p-3 flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-1 border-b-[3px] border-black">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-black uppercase">🕒 Recent Analyses</span>
          {history.length > 0 && (
            <span
              className="text-[10px] font-black px-1.5 py-0.5 rounded-full border-[2px] border-black text-black"
              style={{ background: '#bfdbfe' }}
            >
              {history.length}
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {displayHistory.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center border-[3px] border-black bg-neo-yellow shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            <EmptyIcon />
          </div>
          <p className="text-xs font-bold text-slate-600 text-center leading-relaxed">
            No analyses yet<br />Search a stock to begin
          </p>
        </div>
      )}

      {/* Entries */}
      <div className="flex flex-col gap-1.5 overflow-y-auto scroll-panel flex-1">
        {displayHistory.map((entry, i) => (
          <div
            key={entry.id}
            className="rounded px-3 py-2.5 cursor-pointer animate-fade-in bg-white hover:bg-neo-yellow border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform"
            style={{
              animationDelay: `${i * 40}ms`,
              animationFillMode: 'both',
            }}
            onClick={() => onSelectEntry(entry)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectEntry(entry)}
            aria-label={`View analysis: ${entry.name} — ${entry.recommendation}`}
          >
            <div className="flex items-start justify-between gap-2">
              {/* Left */}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-black uppercase truncate max-w-[90px]">
                    {entry.name}
                  </span>
                  <ExchangeBadge exchange={entry.exchange} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <RecBadge rec={entry.recommendation} />
                  <span className="font-mono-num text-[10px] font-bold text-slate-600">
                    {Math.round(entry.confidence * 100)}% conf.
                  </span>
                </div>
              </div>

              {/* Right */}
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span className="font-mono-num font-black text-xs text-black">
                  ₹{entry.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] font-bold text-slate-500">{timeAgo(entry.analysedAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Clear button */}
      {displayHistory.length > 0 && (
        <button
          onClick={onClear}
          className="mt-1 w-full text-xs font-bold text-black bg-white hover:bg-red-200 transition-colors py-1.5 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px]"
        >
          🗑 Clear History
        </button>
      )}
    </div>
  );
};
