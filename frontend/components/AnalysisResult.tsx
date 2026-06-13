import React, { useEffect, useRef, useState } from 'react';
import type { AnalysisData, NewsSource, StockQuote, KeyIndicator } from '../types';

interface AnalysisResultProps {
  result: AnalysisData;
  sources: NewsSource[] | null;
  quote: StockQuote | null;
}

// ─── Confidence Ring ─────────────────────────────────────────────────────────

const ConfidenceRing: React.FC<{ confidence: number; color: string }> = ({ confidence, color }) => {
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, confidence));
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference * (1 - pct));
    }, 100);
    return () => clearTimeout(timer);
  }, [pct, circumference]);

  return (
    <div className="confidence-ring" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        {/* Track */}
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(51,65,85,0.6)" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ position: 'absolute' }}
      >
        <span className="font-mono-num text-lg font-bold text-black leading-none">
          {Math.round(pct * 100)}%
        </span>
        <span className="text-xs text-slate-600 mt-0.5 font-bold">conf.</span>
      </div>
    </div>
  );
};

// ─── Risk Badge ───────────────────────────────────────────────────────────────

const RiskBadge: React.FC<{ score: number }> = ({ score }) => {
  let color = '#000';
  let bg = '';
  if (score <= 3) { bg = '#bbf7d0'; } // green
  else if (score <= 6) { bg = '#fde047'; } // yellow
  else { bg = '#fecdd3'; } // pink

  return (
    <div
      className="flex flex-col items-center justify-center px-4 py-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      style={{ background: bg }}
    >
      <span className="text-xs text-black font-black mb-1 tracking-wider uppercase">Risk</span>
      <span className="font-mono-num text-2xl font-black text-black">
        {score}<span className="text-sm font-bold">/10</span>
      </span>
    </div>
  );
};

// ─── Recommendation banner colours ────────────────────────────────────────────

function getRecommendationConfig(rec: string) {
  switch (rec) {
    case 'Buy':
      return {
        label: 'BUY',
        icon: '↑',
        ringColor: '#000',
        bg: '#bbf7d0',
        border: '#000',
        textColor: '#000',
      };
    case 'Sell':
      return {
        label: 'SELL',
        icon: '↓',
        ringColor: '#000',
        bg: '#fecdd3',
        border: '#000',
        textColor: '#000',
      };
    default:
      return {
        label: 'HOLD',
        icon: '→',
        ringColor: '#000',
        bg: '#f3f4f6',
        border: '#000',
        textColor: '#000',
      };
  }
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

const Section: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = '',
}) => (
  <div
    className={`animate-fade-in ${className}`}
    style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
  >
    {children}
  </div>
);

// ─── Key Indicator Badge ──────────────────────────────────────────────────────

const KeyIndicatorBadge: React.FC<{ indicator: KeyIndicator }> = ({ indicator }) => {
  const statusConfig = {
    bullish: { icon: '↑', color: '#000', bg: '#bbf7d0', border: '#000' },
    bearish: { icon: '↓', color: '#000', bg: '#fecdd3', border: '#000' },
    neutral: { icon: '→', color: '#000', bg: '#f3f4f6', border: '#000' },
  };
  const cfg = statusConfig[indicator.status];

  return (
    <div
      title={indicator.value}
      className="rounded-lg p-3 flex flex-col gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      style={{ background: cfg.bg, border: `2px solid ${cfg.border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-black font-black uppercase truncate">{indicator.name}</span>
        <span className="text-base font-black leading-none ml-1" style={{ color: cfg.color }}>
          {cfg.icon}
        </span>
      </div>
      <span className="font-mono-num text-xs font-bold text-black truncate">{indicator.value}</span>
    </div>
  );
};

// ─── FnO Signal Badge ─────────────────────────────────────────────────────────

