import React from 'react';

const ProfileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 inline-block" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
);

const BriefcaseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 inline-block" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 2a2 2 0 00-2 2v1H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2V4a2 2 0 00-2-2zm-2 4V4h4v2H8z" clipRule="evenodd" />
    </svg>
);

export const AboutPage: React.FC = () => {
  return (
    <div className="animate-fade-in text-black space-y-8 max-w-4xl mx-auto pb-12 mt-6">
      <div className="text-center mb-10">
        <h2 className="text-4xl md:text-5xl font-black text-black inline-block px-6 py-2 bg-sky-200 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transform -rotate-2">
          ABOUT ME
        </h2>
      </div>
      
      <div className="bg-[#bbf7d0] p-6 md:p-8 rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all">
        <h3 className="font-black text-2xl uppercase text-black flex items-center mb-4 border-b-4 border-black pb-4">
          <ProfileIcon />
          AI Developer & Financial Analyst
        </h3>
        <p className="leading-relaxed text-lg font-medium text-slate-900">
          I am <strong className="font-black text-black">Sarthak Pande</strong>, an AI/GenAI developer with four years of experience building innovative AI-powered products. My expertise lies at the intersection of artificial intelligence and finance, a space where I am passionate about creating tools that provide actionable insights from complex data.
        </p>
      </div>

      <div className="bg-[#bfdbfe] p-6 md:p-8 rounded-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all">
        <h3 className="font-black text-2xl uppercase text-black flex items-center mb-4 border-b-4 border-black pb-4">
            <BriefcaseIcon />
            Professional Experience
        </h3>
        <p className="leading-relaxed text-lg font-medium text-slate-900">
          Alongside my development work, I serve as a sub-broker with <strong className="font-black text-black underline decoration-4 decoration-sky-400">Choice International</strong>. In this role, I have successfully managed client portfolios, leveraging data-driven insights and technical analysis to inform investment strategies. My mission is to build intelligent applications like MarketWings to empower investors and traders to make smarter, more informed financial decisions.
        </p>
      </div>

      <div className="text-center mt-12">
        <div className="inline-block bg-[#fde047] px-6 py-3 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-black text-lg text-black uppercase">
            Thank you for using MarketWings! Happy Trading! 🚀
          </p>
        </div>
      </div>
    </div>
  );
};