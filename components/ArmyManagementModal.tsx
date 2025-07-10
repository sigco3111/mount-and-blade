import React, { useMemo } from 'react';
import { Player } from '../types';
import { UNITS, ITEMS, COMPANIONS } from '../constants';

interface ArmyManagementModalProps {
  player: Player;
  onClose: () => void;
  onUpgradeUnits: (fromUnitId: string, toUnitId: string, quantity: number) => void;
  isLoading: boolean;
  currentLocationId: string;
  effectiveTrainerSkill: number;
}

const UpgradeTooltip = ({ lines }: { lines: string[] }) => {
  if (lines.length === 0) return null;
  return (
    <div className="absolute bottom-full mb-2 w-max max-w-xs bg-slate-900 text-white text-xs rounded py-1 px-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      {lines.map((line, i) => <div key={i}>{line}</div>)}
    </div>
  );
};


const UnitNode = ({ 
  unitId, 
  player, 
  onUpgradeUnits, 
  isLoading, 
  upgradeTree,
  isLast,
  currentLocationId,
  effectiveTrainerSkill
} : {
  unitId: string;
  player: Player;
  onUpgradeUnits: (fromUnitId: string, toUnitId: string, quantity: number) => void;
  isLoading: boolean;
  upgradeTree: Record<string, string[]>;
  isLast: boolean;
  currentLocationId: string;
  effectiveTrainerSkill: number;
}) => {
  const unit = UNITS[unitId];
  if (!unit) return null;

  const unitCount = player.army[unitId] || 0;
  const woundedCount = player.woundedArmy[unitId] || 0;
  const precursorUnitId = unit.upgradeFrom;

  const { maxUpgrades, canUpgradeAny, tooltipLines } = useMemo(() => {
    const lines: string[] = [];
    if (!precursorUnitId) {
      return { maxUpgrades: 0, canUpgradeAny: false, tooltipLines: ["기본 유닛입니다."] };
    }
    const precursor = UNITS[precursorUnitId];
    if (!precursor) {
      return { maxUpgrades: 0, canUpgradeAny: false, tooltipLines: ["필요한 하위 병종 정보가 없습니다."] };
    }

    const discount = 1 - (effectiveTrainerSkill * 0.05);
    const cost = Math.round((unit.upgradeCost || 0) * discount);
    const experienceToUpgrade = unit.xpToUpgrade || 99999;
    const precursorUnitCount = player.army[precursorUnitId] || 0;
    const currentExperience = player.unitExperience[precursorUnitId] || 0;

    lines.push(`훈련 대상: ${precursor.name}`);
    lines.push(`비용: ${cost}G (기본 ${unit.upgradeCost || 0}G)`);
    lines.push(`필요 XP: ${experienceToUpgrade}`);
    lines.push(`---`);
    lines.push(`공격: ${precursor.attack} -> ${unit.attack} (${unit.attack - precursor.attack >= 0 ? '+' : ''}${unit.attack - precursor.attack})`);
    lines.push(`방어: ${precursor.defense} -> ${unit.defense} (${unit.defense - precursor.defense >= 0 ? '+' : ''}${unit.defense - precursor.defense})`);
    lines.push(`---`);


    let errors: string[] = [];
    if (precursorUnitCount <= 0) errors.push(`- 훈련시킬 ${precursor.name}이(가) 없습니다.`);
    if (player.gold < cost) errors.push(`- 골드가 부족합니다. (${player.gold}/${cost})`);
    if (currentExperience < experienceToUpgrade) errors.push(`- 경험이 부족합니다. (${Math.floor(currentExperience)}/${experienceToUpgrade})`);
    
    if (unit.upgradeRequiresLocation && !unit.upgradeRequiresLocation.includes(currentLocationId)) {
      errors.push(`- 훈련 장소: ${unit.upgradeRequiresLocation.join(', ')} 에서만 가능`);
    }
    if (unit.upgradeRequiresCompanion) {
      const missingCompanions = unit.upgradeRequiresCompanion.filter(c => !player.companions.includes(c));
      if (missingCompanions.length > 0) {
        errors.push(`- 필요 동료: ${missingCompanions.map(cId => COMPANIONS[cId]?.name).join(', ')}`);
      }
    }
    if (unit.upgradeRequiresItems) {
      Object.entries(unit.upgradeRequiresItems).forEach(([itemId, qty]) => {
        if ((player.inventory[itemId] || 0) < qty) {
          errors.push(`- 필요 장비: ${ITEMS[itemId]?.name} ${qty}개`);
        }
      });
    }

    if (errors.length > 0) {
      lines.push(...errors);
      return { maxUpgrades: 0, canUpgradeAny: false, tooltipLines: lines };
    }
    
    const maxFromTroops = precursorUnitCount;
    const maxFromGold = cost > 0 ? Math.floor(player.gold / cost) : Infinity;
    const maxFromXp = experienceToUpgrade > 0 ? Math.floor(currentExperience / experienceToUpgrade) : Infinity;
    
    let maxFromItems = Infinity;
    if (unit.upgradeRequiresItems) {
      for (const [itemId, qty] of Object.entries(unit.upgradeRequiresItems)) {
        const available = Math.floor((player.inventory[itemId] || 0) / qty);
        if (available < maxFromItems) {
          maxFromItems = available;
        }
      }
    }
    
    const possible = Math.min(maxFromTroops, maxFromGold, maxFromXp, maxFromItems);

    return { maxUpgrades: possible, canUpgradeAny: possible > 0, tooltipLines: lines };

  }, [precursorUnitId, unit, player, currentLocationId, effectiveTrainerSkill]);

  const currentXp = precursorUnitId ? (player.unitExperience[precursorUnitId] || 0) : 0;
  const requiredXp = unit.xpToUpgrade || 0;
  const xpPercentage = requiredXp > 0 ? Math.min(100, (currentXp / requiredXp) * 100) : 0;
  const children = upgradeTree[unitId] || [];

  return (
    <div className="relative">
      {/* Connector lines */}
      <div className={`absolute top-0 -left-8 w-px bg-slate-600 ${isLast ? 'h-[58px]' : 'h-full'}`}></div>
      <div className="absolute top-[58px] -left-8 w-8 h-px bg-slate-600"></div>

      {/* Node Content */}
      <div className="ml-4 mb-4 bg-slate-900/50 p-4 rounded-lg flex flex-col gap-4 relative">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-semibold text-white">
              {unit.name} 
              <span className="text-base text-slate-400 font-normal ml-2">x {unitCount}</span>
              {woundedCount > 0 && <span className="text-base text-red-400 font-normal ml-1">(+{woundedCount})</span>}
            </h4>
            <p className="text-sm text-slate-400">{unit.description}</p>
          </div>
          {precursorUnitId && (
            <div className="text-right flex-shrink-0 flex items-center gap-2">
              <div className="group relative">
                <button
                  onClick={() => onUpgradeUnits(precursorUnitId, unitId, 1)}
                  disabled={isLoading || !canUpgradeAny}
                  className="bg-green-700 hover:bg-green-600 text-white font-bold py-2 px-4 rounded text-sm disabled:bg-slate-600 disabled:cursor-not-allowed transition"
                >
                  훈련
                </button>
                <UpgradeTooltip lines={tooltipLines} />
              </div>
               <div className="group relative">
                <button
                  onClick={() => onUpgradeUnits(precursorUnitId, unitId, maxUpgrades)}
                  disabled={isLoading || !canUpgradeAny || maxUpgrades <= 1}
                  className="bg-sky-700 hover:bg-sky-600 text-white font-bold py-2 px-4 rounded text-sm disabled:bg-slate-600 disabled:cursor-not-allowed transition"
                >
                  일괄 ({maxUpgrades})
                </button>
                <UpgradeTooltip lines={tooltipLines} />
              </div>
            </div>
          )}
        </div>
        {precursorUnitId && requiredXp > 0 && (
            <div>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-xs font-bold text-sky-300">훈련 경험치 ({UNITS[precursorUnitId]?.name})</span>
                <span className="text-xs text-slate-400">{Math.floor(currentXp)} / {requiredXp} XP</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div className="bg-sky-500 h-2 rounded-full transition-all duration-500" style={{width: `${xpPercentage}%`}}></div>
              </div>
            </div>
        )}
      </div>

      {/* Children */}
      {children.length > 0 && (
        <div className="relative ml-4 pl-8">
          {children.map((childId, index) => (
            <UnitNode
              key={childId}
              unitId={childId}
              player={player}
              onUpgradeUnits={onUpgradeUnits}
              isLoading={isLoading}
              upgradeTree={upgradeTree}
              isLast={index === children.length - 1}
              currentLocationId={currentLocationId}
              effectiveTrainerSkill={effectiveTrainerSkill}
            />
          ))}
        </div>
      )}
    </div>
  );
};


