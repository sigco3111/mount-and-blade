import React, { useState } from 'react';
import { CpuChipIcon } from './icons/CpuChipIcon';

interface TokenUsageDisplayProps {
  total: number;
  session: number;
  last: number;
}

const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ total, session, last }) => {
    const [isMinimized, setIsMinimized] = useState(true);

    return (
        <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg shadow-lg overflow-hidden">
            <button 
                className="p-4 w-full flex justify-between items-center"
                onClick={() => setIsMinimized(!isMinimized)}
                aria-expanded={!isMinimized}
            >
                <h3 className="text-lg font-semibold text-sky-300 flex items-center">
                    <CpuChipIcon className="w-5 h-5 mr-3" />
                    토큰 사용량
                </h3>
                <svg className={`w-5 h-5 text-slate-400 transition-transform ${isMinimized ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {!isMinimized && (
                <div className="px-6 pb-6 pt-2 space-y-3 text-sm animate-fade-in">
                    <div className="flex justify-between items-center">
                    <span className="text-slate-400">최근 사용량:</span>
                    <span className="font-bold text-white tabular-nums">{last.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                    <span className="text-slate-400">진행중 토큰:</span>
                    <span className="font-bold text-white tabular-nums">{session.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                    <span className="text-slate-400">누적 토큰:</span>
                    <span className="font-bold text-white tabular-nums">{total.toLocaleString()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TokenUsageDisplay;
