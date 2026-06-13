import React, { useMemo } from 'react';
import type { StockQuote } from '../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface KeyStatsBarProps {
  quote: StockQuote | null;
  isLoading: boolean;
}

// ── Number Formatting Helpers ─────────────────────────────────────────────────

/**
 * Format large market-cap values as Indian style:
 *   ≥ 1 Lakh Crore → "₹X.XT" (trillion)
 *   ≥ 1 Crore → "₹XCr"
 *   ≥ 1 Lakh → "₹XL"
 *   else raw
 */
const formatMarketCap = (value: number, currency: string): string => {
  const prefix = currency === 'USD' ? '$' : '₹';
  if (value === 0) return '—';
  if (value >= 1e12) return `${prefix}${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B`;
  const crore = 1e7;
  const lakh = 1e5;
  if (value >= crore) return `${prefix}${(value / crore).toFixed(0)}Cr`;
  if (value >= lakh) return `${prefix}${(value / lakh).toFixed(0)}L`;
  return `${prefix}${value.toFixed(0)}`;
};

/**
 * Format volume in Indian style units (Cr / L / raw)
 */
const formatVolume = (value: number): string => {
  if (value === 0) return '—';
  const crore = 1e7;
  const lakh = 1e5;
  if (value >= crore) return `${(value / crore).toFixed(2)}Cr`;
  if (value >= lakh) return `${(value / lakh).toFixed(2)}L`;
  return new Intl.NumberFormat('en-IN').format(value);
};

const formatPrice = (value: number, currency: string): string => {
  const prefix = currency === 'USD' ? '$' : '₹';
  return (
    prefix +
    new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  );
};

const formatChange = (abs: number, pct: number, currency: string) => {
  const prefix = currency === 'USD' ? '$' : '₹';
  const sign = abs >= 0 ? '+' : '';
  const absStr =
    prefix +
    new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(abs));
  const pctStr = `${sign}${pct.toFixed(2)}%`;
  return { absStr: `${sign}${absStr}`, pctStr };
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

const SkeletonBlock: React.FC<{ wide?: boolean }> = ({ wide }) => (
  <div className="flex flex-col gap-2">
    <span className="skeleton h-3 w-20 rounded" />
    <span className={`skeleton h-6 ${wide ? 'w-32' : 'w-24'} rounded`} />
  </div>
);

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, children, className = '' }) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest leading-none">
      {label}
    </span>
    <div className="text-sm font-black text-black font-mono-num leading-tight">
      {children}
    </div>
  </div>
);

// ── Range Bar ─────────────────────────────────────────────────────────────────

interface RangeBarProps {
  low: number;
  high: number;
  current: number;
}

