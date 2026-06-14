import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
  type LineSeriesOptions,
  type HistogramSeriesOptions,
  type CandlestickSeriesOptions,
} from 'lightweight-charts';
import type {
  Candle,
  TechnicalIndicators,
  IndicatorToggles,
  Timeframe,
} from '../types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface CandlestickChartProps {
  candles: Candle[];
  indicators: TechnicalIndicators;
  toggles: IndicatorToggles;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  ticker: string;
  isLoading: boolean;
  supportLevels?: number[];
  resistanceLevels?: number[];
}

export interface CandlestickChartHandle {
  getScreenshot: () => string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_BG = '#ffffff';
const GRID_LINE = '#e5e7eb';
const TEXT_COLOUR = '#000000';
const CANDLE_UP = '#10b981';
const CANDLE_DOWN = '#f43f5e';

const TIMEFRAMES: Timeframe[] = ['1H', '1D', '1W'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const toTime = (unixSeconds: number): Time =>
  unixSeconds as UTCTimestamp;

const buildCandleData = (candles: Candle[]) =>
  candles.map((c) => ({
    time: toTime(c.time),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));

const buildVolumeData = (candles: Candle[]) =>
  candles.map((c) => ({
    time: toTime(c.time),
    value: c.volume,
    color: c.close >= c.open ? `${CANDLE_UP}88` : `${CANDLE_DOWN}88`,
  }));

const buildLineData = (
  candles: Candle[],
  values: (number | null)[]
) =>
  candles
    .map((c, i) => {
      const v = values[i];
      if (v === null || v === undefined) return null;
      return { time: toTime(c.time), value: v };
    })
    .filter((x): x is { time: Time; value: number } => x !== null);

const formatUpdateTime = (timestamp: number): string => {
  if (!timestamp) return '';
  return new Date(timestamp * 1000).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// ── Loading overlay ───────────────────────────────────────────────────────────

const ChartSkeleton: React.FC = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 gap-4 border-t-4 border-black">
    <div className="flex items-end gap-1 h-16">
      {[40, 65, 35, 80, 55, 90, 45, 70, 30, 85, 50, 75].map((h, i) => (
        <div
          key={i}
          className="w-4 bg-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }}
        />
      ))}
    </div>
    <p className="text-black font-bold uppercase tracking-widest text-sm animate-pulse">
      Loading chart data…
    </p>
  </div>
);

// ── CandlestickChart ──────────────────────────────────────────────────────────

export const CandlestickChart = forwardRef<CandlestickChartHandle, CandlestickChartProps>(({
  candles,
  indicators,
  toggles,
  timeframe,
  onTimeframeChange,
  ticker,
  isLoading,
  supportLevels = [],
  resistanceLevels = [],
}, ref) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Series refs
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const sma20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema9Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);

  useImperativeHandle(ref, () => ({
    getScreenshot: () => {
      if (!chartRef.current) return null;
      return chartRef.current.takeScreenshot().toDataURL('image/png');
    }
  }));

  // Last candle timestamp for "updated" label
  const lastTime = candles.length > 0 ? candles[candles.length - 1].time : 0;

  // ── Chart initialisation ────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: TEXT_COLOUR,
      },
      grid: {
        vertLines: { color: GRID_LINE },
        horzLines: { color: GRID_LINE },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: GRID_LINE },
      timeScale: {
        borderColor: GRID_LINE,
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight || 380,
    });

    chartRef.current = chart;

