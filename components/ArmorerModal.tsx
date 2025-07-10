import React from 'react';
import { Player } from '../types';
import { ITEMS, ARMORER_STOCK } from '../constants';

interface ArmorerModalProps {
  player: Player;
  onClose: () => void;
  onBuyItem: (itemId: string) => void;
  isLoading: boolean;
}

const ArmorerModal: React.FC<ArmorerModalProps> = ({ player, onClose, onBuyItem, isLoading }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-600 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-amber-300">장비점</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">
          <p className="text-slate-400 mb-6 text-center">장비점 주인이 투박한 손으로 물건들을 가리킵니다. "둘러보시오. 꽤 쓸만한 물건들이오."</p>
          <div className="space-y-4">
            {ARMORER_STOCK.map(itemId => {
              const item = ITEMS[itemId];
              if (!item) return null;

              const canAfford = player.gold >= item.price;

              return (
                <div key={itemId} className="bg-slate-900/50 p-4 rounded-lg flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">{item.name}</h4>
                    <p className="text-sm text-slate-400">{item.description}</p>
                    <p className="text-sm text-sky-300 mt-1">
                      {Object.entries(item.effects).map(([key, value]) => `${key}: +${value}`).join(', ')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-amber-400 mb-2">{item.price} G</p>
                    <button
                      onClick={() => onBuyItem(itemId)}
                      disabled={isLoading || !canAfford}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm disabled:bg-slate-600 disabled:cursor-not-allowed transition"
                    >
                      구매
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArmorerModal;
