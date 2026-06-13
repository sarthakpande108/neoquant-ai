import React, { useState, useEffect, useCallback } from 'react';

interface SectorHeatmapProps {
  onSectorClick: (symbol: string) => void;
}

interface SectorCell {
  name: string;
  change: number;
  topTicker: string;
  topSymbol: string;     // symbol to load when clicked
  indexSymbol: string;   // Yahoo Finance symbol for this sector index
  isLoading: boolean;
  error: boolean;
}

// Real NSE sector indices from Yahoo Finance + top stock to drill into
const SECTORS: {
  name: string;
  indexSymbol: string;
  topTicker: string;
  topSymbol: string;
}[] = [
  { name: 'Banking',        indexSymbol: '^NSEBANK',    topTicker: 'HDFCBANK',  topSymbol: 'HDFCBANK.NS'  },
  { name: 'IT',             indexSymbol: '^CNXIT',      topTicker: 'TCS',       topSymbol: 'TCS.NS'       },
  { name: 'Energy',         indexSymbol: '^CNXENERGY',  topTicker: 'RELIANCE',  topSymbol: 'RELIANCE.NS'  },
  { name: 'Metal',          indexSymbol: '^CNXMETAL',   topTicker: 'TATASTEEL', topSymbol: 'TATASTEEL.NS' },
  { name: 'Pharma',         indexSymbol: '^CNXPHARMA',  topTicker: 'SUNPHARMA', topSymbol: 'SUNPHARMA.NS' },
  { name: 'Auto',           indexSymbol: '^CNXAUTO',    topTicker: 'MARUTI',    topSymbol: 'MARUTI.NS'    },
  { name: 'FMCG',           indexSymbol: '^CNXFMCG',    topTicker: 'HINDUNILVR',topSymbol: 'HINDUNILVR.NS'},
  { name: 'Infra',          indexSymbol: '^CNXINFRA',   topTicker: 'L&T',       topSymbol: 'LT.NS'        },
  { name: 'Consumer',       indexSymbol: '^CNXCONSUM',  topTicker: 'TITAN',     topSymbol: 'TITAN.NS'     },
  { name: 'NBFC',           indexSymbol: 'BAJFINANCE.NS', topTicker: 'BAJFINANCE', topSymbol: 'BAJFINANCE.NS'},
];

function getSectorColor(change: number): { bg: string; text: string; border: string } {
  if (change <= -2.5) return { bg: '#f43f5e', text: '#fff', border: '#000' }; // solid red
  if (change <= -1.5) return { bg: '#fb7185', text: '#000', border: '#000' };
  if (change <= -0.3) return { bg: '#fecdd3', text: '#000', border: '#000' };
  if (change <   0.3) return { bg: '#e5e7eb', text: '#000', border: '#000' }; // gray
  if (change <   1.5) return { bg: '#bbf7d0', text: '#000', border: '#000' };
  if (change <   2.5) return { bg: '#4ade80', text: '#000', border: '#000' };
  return               { bg: '#22c55e', text: '#fff', border: '#000' }; // solid green
}

async function fetchSectorChange(symbol: string): Promise<number> {
  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d&includePrePost=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('No meta');
  const price = meta.regularMarketPrice as number;
  const prevClose = (meta.previousClose ?? meta.regularMarketPreviousClose ?? meta.chartPreviousClose) as number;
  if (!prevClose || prevClose === 0) throw new Error('No prevClose');
  return ((price - prevClose) / prevClose) * 100;
}