    // ── Candlestick series ──────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor: CANDLE_UP,
      downColor: CANDLE_DOWN,
      wickUpColor: CANDLE_UP,
      wickDownColor: CANDLE_DOWN,
      borderVisible: false,
    } as Partial<CandlestickSeriesOptions>);
    candleSeriesRef.current = candleSeries;

    // ── Volume histogram (separate pane) ────────────────────────────────────
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    } as Partial<HistogramSeriesOptions>);
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // ── SMA 20 ──────────────────────────────────────────────────────────────
    const sma20 = chart.addLineSeries({
      color: '#0ea5e9',
      lineWidth: 1,
      title: 'SMA20',
      lastValueVisible: false,
      priceLineVisible: false,
    } as Partial<LineSeriesOptions>);
    sma20Ref.current = sma20;

    // ── SMA 50 ──────────────────────────────────────────────────────────────
    const sma50 = chart.addLineSeries({
      color: '#8b5cf6',
      lineWidth: 1,
      title: 'SMA50',
      lastValueVisible: false,
      priceLineVisible: false,
    } as Partial<LineSeriesOptions>);
    sma50Ref.current = sma50;

    // ── EMA 9 ───────────────────────────────────────────────────────────────
    const ema9 = chart.addLineSeries({
      color: '#f59e0b',
      lineWidth: 1,
      title: 'EMA9',
      lastValueVisible: false,
      priceLineVisible: false,
    } as Partial<LineSeriesOptions>);
    ema9Ref.current = ema9;

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    const bbUpper = chart.addLineSeries({
      color: '#64748b',
      lineWidth: 1,
      title: 'BB Upper',
      lastValueVisible: false,
      priceLineVisible: false,
    } as Partial<LineSeriesOptions>);
    bbUpperRef.current = bbUpper;

    const bbMiddle = chart.addLineSeries({
      color: '#64748b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'BB Mid',
      lastValueVisible: false,
      priceLineVisible: false,
    } as Partial<LineSeriesOptions>);
    bbMiddleRef.current = bbMiddle;

    const bbLower = chart.addLineSeries({
      color: '#64748b',
      lineWidth: 1,
      title: 'BB Lower',
      lastValueVisible: false,
      priceLineVisible: false,
    } as Partial<LineSeriesOptions>);
    bbLowerRef.current = bbLower;

    // ── ResizeObserver ───────────────────────────────────────────────────────
    const ro = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      chart.applyOptions({ 
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height
      });
      chart.timeScale().fitContent();
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []); // run once on mount

  // ── Data updates ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    // Candles
    candleSeriesRef.current?.setData(buildCandleData(candles));

    // Volume
    volumeSeriesRef.current?.setData(buildVolumeData(candles));

    // SMA 20
    sma20Ref.current?.setData(buildLineData(candles, indicators.sma20));

    // SMA 50
    sma50Ref.current?.setData(buildLineData(candles, indicators.sma50));

    // EMA 9
    ema9Ref.current?.setData(buildLineData(candles, indicators.ema9));

    // Bollinger Bands
    bbUpperRef.current?.setData(
      buildLineData(candles, indicators.bollingerBands.upper)
    );
    bbMiddleRef.current?.setData(
      buildLineData(candles, indicators.bollingerBands.middle)
    );
    bbLowerRef.current?.setData(
      buildLineData(candles, indicators.bollingerBands.lower)
    );

    // Fit content after new data
    chartRef.current.timeScale().fitContent();
  }, [candles, indicators]);

  // ── Support / Resistance lines ───────────────────────────────────────────────

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries) return;

    // Remove old price lines by recreating (lightweight-charts v4 doesn't have
    // a "removeAllPriceLines" so we track them via refs)
    // We'll use a dedicated effect — stored on the component via a ref list.
    const lines: ReturnType<typeof candleSeries.createPriceLine>[] = [];

    supportLevels.forEach((price) => {
      lines.push(
        candleSeries.createPriceLine({
          price,
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `S ${price}`,
        })
      );
    });

    resistanceLevels.forEach((price) => {
      lines.push(
        candleSeries.createPriceLine({
          price,
          color: '#f43f5e',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `R ${price}`,
        })
      );
    });

    return () => {
      lines.forEach((l) => candleSeries.removePriceLine(l));
    };
  }, [supportLevels, resistanceLevels]);

  // ── Toggle visibility ────────────────────────────────────────────────────────

  useEffect(() => {
    sma20Ref.current?.applyOptions({ visible: toggles.sma20 });
  }, [toggles.sma20]);

  useEffect(() => {
    sma50Ref.current?.applyOptions({ visible: toggles.sma50 });
  }, [toggles.sma50]);

  useEffect(() => {
    ema9Ref.current?.applyOptions({ visible: toggles.ema9 });
  }, [toggles.ema9]);

  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: toggles.bb });
    bbMiddleRef.current?.applyOptions({ visible: toggles.bb });
    bbLowerRef.current?.applyOptions({ visible: toggles.bb });
  }, [toggles.bb]);

  // ── Zoom Controls ────────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;
    const length = range.to - range.from;
    timeScale.setVisibleLogicalRange({
      from: range.from + length * 0.15,
      to: range.to - length * 0.15,
    });
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;
    const length = range.to - range.from;
    timeScale.setVisibleLogicalRange({
      from: range.from - length * 0.15,
      to: range.to + length * 0.15,
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().fitContent();
    chartRef.current.priceScale('right').applyOptions({ autoScale: true });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      chartContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div 
      ref={chartContainerRef}
      className={`chart-container bg-white overflow-hidden flex flex-col ${
        isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen rounded-none border-none' : 'neo-card-flat'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 pt-3 pb-2 border-b-[3px] border-black bg-neo-yellow gap-2 sm:gap-0">
        {/* Ticker label */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black text-black uppercase font-mono-num break-all">
            {ticker || '—'}
          </span>
          <span className="text-xs text-black font-bold uppercase whitespace-nowrap">Candlestick</span>
        </div>

        {/* Right: update time + timeframe tabs */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {/* Last update */}
          {lastTime > 0 && (
            <span className="text-[0.65rem] text-black font-bold hidden sm:inline uppercase">
              Updated {formatUpdateTime(lastTime)}
            </span>
          )}

          {/* Timeframe tabs */}
          <div className="flex items-center gap-1 bg-white border-[3px] border-black rounded-lg p-0.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframeChange(tf)}
                className={`px-3 py-1 text-xs font-semibold rounded-md border transition-all duration-150 ${
                  timeframe === tf
                    ? 'tab-active'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="text-black hover:bg-black hover:text-white bg-white rounded border-[3px] border-black transition-colors p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[2px]"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0l5-5M4 4v5m11-1V4m0 0l5 5M20 4h-5m-6 11l-5 5m0 0l5 5M4 20v-5m11-1h5m0 0l-5 5M20 20v-5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ── Indicator toggles legend ────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b-[3px] border-black flex-wrap bg-white">
        <LegendDot colour="#0ea5e9" label="SMA 20" visible={toggles.sma20} />
        <LegendDot colour="#8b5cf6" label="SMA 50" visible={toggles.sma50} />
        <LegendDot colour="#f59e0b" label="EMA 9" visible={toggles.ema9} />
        <LegendDot colour="#64748b" label="BB" visible={toggles.bb} />
        {supportLevels.length > 0 && (
          <LegendDot colour="#10b981" label="Support" visible />
        )}
        {resistanceLevels.length > 0 && (
          <LegendDot colour="#f43f5e" label="Resistance" visible />
        )}
      </div>

      {/* ── Chart area ─────────────────────────────────────────────────────── */}
      <div className="relative flex-1 flex">
        {/* lightweight-charts mount point */}
        <div ref={containerRef} className={`w-full relative ${isFullscreen ? 'h-full' : 'h-[380px]'}`} />

        {/* Zoom Controls Overlay */}
        <div className="absolute top-4 right-14 z-10 hidden sm:flex items-center gap-1 bg-white border-[3px] border-black p-1 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <button
            onClick={handleZoomIn}
            className="w-7 h-7 flex items-center justify-center text-black hover:bg-black hover:text-white transition-colors border-2 border-transparent hover:border-black"
            title="Zoom In"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <div className="w-[3px] h-4 bg-black" />
          <button
            onClick={handleZoomOut}
            className="w-7 h-7 flex items-center justify-center text-black hover:bg-black hover:text-white transition-colors border-2 border-transparent hover:border-black"
            title="Zoom Out"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
          <div className="w-[3px] h-4 bg-black" />
          <button
            onClick={handleResetZoom}
            className="w-7 h-7 flex items-center justify-center text-black hover:bg-black hover:text-white transition-colors border-2 border-transparent hover:border-black"
            title="Reset Zoom"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>

        {/* Loading overlay */}
        {isLoading && <ChartSkeleton />}
      </div>
    </div>
  );
});

// ── Legend dot sub-component ──────────────────────────────────────────────────

const LegendDot: React.FC<{
  colour: string;
  label: string;
  visible: boolean;
}> = ({ colour, label, visible }) => (
  <span
    className={`flex items-center gap-1 text-[0.65rem] font-medium transition-opacity ${
      visible ? 'opacity-100' : 'opacity-30'
    }`}
  >
    <span
      className="inline-block w-3 h-3 rounded-sm border-2 border-black"
      style={{ backgroundColor: colour }}
    />
    <span className="text-black font-bold uppercase">{label}</span>
  </span>
);

export default CandlestickChart;