const RangeBar: React.FC<RangeBarProps> = ({ low, high, current }) => {
  const range = high - low;
  const pct = range > 0 ? ((current - low) / range) * 100 : 50;
  const clampedPct = Math.min(100, Math.max(0, pct));

  return (
    <div className="relative h-1.5 rounded-full bg-slate-200 w-full mt-1.5 border border-black" title={`Low: ${low} | High: ${high}`}>
      {/* Fill from low to current */}
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-neo-pink to-neo-lime border-r border-black"
        style={{ width: `${clampedPct}%` }}
      />
      {/* Indicator dot */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full border-2 border-black bg-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
        style={{ left: `${clampedPct}%` }}
      />
    </div>
  );
};

// ── KeyStatsBar ───────────────────────────────────────────────────────────────

export const KeyStatsBar: React.FC<KeyStatsBarProps> = ({
  quote,
  isLoading,
}) => {
  const derived = useMemo(() => {
    if (!quote) return null;
    const absChange = quote.price - quote.previousClose;
    const pctChange =
      quote.previousClose !== 0
        ? (absChange / quote.previousClose) * 100
        : 0;
    return { absChange, pctChange };
  }, [quote]);

  const isPositive = (derived?.absChange ?? 0) >= 0;
  const priceColour = isPositive ? 'text-green-600' : 'text-red-600';
  const changeColour = isPositive ? 'text-green-600' : 'text-red-600';
  const arrow = isPositive ? '▲' : '▼';

  return (
    <div className="neo-card-flat bg-white p-4 mt-4 overflow-x-auto">
      {isLoading ? (
        /* Loading skeleton */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5 min-w-[640px]">
          <SkeletonBlock wide />
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock wide />
          <SkeletonBlock wide />
          <SkeletonBlock />
          <SkeletonBlock wide />
        </div>
      ) : !quote ? (
        /* No data */
        <div className="flex items-center justify-center h-16 text-black font-bold text-sm">
          Select a stock to view key statistics
        </div>
      ) : (
        /* Data grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-5 min-w-[640px]">

          {/* 1. Current Price */}
          <StatCard label="Price" className="col-span-1">
            <span className={`text-xl font-bold ${priceColour}`}>
              {formatPrice(quote.price, quote.currency)}
            </span>
          </StatCard>

          {/* 2. Day Change */}
          <StatCard label="Day Change">
            {derived ? (
              <span className={`flex flex-col gap-0.5 ${changeColour}`}>
                <span>
                  {arrow}&nbsp;
                  {formatChange(derived.absChange, derived.pctChange, quote.currency).absStr}
                </span>
                <span className="text-xs opacity-80">
                  {formatChange(derived.absChange, derived.pctChange, quote.currency).pctStr}
                </span>
              </span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </StatCard>

          {/* 3. Open */}
          <StatCard label="Open">
            {quote.open > 0 ? formatPrice(quote.open, quote.currency) : '—'}
          </StatCard>

          {/* 4. Prev Close */}
          <StatCard label="Prev Close">
            {quote.previousClose > 0
              ? formatPrice(quote.previousClose, quote.currency)
              : '—'}
          </StatCard>

          {/* 5. Day Range */}
          <StatCard label="Day High / Low" className="col-span-2 sm:col-span-1">
            <div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-red-600 font-mono-num">
                  {quote.dayLow > 0 ? formatPrice(quote.dayLow, quote.currency) : '—'}
                </span>
                <span className="text-green-600 font-mono-num">
                  {quote.dayHigh > 0 ? formatPrice(quote.dayHigh, quote.currency) : '—'}
                </span>
              </div>
              {quote.dayLow > 0 && quote.dayHigh > 0 && (
                <RangeBar
                  low={quote.dayLow}
                  high={quote.dayHigh}
                  current={quote.price}
                />
              )}
            </div>
          </StatCard>

          {/* 6. 52W Range */}
          <StatCard label="52W High / Low" className="col-span-2 sm:col-span-1">
            <div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-red-600 font-mono-num">
                  {quote.fiftyTwoWeekLow > 0
                    ? formatPrice(quote.fiftyTwoWeekLow, quote.currency)
                    : '—'}
                </span>
                <span className="text-green-600 font-mono-num">
                  {quote.fiftyTwoWeekHigh > 0
                    ? formatPrice(quote.fiftyTwoWeekHigh, quote.currency)
                    : '—'}
                </span>
              </div>
              {quote.fiftyTwoWeekLow > 0 && quote.fiftyTwoWeekHigh > 0 && (
                <RangeBar
                  low={quote.fiftyTwoWeekLow}
                  high={quote.fiftyTwoWeekHigh}
                  current={quote.price}
                />
              )}
            </div>
          </StatCard>

          {/* 7. Volume */}
          <StatCard label="Volume">
            <div className="flex flex-col gap-0.5">
              <span>{formatVolume(quote.volume)}</span>
              {quote.avgVolume > 0 && (
                <span className="text-xs text-slate-500">
                  Avg {formatVolume(quote.avgVolume)}
                </span>
              )}
            </div>
          </StatCard>

          {/* 8. Market Cap */}
          <StatCard label="Market Cap">
            {quote.marketCap > 0
              ? formatMarketCap(quote.marketCap, quote.currency)
              : '—'}
          </StatCard>

          {/* 9. P/E Ratio (bonus stat) */}
          {quote.pe !== null && (
            <StatCard label="P/E Ratio">
              {quote.pe > 0 ? quote.pe.toFixed(2) : '—'}
            </StatCard>
          )}

          {/* 10. Market State badge */}
          <StatCard label="Market Status">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                quote.marketState === 'REGULAR'
                  ? 'bg-neo-lime text-black'
                  : 'bg-slate-200 text-black'
              }`}
            >
              {quote.marketState === 'REGULAR' ? '● Live' : quote.marketState}
            </span>
          </StatCard>
        </div>
      )}
    </div>
  );
};

export default KeyStatsBar;
