import React from 'react';
import type { IndicatorToggles, Candle } from '../types';

interface TechnicalPanelProps {
  toggles: IndicatorToggles;
  onToggle: (key: keyof IndicatorToggles) => void;
  latestRsi: number | null;
  candles: Candle[];
}

interface ToggleDef {
  key: keyof IndicatorToggles;
  label: string;
  color: string;
  bg: string;
  activeBorder: string;
  activeBg: string;
}

const TOGGLES: ToggleDef[] = [
  {
    key: 'sma20',
    label: 'SMA20',
    color: '#000',
    bg: '#ffffff',
    activeBorder: '#000000',
    activeBg: '#bfdbfe', // neo-blue
  },
  {
    key: 'sma50',
    label: 'SMA50',
    color: '#000',
    bg: '#ffffff',
    activeBorder: '#000000',
    activeBg: '#e9d5ff', // neo-purple
  },
  {
    key: 'ema9',
    label: 'EMA9',
    color: '#000',
    bg: '#ffffff',
    activeBorder: '#000000',
    activeBg: '#fde047', // neo-yellow
  },
  {
    key: 'bb',
    label: 'BB',
    color: '#000',
    bg: '#ffffff',
    activeBorder: '#000000',
    activeBg: '#e5e7eb', // gray
  },
  {
    key: 'rsi',
    label: 'RSI',
    color: '#000',
    bg: '#ffffff',
    activeBorder: '#000000',
    activeBg: '#ff90e8', // neo-pink
  },
];

function getRsiLabel(rsi: number): { text: string; color: string; zone: 'overbought' | 'neutral' | 'oversold' } {
  if (rsi >= 70) return { text: 'Overbought', color: '#ef4444', zone: 'overbought' }; // red-500
  if (rsi <= 30) return { text: 'Oversold', color: '#22c55e', zone: 'oversold' }; // green-500
  return { text: 'Neutral', color: '#6b7280', zone: 'neutral' };
}

function fmtVol(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
}

const RsiMeter: React.FC<{ rsi: number }> = ({ rsi }) => {
  const { text, color, zone } = getRsiLabel(rsi);
  const pct = Math.min(100, Math.max(0, rsi));

  return (
    <div className="neo-card-flat bg-white p-3 mt-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-black font-black uppercase">RSI (14)</span>
        <span className="font-mono-num text-sm font-bold" style={{ color }}>
          {rsi.toFixed(1)} — {text}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-4 rounded-full overflow-hidden flex border-2 border-black">
        {/* Oversold zone (0-30) */}
        <div className="h-full" style={{ width: '30%', background: '#bbf7d0' }} />
        {/* Neutral zone (30-70) */}
        <div className="h-full" style={{ width: '40%', background: '#f3f4f6' }} />
        {/* Overbought zone (70-100) */}
        <div className="h-full" style={{ width: '30%', background: '#fecdd3' }} />

        {/* Current RSI dot */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white"
          style={{
            left: `calc(${pct}% - 8px)`,
            transition: 'left 0.5s ease-out',
          }}
        />

        {/* Zone separator lines */}
        <div className="absolute top-0 bottom-0 w-[2px] bg-black" style={{ left: '30%' }} />
        <div className="absolute top-0 bottom-0 w-[2px] bg-black" style={{ left: '70%' }} />
      </div>

      {/* Zone labels */}
      <div className="flex justify-between mt-1 px-0.5 font-bold uppercase tracking-wider">
        <span className="text-[9px] text-green-600">Oversold 30</span>
        <span className="text-[9px] text-slate-500">Neutral</span>
        <span className="text-[9px] text-red-600">70 Overbought</span>
      </div>
    </div>
  );
};

export const TechnicalPanel: React.FC<TechnicalPanelProps> = ({
  toggles,
  onToggle,
  latestRsi,
  candles,
}) => {
  const latest = candles.length > 0 ? candles[candles.length - 1] : null;

  return (
    <div className="neo-card-flat bg-white p-4 animate-fade-in">
      {/* Title */}
      <p className="text-xs text-black uppercase tracking-wider font-black mb-3">
        📐 Technical Indicators
      </p>

      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2">
        {TOGGLES.map((t) => {
          const isOn = toggles[t.key];
          return (
            <button
              key={t.key}
              onClick={() => onToggle(t.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all border-[2px] border-black hover:-translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              style={{
                background: isOn ? t.activeBg : t.bg,
                color: t.color,
                boxShadow: isOn ? 'inset 2px 2px 0px 0px rgba(0,0,0,0.1)' : 'none',
              }}
              aria-pressed={isOn}
              aria-label={`Toggle ${t.label}`}
            >
              {/* Colour swatch dot */}
              <span
                className="w-2 h-2 rounded-full border border-black flex-shrink-0"
                style={{ background: isOn ? '#000' : '#fff' }}
              />
              {t.label}
              <span
                className="ml-0.5 text-[9px] font-black tracking-wider"
                style={{ color: isOn ? '#000' : '#6b7280' }}
              >
                {isOn ? 'ON' : 'OFF'}
              </span>
            </button>
          );
        })}
      </div>

      {/* RSI Meter — only when RSI toggle is ON and value available */}
      {toggles.rsi && latestRsi != null && <RsiMeter rsi={latestRsi} />}

      {/* Latest candle stats */}
      {latest && (
        <div
          className="mt-3 rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          {[
            { label: 'Open', value: latest.open },
            { label: 'High', value: latest.high },
            { label: 'Low', value: latest.low },
            { label: 'Close', value: latest.close },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 font-bold uppercase">{label}:</span>
              <span className="font-mono-num text-[11px] text-black font-black">
                ₹{value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Vol:</span>
            <span className="font-mono-num text-[11px] text-black font-black">
              {fmtVol(latest.volume)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