const FnoBadge: React.FC<{ signal: string }> = ({ signal }) => {
  const signalConfig: Record<string, { color: string; bg: string }> = {
    'Bullish Build-up': { color: '#000', bg: '#bbf7d0' },
    'Bearish Build-up': { color: '#000', bg: '#fecdd3' },
    'Short Covering': { color: '#000', bg: '#bfdbfe' },
    'Long Unwinding': { color: '#000', bg: '#fde047' },
    'Neutral': { color: '#000', bg: '#f3f4f6' },
  };
  const cfg = signalConfig[signal] || { color: '#000', bg: '#f3f4f6' };

  return (
    <span
      className="indicator-badge font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      style={{ color: cfg.color, background: cfg.bg, border: `2px solid ${cfg.color}` }}
    >
      {signal}
    </span>
  );
};

// ─── News Sentiment Badge ─────────────────────────────────────────────────────

const SentimentBadge: React.FC<{ sentiment: string }> = ({ sentiment }) => {
  const cfg =
    sentiment === 'Positive'
      ? { color: '#000', bg: '#bbf7d0', icon: '😊' }
      : sentiment === 'Negative'
      ? { color: '#000', bg: '#fecdd3', icon: '😟' }
      : { color: '#000', bg: '#f3f4f6', icon: '😐' };

  return (
    <span
      className="indicator-badge text-sm px-3 py-1 font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      style={{ color: cfg.color, background: cfg.bg, border: `2px solid ${cfg.color}` }}
    >
      {cfg.icon} {sentiment}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ result, sources, quote }) => {
  const recCfg = getRecommendationConfig(result.recommendation);

  const fmt = (n: number, currency = '₹') =>
    `${currency}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const currentPrice = quote?.price ?? null;

  // Range bar calculations
  const rangeMin = result.priceTarget.low;
  const rangeMax = result.priceTarget.high;
  const rangeSpan = rangeMax - rangeMin;
  const currentPctOnBar =
    currentPrice != null && rangeSpan > 0
      ? Math.min(100, Math.max(0, ((currentPrice - rangeMin) / rangeSpan) * 100))
      : null;

  return (
    <div className="animate-fade-in space-y-4 mt-6">
      {/* ── Row 1: Recommendation Banner ─────────────────────────────────── */}
      <Section delay={0}>
        <div
          className="rounded-2xl p-6 flex flex-col gap-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          style={{ background: recCfg.bg, border: `4px solid ${recCfg.border}` }}
        >
          {/* Top row: Recommendation, Confidence, Risk */}
          <div className="flex items-center justify-between gap-4">
            {/* Direction label */}
            <div className="flex flex-col items-center justify-center min-w-[100px] sm:min-w-[120px]">
              <span
                className="text-5xl sm:text-6xl font-black leading-none"
                style={{ color: recCfg.textColor }}
              >
                {recCfg.icon}
              </span>
              <span
                className="text-xl sm:text-3xl font-black tracking-widest mt-2"
                style={{ color: recCfg.textColor }}
              >
                {recCfg.label}
              </span>
              <span className="text-xs sm:text-sm text-black font-bold mt-1 uppercase">Recommendation</span>
            </div>

            {/* Confidence ring */}
            <div className="flex-1 flex justify-center scale-110 sm:scale-125 origin-center">
              <ConfidenceRing confidence={result.confidence} color={recCfg.ringColor} />
            </div>

            {/* Risk badge */}
            <div className="scale-110 sm:scale-125 origin-right">
              <RiskBadge score={result.riskScore} />
            </div>
          </div>

          {/* Bottom row: Trend and Pattern */}
          <div className="border-t-[4px] border-black pt-4">
            <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-black/70 mb-1">
              Observed Trend
            </h4>
            <p className="text-xl sm:text-2xl md:text-3xl font-black text-black leading-tight uppercase">
              {result.trend || 'Trend Analysis Pending'}
            </p>
            {result.pattern && (
              <div className="mt-3 inline-flex items-center gap-2 bg-white text-black font-bold text-xs sm:text-sm px-3 py-1.5 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
                <span>🔎</span> Pattern: {result.pattern}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── Row 2: Price Target Card ──────────────────────────────────────── */}
      <Section delay={80}>
        <div className="neo-card-flat bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-black uppercase tracking-wider font-black">
              🎯 Price Target Range
            </span>
            <span className="font-mono-num font-bold text-sm text-black">
              {fmt(rangeMin)} – {fmt(rangeMax)}
            </span>
          </div>
          {/* Range bar */}
          <div className="relative h-4 rounded-full overflow-visible border-2 border-black" style={{ background: '#f3f4f6' }}>
            <div
              className="h-full rounded-full border-r-2 border-black"
              style={{
                background: 'linear-gradient(90deg, #bbf7d0, #fde047)',
                width: '100%',
              }}
            />
            {currentPctOnBar != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[3px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                style={{
                  left: `calc(${currentPctOnBar}% - 10px)`,
                  background: '#fff',
                }}
                title={`Current: ${fmt(currentPrice!)}`}
              />
            )}
          </div>
          <div className="flex justify-between mt-3 text-xs text-black font-bold font-mono-num">
            <span>{fmt(rangeMin)}</span>
            {currentPrice != null && (
              <span>
                Current: <span className="font-mono-num text-black font-black">{fmt(currentPrice)}</span>
              </span>
            )}
            <span>{fmt(rangeMax)}</span>
          </div>
        </div>
      </Section>

      {/* ── Row 3: Support & Resistance ───────────────────────────────────── */}
      <Section delay={160}>
        <div className="grid grid-cols-2 gap-3">
          {/* Support */}
          <div className="neo-card-flat bg-white p-4">
            <p className="text-xs text-black uppercase tracking-wider mb-2 font-black">
              🟢 Support Levels
            </p>
            <div className="flex flex-wrap gap-2">
              {result.supportLevels.map((lvl, i) => (
                <span
                  key={i}
                  className="font-mono-num text-sm px-2 py-1 rounded-lg font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black"
                  style={{ background: '#bbf7d0', color: '#000' }}
                >
                  {fmt(lvl)}
                </span>
              ))}
            </div>
          </div>
          {/* Resistance */}
          <div className="neo-card-flat bg-white p-4">
            <p className="text-xs text-black uppercase tracking-wider mb-2 font-black">
              🔴 Resistance Levels
            </p>
            <div className="flex flex-wrap gap-2">
              {result.resistanceLevels.map((lvl, i) => (
                <span
                  key={i}
                  className="font-mono-num text-sm px-2 py-1 rounded-lg font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black"
                  style={{ background: '#fecdd3', color: '#000' }}
                >
                  {fmt(lvl)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Row 4: Pattern + News Sentiment ──────────────────────────────── */}
      <Section delay={240}>
        <div className="grid grid-cols-2 gap-3">
          {/* Pattern */}
          <div className="neo-card-flat bg-white p-4 flex flex-col gap-2">
            <span className="text-xs text-black uppercase tracking-wider font-black">
              📊 Chart Pattern
            </span>
            <div className="flex items-center gap-2 mt-1">
              <svg className="w-5 h-5 text-black flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span className="text-sm text-black font-bold">{result.pattern}</span>
            </div>
          </div>
          {/* News Sentiment */}
          <div className="neo-card-flat bg-white p-4 flex flex-col gap-2">
            <span className="text-xs text-black uppercase tracking-wider font-black">
              📰 News Sentiment
            </span>
            <div className="mt-1">
              <SentimentBadge sentiment={result.newsSentiment} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Row 5: Key Indicators ─────────────────────────────────────────── */}
      {result.keyIndicators.length > 0 && (
        <Section delay={320}>
          <div className="neo-card-flat bg-white p-4">
            <p className="text-xs text-black uppercase tracking-wider mb-3 font-black">
              📈 Key Indicators
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {result.keyIndicators.map((ind, i) => (
                <KeyIndicatorBadge key={i} indicator={ind} />
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── Row 6: Technical Analysis Summary ────────────────────────────── */}
      <Section delay={400}>
        <div className="neo-card-flat bg-white p-4 border-l-[6px] border-l-black">
          <p className="text-xs text-black uppercase tracking-wider mb-3 font-black">
            🧠 NeoQuant AI Summary
          </p>
          <ul className="space-y-2">
            {Array.isArray(result.summary) ? result.summary.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-black font-medium leading-relaxed">
                <span className="text-black flex-shrink-0 mt-0.5 font-bold">•</span>
                <span>{point}</span>
              </li>
            )) : (
              <p className="text-sm text-black font-medium leading-relaxed">{result.summary}</p>
            )}
          </ul>
        </div>
      </Section>

      {/* ── Row 6.5: Interesting Facts ───────────────────────────────────── */}
      {result.interestingFacts && result.interestingFacts.length > 0 && (
        <Section delay={440}>
          <div className="neo-card-flat p-4 bg-[#ffeb3b]">
            <p className="text-xs text-black uppercase tracking-wider mb-3 font-black">
              💡 Interesting Facts
            </p>
            <ul className="space-y-2">
              {result.interestingFacts.map((fact, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-black font-bold">
                  <span className="text-black flex-shrink-0 mt-0.5">✧</span>
                  <span className="leading-relaxed">{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ── Row 7: F&O Signal ─────────────────────────────────────────────── */}
      {result.fnoSignal && (
        <Section delay={480}>
          <div
            className="neo-card-flat bg-white p-4"
          >
            <p className="text-xs text-black uppercase tracking-wider mb-3 font-black">
              📉 F&O Signal
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <FnoBadge signal={result.fnoSignal.openInterestSignal} />
              <span className="text-xs text-black font-bold">{result.fnoSignal.pcrIndication}</span>
            </div>
            {result.fnoSignal.note && (
              <p className="text-xs text-slate-600 italic border-t-[2px] border-black pt-2 mt-2 font-medium">
                {result.fnoSignal.note}
              </p>
            )}
          </div>
        </Section>
      )}

      {/* ── Row 8: MCX Panel ──────────────────────────────────────────────── */}
      {result.mcxPanel && (
        <Section delay={560}>
          <div
            className="neo-card-flat bg-neo-orange p-4"
          >
            <p className="text-xs uppercase tracking-wider mb-3 font-black text-black">
              🏅 MCX Commodity Panel
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] text-slate-600 font-bold uppercase mb-0.5">Commodity</p>
                <p className="text-sm text-black font-black">{result.mcxPanel.commodity}</p>
              </div>
              <div className="bg-white p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] text-slate-600 font-bold uppercase mb-0.5">Int'l Reference</p>
                <p className="text-sm text-black font-mono-num font-bold">{result.mcxPanel.internationalRef}</p>
              </div>
              <div className="bg-white p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] text-slate-600 font-bold uppercase mb-0.5">INR/USD Impact</p>
                <p className="text-sm text-black font-bold">{result.mcxPanel.inrUsdImpact}</p>
              </div>
              <div className="bg-white p-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <p className="text-[10px] text-slate-600 font-bold uppercase mb-0.5">Seasonal Factor</p>
                <p className="text-sm text-black font-bold">{result.mcxPanel.seasonalFactor}</p>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Row 9: News Summary ───────────────────────────────────────────── */}
      {result.newsSummary.length > 0 && (
        <Section delay={640}>
          <div className="neo-card-flat bg-white p-4">
            <p className="text-xs text-black uppercase tracking-wider mb-3 font-black">
              📋 News Summary
            </p>
            <ul className="space-y-2">
              {result.newsSummary.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-black font-medium">
                  <span className="text-black font-bold mt-0.5 flex-shrink-0">›</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* ── Row 10: News Sources ──────────────────────────────────────────── */}
      {sources && sources.length > 0 && (
        <Section delay={720}>
          <div className="neo-card-flat bg-white p-4">
            <p className="text-xs text-black uppercase tracking-wider mb-3 font-black">
              🔗 Sources
            </p>
            <div className="space-y-2">
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-black font-bold hover:text-neo-blue transition-colors group"
                >
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span className="truncate hover:underline">{src.title || src.uri}</span>
                </a>
              ))}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
};