const RefreshIcon: React.FC<{ spinning: boolean }> = ({ spinning }) => (
  <svg
    className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export const SectorHeatmap: React.FC<SectorHeatmapProps> = ({ onSectorClick }) => {
  const [cells, setCells] = useState<SectorCell[]>(() =>
    SECTORS.map(s => ({
      name: s.name,
      change: 0,
      topTicker: s.topTicker,
      topSymbol: s.topSymbol,
      indexSymbol: s.indexSymbol,
      isLoading: true,
      error: false,
    }))
  );
  const [spinning, setSpinning] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadSectorData = useCallback(async () => {
    setSpinning(true);
    // Reset to loading state
    setCells(prev => prev.map(c => ({ ...c, isLoading: true, error: false })));

    // Fetch each sector sequentially to avoid rate limiting
    for (let i = 0; i < SECTORS.length; i++) {
      const sector = SECTORS[i];
      try {
        const change = await fetchSectorChange(sector.indexSymbol);
        setCells(prev =>
          prev.map(c =>
            c.name === sector.name
              ? { ...c, change: parseFloat(change.toFixed(2)), isLoading: false, error: false }
              : c
          )
        );
      } catch {
        setCells(prev =>
          prev.map(c =>
            c.name === sector.name
              ? { ...c, change: 0, isLoading: false, error: true }
              : c
          )
        );
      }
      // Small delay between requests
      if (i < SECTORS.length - 1) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // Record last updated time in IST
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
    const hh = ist.getHours().toString().padStart(2, '0');
    const mm = ist.getMinutes().toString().padStart(2, '0');
    setLastUpdated(`${hh}:${mm} IST`);
    setSpinning(false);
  }, []);

  // Load on mount
  useEffect(() => {
    loadSectorData();
  }, [loadSectorData]);

  return (
    <div className="neo-card-flat bg-white p-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-black text-black uppercase">🗺 Market Sectors</h3>
          <p className="text-xs font-bold text-slate-500 mt-0.5">
            {lastUpdated ? `Live NSE data · ${lastUpdated}` : 'Loading NSE sector indices...'}
          </p>
        </div>
        <button
          onClick={loadSectorData}
          disabled={spinning}
          className="flex items-center gap-1.5 text-xs font-black text-black bg-white hover:bg-neo-yellow transition-colors px-2 py-1 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px] disabled:opacity-50"
          title="Refresh sector data"
        >
          <RefreshIcon spinning={spinning} />
          <span>REFRESH</span>
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {cells.map((cell) => {
          const cfg = getSectorColor(cell.change);
          const isPositive = cell.change >= 0;

          return (
            <div
              key={cell.name}
              className="heatmap-cell rounded p-1.5 flex flex-col gap-0.5 select-none cursor-pointer border-[2px] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform overflow-hidden"
              style={{ background: cfg.bg }}
              onClick={() => !cell.isLoading && onSectorClick(cell.topSymbol)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && !cell.isLoading && onSectorClick(cell.topSymbol)}
              aria-label={`${cell.name}: ${cell.change >= 0 ? '+' : ''}${cell.change}%`}
            >
              <span className="text-[11px] font-black uppercase text-black truncate leading-tight" style={{ color: cfg.text }}>
                {cell.name}
              </span>

              {cell.isLoading ? (
                <span className="w-12 h-4 bg-black/20 rounded mt-0.5 animate-pulse" />
              ) : cell.error ? (
                <span className="font-mono-num font-black text-xs" style={{ color: cfg.text }}>N/A</span>
              ) : (
                <span
                  className="font-mono-num text-xs font-black leading-none truncate"
                  style={{ color: cfg.text }}
                >
                  {isPositive ? '+' : ''}{cell.change.toFixed(2)}%
                </span>
              )}

              <span className="text-[10px] font-bold truncate opacity-80" style={{ color: cfg.text }}>{cell.topTicker}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t-[3px] border-black">
        <div className="flex items-center gap-1 font-bold">
          <span className="w-3 h-3 border-2 border-black inline-block" style={{ background: '#f43f5e' }} />
          <span className="text-[10px] text-black uppercase">Strong Sell</span>
        </div>
        <div className="flex items-center gap-1 font-bold">
          <span className="w-3 h-3 border-2 border-black inline-block" style={{ background: '#e5e7eb' }} />
          <span className="text-[10px] text-black uppercase">Neutral</span>
        </div>
        <div className="flex items-center gap-1 font-bold">
          <span className="w-3 h-3 border-2 border-black inline-block" style={{ background: '#22c55e' }} />
          <span className="text-[10px] text-black uppercase">Strong Buy</span>
        </div>
      </div>
    </div>
  );
};
