
import React, { useEffect, useState, useMemo } from 'react';
import { Player, Location, LogEntry, Quest, EquipmentSlot, Companion, AILord } from '../types';
import { TRADE_GOODS, UNITS, FACTIONS, COMPANIONS } from '../constants';
import { GoldIcon } from './icons/GoldIcon';
import { StarIcon } from './icons/StarIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { ShieldCheckIcon } from './icons/ShieldCheckIcon';
import { CastleIcon } from './icons/CastleIcon';
import { AnvilIcon } from './icons/AnvilIcon';
import { CharacterIcon } from './icons/CharacterIcon';
import { BuildingStorefrontIcon } from './icons/BuildingStorefrontIcon';
import { FlagIcon } from './icons/FlagIcon';
import WorldMap from './WorldMap';
import ArmyManagementModal from './ArmyManagementModal';
import QuestOfferModal from './QuestOfferModal';
import CharacterSheetModal from './CharacterSheetModal';
import ArmorerModal from './ArmorerModal';
import FiefManagementModal from './FiefManagementModal';
import FloatingStatChange from './FloatingStatChange';
import EnterpriseModal from './EnterpriseModal';
import { ArrowPathIcon } from './icons/ArrowPathIcon';
import { FireIcon } from './icons/FireIcon';
import { HeartIcon } from './icons/HeartIcon';
import { BrainIcon } from './icons/BrainIcon';


const XP_FOR_NEXT_LEVEL_BASE = 500;
type ApiKeyStatus = 'loading' | 'env' | 'local' | 'none' | 'invalid';

interface GameScreenProps {
  player: Player;
  locations: Record<string, Location>;
  currentLocation: Location;
  log: LogEntry[];
  isLoading: boolean;
  apiKeyStatus: ApiKeyStatus;
  questOffer: Quest | null;
  statChanges: { key: number, gold: number, renown: number };
  highlightedLocationId: string | null;
  companions: Record<string, Companion>;
  aiLords: Record<string, AILord>;
  wars: Record<string, string[]>;
  isDelegated: boolean;
  onToggleDelegation: () => void;
  onHighlightLocation: (locationId: string) => void;
  onTravel: (locationId: string) => void;
  onRecruit: () => void;
  onRecruitCompanion: (companionId: string) => void;
  onSeekBattle: () => void;
  onBuyGood: (goodId: string, price: number) => void;
  onSellGood: (goodId: string, price: number) => void;
  onBuyItem: (itemId: string) => void;
  onBuyEnterprise: (typeId: string) => void;
  onGatherRumors: () => void;
  onUpgradeUnits: (fromUnitId: string, toUnitId: string, quantity: number) => void;
  onSeekQuest: () => void;
  onAcceptQuest: () => void;
  onDeclineQuest: () => void;
  onJoinFaction: (factionId: string) => void;
  onRequestFief: (factionId: string) => void;
  onCollectTaxes: (locationId: string) => void;
  onManageGarrison: (locationId: string, unitId: string, quantity: number, direction: 'to' | 'from') => void;
  onEquipItem: (characterId: string, itemId: string) => void;
  onUnequipItem: (characterId: string, slot: EquipmentSlot) => void;
  onResetGame: () => void;
  onSpendSkillPoint: (skillId: string) => void;
  onRaidLocation: (locationId: string) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({
  player,
  locations,
  currentLocation,
  log,
  isLoading,
  apiKeyStatus,
  questOffer,
  statChanges,
  highlightedLocationId,
  companions,
  aiLords,
  wars,
  isDelegated,
  onToggleDelegation,
  onHighlightLocation,
  onTravel,
  onRecruit,
  onRecruitCompanion,
  onSeekBattle,
  onBuyGood,
  onSellGood,
  onBuyItem,
  onBuyEnterprise,
  onGatherRumors,
  onUpgradeUnits,
  onSeekQuest,
  onAcceptQuest,
  onDeclineQuest,
  onJoinFaction,
  onRequestFief,
  onCollectTaxes,
  onManageGarrison,
  onEquipItem,
  onUnequipItem,
  onResetGame,
  onSpendSkillPoint,
  onRaidLocation,
}) => {
  const [modal, setModal] = useState<'market' | 'tavern' | 'army' | 'castle' | 'character' | 'armorer' | 'enterprise' | 'fief' | null>(null);

  const isApiReady = apiKeyStatus === 'env' || apiKeyStatus === 'local';
  const combinedIsLoading = isLoading;

  useEffect(() => {
    if(questOffer) {
      setModal(null);
    }
  }, [questOffer]);

  const totalArmySize = useMemo(() => {
    const fighting = Object.values(player.army).reduce((sum, count) => sum + count, 0);
    const wounded = Object.values(player.woundedArmy).reduce((sum, count) => sum + count, 0);
    return { fighting, wounded, companions: player.companions.length };
  }, [player.army, player.woundedArmy, player.companions]);
  
  const isHostileCity = useMemo(() => {
    if (!player.factionId) return false;
    const playerFaction = player.factionId;
    const locationFaction = currentLocation.factionId;
    return (wars[playerFaction] || []).includes(locationFaction);
  }, [player.factionId, currentLocation.factionId, wars]);

  const isPlayerOwnedFief = useMemo(() => {
      return player.fiefs.includes(currentLocation.id);
  }, [player.fiefs, currentLocation.id]);

  const recruitCost = useMemo(() => {
    if (!player) return UNITS['recruit'].recruitCost || 10;
    const baseRecruitCost = UNITS['recruit'].recruitCost || 10;
    const currentFactionId = currentLocation.factionId;
    const relation = player.factionRelations[currentFactionId] || 0;
    // Max 50% discount, max 100% surcharge. Clamp relation effect.
    const discountMultiplier = 1 - (Math.max(-100, Math.min(100, relation)) / 200);
    return Math.round(baseRecruitCost * discountMultiplier);
  }, [player, currentLocation]);
  
  const xpForNextLevel = XP_FOR_NEXT_LEVEL_BASE * player.level;
  const xpPercentage = Math.round((player.xp / xpForNextLevel) * 100);
  const hasUnspentSkillPoints = player.skillPoints > 0;
  
  const canRaid = !isPlayerOwnedFief && !isHostileCity && currentLocation.status !== 'looted';

  const effectiveTrainerSkill = useMemo(() => {
    if (!player) return 0;
    let maxLevel = player.isWounded ? 0 : (player.skills['trainer'] || 0);
    player.companions.forEach(compId => {
        const companion = companions[compId];
        if (companion && !companion.isWounded && companion.skills['trainer']) {
            if (companion.skills['trainer'] > maxLevel) {
                maxLevel = companion.skills['trainer'];
            }
        }
    });
    return maxLevel;
  }, [player, companions]);


  const StatItem = ({ icon, value, label, colorClass, onClick, change, changeKey }: { icon: React.ReactNode, value: string | number, label: string, colorClass: string, onClick?: () => void, change?: number, changeKey?: string }) => (
    <div className={`relative flex items-center space-x-3 bg-slate-800/50 p-3 rounded-lg ${onClick ? 'cursor-pointer hover:bg-slate-700/50 transition-colors' : ''}`} onClick={onClick}>
      <div className={`p-2 rounded-full ${colorClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
      {change !== 0 && <FloatingStatChange key={changeKey} change={change || 0} />}
    </div>
  );
  
  const calculatePrice = (basePrice: number, multiplier: number) => Math.round(basePrice * multiplier);

  const closeModal = () => setModal(null);

  const getPriceIndicator = (multiplier: number): { color: string; text: string } => {
    if (multiplier < 0.8) return { color: 'text-green-400', text: '(매우 저렴)' };
    if (multiplier < 1.0) return { color: 'text-green-500', text: '(저렴)' };
    if (multiplier > 1.25) return { color: 'text-red-400', text: '(매우 비쌈)' };
    if (multiplier > 1.0) return { color: 'text-red-500', text: '(비쌈)' };
    return { color: 'text-slate-400', text: '(평균)' };
  };

  const renderMarketModal = () => (
    <>
      <div className="grid grid-cols-5 gap-x-4 gap-y-2 text-sm text-slate-400 font-bold px-4 py-2 border-b border-slate-700 bg-slate-900/50 sticky top-0">
        <div>상품</div>
        <div className="text-center">재고</div>
        <div className="text-right">구매가</div>
        <div className="text-right">판매가</div>
        <div className="text-center">액션</div>
      </div>
      <div className="space-y-2">
        {currentLocation.market.map(({ goodId, priceMultiplier }) => {
          const good = TRADE_GOODS[goodId];
          const buyPrice = calculatePrice(good.basePrice, priceMultiplier);
          const sellPrice = Math.round(buyPrice * 0.9);
          const playerStock = player.inventory[goodId] || 0;
          const priceIndicator = getPriceIndicator(priceMultiplier);

          return (
            <div key={goodId} className="grid grid-cols-5 gap-4 items-center p-4 bg-slate-800/50 rounded-md">
              <div>
                <div className="font-semibold text-white">{good.name}</div>
                <div className={`text-xs ${priceIndicator.color}`}>{priceIndicator.text}</div>
              </div>
              <div className="text-center text-lg text-amber-300">{playerStock}</div>
              <div className="text-right text-slate-300">{buyPrice} G</div>
              <div className="text-right text-slate-300">{sellPrice} G</div>
              <div className="flex justify-center space-x-2">
                <button
                  onClick={() => onBuyGood(goodId, buyPrice)}
                  disabled={combinedIsLoading || player.gold < buyPrice}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded disabled:bg-slate-600 disabled:cursor-not-allowed text-xs transition">
                  구매
                </button>
                <button
                  onClick={() => onSellGood(goodId, sellPrice)}
                  disabled={combinedIsLoading || playerStock <= 0}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded disabled:bg-slate-600 disabled:cursor-not-allowed text-xs transition">
                  판매
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderTavernModal = () => {
    const availableCompanions = Object.values(companions).filter(
        c => c.status === 'unrecruited' && c.locationId === currentLocation.id
    );
    
    const leadershipLevel = player.skills?.leadership || 0;
    const maxArmySize = 20 + Math.floor(player.renown / 25) + leadershipLevel * 5;
    const currentTotalArmySize = totalArmySize.fighting + totalArmySize.wounded + totalArmySize.companions;

    return (
        <div className="flex flex-col items-center space-y-6 p-4">
            <p className="text-slate-300 text-center">선술집에서는 떠들썩한 소리와 에일 냄새가 진동합니다. 무엇을 하시겠습니까?</p>
            <div className="w-full max-w-sm space-y-4">
                <button
                  onClick={onRecruit}
                  disabled={combinedIsLoading || player.gold < recruitCost || currentTotalArmySize >= maxArmySize}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200">
                  신병 모집 ({recruitCost}G)
                </button>
                <button
                  onClick={() => {
                      onGatherRumors();
                      closeModal();
                  }}
                  disabled={combinedIsLoading || player.gold < 10 || !isApiReady}
                  title={!isApiReady ? "API 키가 활성화되어야 합니다." : ""}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200">
                  소문 듣기 (10G)
                </button>
            </div>
            
            {availableCompanions.length > 0 && (
                <div className="w-full max-w-lg mt-6 border-t border-slate-700 pt-6">
                    <h4 className="text-lg font-semibold text-amber-300 mb-4 text-center">선술집 구석의 인물들</h4>
                    {availableCompanions.map(comp => (
                        <div key={comp.id} className="bg-slate-900/50 p-4 rounded-lg mb-3">
                            <h5 className="font-bold text-white text-xl">{comp.name}</h5>
                            <p className="text-sm text-slate-300 italic my-2">"{comp.backstory}"</p>
                            <p className="text-sm text-sky-300 mb-3">기술: {Object.entries(comp.skills).map(([key, value]) => `${key} ${value}`).join(', ')}</p>
                            <button
                                onClick={() => {
                                  onRecruitCompanion(comp.id);
                                  closeModal();
                                }}
                                disabled={combinedIsLoading || player.gold < comp.cost}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200"
                            >
                                영입하기 ({comp.cost}G)
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
  };
  
  const renderCastleModal = () => {
    const factionOfLocation = FACTIONS[currentLocation.factionId];
    return (
        <div className="flex flex-col items-center space-y-6 p-4">
            <p className="text-slate-300 text-center">{currentLocation.ownerId}이(가) 당신을 맞이합니다. 위풍당당한 성채입니다.</p>
            <div className="w-full max-w-sm space-y-4">
                <button
                    onClick={() => {
                        onSeekQuest();
                        closeModal();
                    }}
                    disabled={combinedIsLoading || !!player.activeQuest || !isApiReady}
                    title={!isApiReady ? "API 키가 활성화되어야 합니다." : player.activeQuest ? '이미 퀘스트를 진행 중입니다' : ''}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200">
                    {player.activeQuest ? '이미 퀘스트를 진행 중입니다' : '일거리 문의'}
                </button>

                {player.factionId === null && factionOfLocation.id !== 'neutral' && (
                  player.renown >= 50 ? (
                    <button
                      onClick={() => {
                        onJoinFaction(factionOfLocation.id)
                        closeModal();
                      }}
                      disabled={combinedIsLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200"
                    >
                      {factionOfLocation.name}에 충성 맹세하기
                    </button>
                  ) : (
                    <div className="text-center text-sm text-slate-400 p-3 bg-slate-900/50 rounded-lg">
                      명성이 50 이상이 되면 영주에게 충성을 맹세할 수 있습니다. (현재 명성: {player.renown})
                    </div>
                  )
                )}
                
                {player.factionId === currentLocation.factionId && player.fiefs.length === 0 && (
                   player.renown >= 150 ? (
                    <button
                        onClick={() => {
                            onRequestFief(currentLocation.factionId);
                            closeModal();
                        }}
                        disabled={combinedIsLoading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200"
                    >
                        영지 수여 요청하기
                    </button>
                   ) : (
                     <div className="text-center text-sm text-slate-400 p-3 bg-slate-900/50 rounded-lg">
                      명성이 150 이상이 되면 군주에게 영지를 요청할 수 있습니다. (현재 명성: {player.renown})
                    </div>
                   )
                )}

                {player.factionId && player.factionId === factionOfLocation.id && (
                  <p className="text-center text-sm text-green-400">당신은 이미 이 세력의 충실한 일원입니다.</p>
                )}
            </div>
        </div>
    );
  };
  
  const locationNames = useMemo(() => Object.values(locations).map(l => l.name), [locations]);
  const locationNameMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(locations).forEach(l => map.set(l.name, l.id));
    return map;
  }, [locations]);

  const parseAndRenderLogMessage = (message: string) => {
    const regex = new RegExp(`(${locationNames.join('|')})`, 'g');
    const parts = message.split(regex);

    return parts.map((part, index) => {
      if (locationNameMap.has(part)) {
        const locationId = locationNameMap.get(part)!;
        return (
          <button
            key={index}
            className="text-sky-400 font-semibold hover:underline focus:outline-none focus:ring-1 focus:ring-sky-500 rounded px-1 py-0.5"
            onClick={() => onHighlightLocation(locationId)}
          >
            {part}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };


  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-6 lg:p-8 font-sans" style={{backgroundImage: "linear-gradient(rgba(20,30,48,0.9), rgba(36,59,85,0.9)), url('https://picsum.photos/seed/worldmap/1920/1080')", backgroundAttachment: 'fixed'}}>
      
      {/* Modal Container */}
      {modal && !['army', 'character', 'armorer', 'enterprise', 'fief'].includes(modal) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-slate-600 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-bold text-amber-300">
                {modal === 'market' && `시장: ${currentLocation.name}`}
                {modal === 'tavern' && `선술집: ${currentLocation.name}`}
                {modal === 'castle' && `성채: ${currentLocation.name}`}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-white text-3xl font-bold leading-none">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
              {modal === 'market' && renderMarketModal()}
              {modal === 'tavern' && renderTavernModal()}
              {modal === 'castle' && renderCastleModal()}
            </div>
          </div>
        </div>
      )}
      {modal === 'army' && (
        <ArmyManagementModal 
            player={player}
            onClose={closeModal}
            onUpgradeUnits={onUpgradeUnits}
            isLoading={combinedIsLoading}
            currentLocationId={currentLocation.id}
            effectiveTrainerSkill={effectiveTrainerSkill}
        />
      )}
      {modal === 'character' && (
        <CharacterSheetModal
            player={player}
            companions={companions}
            onClose={closeModal}
            onEquipItem={onEquipItem}
            onUnequipItem={onUnequipItem}
            onSpendSkillPoint={onSpendSkillPoint}
            isLoading={combinedIsLoading}
            wars={wars}
        />
      )}
       {modal === 'armorer' && (
        <ArmorerModal
            player={player}
            onClose={closeModal}
            onBuyItem={onBuyItem}
            isLoading={combinedIsLoading}
        />
      )}
      {modal === 'enterprise' && (
        <EnterpriseModal
            player={player}
            location={currentLocation}
            onClose={closeModal}
            onBuyEnterprise={(typeId) => {
                onBuyEnterprise(typeId);
                closeModal();
            }}
            isLoading={combinedIsLoading}
        />
      )}
      {modal === 'fief' && (
        <FiefManagementModal
          player={player}
          location={currentLocation}
          onClose={closeModal}
          onCollectTaxes={onCollectTaxes}
          onManageGarrison={onManageGarrison}
          isLoading={combinedIsLoading}
        />
      )}
      {questOffer && (
        <QuestOfferModal
          quest={questOffer}
          onAccept={onAcceptQuest}
          onDecline={onDeclineQuest}
          isLoading={combinedIsLoading}
        />
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Panel: Player & Location Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Player Info */}
          <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg p-6 shadow-lg">
             <div className="flex items-start justify-between mb-2">
                <div>
                    <h2 className="text-2xl font-bold text-amber-300">{player.name}</h2>
                    {player.isWounded && <span className="text-sm font-bold px-2 py-1 bg-red-800/50 border border-red-700 rounded text-red-300 mt-2 inline-block">부상당함</span>}
                </div>
                <div className="flex items-center space-x-1">
                    <button onClick={() => setModal('character')} title="캐릭터 정보" className="relative p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
                        <CharacterIcon className="h-6 w-6"/>
                        {hasUnspentSkillPoints && (
                            <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-slate-800 animate-pulse">
                               <span className="sr-only">사용 가능한 기술 포인트</span>
                            </span>
                        )}
                    </button>
                    <button onClick={onResetGame} title="게임 초기화" className="p-2 rounded-full text-slate-400 hover:bg-slate-700 hover:text-red-400 transition-colors">
                        <ArrowPathIcon className="h-6 w-6"/>
                    </button>
                </div>
            </div>
            {player.factionId && (
                <div className="mb-4">
                    <span className="text-sm font-semibold px-2 py-1 bg-slate-700 rounded text-sky-300">소속: {FACTIONS[player.factionId].name}</span>
                </div>
            )}
            <p className="text-slate-300 italic mb-6">"{player.backstory}"</p>
            <div className="space-y-4">
              <StatItem icon={<GoldIcon className="h-6 w-6 text-amber-300"/>} value={player.gold} label="골드" colorClass="bg-amber-500/20" change={statChanges.gold} changeKey={`gold-${statChanges.key}`} />
              <StatItem icon={<StarIcon className="h-6 w-6 text-yellow-300"/>} value={player.renown} label="명성" colorClass="bg-yellow-500/20" change={statChanges.renown} changeKey={`renown-${statChanges.key}`} />
              <StatItem icon={<UserGroupIcon className="h-6 w-6 text-green-300"/>} value={`${totalArmySize.fighting + totalArmySize.companions}명 (+${totalArmySize.wounded})`} label="총 병력 (부상)" colorClass="bg-green-500/20" onClick={() => setModal('army')} />
            </div>
             {/* AI Delegation Toggle */}
            <div className="mt-6 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <BrainIcon className="h-6 w-6 mr-3 text-amber-300" />
                        <h4 className="text-lg font-semibold text-white">AI 위임</h4>
                    </div>
                    <button
                        onClick={onToggleDelegation}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isDelegated ? 'bg-amber-500' : 'bg-slate-600'
                        }`}
                        aria-label="Toggle AI Delegation"
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isDelegated ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
                {isDelegated && (
                    <p className="text-xs text-amber-300 mt-2 animate-pulse text-center">AI가 당신의 부대를 지휘합니다...</p>
                )}
            </div>
            <div className="mt-6">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-bold text-white">레벨 {player.level}</span>
                    <span className="text-xs text-slate-400">{player.xp} / {xpForNextLevel} XP</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-sky-500 h-2.5 rounded-full" style={{width: `${xpPercentage}%`}}></div>
                </div>
            </div>
          </div>

          {/* Active Quest */}
          {player.activeQuest && (
              <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg p-6 shadow-lg">
                  <h3 className="text-lg font-semibold text-sky-300 mb-3">활성 퀘스트</h3>
                  <h4 className="font-bold text-amber-200 mb-2">{player.activeQuest.title}</h4>
                  <p className="text-sm text-slate-300 mb-3">"{player.activeQuest.description}"</p>
                  <div className="text-xs text-slate-400 space-y-1">
                      <p><strong>의뢰인:</strong> {player.activeQuest.giver}</p>
                       <p><strong>보상:</strong> {player.activeQuest.rewardGold} 골드, 명성 {player.activeQuest.rewardRenown}</p>
                  </div>
              </div>
          )}

          {/* Location Info */}
          <div className="bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-sky-300 mb-2">현재 위치: {currentLocation.name}</h3>
            {isPlayerOwnedFief ? (
                <p className="text-amber-300 font-bold">당신의 영지입니다.</p>
            ) : (
                <p className="text-slate-400">영주: {currentLocation.ownerId}</p>
            )}
            <p className="text-slate-400 mt-2">{currentLocation.description}</p>
            {currentLocation.status === 'looted' && <p className="mt-4 text-orange-400 font-bold border-t border-orange-500/30 pt-3">이곳은 최근에 약탈당하여 황폐해졌습니다. 당분간 모집과 거래가 불가능합니다.</p>}
            {isHostileCity && <p className="mt-4 text-red-400 font-bold border-t border-red-500/30 pt-3">이곳은 당신의 세력과 전쟁 중입니다! 활동이 제한됩니다.</p>}
          </div>
        </div>

        {/* Center Panel: Log */}
        <div className="lg:col-span-2 bg-slate-800/70 backdrop-blur-sm border border-slate-700 rounded-lg shadow-lg flex flex-col h-[85vh]">
          <h2 className="text-2xl font-bold text-white p-4 border-b border-slate-700">모험 기록</h2>
          <div className="flex-grow p-4 overflow-y-auto flex flex-col-reverse">
            <div className="space-y-4">
              {log.map(entry => (
                <div key={entry.id} className={`p-3 rounded-md text-sm animate-fade-in ${
                  entry.type === 'battle' ? 'bg-red-900/40 border-l-4 border-red-500' : 
                  entry.type === 'rumor' ? 'bg-purple-900/40 border-l-4 border-purple-500 italic' :
                  entry.type === 'quest' ? 'bg-green-900/40 border-l-4 border-green-500' :
                  entry.type === 'market' ? 'bg-blue-900/40 border-l-4 border-blue-500' :
                  'bg-slate-900/50'}`}>
                  <div className="whitespace-pre-wrap">{parseAndRenderLogMessage(entry.message)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-slate-700 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            <button onClick={() => setModal('market')} disabled={combinedIsLoading || isDelegated || isHostileCity || currentLocation.status === 'looted'} title={isHostileCity ? "적대 세력의 도시에서는 이용할 수 없습니다." : currentLocation.status === 'looted' ? "약탈당한 곳에서는 이용할 수 없습니다." : ""} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200">시장</button>
            <button onClick={() => setModal('tavern')} disabled={combinedIsLoading || isDelegated || isHostileCity || currentLocation.status === 'looted'} title={isHostileCity ? "적대 세력의 도시에서는 이용할 수 없습니다." : currentLocation.status === 'looted' ? "약탈당한 곳에서는 이용할 수 없습니다." : ""} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200">선술집</button>
            <button 
                onClick={() => setModal(isPlayerOwnedFief ? 'fief' : 'castle')} 
                disabled={combinedIsLoading || isDelegated || (isHostileCity && !isPlayerOwnedFief)} 
                title={isHostileCity && !isPlayerOwnedFief ? "적대 세력의 도시에서는 이용할 수 없습니다." : ""} 
                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2"
            >
                {isPlayerOwnedFief ? <FlagIcon className="h-5 w-5" /> : <CastleIcon className="h-5 w-5" />}
                <span>{isPlayerOwnedFief ? "영지 관리" : "성채"}</span>
            </button>
            <button onClick={() => setModal('armorer')} disabled={combinedIsLoading || isDelegated || isHostileCity || currentLocation.status === 'looted'} title={isHostileCity ? "적대 세력의 도시에서는 이용할 수 없습니다." : currentLocation.status === 'looted' ? "약탈당한 곳에서는 이용할 수 없습니다." : ""} className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2"><AnvilIcon className="h-5 w-5" /><span>장비점</span></button>
            <button onClick={() => setModal('army')} disabled={combinedIsLoading || isDelegated} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2"><ShieldCheckIcon className="h-5 w-5" /><span>부대</span></button>
            <button onClick={() => onRaidLocation(currentLocation.id)} disabled={combinedIsLoading || isDelegated || !canRaid} title={!canRaid ? "이곳은 약탈할 수 없습니다." : ""} className="bg-red-800 hover:bg-red-900 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2"><FireIcon className="h-5 w-5" /><span>약탈</span></button>
            <button onClick={onSeekBattle} disabled={combinedIsLoading || isDelegated || !isApiReady || player.isWounded || totalArmySize.fighting === 0} title={!isApiReady ? "API 키가 활성화되어야 합니다." : player.isWounded ? "부상 중에는 전투를 할 수 없습니다." : totalArmySize.fighting === 0 ? "싸울 수 있는 병사가 없습니다." : ""} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2"><HeartIcon className="h-5 w-5"/><span>전투</span></button>
            <button onClick={() => setModal('enterprise')} disabled={combinedIsLoading || isDelegated || isHostileCity} title={isHostileCity ? "적대 세력의 도시에서는 이용할 수 없습니다." : ""} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-200 flex items-center justify-center space-x-2"><BuildingStorefrontIcon className="h-5 w-5" /><span>사업장</span></button>

             {combinedIsLoading && (
              <div className="col-span-full flex justify-center items-center text-amber-300 pt-2">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  처리 중...
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: World Map */}
        <div className="lg:col-span-1 space-y-6">
            <WorldMap 
              locations={locations}
              currentLocationId={currentLocation.id}
              onTravel={onTravel}
              isLoading={combinedIsLoading || isDelegated}
              highlightedLocationId={highlightedLocationId}
              aiLords={aiLords}
            />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
