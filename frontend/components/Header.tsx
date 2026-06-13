import React, { useState, useEffect, useCallback } from 'react';

type Page = 'home' | 'about';
type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE';

interface HeaderProps {
  currentPage: Page;
  setPage: (page: Page) => void;
  marketStatus: MarketStatus;
}

// ─── WingsIcon ────────────────────────────────────────────────────────────────

const WingsIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 40 40"
    className="h-9 w-9"
    fill="none"
  >
    {/* Left wing */}
    <path
      d="M20 32 C12 28, 4 22, 6 12 C10 16, 14 18, 20 20"
      stroke="#000"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#ff90e8"
    />
    {/* Right wing */}
    <path
      d="M20 32 C28 28, 36 22, 34 12 C30 16, 26 18, 20 20"
      stroke="#000"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="#ccff00"
    />
    {/* Body / arrow up */}
    <path
      d="M20 34 L20 16 M16 20 L20 16 L24 20"
      stroke="#000"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Market Status Computation ────────────────────────────────────────────────

/**
 * Computes NSE market status from current IST time.
 * NSE Regular session: Mon–Fri 09:15 – 15:30 IST
 * Pre-market: Mon–Fri 09:00 – 09:15 IST
 */
function computeMarketStatus(): { status: MarketStatus; istTime: string } {
  // IST = UTC+5:30
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600 * 1000;
  const ist = new Date(istMs);

  const day = ist.getDay(); // 0=Sun, 6=Sat
  const h = ist.getHours();
  const m = ist.getMinutes();
  const totalMin = h * 60 + m;

  // Format time as "10:32 AM IST"
  const hours12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  const mStr = m.toString().padStart(2, '0');
  const istTime = `${hours12}:${mStr} ${ampm} IST`;

  const isWeekday = day >= 1 && day <= 5;

  if (!isWeekday) {
    return { status: 'CLOSED', istTime };
  }

  // Pre-market: 9:00 – 9:15
  if (totalMin >= 540 && totalMin < 555) {
    return { status: 'PRE', istTime };
  }

  // Regular: 9:15 – 15:30
  if (totalMin >= 555 && totalMin < 930) {
    return { status: 'OPEN', istTime };
  }

  return { status: 'CLOSED', istTime };
}

// ─── Market Status Badge ──────────────────────────────────────────────────────

const MarketStatusBadge: React.FC<{ status: MarketStatus; istTime: string }> = ({
  status,
  istTime,
}) => {
  const cfg = {
    OPEN: {
      label: 'NSE OPEN',
      dotColor: '#000',
      textColor: '#000',
      bg: '#ccff00',
      border: '#000',
      pulse: false,
    },
    CLOSED: {
      label: 'MARKET CLOSED',
      dotColor: '#000',
      textColor: '#000',
      bg: '#ff90e8',
      border: '#000',
      pulse: false,
    },
    PRE: {
      label: 'PRE-MARKET',
      dotColor: '#000',
      textColor: '#000',
      bg: '#fde047',
      border: '#000',
      pulse: false,
    },
  }[status];

  return (
    <div
      className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {/* Dot */}
      <span className="relative flex h-2 w-2 flex-shrink-0">
        {cfg.pulse && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: cfg.dotColor }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ background: cfg.dotColor }}
        />
      </span>

      {/* Label */}
      <span className="text-xs font-bold tracking-wider" style={{ color: cfg.textColor }}>
        {cfg.label}
      </span>

      {/* Separator */}
      <span className="text-black font-bold text-xs">|</span>

      {/* IST Time */}
      <span className="font-mono-num font-bold text-xs text-black">{istTime}</span>
    </div>
  );
};

// ─── Header Component ─────────────────────────────────────────────────────────

export const Header: React.FC<HeaderProps> = ({ currentPage, setPage, marketStatus: externalStatus }) => {
  // We compute status internally and update every 60 seconds
  const [{ status, istTime }, setStatusState] = useState<{ status: MarketStatus; istTime: string }>(
    computeMarketStatus
  );

  useEffect(() => {
    const tick = () => setStatusState(computeMarketStatus());
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const navLinkClasses = useCallback(
    (page: Page) =>
      `px-3 py-1.5 rounded-lg text-sm font-bold uppercase transition-all ${
        currentPage === page
          ? 'tab-active'
          : 'text-slate-600 hover:text-black hover:bg-slate-100'
      }`,
    [currentPage]
  );

  return (
    <header
      className="sticky top-0 z-40 bg-white border-b-[3px] border-black"
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* ── Left: Logo + Title ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <WingsIcon />
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-black tracking-tight leading-none uppercase">
              MarketWings
            </h1>
            <p className="text-[10px] text-black font-bold tracking-[0.18em] uppercase mt-0.5">
              NSE · BSE · MCX Intelligence
            </p>
          </div>
        </div>

        {/* ── Centre: Market Status ──────────────────────────────────────── */}
        <div className="flex-1 flex justify-center">
          <MarketStatusBadge status={status} istTime={istTime} />
        </div>

        {/* ── Right: Nav Links ───────────────────────────────────────────── */}
        <nav className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setPage('home')}
            className={navLinkClasses('home')}
          >
            Analyzer
          </button>
          <button
            onClick={() => setPage('about')}
            className={navLinkClasses('about')}
          >
            About
          </button>
        </nav>
      </div>
    </header>
  );
};