const ArmyManagementModal: React.FC<ArmyManagementModalProps> = ({ player, onClose, onUpgradeUnits, isLoading, currentLocationId, effectiveTrainerSkill }) => {
  const { baseUnits, upgradeTree } = useMemo(() => {
    const baseUnits: string[] = [];
    const upgradeTree: Record<string, string[]> = {};

    Object.values(UNITS).forEach(unit => {
      if (unit.upgradeFrom) {
        if (!upgradeTree[unit.upgradeFrom]) {
          upgradeTree[unit.upgradeFrom] = [];
        }
        upgradeTree[unit.upgradeFrom].push(unit.id);
      } else {
        baseUnits.push(unit.id);
      }
    });
    
    // Sort for consistent order
    baseUnits.sort((a, b) => UNITS[a].name.localeCompare(UNITS[b].name));
    Object.values(upgradeTree).forEach(upgrades => upgrades.sort((a,b) => UNITS[a].name.localeCompare(UNITS[b].name)));
    
    return { baseUnits, upgradeTree };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-600 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-amber-300">부대 진급 트리</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
        </div>
        <div className="p-6 overflow-y-auto">
          {baseUnits.length === 0 ? (
            <p className="text-slate-400 text-center">훈련 가능한 병사가 없습니다.</p>
          ) : (
            <div className="space-y-6">
              {baseUnits.map(unitId => {
                const unit = UNITS[unitId];
                const unitCount = player.army[unitId] || 0;
                const woundedCount = player.woundedArmy[unitId] || 0;
                const children = upgradeTree[unitId] || [];
                return (
                  <div key={unitId} className="bg-slate-900/30 p-4 rounded-lg">
                    {/* Base Node Content */}
                    <div className="flex items-center justify-between">
                       <div>
                          <h4 className="text-lg font-semibold text-white">
                            {unit.name} 
                            <span className="text-base text-slate-400 font-normal ml-2">x {unitCount}</span>
                            {woundedCount > 0 && <span className="text-base text-red-400 font-normal ml-1">(+{woundedCount})</span>}
                          </h4>
                          <p className="text-sm text-slate-400">{unit.description}</p>
                        </div>
                    </div>
                    {/* Children */}
                    {children.length > 0 && (
                      <div className="relative pt-4 pl-8">
                        {children.map((childId, index) => (
                          <UnitNode
                            key={childId}
                            unitId={childId}
                            player={player}
                            onUpgradeUnits={onUpgradeUnits}
                            isLoading={isLoading}
                            upgradeTree={upgradeTree}
                            isLast={index === children.length -1}
                            currentLocationId={currentLocationId}
                            effectiveTrainerSkill={effectiveTrainerSkill}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArmyManagementModal;