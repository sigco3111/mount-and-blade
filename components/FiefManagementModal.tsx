import React, { useState, useMemo } from 'react';
import { Player, Location } from '../types';
import { UNITS } from '../constants';
import { GoldIcon } from './icons/GoldIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { ArrowLeftRightIcon } from './icons/ArrowLeftRightIcon';

interface FiefManagementModalProps {
  player: Player;
  location: Location;
  onClose: () => void;
  onCollectTaxes: (locationId: string) => void;
  onManageGarrison: (locationId: string, unitId: string, quantity: number, direction: 'to' | 'from') => void;
  isLoading: boolean;
}

const FiefManagementModal: React.FC<FiefManagementModalProps> = ({ player, location, onClose, onCollectTaxes, onManageGarrison, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'taxes' | 'garrison'>('taxes');
  const [transferAmounts, setTransferAmounts] = useState<Record<string, string>>({});

  const allUnitIds = useMemo(() => {
    const unitSet = new Set<string>([
      ...Object.keys(player.army),
      ...Object.keys(location.garrison)
    ]);
    return Array.from(unitSet).sort((a,b) => (UNITS[a]?.name || a).localeCompare(UNITS[b]?.name || b));
  }, [player.army, location.garrison]);

  const handleTransfer = (unitId: string, direction: 'to' | 'from') => {
    const quantity = parseInt(transferAmounts[unitId] || '0', 10);
    if (quantity > 0) {
      onManageGarrison(location.id, unitId, quantity, direction);
      setTransferAmounts(prev => ({...prev, [unitId]: '0'}));
    }
  };
  
  const handleAmountChange = (unitId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (value === '' || (numValue >= 0)) {
       setTransferAmounts(prev => ({...prev, [unitId]: value}));
    }
  };

  const renderTaxesTab = () => (
    <div className="text-center p-8">
      <h4 className="text-lg font-semibold text-sky-300 mb-2">누적된 세금</h4>
      <div className="flex items-center justify-center space-x-2 text-4xl font-bold text-amber-300 mb-6">
        <GoldIcon className="w-8 h-8"/>
        <span>{location.accumulatedTaxes}</span>
      </div>
      <button
        onClick={() => onCollectTaxes(location.id)}
        disabled={isLoading || location.accumulatedTaxes <= 0}
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200"
      >
        세금 징수
      </button>
      <p className="text-sm text-slate-500 mt-4">세금은 매일 자동으로 축적됩니다.</p>
    </div>
  );

  const renderGarrisonTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-11 gap-x-2 text-sm text-slate-400 font-bold px-4 py-2 border-b border-slate-700 bg-slate-900/50 sticky top-0">
        <div className="col-span-3">병종</div>
        <div className="col-span-2 text-center">부대</div>
        <div className="col-span-4 text-center">이동 수량</div>
        <div className="col-span-2 text-center">주둔군</div>
      </div>
      {allUnitIds.length > 0 ? (
        allUnitIds.map(unitId => {
          const unit = UNITS[unitId];
          if (!unit) return null;
          const player_count = player.army[unitId] || 0;
          const garrison_count = location.garrison[unitId] || 0;
          
          return (
            <div key={unitId} className="grid grid-cols-11 gap-x-2 items-center px-4">
              <div className="col-span-3 font-semibold text-white">{unit.name}</div>
              <div className="col-span-2 text-center text-lg text-amber-300">{player_count}</div>
              <div className="col-span-4 flex items-center justify-center gap-x-2">
                 <button onClick={() => handleTransfer(unitId, 'from')} disabled={isLoading || (parseInt(transferAmounts[unitId] || '0', 10) > garrison_count)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-1 px-3 rounded disabled:bg-slate-600">&lt;</button>
                 <input
                    type="number"
                    min="0"
                    value={transferAmounts[unitId] || ''}
                    onChange={(e) => handleAmountChange(unitId, e.target.value)}
                    placeholder="수량"
                    className="w-20 bg-slate-900 border border-slate-600 rounded-md py-1 text-center text-white"
                 />
                 <button onClick={() => handleTransfer(unitId, 'to')} disabled={isLoading || (parseInt(transferAmounts[unitId] || '0', 10) > player_count)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-1 px-3 rounded disabled:bg-slate-600">&gt;</button>
              </div>
              <div className="col-span-2 text-center text-lg text-amber-300">{garrison_count}</div>
            </div>
          )
        })
      ) : (
        <p className="text-center text-slate-500 p-4">관리할 병력이 없습니다.</p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-600 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-amber-300">영지 관리: {location.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
        </div>
        <div className="border-b border-slate-700 flex-shrink-0">
          <button
            onClick={() => setActiveTab('taxes')}
            className={`px-4 py-3 font-semibold transition-colors ${activeTab === 'taxes' ? 'text-amber-300 border-b-2 border-amber-300 bg-slate-700/50' : 'text-slate-400 hover:bg-slate-700/30'}`}
          >
            세금
          </button>
          <button
            onClick={() => setActiveTab('garrison')}
            className={`px-4 py-3 font-semibold transition-colors ${activeTab === 'garrison' ? 'text-amber-300 border-b-2 border-amber-300 bg-slate-700/50' : 'text-slate-400 hover:bg-slate-700/30'}`}
          >
            주둔군
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {activeTab === 'taxes' && renderTaxesTab()}
          {activeTab === 'garrison' && renderGarrisonTab()}
        </div>
      </div>
    </div>
  );
};

export default FiefManagementModal;
