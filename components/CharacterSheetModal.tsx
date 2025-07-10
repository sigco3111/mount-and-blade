import React, { useMemo, useState } from 'react';
import { Player, EquipmentSlot, Item, Companion } from '../types';
import { ITEMS, FACTIONS, LOCATIONS, ENTERPRISE_TYPES } from '../constants';
import { SKILLS } from '../skills';

const XP_FOR_NEXT_LEVEL_BASE = 500;
const MAX_HP = 100;

interface CharacterSheetModalProps {
  player: Player;
  companions: Record<string, Companion>;
  onClose: () => void;
  onEquipItem: (characterId: string, itemId: string) => void;
  onUnequipItem: (characterId: string, slot: EquipmentSlot) => void;
  onSpendSkillPoint: (skillId: string) => void;
  isLoading: boolean;
  wars: Record<string, string[]>;
}

const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({ player, companions, onClose, onEquipItem, onUnequipItem, onSpendSkillPoint, isLoading, wars }) => {
  const [selectedTab, setSelectedTab] = useState<string>('player');

  const equipmentSlots: EquipmentSlot[] = [
    EquipmentSlot.WEAPON,
    EquipmentSlot.HEAD,
    EquipmentSlot.BODY,
    EquipmentSlot.FEET,
    EquipmentSlot.HORSE,
  ];

  const inventoryItems = Object.entries(player.inventory)
    .map(([itemId, quantity]) => ({ item: ITEMS[itemId], quantity }))
    .filter(data => data.item && data.quantity > 0 && data.item.slot);
  
  const hasUnspentSkillPoints = player.skillPoints > 0;

  const tabs = useMemo(() => {
    const playerEntry = { id: 'player', name: player.name };
    const companionEntries = player.companions.map(id => ({ id, name: companions[id].name, isWounded: companions[id].isWounded }));
    const skillsEntry = { id: 'skills', name: '플레이어 기술' };
    return [playerEntry, ...companionEntries, skillsEntry];
  }, [player.name, player.companions, companions]);

  const selectedCharacterData = useMemo(() => {
    if (selectedTab === 'player') {
      return {
        id: 'player',
        name: player.name,
        equipment: player.equipment,
        factionId: player.factionId,
        skills: null,
        hp: player.hp,
        isWounded: player.isWounded,
      };
    }
    if (selectedTab === 'skills') return null;

    const companion = companions[selectedTab];
    return companion ? {
        id: companion.id,
        name: companion.name,
        equipment: companion.equipment,
        factionId: null,
        skills: companion.skills,
        hp: companion.hp,
        isWounded: companion.isWounded,
    } : null;
  }, [selectedTab, player, companions]);
  
  const ongoingWars = useMemo(() => {
    const uniqueWars = new Set<string>();
    Object.entries(wars).forEach(([factionId, enemies]) => {
        (enemies || []).forEach(enemyId => {
            const sortedPair = [factionId, enemyId].sort().join('-');
            uniqueWars.add(sortedPair);
        });
    });
    return Array.from(uniqueWars);
  }, [wars]);

  const getEffectString = (item: Item) => {
    return Object.entries(item.effects).map(([key, value]) => `${key}: +${value}`).join(', ');
  }

  const totalEffects = useMemo(() => {
    if (!selectedCharacterData) return { attack: 0, armor: 0 };

    const effects: Record<string, number> = { attack: 0, armor: 0 };
    Object.values(selectedCharacterData.equipment).forEach(itemId => {
        if (itemId) {
            const item = ITEMS[itemId];
            if (item && item.effects) {
                for (const [effect, value] of Object.entries(item.effects)) {
                    effects[effect] = (effects[effect] || 0) + value;
                }
            }
        }
    });
    return effects;
  }, [selectedCharacterData]);
  
  const getRelationColor = (relation: number) => {
    if (relation > 20) return 'text-green-400';
    if (relation > 0) return 'text-green-500';
    if (relation < -20) return 'text-red-400';
    if (relation < 0) return 'text-red-500';
    return 'text-slate-400';
  };
  
  const getRelationDescription = (relation: number) => {
    if (relation >= 75) return '확고한 동맹';
    if (relation >= 40) return '우호적';
    if (relation >= 10) return '긍정적';
    if (relation > -10) return '중립';
    if (relation > -40) return '부정적';
    if (relation > -75) return '적대적';
    return '극도로 적대적';
  };

  const renderSlot = (slot: EquipmentSlot) => {
    if (!selectedCharacterData) return null;
    const equippedItemId = selectedCharacterData.equipment[slot];
    const equippedItem = equippedItemId ? ITEMS[equippedItemId] : null;

    return (
      <div key={slot} className="bg-slate-900/50 p-3 rounded-md flex items-center justify-between">
        <span className="font-bold text-slate-400 capitalize w-20">{slot}</span>
        {equippedItem ? (
          <div className="text-right flex-grow">
            <p className="font-semibold text-white">{equippedItem.name}</p>
            <p className="text-xs text-sky-300">{getEffectString(equippedItem)}</p>
          </div>
        ) : (
          <p className="text-slate-500 flex-grow text-right">없음</p>
        )}
         {equippedItem && (
             <button onClick={() => onUnequipItem(selectedCharacterData.id, slot)} disabled={isLoading || selectedCharacterData.isWounded} className="ml-4 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-xs disabled:bg-slate-600 disabled:cursor-not-allowed transition">해제</button>
         )}
      </div>
    );
  };
  
  const renderSkills = () => {
    const xpForNextLevel = XP_FOR_NEXT_LEVEL_BASE * player.level;
    const xpPercentage = Math.round((player.xp / xpForNextLevel) * 100);

    return (
      <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Left Column: Stats and Info */}
        <div className="space-y-6">
            <h3 className="text-2xl font-bold text-white">플레이어 기술 트리</h3>
            <div className="bg-slate-900/50 p-4 rounded-lg space-y-4">
                <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-white">레벨</span>
                    <span className="font-bold text-amber-300">{player.level}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                    <span className="font-bold text-white">기술 포인트</span>
                    <span className="font-bold text-green-400">{player.skillPoints}</span>
                </div>
                 <div>
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-bold text-white">경험치</span>
                        <span className="text-xs text-slate-400">{player.xp} / {xpForNextLevel} XP</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5">
                        <div className="bg-sky-500 h-2.5 rounded-full" style={{width: `${xpPercentage}%`}}></div>
                    </div>
                </div>
            </div>
            <p className="text-sm text-slate-400">레벨이 오를 때마다 기술 포인트를 얻습니다. 기술 포인트를 사용하여 새로운 능력을 배우거나 기존 능력을 강화하세요.</p>
        </div>
        {/* Right Column: Skill List */}
        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
            {Object.values(SKILLS).map(skill => {
              const currentLevel = player.skills[skill.id] || 0;
              const isMaxLevel = currentLevel >= skill.maxLevel;
              const canAfford = player.skillPoints > 0;
              
              return (
                <div key={skill.id} className="bg-slate-900/50 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="text-lg font-semibold text-white">{skill.name}</h4>
                            <p className="text-sm text-sky-300">레벨 {currentLevel} / {skill.maxLevel}</p>
                        </div>
                        <button
                            onClick={() => onSpendSkillPoint(skill.id)}
                            disabled={isLoading || !canAfford || isMaxLevel}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm disabled:bg-slate-600 disabled:cursor-not-allowed transition"
                        >
                            {isMaxLevel ? "마스터" : "배우기 (1 SP)"}
                        </button>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">{skill.description(currentLevel)}</p>
                </div>
              )
            })}
        </div>
      </div>
    )
  }
  
  const renderCharacterSheet = () => {
    if (!selectedCharacterData) return null;
    const hpPercentage = (selectedCharacterData.hp / MAX_HP) * 100;

    return (
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-bold text-white mb-1">{selectedCharacterData.name}</h3>
                 {selectedCharacterData.isWounded && <span className="text-base font-bold px-2 py-1 bg-red-800/50 border border-red-700 rounded text-red-300 mt-2 inline-block">부상당함</span>}
                {selectedCharacterData.factionId && <p className="text-sm text-sky-300 mt-2">소속: {FACTIONS[selectedCharacterData.factionId].name}</p>}
            </div>
            
             {/* HP Bar */}
            <div>
                <h4 className="text-lg font-semibold text-sky-300 mb-2">건강 상태</h4>
                <div className="bg-slate-900/50 p-3 rounded-md">
                    <div className="flex justify-between items-baseline mb-1">
                        <span className="text-sm font-bold text-white">체력</span>
                        <span className="text-xs text-slate-400">{selectedCharacterData.hp} / {MAX_HP}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-4">
                        <div className="bg-green-500 h-4 rounded-full transition-all duration-500" style={{width: `${hpPercentage}%`}}></div>
                    </div>
                </div>
            </div>

            {/* Total Stats Section */}
            <div>
              <h4 className="text-lg font-semibold text-sky-300 mb-2">종합 능력치 보너스</h4>
              <div className="space-y-2 bg-slate-900/50 p-4 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">공격력 보너스</span>
                  <span className="font-bold text-lg text-green-400">+{totalEffects.attack || 0}</span>
                </div>
                 <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">방어력 보너스</span>
                  <span className="font-bold text-lg text-green-400">+{totalEffects.armor || 0}</span>
                </div>
              </div>
            </div>

            {/* Equipment Section */}
            <div>
              <h4 className="text-lg font-semibold text-sky-300 mb-2">장착 중인 아이템</h4>
              <div className="space-y-2">
                {equipmentSlots.map(slot => renderSlot(slot))}
              </div>
            </div>

             {/* Skills for Companions */}
            {selectedCharacterData.skills && (
                 <div>
                    <h4 className="text-lg font-semibold text-sky-300 mb-2">기술</h4>
                     <div className="space-y-2 bg-slate-900/50 p-4 rounded-md">
                        {Object.entries(selectedCharacterData.skills).map(([skill, value]) => (
                            <div key={skill} className="flex justify-between items-center capitalize">
                                <span className={`font-semibold text-white ${selectedCharacterData.isWounded ? 'text-slate-500 line-through' : ''}`}>{SKILLS[skill]?.name || skill}</span>
                                <span className={`font-bold text-lg ${selectedCharacterData.isWounded ? 'text-slate-500 line-through' : 'text-green-400'}`}>{String(value)}</span>
                            </div>
                        ))}
                         {selectedCharacterData.isWounded && <p className="text-xs text-red-400 mt-2 text-center">부상 중에는 기술이 비활성화됩니다.</p>}
                    </div>
                </div>
            )}

            {/* Faction Relations Section (Player Only) */}
            {selectedCharacterData.id === 'player' && (
                <div>
                  <h4 className="text-lg font-semibold text-sky-300 mb-2">세력 관계</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {Object.entries(player.factionRelations)
                      .sort(([a], [b]) => (FACTIONS[a]?.name || a).localeCompare(FACTIONS[b]?.name || b))
                      .map(([factionId, relation]) => (
                      <div key={factionId} className="bg-slate-900/50 p-3 rounded-md flex items-center justify-between">
                        <span className="font-semibold text-white">{FACTIONS[factionId]?.name || factionId}</span>
                        <div className="text-right">
                          <span className={`font-bold text-lg ${getRelationColor(relation)}`}>
                            {relation > 0 ? `+${relation}` : relation}
                          </span>
                          <p className="text-xs text-slate-500">{getRelationDescription(relation)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            )}
            
            {/* Current Wars Section (Player only) */}
            {selectedCharacterData.id === 'player' && (
                <div>
                  <h4 className="text-lg font-semibold text-sky-300 mb-2">칼라디아의 전쟁 현황</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {ongoingWars.length > 0 ? (
                      ongoingWars.map(warPair => {
                        const [f1, f2] = warPair.split('-');
                        return (
                           <div key={warPair} className="bg-slate-900/50 p-3 rounded-md flex items-center justify-center text-center">
                              <span className="font-semibold text-red-400">{FACTIONS[f1]?.name || f1}</span>
                              <span className="font-bold text-slate-400 mx-2">vs</span>
                              <span className="font-semibold text-red-400">{FACTIONS[f2]?.name || f2}</span>
                          </div>
                        )
                      })
                    ) : (
                      <div className="bg-slate-900/50 p-3 rounded-md text-center text-slate-400">
                        현재 칼라디아는 평화롭습니다.
                      </div>
                    )}
                  </div>
                </div>
            )}

             {/* Fiefs Section (Player Only) */}
            {selectedTab === 'player' && player.fiefs.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-sky-300 mb-2">소유 영지</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {player.fiefs.map((fiefId) => (
                      <div key={fiefId} className="bg-slate-900/50 p-3 rounded-md">
                          <p className="font-semibold text-white">
                              {LOCATIONS[fiefId]?.name || '알 수 없는 영지'}
                          </p>
                      </div>
                    ))}
                  </div>
                </div>
            )}

            {/* Enterprises Section (Player Only) */}
            {selectedCharacterData.id === 'player' && player.enterprises.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-sky-300 mb-2">소유 사업장</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {player.enterprises.map((enterprise, index) => (
                      <div key={index} className="bg-slate-900/50 p-3 rounded-md">
                          <p className="font-semibold text-white">
                              {LOCATIONS[enterprise.locationId]?.name || '알 수 없는 도시'} - {ENTERPRISE_TYPES[enterprise.typeId]?.name || '알 수 없는 사업장'}
                          </p>
                      </div>
                    ))}
                  </div>
                </div>
            )}
          </div>

          {/* Right Column: Inventory Section */}
          <div>
            <h4 className="text-lg font-semibold text-sky-300 mb-4">보유 장비 (공용 물품)</h4>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              {inventoryItems.length > 0 ? (
                inventoryItems.map(({ item, quantity }) => (
                  <div key={item.id} className="bg-slate-900/50 p-3 rounded-md flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{item.name} <span className="text-sm text-slate-400">x{quantity}</span></p>
                      <p className="text-xs text-slate-400">{item.description}</p>
                       <p className="text-xs text-sky-300 mt-1">{getEffectString(item)}</p>
                    </div>
                    <button 
                        onClick={() => onEquipItem(selectedCharacterData.id, item.id)}
                        disabled={isLoading || selectedCharacterData.isWounded}
                        className="ml-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm disabled:bg-slate-600 disabled:cursor-not-allowed transition"
                    >
                        장착
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-center py-4">보유한 장비 아이템이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-slate-600 flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold text-amber-300">부대 정보</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
        </div>
        <div className="flex border-b border-slate-700 flex-wrap flex-shrink-0">
            {tabs.map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setSelectedTab(tab.id)}
                    className={`relative px-4 py-3 font-semibold transition-colors ${
                        selectedTab === tab.id
                            ? 'text-amber-300 border-b-2 border-amber-300 bg-slate-700/50'
                            : 'text-slate-400 hover:bg-slate-700/30'
                    }`}
                >
                    {tab.name}
                    {(tab as any).isWounded && (
                        <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 animate-pulse">
                           <span className="sr-only">부상당함</span>
                        </span>
                    )}
                    {tab.id === 'skills' && hasUnspentSkillPoints && (
                         <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-green-400 animate-pulse">
                            <span className="sr-only">사용 가능한 기술 포인트</span>
                        </span>
                    )}
                </button>
            ))}
        </div>
        {selectedTab === 'skills' ? renderSkills() : renderCharacterSheet()}
      </div>
    </div>
  );
};

export default CharacterSheetModal;