import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-10 h-10 border-4 border-slate-600 border-t-sky-500 rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-400 font-semibold">Analyzing chart and fetching news...</p>
      <p className="text-xs text-slate-500">This may take a moment.</p>
    </div>
  );
};