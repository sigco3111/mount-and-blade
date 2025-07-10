import React from 'react';
import { Player, Location } from '../types';
import { ENTERPRISE_TYPES, TRADE_GOODS } from '../constants';

interface EnterpriseModalProps {
  player: Player;
  location: Location;
  onClose: () => void;
  onBuyEnterprise: (typeId: string) => void;
  isLoading: boolean;
}

const EnterpriseModal: React.FC<EnterpriseModalProps> = ({ player, location, onClose, onBuyEnterprise, isLoading }) => {
  const ownedEnterpriseInLocation = player.enterprises.find(e => e.locationId === location.id);
  
  const calculateEstimatedProfit = (typeId: string) => {
      const type = ENTERPRISE_TYPES[typeId];
      if (!type) return 0;
      
      const marketGood = location.market.find(g => g.goodId === type.outputGoodId);
      const priceMultiplier = marketGood ? marketGood.priceMultiplier : 1.0;
      return Math.round(type.baseWeeklyProfit * priceMultiplier);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-600 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-amber-300">사업장 관리: {location.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {ownedEnterpriseInLocation ? (
            <div>
                <h4 className="text-lg font-semibold text-white mb-2">소유 중인 사업장</h4>
                <div className="bg-slate-900/50 p-4 rounded-lg">
                    <p className="text-xl text-amber-300">{ENTERPRISE_TYPES[ownedEnterpriseInLocation.typeId].name}</p>
                    <p className="text-slate-300 mt-2">
                        예상 주간 수입: 
                        <span className="font-bold text-green-400 ml-2">
                            {calculateEstimatedProfit(ownedEnterpriseInLocation.typeId)} G
                        </span>
                    </p>
                    <p className="text-sm text-slate-500 mt-4">한 도시에는 하나의 사업장만 소유할 수 있습니다.</p>
                </div>
            </div>
          ) : (
            <div>
              <p className="text-slate-400 mb-6 text-center">도시의 길드장과 대화하여 사업장을 건설할 수 있습니다. "수익성은 도시의 시장 상황에 따라 달라집니다."</p>
              <div className="space-y-4">
                {Object.values(ENTERPRISE_TYPES).map(type => {
                  const canAfford = player.gold >= type.cost;
                  const estimatedProfit = calculateEstimatedProfit(type.id);
                  const goodName = TRADE_GOODS[type.outputGoodId]?.name || '알 수 없는 상품';

                  return (
                    <div key={type.id} className="bg-slate-900/50 p-4 rounded-lg flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{type.name}</h4>
                        <p className="text-sm text-slate-400">생산품: {goodName}</p>
                        <p className="text-sm text-green-400 mt-1">
                          예상 주간 수입: ~{estimatedProfit} G
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-amber-400 mb-2">{type.cost} G</p>
                        <button
                          onClick={() => onBuyEnterprise(type.id)}
                          disabled={isLoading || !canAfford}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm disabled:bg-slate-600 disabled:cursor-not-allowed transition"
                        >
                          건설
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnterpriseModal;
