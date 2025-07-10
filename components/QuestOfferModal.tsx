import React from 'react';
import { Quest } from '../types';

interface QuestOfferModalProps {
  quest: Quest;
  onAccept: () => void;
  onDecline: () => void;
  isLoading: boolean;
}

const QuestOfferModal: React.FC<QuestOfferModalProps> = ({ quest, onAccept, onDecline, isLoading }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-600">
          <h3 className="text-xl font-bold text-amber-300">{quest.giver}의 제안</h3>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          <h4 className="text-2xl font-semibold text-white">{quest.title}</h4>
          <p className="text-slate-300 italic">"{quest.description}"</p>
          <div className="bg-slate-900/50 p-4 rounded-lg space-y-2">
            {quest.type === 'delivery' && (
                <p className="text-slate-300">
                    <span className="font-bold text-sky-400">목표:</span> {quest.targetItemId} {quest.targetItemQuantity}개를 {quest.targetLocationId}(으)로 배달
                </p>
            )}
            {quest.type === 'bounty' && (
                 <p className="text-slate-300">
                    <span className="font-bold text-sky-400">목표:</span> {quest.targetEnemyLocationHint} 근처의 {quest.targetEnemyName} 소탕
                </p>
            )}
             <p className="text-slate-300">
                <span className="font-bold text-amber-400">보상:</span> {quest.rewardGold} 골드, 명성 {quest.rewardRenown}
            </p>
          </div>
        </div>
        <div className="p-4 border-t border-slate-700 flex justify-end items-center space-x-4">
            {isLoading ? (
                 <div className="flex items-center justify-center text-amber-300">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    처리 중...
                </div>
            ) : (
                <>
                    <button onClick={onDecline} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded transition">
                        거절
                    </button>
                    <button onClick={onAccept} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition">
                        수락
                    </button>
                </>
            )}
        </div>
      </div>
    </div>
  );
};

export default QuestOfferModal;
