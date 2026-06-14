import React from 'react';
import type { TradeSignal } from '../types';

interface Props {
  signal: TradeSignal;
}

export const TradeSignalPanel: React.FC<Props> = ({ signal }) => {
  const bgColors = {
    BUY: 'bg-neo-lime',
    SELL: 'bg-neo-pink',
    HOLD: 'bg-neo-yellow',
  };

  const actionBg = bgColors[signal.action] || 'bg-slate-200';

  return (
    <div className={`neo-card overflow-hidden animate-fade-in ${actionBg}`}>
      <div className="border-b-[3px] border-black p-3 bg-white flex items-center justify-between">
        <h3 className="font-black uppercase tracking-widest text-black text-sm">🔥 Trade Setup</h3>
        <span className={`px-3 py-1 font-black text-xs uppercase border-2 border-black ${actionBg} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}>
          {signal.action}
        </span>
      </div>
      
      <div className="p-4 grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Entry Price</div>
          <div className="font-black text-xl text-black">{signal.entryPrice}</div>
        </div>

        <div className="col-span-2 sm:col-span-1 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Stop Loss</div>
          <div className="font-black text-xl text-red-600">{signal.stopLoss}</div>
        </div>

        <div className="col-span-1 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Target 1</div>
          <div className="font-black text-lg text-green-600">{signal.target1}</div>
        </div>

        <div className="col-span-1 border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Target 2</div>
          <div className="font-black text-lg text-green-600">{signal.target2}</div>
        </div>
      </div>

      <div className="p-4 pt-0">
        <div className="border-2 border-black bg-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase font-bold text-slate-500">Risk / Reward</span>
            <span className="font-black text-sm bg-black text-white px-2 py-0.5">{signal.riskReward}</span>
          </div>
          <div className="w-full h-[2px] bg-black mb-2" />
          <p className="font-bold text-sm text-black leading-tight">
            {signal.catalyst}
          </p>
        </div>
      </div>
    </div>
  );
};
