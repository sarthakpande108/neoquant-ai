import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="text-center p-4 mt-8 text-xs text-slate-500">
      <p>
        AI analysis powered by LLM. This is not financial advice. Always conduct your own research.
      </p>
      <p className="mt-1">
        Developed by MarketWings | <a href="mailto:marketwings23@gmail.com" className="hover:text-sky-400 transition-colors">marketwings23@gmail.com</a>
      </p>
    </footer>
  );
};