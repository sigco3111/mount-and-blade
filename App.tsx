


import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GamePhase, Player, CharacterBackground, LogEntry, Location, BattleResult, BattleOutcome, Quest, Item, EquipmentSlot, Companion, PlayerEnterprise, AILord, MarketGood, GameEvent, GameEventChoice } from './types';
import { initializeAi, verifyApiKey, generateCharacter, simulateBattle, getTavernRumor, generateQuest, getAIDestinationForBountyQuest, generateTravelEvent } from './services/geminiService';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import ConfirmModal from './components/ConfirmModal';
import ErrorModal from './components/ErrorModal';
import ApiKeyManager from './components/ApiKeyManager';
import TravelEventModal from './components/TravelEventModal';
import { LOCATIONS, TRADE_GOODS, UNITS, ITEMS, FACTIONS, COMPANIONS, ENTERPRISE_TYPES, AI_LORDS } from './constants';
import { SKILLS } from './skills';

const SAVE_KEY = 'mount-and-blade-web-save';
const API_KEY_STORAGE_KEY = 'gemini-api-key';
const XP_FOR_NEXT_LEVEL_BASE = 500;
const MAX_HP = 100;

type ApiKeyStatus = 'loading' | 'env' | 'local' | 'none' | 'invalid';
type TravelEventState = GameEvent & { destinationId: string };


const usePrevious = <T,>(value: T): T | undefined => {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<(() => void) | null>(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    function tick() {
      if (savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

const getInitialFactionRelations = (): Record<string, Record<string, number>> => {
    const initialFactionRelations: Record<string, Record<string, number>> = {};
    const factionIds = Object.keys(FACTIONS).filter(id => id !== 'neutral');
    for (const f1 of factionIds) {
        initialFactionRelations[f1] = {};
        for (const f2 of factionIds) {
            if (f1 !== f2) {
                initialFactionRelations[f1][f2] = 0; // Start neutral
            }
        }
    }
    // Pre-set some hostilities
    initialFactionRelations['swadia']['nords'] = -20;
    initialFactionRelations['nords']['swadia'] = -20;
    initialFactionRelations['vaegirs']['khergits'] = -15;
    initialFactionRelations['khergits']['vaegirs'] = -15;
    return initialFactionRelations;
};

const PARTY_SKILLS = ['tactics', 'trainer', 'surgery', 'wound_treatment', 'persuasion']; // Skills where the highest in party applies

const getEffectiveSkillLevel = (player: Player, companions: Record<string, Companion>, skillId: string): number => {
    if (!PARTY_SKILLS.includes(skillId)) {
        return player.isWounded ? 0 : (player.skills[skillId] || 0);
    }

    let maxLevel = player.isWounded ? 0 : (player.skills[skillId] || 0);
    
    player.companions.forEach(compId => {
        const companion = companions[compId];
        if (companion && !companion.isWounded && companion.skills[skillId]) {
            if (companion.skills[skillId] > maxLevel) {
                maxLevel = companion.skills[skillId];
            }
        }
    });

    return maxLevel;
};

const initializeLocations = (baseLocations: Record<string, Omit<Location, 'market'>>): Record<string, Location> => {
    const newLocations = JSON.parse(JSON.stringify(baseLocations)) as Record<string, Location>;
    const allGoods = Object.keys(TRADE_GOODS);
    for (const locId in newLocations) {
        newLocations[locId].market = allGoods.map(goodId => ({
            goodId,
            priceMultiplier: 1.0,
        }));
    }
    return newLocations;
};


const App: React.FC = () => {
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.START_SCREEN);
  const [player, setPlayer] = useState<Player | null>(null);
  const [locations, setLocations] = useState<Record<string, Location>>(() => initializeLocations(LOCATIONS));
  const [companions, setCompanions] = useState<Record<string, Companion>>(() => JSON.parse(JSON.stringify(COMPANIONS)));
  const [aiLords, setAiLords] = useState<Record<string, AILord>>(() => JSON.parse(JSON.stringify(AI_LORDS)));
  const [currentLocationId, setCurrentLocationId] = useState<string>('pravend');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isApiKeyLoading, setIsApiKeyLoading] = useState<boolean>(false);
  const [logIdCounter, setLogIdCounter] = useState<number>(0);
  const [questOffer, setQuestOffer] = useState<Quest | null>(null);
  const [travelEvent, setTravelEvent] = useState<TravelEventState | null>(null);
  const [isResolvingEvent, setIsResolvingEvent] = useState<boolean>(false);
  const [highlightedLocationId, setHighlightedLocationId] = useState<string | null>(null);
  const [statChanges, setStatChanges] = useState<{ key: number, gold: number, renown: number }>({ key: 0, gold: 0, renown: 0 });
  const [wars, setWars] = useState<Record<string, string[]>>({
    'swadia': ['nords'],
    'nords': ['swadia'],
  });
  const [factionRelations, setFactionRelations] = useState<Record<string, Record<string, number>>>(getInitialFactionRelations());
  const [day, setDay] = useState<number>(1);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDelegated, setIsDelegated] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('loading');
  const [tokenUsage, setTokenUsage] = useState({ total: 0, session: 0, last: 0 });

  // Effect for API key initialization
  useEffect(() => {
    const initKey = async () => {
      setIsApiKeyLoading(true);
      const envKey = process.env.API_KEY;
      if (envKey) {
        const isValid = await verifyApiKey(envKey);
        if (isValid) {
            initializeAi(envKey);
            setApiKeyStatus('env');
        } else {
            // Environment key is present but invalid. Treat as 'invalid'.
            // Do not fall back to local storage, as the environment key should have priority.
            setApiKeyStatus('invalid');
        }
        setIsApiKeyLoading(false);
        return;
      }

      const localKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (localKey) {
        const isValid = await verifyApiKey(localKey);
        if (isValid) {
          initializeAi(localKey);
          setApiKeyStatus('local');
        } else {
          localStorage.removeItem(API_KEY_STORAGE_KEY);
          setApiKeyStatus('invalid');
        }
      } else {
        setApiKeyStatus('none');
      }
      setIsApiKeyLoading(false);
    };
    initKey();
  }, []);

  const prevPlayer = usePrevious(player);

  const addLogEntry = useCallback((message: string, type: LogEntry['type'] = 'event') => {
    setLog(prevLog => [{ id: logIdCounter, message, type }, ...prevLog]);
    setLogIdCounter(prev => prev + 1);
  }, [logIdCounter]);
  
  const updateTokenUsage = useCallback((tokens: number) => {
    if (tokens > 0) {
        setTokenUsage(prev => ({
            total: prev.total + tokens,
            session: prev.session + tokens,
            last: tokens,
        }));
    }
  }, []);

  const checkForLevelUp = useCallback((currentPlayer: Player): Player => {
    let newPlayer = { ...currentPlayer };
    const xpForNextLevel = XP_FOR_NEXT_LEVEL_BASE * newPlayer.level;
    if (newPlayer.xp >= xpForNextLevel) {
        newPlayer.level += 1;
        newPlayer.skillPoints += 1;
        newPlayer.xp -= xpForNextLevel;
        addLogEntry(`[레벨 업!] 당신은 레벨 ${newPlayer.level}에 도달했습니다! 기술 포인트를 1 획득했습니다.`, 'quest');
        // Check for multiple level ups
        return checkForLevelUp(newPlayer);
    }
    return newPlayer;
  }, [addLogEntry]);

  // Effect for loading game from localStorage on initial mount
  useEffect(() => {
    const savedDataJSON = localStorage.getItem(SAVE_KEY);
    if (savedDataJSON) {
        try {
            const savedData = JSON.parse(savedDataJSON);
            if (!savedData.player || !savedData.currentLocationId) {
                throw new Error("Invalid save data found.");
            }
            
            // Restore state from save file
            setPlayer(savedData.player);
            setLocations(savedData.locations || initializeLocations(LOCATIONS));
            setCompanions(savedData.companions || JSON.parse(JSON.stringify(COMPANIONS)));
            setAiLords(savedData.aiLords || JSON.parse(JSON.stringify(AI_LORDS)));
            setCurrentLocationId(savedData.currentLocationId);
            setDay(savedData.day || 1);
            setWars(savedData.wars || { 'swadia': ['nords'], 'nords': ['swadia'] });
            setFactionRelations(savedData.factionRelations || getInitialFactionRelations());
            setIsDelegated(savedData.isDelegated || false);

            const loadedLog = savedData.log || [];
            const nextId = (savedData.logIdCounter || loadedLog.length) + 1;
            const welcomeBackLog: LogEntry = { id: nextId, message: "저장된 게임을 불러왔습니다.", type: 'system' };
            setLog([...loadedLog, welcomeBackLog]);
            setLogIdCounter(nextId + 1);

            setTokenUsage({
                total: savedData.tokenUsage?.total || 0,
                session: 0, // Reset session on load
                last: 0,
            });
            
            setGamePhase(GamePhase.GAMEPLAY);
        } catch (error) {
            console.error("Error loading game, resetting.", error);
            localStorage.removeItem(SAVE_KEY);
            setGamePhase(GamePhase.START_SCREEN);
        }
    }
    setIsLoading(false); // Finished initial load attempt
  }, []);

  // Effect for saving game to localStorage whenever state changes
  useEffect(() => {
    if (gamePhase === GamePhase.GAMEPLAY && player) {
        const gameStateToSave = {
            player,
            locations,
            companions,
            aiLords,
            currentLocationId,
            log,
            logIdCounter,
            day,
            wars,
            factionRelations,
            isDelegated,
            tokenUsage: { total: tokenUsage.total },
        };
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(gameStateToSave));
        } catch (error) {
            console.error("Failed to save game state:", error);
        }
    }
  }, [gamePhase, player, locations, companions, aiLords, currentLocationId, log, logIdCounter, day, wars, factionRelations, isDelegated, tokenUsage.total]);

  useEffect(() => {
    if (player && prevPlayer) {
        const goldChange = player.gold - prevPlayer.gold;
        const renownChange = player.renown - prevPlayer.renown;

        if (goldChange !== 0 || renownChange !== 0) {
            setStatChanges(prev => ({
                key: prev.key + 1, // To re-trigger animation on same value change
                gold: goldChange,
                renown: renownChange,
            }));
        }
    }
  }, [player, prevPlayer]);
  
  const handleSaveApiKey = async (key: string) => {
    setIsApiKeyLoading(true);
    const isValid = await verifyApiKey(key);
    if (isValid) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
      initializeAi(key);
      setApiKeyStatus('local');
    } else {
      setApiKeyStatus('invalid');
    }
    setIsApiKeyLoading(false);
  };

  
  const handleHighlightLocation = useCallback((locationId: string) => {
    setHighlightedLocationId(locationId);
    setTimeout(() => {
      setHighlightedLocationId(null);
    }, 4000);
  }, []);
  
  const handleWeeklyIncome = useCallback(() => {
    if (!player) return;

    let totalIncome = 0;
    let incomeDetails: string[] = [];
    
    // Enterprises
    if (player.enterprises.length > 0) {
        for (const enterprise of player.enterprises) {
            const enterpriseType = ENTERPRISE_TYPES[enterprise.typeId];
            const location = locations[enterprise.locationId];
            if (!enterpriseType || !location) continue;

            const marketGood = location.market.find(g => g.goodId === enterpriseType.outputGoodId);
            const priceMultiplier = marketGood ? marketGood.priceMultiplier : 1.0;
            const weeklyProfit = Math.round(enterpriseType.baseWeeklyProfit * priceMultiplier);
            
            totalIncome += weeklyProfit;
            incomeDetails.push(`${location.name}의 ${enterpriseType.name}에서 ${weeklyProfit}G`);
        }
    }
    
    if (totalIncome !== 0) {
        setPlayer(p => p ? { ...p, gold: p.gold + totalIncome } : null);
        addLogEntry(`[주간 수입] 총 ${totalIncome} 골드를 벌었습니다.\n${incomeDetails.length > 0 ? `- ` + incomeDetails.join('\n- ') : ''}`, 'system');
    }

  }, [player, locations, addLogEntry]);

  const updateMarketPrices = useCallback(() => {
    let newLocations = JSON.parse(JSON.stringify(locations));
    const allGoods = Object.keys(TRADE_GOODS);
    let marketLogMessages: string[] = [];

    for (const locId in newLocations) {
        const location = newLocations[locId];
        const oldMarket = locations[locId].market;

        if (location.status === 'looted') {
            location.market.forEach(marketGood => {
                marketGood.priceMultiplier = 2.5;
            });
            continue;
        }

        const newMarket: MarketGood[] = [];
        
        for (const goodId of allGoods) {
            let targetMultiplier = 1.0;
            
            // 1. Production (Supply)
            if (location.production.includes(goodId)) {
                targetMultiplier -= 0.4;
            }

            // 2. Demand from connected looted cities
            for (const connId of location.connectedTo) {
                const connectedLocation = newLocations[connId];
                if (connectedLocation && connectedLocation.status === 'looted' && connectedLocation.production.includes(goodId)) {
                    targetMultiplier += 0.6;
                }
            }

            // 3. War demand
            const locFaction = location.factionId;
            if (wars[locFaction] && wars[locFaction].length > 0) {
                if (goodId === 'tools' || goodId === 'salt') {
                    targetMultiplier += 0.5;
                }
                if (goodId === 'velvet' || goodId === 'wine') {
                    targetMultiplier -= 0.2;
                }
            }

            // 4. AI Lord presence
            const lordsInLocation = Object.values(aiLords).filter(lord => !lord.isDefeated && lord.currentLocationId === locId);
            if (lordsInLocation.length > 0) {
                if (goodId === 'ale' || goodId === 'salt') {
                    targetMultiplier += 0.15 * lordsInLocation.length;
                }
            }
            
            targetMultiplier = Math.max(0.3, Math.min(3.0, targetMultiplier));

            const oldMarketGood = oldMarket.find(g => g.goodId === goodId);
            const oldMultiplier = oldMarketGood ? oldMarketGood.priceMultiplier : 1.0;
            const smoothedMultiplier = oldMultiplier * 0.7 + targetMultiplier * 0.3;

            // Log significant changes
            const changeRatio = smoothedMultiplier / oldMultiplier;
            if (changeRatio > 1.4) {
                 marketLogMessages.push(`${location.name}에서 ${TRADE_GOODS[goodId].name}의 가격이 급등하고 있습니다.`);
            } else if (changeRatio < 0.7) {
                 marketLogMessages.push(`${location.name}에서 ${TRADE_GOODS[goodId].name}의 가격이 하락하고 있습니다.`);
            }
            
            newMarket.push({ goodId, priceMultiplier: smoothedMultiplier });
        }
        newLocations[locId].market = newMarket.sort((a,b) => (TRADE_GOODS[a.goodId]?.name || '').localeCompare(TRADE_GOODS[b.goodId]?.name || ''));
    }
    
    if (marketLogMessages.length > 0) {
        const randomMessage = marketLogMessages[Math.floor(Math.random() * marketLogMessages.length)];
        addLogEntry(`[시장 동향] ${randomMessage}`, 'market');
    }

    setLocations(newLocations);
  }, [locations, wars, aiLords, addLogEntry]);
  
  const handleDailyUpdates = useCallback(() => {
      if(!player) return;

      let playerAfterUpdates = {...player};
      let companionsAfterUpdates = {...companions};
      let locationsAfterUpdates = {...locations};
      let logMessages: string[] = [];

      // Recovery from looted status
      Object.values(locationsAfterUpdates).forEach(loc => {
        if (loc.status === 'looted' && day >= loc.lootedUntilDay) {
          locationsAfterUpdates[loc.id].status = 'normal';
          locationsAfterUpdates[loc.id].recruitsAvailable = 10; // Restore some recruits
          logMessages.push(`${loc.name}이(가) 약탈의 상처에서 회복되었습니다.`);
        }
      });
      
      // Healing
      const woundTreatmentLevel = getEffectiveSkillLevel(player, companions, 'wound_treatment');

      // Player and Companion Healing
      if (playerAfterUpdates.isWounded) {
          const hpRecovered = 10 + woundTreatmentLevel * 5;
          playerAfterUpdates.hp = Math.min(MAX_HP, playerAfterUpdates.hp + hpRecovered);
          if (playerAfterUpdates.hp >= MAX_HP) {
              playerAfterUpdates.isWounded = false;
              playerAfterUpdates.hp = MAX_HP;
              logMessages.push("당신은 부상에서 완전히 회복되었습니다!");
          }
      }

      playerAfterUpdates.companions.forEach(compId => {
        const comp = companionsAfterUpdates[compId];
        if (comp.isWounded) {
          const hpRecovered = 10 + woundTreatmentLevel * 5;
          comp.hp = Math.min(MAX_HP, comp.hp + hpRecovered);
          if (comp.hp >= MAX_HP) {
              comp.isWounded = false;
              comp.hp = MAX_HP;
              logMessages.push(`${comp.name}이(가) 부상에서 완전히 회복되었습니다.`);
          }
        }
      });

      // Troop Healing (Wounded Army)
      const newWoundedArmy = { ...playerAfterUpdates.woundedArmy };
      const newArmy = { ...playerAfterUpdates.army };
      let troopsHealed = false;
      for (const unitId in newWoundedArmy) {
          if (newWoundedArmy[unitId] > 0) {
              // Heal 10% of troops per day
              const healCount = Math.max(1, Math.floor(newWoundedArmy[unitId] * 0.1));
              const actualHealCount = Math.min(newWoundedArmy[unitId], healCount);
              
              newWoundedArmy[unitId] -= actualHealCount;
              newArmy[unitId] = (newArmy[unitId] || 0) + actualHealCount;
              
              if (newWoundedArmy[unitId] <= 0) {
                  delete newWoundedArmy[unitId];
              }
              troopsHealed = true;
          }
      }
      if (troopsHealed) {
        logMessages.push("부상당했던 병사들 중 일부가 회복하여 부대에 복귀했습니다.");
        playerAfterUpdates.woundedArmy = newWoundedArmy;
        playerAfterUpdates.army = newArmy;
      }


      // Tax accumulation for player fiefs
      if(player.fiefs.length > 0) {
        player.fiefs.forEach(fiefId => {
            const fief = locationsAfterUpdates[fiefId];
            if(fief) {
                fief.accumulatedTaxes += 100;
            }
        });
      }

      // Daily Experience Gain (Marching + Training)
      const newUnitExperience = { ...playerAfterUpdates.unitExperience };
      const armyHasTroops = Object.values(playerAfterUpdates.army).some(count => count > 0);
      if (armyHasTroops) {
          const MARCH_XP = 5;
          const trainerLevel = getEffectiveSkillLevel(player, companions, 'trainer');
          const trainerXp = trainerLevel > 0 ? trainerLevel * 2 : 0;
          const totalPassiveXpPerUnit = MARCH_XP + trainerXp;
          
          for (const unitId in playerAfterUpdates.army) {
              if (playerAfterUpdates.army[unitId] > 0) {
                  newUnitExperience[unitId] = (newUnitExperience[unitId] || 0) + totalPassiveXpPerUnit * playerAfterUpdates.army[unitId];
              }
          }

          let xpLog = `부대원들이 행군을 통해 유닛당 ${MARCH_XP}의 경험치를 얻었습니다.`;
          if (trainerXp > 0) {
              xpLog += ` '훈련교관' 기술 덕분에 추가로 ${trainerXp}를 더 얻었습니다.`;
          }
          logMessages.push(xpLog);
          playerAfterUpdates.unitExperience = newUnitExperience;
      }

      if(logMessages.length > 0) {
        addLogEntry(logMessages.join('\n'), 'system');
      }

      setPlayer(playerAfterUpdates);
      setCompanions(companionsAfterUpdates);
      setLocations(locationsAfterUpdates);
  }, [player, companions, locations, day, addLogEntry]);

  const updateWorldState = useCallback(() => {
    let newRelations = JSON.parse(JSON.stringify(factionRelations));
    let newWars = JSON.parse(JSON.stringify(wars));
    const factionIds = Object.keys(newRelations);
    
    // 1. Relation decay and random events
    for (const f1 of factionIds) {
        for (const f2 of factionIds) {
            if (f1 >= f2) continue;

            // Decay towards 0
            if (newRelations[f1][f2] !== 0) {
                newRelations[f1][f2] += newRelations[f1][f2] > 0 ? -0.5 : 0.5;
                newRelations[f1][f2] = Math.round(newRelations[f1][f2] * 10) / 10;
            }
            newRelations[f2][f1] = newRelations[f1][f2];
            
            // Random event
            if (Math.random() < 0.05) { // 5% chance of event per pair per 3 days
                const change = Math.floor(Math.random() * 11) - 5; // -5 to +5
                if (change === 0) continue;

                newRelations[f1][f2] = Math.max(-100, Math.min(100, newRelations[f1][f2] + change));
                newRelations[f2][f1] = newRelations[f1][f2];
                
                const f1Name = FACTIONS[f1]?.name || f1;
                const f2Name = FACTIONS[f2]?.name || f2;
                const changeDesc = change > 0 ? '개선되었습니다' : '악화되었습니다';
                addLogEntry(`[세계 정세] ${f1Name}와(과) ${f2Name}의 관계가 사소한 사건으로 인해 ${changeDesc}.`, 'rumor');
            }
        }
    }
    
    // 2. War/Peace declarations
    for (const f1 of factionIds) {
        for (const f2 of factionIds) {
            if (f1 >= f2) continue;

            const relation = newRelations[f1][f2];
            const areAtWar = (newWars[f1] || []).includes(f2);
            
            if (!areAtWar && relation <= -50) {
                newWars[f1] = [...(newWars[f1] || []), f2];
                newWars[f2] = [...(newWars[f2] || []), f1];
                addLogEntry(`[전쟁 선포] ${(FACTIONS[f1]?.name || f1)}이(가) ${(FACTIONS[f2]?.name || f2)}에 전쟁을 선포했습니다!`, 'quest');
            }

            if (areAtWar && relation >= 10) {
                newWars[f1] = (newWars[f1] || []).filter(id => id !== f2);
                newWars[f2] = (newWars[f2] || []).filter(id => id !== f1);
                addLogEntry(`[평화 협정] ${(FACTIONS[f1]?.name || f1)}와(과) ${(FACTIONS[f2]?.name || f2)} 사이에 평화 협정이 체결되었습니다.`, 'quest');
            }
        }
    }
    
    setFactionRelations(newRelations);
    setWars(newWars);
  }, [factionRelations, wars, addLogEntry]);

  const handleAILordTurns = useCallback(() => {
    let newLords: Record<string, AILord> = JSON.parse(JSON.stringify(aiLords));
    let newLocations: Record<string, Location> = JSON.parse(JSON.stringify(locations));

    for (const lord of Object.values(newLords)) {
        // === 1. Handle defeated lords first ===
        if (lord.isDefeated) {
            if (day >= lord.defeatedUntilDay) {
                // Try to find a valid respawn location
                const factionFiefs = Object.values(newLocations).filter(l => l.factionId === lord.factionId);
                let respawnLocation: Location | undefined;

                // Prefer the original capital if the faction still holds it
                const originalCapital = Object.values(LOCATIONS).find(l => l.ownerId === lord.name);
                if (originalCapital && factionFiefs.some(f => f.id === originalCapital.id)) {
                    respawnLocation = newLocations[originalCapital.id];
                } else if (factionFiefs.length > 0) {
                    // Otherwise, pick any remaining fief
                    respawnLocation = factionFiefs[Math.floor(Math.random() * factionFiefs.length)];
                }

                if (respawnLocation) {
                    lord.isDefeated = false;
                    lord.currentLocationId = respawnLocation.id;
                    lord.army = JSON.parse(JSON.stringify(AI_LORDS[lord.id].army)); // Reset army
                    addLogEntry(`${lord.name}이(가) 패배에서 회복하여 ${respawnLocation.name}에 복귀했습니다.`, 'rumor');
                } else {
                    // Faction is wiped out. Lord cannot respawn.
                    if (lord.defeatedUntilDay < day + 9000) { // Check to prevent spamming the log
                        addLogEntry(`${lord.name}의 세력이 멸망하여, 그가 전장에 복귀할 곳이 없습니다.`, 'rumor');
                    }
                    lord.defeatedUntilDay = day + 9999;
                }
            }
            continue; // Skip turn for defeated lords
        }

        // === 2. Handle active lords: Validate current location ===
        const lordLocation = newLocations[lord.currentLocationId];
        if (!lordLocation) {
            const friendlyFiefs = Object.values(newLocations).filter(l => l.factionId === lord.factionId);
            if (friendlyFiefs.length > 0) {
                const newHome = friendlyFiefs[0];
                lord.currentLocationId = newHome.id;
                addLogEntry(`${lord.name}이(가) 알 수 없는 곳에서 발견되어 ${newHome.name}(으)로 이동합니다.`, 'system');
            } else {
                lord.isDefeated = true;
                lord.defeatedUntilDay = day + 5;
                addLogEntry(`${lord.name}이(가) 갈 곳을 잃고 부대가 흩어졌습니다.`, 'battle');
            }
            continue; // Skip the rest of the turn
        }

        const atWarWith = wars[lord.factionId] || [];
        const totalTroops = Object.values(lord.army).reduce((s, c) => s + c, 0);

        // === 3. Action Phase: What to do at the current location ===
        if (atWarWith.includes(lordLocation.factionId) && lordLocation.status !== 'looted' && totalTroops > 30) {
            newLocations[lordLocation.id].status = 'looted';
            newLocations[lordLocation.id].lootedUntilDay = day + 5;
            newLocations[lordLocation.id].recruitsAvailable = 0;
            const newArmy = { ...lord.army };
            let totalLosses = 0;
            for (const unitId in newArmy) {
                const losses = Math.floor(newArmy[unitId] * 0.05); // 5% losses
                if (newArmy[unitId] - losses <= 0) {
                    delete newArmy[unitId];
                } else {
                    newArmy[unitId] -= losses;
                }
                totalLosses += losses;
            }
            lord.army = newArmy;
            addLogEntry(`${lord.name}의 군대가 ${lordLocation.name}을(를) 약탈했습니다! (${totalLosses}명 손실)`, 'battle');
        } else if (lord.factionId === lordLocation.factionId && totalTroops < 100 && lordLocation.recruitsAvailable > 5) {
            const recruitsToGet = Math.min(lordLocation.recruitsAvailable, 10);
            lord.army['recruit'] = (lord.army['recruit'] || 0) + recruitsToGet;
            newLocations[lordLocation.id].recruitsAvailable -= recruitsToGet;
            addLogEntry(`${lord.name}이(가) ${lordLocation.name}에서 병력을 ${recruitsToGet}명 충원합니다.`, 'rumor');
        }

        // === 4. Movement Phase: Decide where to go next ===
        let destination: Location | null = null;
        if (atWarWith.length > 0 && totalTroops > 50) {
            const enemyLocations = Object.values(newLocations).filter(l => atWarWith.includes(l.factionId) && l.status !== 'looted');
            if (enemyLocations.length > 0) {
                destination = enemyLocations[Math.floor(Math.random() * enemyLocations.length)];
            }
        }
        
        if (!destination) {
            const friendlyLocations = Object.values(newLocations).filter(l => l.factionId === lord.factionId && l.id !== lord.currentLocationId);
            if(friendlyLocations.length > 0) {
                destination = friendlyLocations[Math.floor(Math.random() * friendlyLocations.length)];
            }
        }

        if (destination && destination.id !== lord.currentLocationId) {
            lord.currentLocationId = destination.id;
            addLogEntry(`${lord.name}의 부대가 ${destination.name}(으)로 행군을 시작했습니다.`, 'rumor');
        }
    }

    setAiLords(newLords);
    setLocations(newLocations);
  }, [aiLords, locations, wars, day, addLogEntry]);


  useEffect(() => {
    if (gamePhase !== GamePhase.GAMEPLAY) return;
    
    handleDailyUpdates();
    updateMarketPrices();

    // A new week starts
    if (day > 1 && (day - 1) % 7 === 0) {
        handleWeeklyIncome();
    }
    // World and AI state updates every day
    if (day > 1) {
      if (day % 3 === 0) {
          updateWorldState();
      }
      handleAILordTurns();
    }
  }, [day, gamePhase]);

  const handleStartGame = useCallback(async (background: CharacterBackground) => {
    setIsLoading(true);
    addLogEntry("칼라디아에 당신의 이야기를 쓸 준비를 하고 있습니다...", "system");
    try {
        const { data: newPlayer, tokens } = await generateCharacter(background);
        if (newPlayer) {
          updateTokenUsage(tokens);
          setTokenUsage({ total: tokens, session: tokens, last: tokens });

          const initialPlayerRelations: Record<string, number> = {};
          Object.keys(FACTIONS).forEach(factionId => {
            if (factionId !== 'neutral') {
              initialPlayerRelations[factionId] = 0;
            }
          });
          newPlayer.factionRelations = initialPlayerRelations;
          newPlayer.factionId = null;
          newPlayer.companions = [];
          newPlayer.enterprises = [];
          newPlayer.fiefs = [];
          
          setPlayer(newPlayer);
          setLocations(initializeLocations(LOCATIONS));
          setCompanions(JSON.parse(JSON.stringify(COMPANIONS)));
          setAiLords(JSON.parse(JSON.stringify(AI_LORDS)));
          setFactionRelations(getInitialFactionRelations());
          setWars({ 'swadia': ['nords'], 'nords': ['swadia'] });
          setIsDelegated(false);
          setLog([{ id: 1, message: `${LOCATIONS[currentLocationId].name}에 도착했습니다. (현재 1일차)`, type: 'system' }]);
          setLogIdCounter(2);
          setGamePhase(GamePhase.GAMEPLAY);
          
          // Initial market calculation
          updateMarketPrices();
        } else {
            addLogEntry("캐릭터 생성 중 알 수 없는 오류가 발생했습니다.", "system");
        }
    } catch (error) {
        console.error("Error in handleStartGame:", error);
        if (error && error.toString().includes('429')) {
            setApiError("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.\n지속적으로 발생할 경우, API 키 플랜을 확인해주세요.");
        } else {
            addLogEntry("캐릭터 생성에 실패했습니다. API 키가 유효한지 확인하고, 페이지를 새로고침하여 다시 시도해주세요.", "system");
        }
    } finally {
        setIsLoading(false);
    }
  }, [addLogEntry, currentLocationId, updateMarketPrices, updateTokenUsage]);

  const completeTravel = useCallback((locationId: string) => {
    setCurrentLocationId(locationId);
    addLogEntry(`${locations[locationId].name}에 도착했습니다.`, 'system');

    if (player?.factionId) {
      const location = locations[locationId];
      const playerFaction = player.factionId;
      const locationFaction = location.factionId;
      const playerWars = wars[playerFaction] || [];
      if (playerWars.includes(locationFaction)) {
          addLogEntry(`${location.name}에 들어서자, 경비병들이 당신의 깃발을 보고 적대적으로 노려봅니다. 도시에서의 활동이 제한됩니다.`, 'event');
      }
    }

    if (player?.activeQuest?.type === 'delivery' && player.activeQuest.targetLocationId === locationId) {
      const quest = player.activeQuest;
      const requiredItem = quest.targetItemId!;
      const requiredQty = quest.targetItemQuantity!;
      const itemData = TRADE_GOODS[requiredItem];

      if (!itemData) {
        addLogEntry(`[퀘스트 오류] 배달 퀘스트에 필요한 아이템(${requiredItem}) 정보를 찾을 수 없습니다. 퀘스트를 포기합니다.`, 'system');
        setPlayer(p => p ? {...p, activeQuest: null} : null);
        return;
      }
      
      if ((player.inventory[requiredItem] || 0) >= requiredQty) {
        
        setPlayer(p => {
          if (!p) return null;

          const persuasionLevel = getEffectiveSkillLevel(p, companions, 'persuasion');
          const rewardMultiplier = 1 + (persuasionLevel * 0.04);
          const finalGoldReward = Math.round(quest.rewardGold * rewardMultiplier);

          addLogEntry(`[퀘스트 완료] ${quest.title} - ${quest.giver}에게 ${itemData.name} ${requiredQty}개를 배달했습니다.`, 'quest');
          addLogEntry(`보상: ${finalGoldReward} 골드, 명성 ${quest.rewardRenown}`, 'quest');
          if (persuasionLevel > 0) {
            addLogEntry(`(설득 기술로 ${finalGoldReward - quest.rewardGold}G 추가 획득)`, 'quest');
          }

          const newInventory = { ...p.inventory };
          newInventory[requiredItem] -= requiredQty;
          if (newInventory[requiredItem] <= 0) {
            delete newInventory[requiredItem];
          }

          const newRelations = { ...p.factionRelations };
          const relationChange = 5;
          newRelations[quest.factionId] = (newRelations[quest.factionId] || 0) + relationChange;
          addLogEntry(`${(FACTIONS[quest.factionId]?.name || quest.factionId)}과의 관계가 ${relationChange}만큼 증가했습니다. (현재: ${newRelations[quest.factionId]})`, 'quest');
          
          let playerAfterQuest = {
            ...p,
            gold: p.gold + finalGoldReward,
            renown: p.renown + quest.rewardRenown,
            xp: p.xp + quest.rewardRenown * 10, // Grant player XP
            inventory: newInventory,
            activeQuest: null,
            factionRelations: newRelations,
          }

          return checkForLevelUp(playerAfterQuest);
        });
      } else {
         addLogEntry(`[퀘스트] ${quest.title} - 배달에 필요한 ${itemData.name} ${requiredQty}개가 없습니다.`, 'quest');
      }
    }
  }, [player, addLogEntry, wars, locations, checkForLevelUp, companions]);

  const handleTravel = useCallback(async (locationId: string) => {
    if (isLoading || !player) return;

    const EVENT_CHANCE = 0.25;
    if (apiKeyStatus === 'env' || apiKeyStatus === 'local') {
      if(Math.random() < EVENT_CHANCE) {
          setIsLoading(true);
          try {
              const from = locations[currentLocationId];
              const to = locations[locationId];
              const { data, tokens } = await generateTravelEvent(player, from, to);
              updateTokenUsage(tokens);
              if (data) {
                  setTravelEvent({ ...data, destinationId: locationId });
              } else {
                  // If event generation fails, proceed with normal travel
                  setDay(d => d + 1);
                  completeTravel(locationId);
              }
          } catch(error) {
              console.error("Error generating travel event:", error);
              if (error && error.toString().includes('429')) {
                  setApiError("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
              }
              setDay(d => d + 1);
              completeTravel(locationId);
          } finally {
              setIsLoading(false);
          }
          return;
      }
    }
    
    setDay(d => d + 1);
    addLogEntry(`1일이 지났습니다. (현재 ${day + 1}일차)`, 'system');
    completeTravel(locationId);
  }, [isLoading, player, addLogEntry, completeTravel, day, locations, currentLocationId, apiKeyStatus, updateTokenUsage]);

  const getCompanionSkillBonus = useCallback((skill: string): number => {
    if (!player) return 0;
    return player.companions.reduce((total, compId) => {
        const companion = companions[compId];
        return total + (companion && !companion.isWounded ? (companion.skills[skill] || 0) : 0);
    }, 0);
  }, [player, companions]);

  const handleBattleResult = useCallback((currentPlayer: Player, battleResult: BattleResult): Player => {
    let resultLog = `[전투 결과] ${battleResult.narrative}`;
    let p = { ...currentPlayer };

    // 1. Update army with losses and wounded
    const newArmy = { ...p.army };
    const newWoundedArmy = { ...p.woundedArmy };
    let totalLosses = 0;
    let totalWounded = 0;

    Object.entries(battleResult.playerLosses).forEach(([unitId, losses]) => {
        newArmy[unitId] = (newArmy[unitId] || 0) - losses;
        if (newArmy[unitId] <= 0) delete newArmy[unitId];
        totalLosses += losses;
    });

    Object.entries(battleResult.playerWounded).forEach(([unitId, wounded]) => {
        newArmy[unitId] = (newArmy[unitId] || 0) - wounded;
        if (newArmy[unitId] <= 0) delete newArmy[unitId];
        newWoundedArmy[unitId] = (newWoundedArmy[unitId] || 0) + wounded;
        totalWounded += wounded;
    });

    p.army = newArmy;
    p.woundedArmy = newWoundedArmy;
    
    // 2. Handle outcome (gold, renown, quest)
    let questCompleted = false;
    const newRelations = { ...p.factionRelations };

    if (battleResult.outcome === BattleOutcome.PLAYER_VICTORY) {
        const lootingBonus = getCompanionSkillBonus('looting');
        const finalGoldLooted = Math.round(battleResult.goldLooted * (1 + lootingBonus / 100));

        p.gold += finalGoldLooted;
        p.renown += 10;
        resultLog += `\n승리했습니다! 사망: ${totalLosses}명, 부상: ${totalWounded}명. 적 손실: ${battleResult.enemyLosses}, 전리품: ${finalGoldLooted} 골드. 명성이 10 올랐습니다.`;
        
        if (lootingBonus > 0 && finalGoldLooted > battleResult.goldLooted) {
            resultLog += ` (동료 기술로 +${finalGoldLooted - battleResult.goldLooted}G)`;
        }
    
        if (battleResult.questUpdate?.completed && p.activeQuest) {
            const quest = p.activeQuest;
            const persuasionLevel = getEffectiveSkillLevel(p, companions, 'persuasion');
            const rewardMultiplier = 1 + (persuasionLevel * 0.04);
            const finalGoldReward = Math.round(quest.rewardGold * rewardMultiplier);

            resultLog += `\n\n[퀘스트 완료] ${battleResult.questUpdate.narrative}`;
            addLogEntry(`퀘스트 "${quest.title}"를 완료했습니다! 보상: ${finalGoldReward} 골드, 명성 ${quest.rewardRenown}`, 'quest');
            
            p.gold += finalGoldReward;
            p.renown += quest.rewardRenown;
            questCompleted = true;

            const relationChange = 10;
            newRelations[quest.factionId] = (newRelations[quest.factionId] || 0) + relationChange;
            addLogEntry(`${(FACTIONS[quest.factionId]?.name || quest.factionId)}과의 관계가 ${relationChange}만큼 증가했습니다. (현재: ${newRelations[quest.factionId]})`, 'quest');
        }

    } else if (battleResult.outcome === BattleOutcome.PLAYER_DEFEAT) {
        p.renown = Math.max(0, p.renown - 5);
        resultLog += `\n패배했습니다... 사망: ${totalLosses}명, 부상: ${totalWounded}명. 적 손실: ${battleResult.enemyLosses}. 명성이 5 감소했습니다.`;
    } else {
        resultLog += `\n무승부입니다. 사망: ${totalLosses}명, 부상: ${totalWounded}명. 적 손실: ${battleResult.enemyLosses}.`;
    }
    
    addLogEntry(resultLog, "battle");

    // 3. Handle player/companion defeat
    if (battleResult.playerDefeated) {
        p.isWounded = true;
        p.hp = 1;
        addLogEntry("당신은 정신을 잃었습니다...", 'battle');
        setCompanions(cs => {
            const newCs = {...cs};
            p.companions.forEach(compId => {
                newCs[compId].isWounded = true;
                newCs[compId].hp = 1;
            });
            return newCs;
        });
    }
    
    // 4. Update XP
    const totalSurvivors = Object.values(p.army).reduce((s, c) => s + c, 0) + p.companions.length;
    if (battleResult.xpGained > 0 && totalSurvivors > 0) {
      const xpPerSurvivor = Math.floor(battleResult.xpGained / totalSurvivors);
      if (xpPerSurvivor > 0) {
        addLogEntry(`생존한 부대원들이 각각 ${xpPerSurvivor}의 경험치를 얻었습니다.`, 'system');
        const newUnitExperience = { ...p.unitExperience };
        for (const unitId in p.army) {
          newUnitExperience[unitId] = (newUnitExperience[unitId] || 0) + xpPerSurvivor * p.army[unitId];
        }
        p.unitExperience = newUnitExperience;
      }
    }
    p.xp += (battleResult.playerXpGained || 0);
    p.activeQuest = questCompleted ? null : p.activeQuest;
    p.factionRelations = newRelations;

    return checkForLevelUp(p);
  }, [addLogEntry, companions, checkForLevelUp, getCompanionSkillBonus]);

  const handleEventResolution = useCallback(async (choice: GameEventChoice, destinationId: string) => {
      if (!player) return;
      
      setIsResolvingEvent(true);
      addLogEntry(choice.resultNarrative, 'event');
      
      let p = { ...player };

      // Apply stat changes
      if (choice.goldChange) p.gold += choice.goldChange;
      if (choice.renownChange) p.renown = Math.max(0, p.renown + choice.renownChange);
      if (choice.hpChange) p.hp = Math.max(0, Math.min(MAX_HP, p.hp + choice.hpChange));
      
      if (p.hp <= 0) {
          p.isWounded = true;
          p.hp = 1;
          addLogEntry("당신은 정신을 잃었습니다...", 'battle');
      }

      const newInventory = { ...p.inventory };
      if (choice.itemChanges) {
          for (const [itemId, quantity] of Object.entries(choice.itemChanges)) {
              newInventory[itemId] = (newInventory[itemId] || 0) + quantity;
              if (newInventory[itemId] <= 0) {
                  delete newInventory[itemId];
              }
          }
      }
      p.inventory = newInventory;
      
      setPlayer(p);
      setTravelEvent(null);

      // Trigger battle if required
      if (choice.startBattle) {
          addLogEntry(`${choice.startBattle.enemyName} ${choice.startBattle.enemySize}명이 공격해옵니다!`, 'battle');
          
          try {
              const playerWars = p.factionId ? (wars[p.factionId] || []) : [];
              const effectiveTactics = getEffectiveSkillLevel(p, companions, 'tactics');
              const effectiveSurgery = getEffectiveSkillLevel(p, companions, 'surgery');
              const { data: battleResult, tokens } = await simulateBattle(p, choice.startBattle.enemyName, choice.startBattle.enemySize, playerWars, companions, effectiveTactics, effectiveSurgery);
              updateTokenUsage(tokens);
              
              if (battleResult) {
                  const playerAfterBattle = handleBattleResult(p, battleResult);
                  setPlayer(playerAfterBattle);
              } else {
                  addLogEntry("전투 시뮬레이션 중 알 수 없는 오류가 발생했습니다.", "system");
              }
          } catch(error) {
              console.error("Error in event battle:", error);
              setApiError("전투 시뮬레이션 중 오류 발생.");
          }
          
          // Travel might be cancelled after a battle
          addLogEntry(`예기치 못한 전투로 인해, 당신은 현재 위치에 머무릅니다.`, 'system');
          
      } else {
          // If no battle, complete the travel
          setDay(d => d + 1);
          addLogEntry(`1일이 지났습니다. (현재 ${day + 1}일차)`, 'system');
          completeTravel(destinationId);
      }

      setIsResolvingEvent(false);
  }, [player, companions, wars, handleBattleResult, addLogEntry, completeTravel, day, updateTokenUsage]);

  const handleRecruit = useCallback(() => {
    if (!player) return;

    const leadershipLevel = getEffectiveSkillLevel(player, companions, 'leadership');
    const maxArmySize = 20 + Math.floor(player.renown / 25) + leadershipLevel * 5;
    const currentArmySize = Object.values(player.army).reduce((a, b) => a + b, 0) + Object.values(player.woundedArmy).reduce((a,b) => a+b, 0) + player.companions.length;
    if (currentArmySize >= maxArmySize) {
        addLogEntry(`부대 최대 규모(${maxArmySize}명)에 도달하여 더 이상 병사를 모집할 수 없습니다.`, "system");
        return;
    }

    const baseRecruitCost = UNITS['recruit'].recruitCost || 10;
    const currentFactionIdAtLocation = locations[currentLocationId].factionId;
    const relation = player.factionRelations[currentFactionIdAtLocation] || 0;
    const discountMultiplier = 1 - (Math.max(-100, Math.min(100, relation)) / 200);
    const recruitCost = Math.round(baseRecruitCost * discountMultiplier);

    if (player.gold < recruitCost) {
      addLogEntry(`골드가 부족하여 병사를 모집할 수 없습니다. (필요: ${recruitCost}G)`, "system");
      return;
    }

    setPlayer(p => {
        if (!p) return null;
        const newArmy = { ...p.army };
        newArmy['recruit'] = (newArmy['recruit'] || 0) + 1;
        return { ...p, gold: p.gold - recruitCost, army: newArmy };
    });
    addLogEntry(`1명의 신병을 모집했습니다. (비용: ${recruitCost} 골드)`, "event");

  }, [player, addLogEntry, currentLocationId, locations, companions]);

  const handleSeekBattle = useCallback(async () => {
    if (!player) return;
    const totalArmySize = Object.values(player.army).reduce((sum, count) => sum + count, 0);
    if (totalArmySize === 0) {
      addLogEntry("전투 가능한 병력이 없습니다. 부상병이 회복되기를 기다리거나 선술집에서 병사를 모집하세요.", "system");
      return;
    }

    setIsLoading(true);
    addLogEntry("주변에서 싸울 상대를 찾고 있습니다...", "system");

    let enemyName: string;
    const playerWars = player.factionId ? (wars[player.factionId] || []) : [];
    
    const isFactionEncounter = player.factionId && Math.random() < 0.4;

    if (isFactionEncounter && player.factionId) {
        const potentialEnemyFactions = Object.keys(FACTIONS).filter(fid => fid !== 'neutral' && fid !== player.factionId && playerWars.includes(fid));
        if(potentialEnemyFactions.length > 0) {
            const enemyFaction = potentialEnemyFactions[Math.floor(Math.random() * potentialEnemyFactions.length)];
            enemyName = `${(FACTIONS[enemyFaction]?.name || enemyFaction)} 순찰대`;
        } else {
             const enemyTypes = ["산적", "도적떼", "탈영병", "해적"];
             enemyName = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        }
    } else {
        const enemyTypes = ["산적", "도적떼", "탈영병", "해적"];
        enemyName = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    }
    
    const enemySize = Math.max(1, Math.floor((totalArmySize + player.companions.length) * (0.5 + Math.random() * 0.8)));
    addLogEntry(`${enemyName} ${enemySize}명을 발견했습니다! 전투가 시작됩니다!`, "battle");

    try {
        const effectiveTactics = getEffectiveSkillLevel(player, companions, 'tactics');
        const effectiveSurgery = getEffectiveSkillLevel(player, companions, 'surgery');
        const { data: battleResult, tokens } = await simulateBattle(player, enemyName, enemySize, playerWars, companions, effectiveTactics, effectiveSurgery);
        updateTokenUsage(tokens);

        if (battleResult) {
          setPlayer(p => p ? handleBattleResult(p, battleResult) : null);
        } else {
          addLogEntry("전투 시뮬레이션 중 알 수 없는 오류가 발생했습니다.", "system");
        }
    } catch(error) {
        console.error("Error in handleSeekBattle:", error);
        if (error && error.toString().includes('429')) {
            setApiError("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
        } else {
            addLogEntry("전투 시뮬레이션 중 오류가 발생했습니다.", "system");
        }
    } finally {
        setIsLoading(false);
    }
  }, [player, addLogEntry, companions, wars, handleBattleResult, updateTokenUsage]);

  const handleBuyGood = useCallback((goodId: string, price: number) => {
    if (!player) return;
    const tradeBonus = getCompanionSkillBonus('trade');
    const persuasionLevel = getEffectiveSkillLevel(player, companions, 'persuasion');
    const priceMultiplier = 1 - (tradeBonus / 100) - (persuasionLevel * 0.04);
    const finalPrice = Math.max(1, Math.round(price * priceMultiplier));

    if (player.gold < finalPrice) {
      addLogEntry("골드가 부족합니다.", "system");
      return;
    }
    setPlayer(p => {
      if (!p) return null;
      const newInventory = { ...p.inventory };
      newInventory[goodId] = (newInventory[goodId] || 0) + 1;
      return { ...p, gold: p.gold - finalPrice, inventory: newInventory };
    });
    addLogEntry(`${TRADE_GOODS[goodId]?.name || goodId} 1개를 ${finalPrice}골드에 구매했습니다. ${price-finalPrice > 0 ? `(기술 보너스로 ${price - finalPrice}G 절약)`: ''}`, "event");
  }, [player, addLogEntry, getCompanionSkillBonus, companions]);

  const handleSellGood = useCallback((goodId: string, price: number) => {
    if (!player || !player.inventory[goodId] || player.inventory[goodId] <= 0) {
      addLogEntry("판매할 상품이 없습니다.", "system");
      return;
    }
    const tradeBonus = getCompanionSkillBonus('trade');
    const persuasionLevel = getEffectiveSkillLevel(player, companions, 'persuasion');
    const priceMultiplier = 1 + (tradeBonus / 100) + (persuasionLevel * 0.04);
    const finalPrice = Math.round(price * priceMultiplier);

     setPlayer(p => {
      if (!p) return null;
      const newInventory = { ...p.inventory };
      newInventory[goodId] -= 1;
      if (newInventory[goodId] === 0) {
        delete newInventory[goodId];
      }
      return { ...p, gold: p.gold + finalPrice, inventory: newInventory };
    });
    addLogEntry(`${TRADE_GOODS[goodId]?.name || goodId} 1개를 ${finalPrice}골드에 판매했습니다. ${finalPrice-price > 0 ? `(기술 보너스로 ${finalPrice - price}G 추가 이득)`: ''}`, "event");
  }, [player, addLogEntry, getCompanionSkillBonus, companions]);

  const handleBuyItem = useCallback((itemId: string) => {
    if (!player) return;
    const item = ITEMS[itemId];
    if (!item) return;
    if (player.gold < item.price) {
      addLogEntry("골드가 부족합니다.", "system");
      return;
    }
    setPlayer(p => {
      if (!p) return null;
      const newInventory = { ...p.inventory };
      newInventory[itemId] = (newInventory[itemId] || 0) + 1;
      return { ...p, gold: p.gold - item.price, inventory: newInventory };
    });
    addLogEntry(`${item.name} 1개를 ${item.price}골드에 구매했습니다.`, "event");
  }, [player, addLogEntry]);

  const handleBuyEnterprise = useCallback((typeId: string) => {
    if (!player) return;
    const type = ENTERPRISE_TYPES[typeId];
    if (!type) return;
    const location = locations[currentLocationId];
    if (!location) return;

    const alreadyOwned = player.enterprises.find(e => e.locationId === currentLocationId);
    if (alreadyOwned) {
        addLogEntry("이 도시에는 이미 사업장을 소유하고 있습니다.", "system");
        return;
    }

    if (player.gold < type.cost) {
        addLogEntry("자금이 부족합니다.", "system");
        return;
    }

    setPlayer(p => {
        if (!p) return null;
        const newEnterprise: PlayerEnterprise = { typeId, locationId: currentLocationId };
        return {
            ...p,
            gold: p.gold - type.cost,
            enterprises: [...p.enterprises, newEnterprise]
        };
    });
    addLogEntry(`${location.name}에 ${type.name}을(를) ${type.cost}G에 건설했습니다.`, 'event');

  }, [player, currentLocationId, addLogEntry, locations]);

  const handleGatherRumors = useCallback(async () => {
    if (!player || player.gold < 10) {
      addLogEntry("소문을 들으려면 10골드가 필요합니다.", "system");
      return;
    }
    
    const originalGold = player.gold;
    setIsLoading(true);
    setPlayer(p => p ? { ...p, gold: p.gold - 10 } : null);
    addLogEntry("선술집 손님들에게 술을 한 잔 돌리며 소문을 듣습니다...", "system");

    try {
        const { data: rumor, tokens } = await getTavernRumor(locations[currentLocationId]);
        updateTokenUsage(tokens);
        if (rumor) {
          addLogEntry(`[소문] "${rumor}"`, "rumor");
        } else {
          addLogEntry("오늘은 별다른 소문이 없는 것 같습니다.", "system");
        }
    } catch (error) {
        console.error("Error in handleGatherRumors:", error);
         if (error && error.toString().includes('429')) {
            setApiError("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
        } else {
            addLogEntry("소문을 가져오는 중 오류가 발생했습니다.", "system");
        }
         // Rollback the gold spent
         setPlayer(p => p ? { ...p, gold: originalGold } : null);
    } finally {
        setIsLoading(false);
    }
  }, [player, addLogEntry, currentLocationId, locations, updateTokenUsage]);

  const handleUpgradeUnits = useCallback((fromUnitId: string, toUnitId: string, quantity: number) => {
    if (!player || quantity <= 0) return;
    const toUnit = UNITS[toUnitId];
    if (!toUnit?.upgradeFrom) return;
    const fromUnit = UNITS[fromUnitId];
    if (!fromUnit) return;

    const effectiveTrainerSkill = getEffectiveSkillLevel(player, companions, 'trainer');
    const discount = 1 - (effectiveTrainerSkill * 0.05);

    const cost = Math.round((toUnit.upgradeCost || 0) * discount);
    const xpCost = toUnit.xpToUpgrade || 99999;
    const totalCost = cost * quantity;
    const totalXpCost = xpCost * quantity;
    
    if ((player.army[fromUnitId] || 0) < quantity) {
        addLogEntry("업그레이드할 병사가 부족합니다.", "system"); return;
    }
    if (player.gold < totalCost) {
        addLogEntry("훈련 비용이 부족합니다.", "system"); return;
    }
    if ((player.unitExperience[fromUnitId] || 0) < totalXpCost) {
        addLogEntry("병사의 경험이 부족하여 훈련할 수 없습니다.", "system"); return;
    }

    if (toUnit.upgradeRequiresLocation && !toUnit.upgradeRequiresLocation.includes(currentLocationId)) {
        addLogEntry(`${toUnit.name} (으)로 훈련하려면 특정 장소에 있어야 합니다.`, "system"); return;
    }

    if (toUnit.upgradeRequiresCompanion) {
        const hasCompanion = toUnit.upgradeRequiresCompanion.every(reqCompId => player.companions.includes(reqCompId));
        if (!hasCompanion) {
            addLogEntry(`${toUnit.name} (으)로 훈련하려면 특정 동료가 필요합니다.`, "system"); return;
        }
    }

    if (toUnit.upgradeRequiresItems) {
        const hasItems = Object.entries(toUnit.upgradeRequiresItems).every(([itemId, requiredQty]) => {
            return (player.inventory[itemId] || 0) >= requiredQty * quantity;
        });
        if (!hasItems) {
            addLogEntry(`${toUnit.name} (으)로 훈련하려면 특수 장비가 필요합니다.`, "system"); return;
        }
    }

    setPlayer(p => {
        if (!p) return null;
        const newArmy = { ...p.army };
        newArmy[fromUnitId] -= quantity;
        if (newArmy[fromUnitId] === 0) delete newArmy[fromUnitId];
        newArmy[toUnitId] = (newArmy[toUnitId] || 0) + quantity;
        
        const newUnitExperience = { ...p.unitExperience };
        newUnitExperience[fromUnitId] -= totalXpCost;

        const newInventory = { ...p.inventory };
        if (toUnit.upgradeRequiresItems) {
            Object.entries(toUnit.upgradeRequiresItems).forEach(([itemId, requiredQty]) => {
                newInventory[itemId] -= requiredQty * quantity;
                if (newInventory[itemId] <= 0) delete newInventory[itemId];
            });
        }

        return { ...p, army: newArmy, gold: p.gold - totalCost, unitExperience: newUnitExperience, inventory: newInventory };
    });
    addLogEntry(`${fromUnit.name} ${quantity}명을 ${toUnit.name}(으)로 훈련시켰습니다. (비용: ${totalCost}G, ${totalXpCost}XP)`, "event");
  }, [player, addLogEntry, currentLocationId, companions]);

  const handleSeekQuest = useCallback(async (isAIAction: boolean = false): Promise<boolean> => {
      if (!player || player.activeQuest) return false;
      setIsLoading(true);
      const location = locations[currentLocationId];
      if (!location) {
        addLogEntry("현재 위치 정보를 찾을 수 없습니다.", "system");
        setIsLoading(false);
        return false;
      }
      addLogEntry(`${location.ownerId}에게 일거리가 있는지 묻습니다...`, "system");
      
      try {
          const { data: quest, tokens } = await generateQuest(player, location);
          updateTokenUsage(tokens);
          if (quest) {
              if (isAIAction) {
                  setPlayer(p => p ? { ...p, activeQuest: quest } : null);
                  addLogEntry(`[AI 결정] 퀘스트 수락: ${quest.title}`, 'quest');
              } else {
                  setQuestOffer(quest);
              }
              return true;
          } else {
              addLogEntry("영주가 제안할만한 일이 없다고 합니다.", "system");
              return false;
          }
      } catch (error) {
          console.error("Error in handleSeekQuest:", error);
          if (error && error.toString().includes('429')) {
              setApiError("API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
          } else {
              addLogEntry("퀘스트를 생성하는 중 오류가 발생했습니다.", "system");
          }
          return false;
      } finally {
          setIsLoading(false);
      }
  }, [player, currentLocationId, addLogEntry, locations, updateTokenUsage]);

  const handleAcceptQuest = useCallback(() => {
    if (!player || !questOffer) return;
    setPlayer(p => p ? { ...p, activeQuest: questOffer } : null);
    addLogEntry(`[퀘스트 수락] ${questOffer.title}`, 'quest');
    setQuestOffer(null);
  }, [player, questOffer, addLogEntry]);

  const handleDeclineQuest = useCallback(() => {
      addLogEntry("영주의 제안을 정중히 거절했습니다.", "event");
      setQuestOffer(null);
  }, [addLogEntry]);

  const handleJoinFaction = useCallback((factionId: string) => {
    if (!player || player.factionId || (player.renown < 50)) return;
    const faction = FACTIONS[factionId];
    if (!faction) return;
    
    setPlayer(p => {
        if (!p) return null;
        const newRelations = { ...p.factionRelations };
        newRelations[factionId] = (newRelations[factionId] || 0) + 10;

        addLogEntry(`[세력] 당신은 이제 ${faction.name}의 정식 기사입니다!`, 'quest');
        addLogEntry(`${faction.name}과의 관계가 10만큼 증가했습니다.`, 'event');
        
        return {
            ...p,
            factionId: factionId,
            factionRelations: newRelations,
        };
    });

  }, [player, addLogEntry]);
  
  const handleRequestFief = useCallback((factionId: string) => {
    if (!player || player.fiefs.length > 0) return;

    const factionLocations = Object.values(locations).filter(
        l => l.factionId === factionId && l.ownerId !== 'player'
    );
    
    if (factionLocations.length === 0) {
        addLogEntry("이 세력에는 수여할만한 영지가 남아있지 않습니다.", "system");
        return;
    }
    
    // Grant the 'poorest' fief (lowest recruit count as proxy)
    const fiefToGrant = factionLocations.sort((a,b) => a.recruitsAvailable - b.recruitsAvailable)[0];
    
    setLocations(prev => {
        const newLocations = { ...prev };
        newLocations[fiefToGrant.id] = { ...newLocations[fiefToGrant.id], ownerId: 'player' };
        return newLocations;
    });
    
    setPlayer(p => {
        if (!p) return null;
        addLogEntry(`[영지] 군주가 당신의 공적을 높이 사, ${fiefToGrant.name}을(를) 영지로 수여했습니다!`, 'quest');
        return { ...p, fiefs: [...p.fiefs, fiefToGrant.id] };
    });

  }, [player, locations, addLogEntry]);

  const handleCollectTaxes = useCallback((locationId: string) => {
    if (!player) return;
    const location = locations[locationId];
    if (!location || location.ownerId !== 'player' || location.accumulatedTaxes <= 0) return;
    
    const collectedAmount = location.accumulatedTaxes;
    
    setPlayer(p => p ? { ...p, gold: p.gold + collectedAmount } : null);
    
    setLocations(prev => {
        const newLocations = { ...prev };
        newLocations[locationId] = { ...newLocations[locationId], accumulatedTaxes: 0 };
        return newLocations;
    });
    
    addLogEntry(`${location.name}에서 세금 ${collectedAmount}골드를 징수했습니다.`, 'event');
  }, [player, locations, addLogEntry]);

  const handleManageGarrison = useCallback((locationId: string, unitId: string, quantity: number, direction: 'to' | 'from') => {
    if (!player) return;
    const location = locations[locationId];
    if (!location || location.ownerId !== 'player') return;
    const unit = UNITS[unitId];
    if (!unit) return;

    setPlayer(p => {
        if (!p) return null;
        const newArmy = { ...p.army };
        
        if (direction === 'to') { // player -> garrison
            if ((newArmy[unitId] || 0) < quantity) {
                addLogEntry("주둔시킬 병력이 부족합니다.", "system");
                return p;
            }
            newArmy[unitId] -= quantity;
            if (newArmy[unitId] <= 0) delete newArmy[unitId];

            setLocations(prevLocs => {
                const newLocs = { ...prevLocs };
                const newGarrison = { ...newLocs[locationId].garrison };
                newGarrison[unitId] = (newGarrison[unitId] || 0) + quantity;
                newLocs[locationId] = { ...newLocs[locationId], garrison: newGarrison };
                return newLocs;
            });
            addLogEntry(`${unit.name} ${quantity}명을 ${location.name}의 주둔군으로 배치했습니다.`, 'event');

        } else { // garrison -> player
            const newGarrison = { ...location.garrison };
            if ((newGarrison[unitId] || 0) < quantity) {
                addLogEntry("주둔군에서 차출할 병력이 부족합니다.", "system");
                return p;
            }
            newGarrison[unitId] -= quantity;
            if (newGarrison[unitId] <= 0) delete newGarrison[unitId];

            setLocations(prevLocs => ({
                ...prevLocs,
                [locationId]: { ...prevLocs[locationId], garrison: newGarrison }
            }));
            
            newArmy[unitId] = (newArmy[unitId] || 0) + quantity;
            addLogEntry(`${location.name}의 주둔군에서 ${unit.name} ${quantity}명을 부대로 편입했습니다.`, 'event');
        }
        
        return { ...p, army: newArmy };
    });
    
  }, [player, locations, addLogEntry]);


  const handleRecruitCompanion = useCallback((companionId: string) => {
    if (!player) return;
    const companion = companions[companionId];
    if (!companion || companion.status === 'recruited') return;

    if (player.gold < companion.cost) {
      addLogEntry(`${companion.name}을(를) 영입하기 위한 자금이 부족합니다. (필요: ${companion.cost}G)`, 'system');
      return;
    }

    setPlayer(p => {
      if (!p) return null;
      return {
        ...p,
        gold: p.gold - companion.cost,
        companions: [...p.companions, companionId],
      };
    });

    setCompanions(c => ({
      ...c,
      [companionId]: { ...c[companionId], status: 'recruited' },
    }));
    
    addLogEntry(`${companion.name}이(가) 당신의 부대에 합류했습니다!`, 'event');
  }, [player, companions, addLogEntry]);

  const handleEquipItem = useCallback((characterId: string, itemId: string) => {
    const item = ITEMS[itemId];
    if (!item || !player || (player.inventory[itemId] || 0) < 1) return;

    const slot = item.slot;

    // First, update player's inventory (applies to both cases)
    const newPlayerInventory = { ...player.inventory };
    newPlayerInventory[itemId] -= 1;
    if (newPlayerInventory[itemId] === 0) {
      delete newPlayerInventory[itemId];
    }
    
    if (characterId === 'player') {
      const char = player;
      if (char.isWounded) { addLogEntry("부상 중에는 장비를 변경할 수 없습니다.", "system"); return; }

      setPlayer(p => {
        if (!p) return null;
        const currentlyEquippedId = p.equipment[slot];
        const finalInventory = { ...newPlayerInventory };

        if (currentlyEquippedId) {
          finalInventory[currentlyEquippedId] = (finalInventory[currentlyEquippedId] || 0) + 1;
        }

        const newEquipment = { ...p.equipment, [slot]: itemId };
        addLogEntry(`${item.name}을(를) 장착했습니다.`, 'event');
        return { ...p, equipment: newEquipment, inventory: finalInventory };
      });
    } else {
      // Companion equipment
      const companion = companions[characterId];
      if (!companion) return;
      if (companion.isWounded) { addLogEntry(`${companion.name}은(는) 부상 중이라 장비를 변경할 수 없습니다.`, "system"); return; }


      const currentlyEquippedId = companion.equipment[slot];

      setCompanions(cs => {
        const newCompanions = { ...cs };
        const compToUpdate = { ...newCompanions[characterId] };
        compToUpdate.equipment = { ...compToUpdate.equipment, [slot]: itemId };
        newCompanions[characterId] = compToUpdate;
        return newCompanions;
      });

      setPlayer(p => {
          if (!p) return null;
          const finalInventory = { ...newPlayerInventory };
          if(currentlyEquippedId){
              finalInventory[currentlyEquippedId] = (finalInventory[currentlyEquippedId] || 0) + 1;
          }
          return { ...p, inventory: finalInventory };
      });
      
      addLogEntry(`${companion.name}이(가) ${item.name}을(를) 장착했습니다.`, 'event');
    }
  }, [player, companions, addLogEntry]);

  const handleUnequipItem = useCallback((characterId: string, slot: EquipmentSlot) => {
    if (!player) return;

    if (characterId === 'player') {
       const char = player;
       if (char.isWounded) { addLogEntry("부상 중에는 장비를 변경할 수 없습니다.", "system"); return; }
       const itemId = player.equipment[slot];
       if (!itemId) return;
       const item = ITEMS[itemId];

       setPlayer(p => {
         if (!p) return null;
         const newEquipment = { ...p.equipment };
         delete newEquipment[slot];
         const newInventory = { ...p.inventory };
         newInventory[itemId] = (newInventory[itemId] || 0) + 1;
         addLogEntry(`${item.name}을(를) 장착 해제했습니다.`, 'event');
         return { ...p, equipment: newEquipment, inventory: newInventory };
       });
    } else {
        const companion = companions[characterId];
        if (!companion) return;
        if (companion.isWounded) { addLogEntry(`${companion.name}은(는) 부상 중이라 장비를 변경할 수 없습니다.`, "system"); return; }
        const itemId = companion.equipment[slot];
        if (!itemId) return;
        const item = ITEMS[itemId];

        setCompanions(cs => {
            const newCompanions = { ...cs };
            const compToUpdate = { ...newCompanions[characterId] };
            delete compToUpdate.equipment[slot];
            newCompanions[characterId] = { ...compToUpdate };
            return newCompanions;
        });

        setPlayer(p => {
            if (!p) return null;
            const newInventory = { ...p.inventory };
            newInventory[itemId] = (newInventory[itemId] || 0) + 1;
            addLogEntry(`${companion.name}이(가) ${item.name}을(를) 장착 해제했습니다.`, 'event');
            return { ...p, inventory: newInventory };
        });
    }
  }, [player, companions, addLogEntry]);
  
  const handleSpendSkillPoint = useCallback((skillId: string) => {
      if (!player || player.skillPoints < 1) return;
      const skill = SKILLS[skillId];
      if (!skill) return;

      const currentLevel = player.skills[skillId] || 0;
      if (currentLevel >= skill.maxLevel) {
          addLogEntry("이미 이 기술을 마스터했습니다.", 'system');
          return;
      }
      
      setPlayer(p => {
          if (!p) return null;
          const newSkills = { ...p.skills };
          newSkills[skillId] = (newSkills[skillId] || 0) + 1;
          addLogEntry(`기술 [${skill.name}] 레벨이 ${newSkills[skillId]}이(가) 되었습니다.`, 'quest');
          return {
              ...p,
              skills: newSkills,
              skillPoints: p.skillPoints - 1
          }
      });
  }, [player, addLogEntry]);
  
  const handleRaidLocation = useCallback((locationId: string) => {
    if (!player) return;
    const location = locations[locationId];
    if (!location || location.status === 'looted' || player.fiefs.includes(locationId)) {
      addLogEntry("이곳은 약탈할 수 없습니다.", "system");
      return;
    }
    const locationFaction = FACTIONS[location.factionId];
    if (!locationFaction) return;
    
    setIsLoading(true);
    // Simple loot calculation
    const goldLooted = Math.floor(Math.random() * 500) + 200;
    const renownLost = -15;
    const relationLost = -30;

    addLogEntry(`당신과 당신의 부하들이 ${location.name}을(를) 약탈합니다!`, 'battle');
    addLogEntry(`당신은 ${goldLooted} 골드를 약탈하고, 약간의 보급품을 챙겼습니다.`, 'event');
    addLogEntry(`이 무자비한 행동으로 당신의 명성이 ${-renownLost}만큼 감소하고, ${locationFaction.name}과의 관계가 크게 악화되었습니다.`, 'event');
    
    setPlayer(p => {
      if (!p) return null;
      const newRelations = { ...p.factionRelations };
      newRelations[location.factionId] = (newRelations[location.factionId] || 0) + relationLost;
      
      return {
        ...p,
        gold: p.gold + goldLooted,
        renown: Math.max(0, p.renown + renownLost),
        factionRelations: newRelations,
      }
    });

    setLocations(locs => ({
      ...locs,
      [locationId]: {
        ...locs[locationId],
        status: 'looted',
        lootedUntilDay: day + 7 // Looted for 7 days
      }
    }));
    
    setIsLoading(false);
  }, [player, locations, day, addLogEntry]);
  
  const handleHealParty = useCallback(() => {
    if (!player) return;

    const HEAL_COST = 100;
    const HP_RECOVERED = 50;
    const isAnyoneWounded = player.isWounded || player.companions.some(id => companions[id]?.isWounded);

    if (!isAnyoneWounded) {
      addLogEntry("회복이 필요한 부대원이 없습니다.", "system");
      return;
    }

    if (player.gold < HEAL_COST) {
      addLogEntry(`휴식을 취하기 위한 비용이 부족합니다. (필요: ${HEAL_COST}G)`, "system");
      return;
    }

    let playerAfterHealing = { ...player, gold: player.gold - HEAL_COST };
    let companionsAfterHealing = JSON.parse(JSON.stringify(companions));
    let healingMessages: string[] = [`편안한 휴식에 100골드를 지불했습니다.`];

    // Heal player
    if (playerAfterHealing.isWounded) {
      const oldHp = player.hp;
      const newHp = Math.min(MAX_HP, playerAfterHealing.hp + HP_RECOVERED);
      if (newHp >= MAX_HP) {
        playerAfterHealing.isWounded = false;
        playerAfterHealing.hp = MAX_HP;
        healingMessages.push("당신은 완전히 회복되었습니다.");
      } else {
        healingMessages.push(`당신의 체력이 ${newHp - oldHp}만큼 회복되었습니다.`);
        playerAfterHealing.hp = newHp;
      }
    }

    // Heal companions
    playerAfterHealing.companions.forEach(compId => {
      const comp = companionsAfterHealing[compId];
      if (comp && comp.isWounded) {
        const oldHp = comp.hp;
        const newHp = Math.min(MAX_HP, comp.hp + HP_RECOVERED);
        if (newHp >= MAX_HP) {
          comp.isWounded = false;
          comp.hp = MAX_HP;
          healingMessages.push(`${comp.name}이(가) 완전히 회복되었습니다.`);
        } else {
          healingMessages.push(`${comp.name}의 체력이 ${newHp - oldHp}만큼 회복되었습니다.`);
          comp.hp = newHp;
        }
      }
    });

    setPlayer(playerAfterHealing);
    setCompanions(companionsAfterHealing);
    addLogEntry(healingMessages.join('\n'), 'event');
  }, [player, companions, addLogEntry]);

  const handleResetGame = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const executeReset = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
    // Keep API key
    window.location.reload();
  }, []);

  const toggleDelegation = useCallback(() => {
    setIsDelegated(prev => {
        const newState = !prev;
        addLogEntry(`AI 위임 모드가 ${newState ? '활성화' : '비활성화'}되었습니다.`, 'system');
        return newState;
    });
  }, [addLogEntry]);

  const handleAIDecision = useCallback(async () => {
      if (!player || isLoading) return;

      const travelToRandomConnectedCity = () => {
          const connected = locations[currentLocationId]?.connectedTo;
          if (connected && connected.length > 0) {
              const destinationId = connected[Math.floor(Math.random() * connected.length)];
              const destination = locations[destinationId];
              if (destination) {
                addLogEntry(`[AI] 다음 행동을 위해 ${destination.name}(으)로 이동합니다.`, 'system');
                handleTravel(destinationId);
                return;
              }
          }
          addLogEntry(`[AI] 이동할 곳이 없어 하루를 보냅니다.`, 'system');
          setDay(d => d + 1);
      };

      addLogEntry("[AI] 다음 행동을 결정합니다...", 'system');

      try {
        // Priority 1: Quest Handling
        if (player.activeQuest) {
            const quest = player.activeQuest;
            if (quest.type === 'delivery') {
                if (quest.targetLocationId && currentLocationId !== quest.targetLocationId) {
                    const destination = locations[quest.targetLocationId];
                    if (destination) {
                        addLogEntry(`[AI] 배달 퀘스트를 위해 ${destination.name}(으)로 이동합니다.`, 'system');
                        handleTravel(quest.targetLocationId);
                    } else {
                        addLogEntry(`[AI] 오류: 배달 퀘스트의 목표 지점(${quest.targetLocationId})을 찾을 수 없습니다. 퀘스트를 포기합니다.`, 'system');
                        setPlayer(p => p ? { ...p, activeQuest: null } : null);
                    }
                }
                // If at destination, quest completes automatically in completeTravel.
                // If stuck, it will be handled on next turn. This return is key.
                return;
            } 
            
            if (quest.type === 'bounty') {
                setIsLoading(true);
                const { data: destinationId, tokens } = await getAIDestinationForBountyQuest(quest, locations);
                updateTokenUsage(tokens);
                setIsLoading(false);
                
                if (destinationId && destinationId !== currentLocationId) {
                    const destination = locations[destinationId];
                    addLogEntry(`[AI] 현상금 퀘스트 목표를 찾아 ${destination.name}(으)로 이동합니다.`, 'system');
                    handleTravel(destinationId);
                } else if (destinationId) { // At the right location
                    addLogEntry(`[AI] 이 지역에서 현상금 퀘스트 목표를 찾기 위해 전투 상대를 찾습니다.`, 'system');
                    await handleSeekBattle();
                } else { // API failed to return a location
                    addLogEntry(`[AI] 현상금 퀘스트 목표 위치를 파악하지 못했습니다. 다른 곳으로 이동하여 정보를 수집합니다.`, 'system');
                    travelToRandomConnectedCity();
                }
                return;
            }
        } else { // No active quest
            const questSucceeded = await handleSeekQuest(true);
            if (!questSucceeded) {
                // Failed to get a quest, so move somewhere else to try again.
                addLogEntry(`[AI] 이 도시에서 퀘스트를 얻지 못했습니다. 다른 도시로 이동합니다.`, 'system');
                travelToRandomConnectedCity();
            }
            return; // End turn whether quest was accepted or not.
        }

        // Priority 3: Heal if wounded
        if (player.isWounded || player.companions.some(cId => companions[cId]?.isWounded)) {
            addLogEntry(`[AI] 부상 회복을 위해 하루 휴식합니다.`, 'system');
            setDay(d => d + 1);
            return;
        }

        // Priority 4: Army Management
        const leadershipLevel = getEffectiveSkillLevel(player, companions, 'leadership');
        const maxArmySize = 20 + Math.floor(player.renown / 25) + leadershipLevel * 5;
        const currentArmySize = Object.values(player.army).reduce((a, b) => a + b, 0) + player.companions.length;

        const availableCompanion = Object.values(companions).find(c => c.status === 'unrecruited' && c.locationId === currentLocationId);
        if (availableCompanion && player.gold >= availableCompanion.cost) {
            addLogEntry(`[AI] ${availableCompanion.name}을(를) 영입합니다.`, 'system');
            handleRecruitCompanion(availableCompanion.id);
            setDay(d => d + 1);
            return;
        }
        
        for (const toUnitId of Object.keys(UNITS)) {
            const toUnit = UNITS[toUnitId];
            const fromUnitId = toUnit.upgradeFrom;
            if (fromUnitId && (player.army[fromUnitId] || 0) > 0) {
                const cost = toUnit.upgradeCost || 0;
                const xpCost = toUnit.xpToUpgrade || 0;
                if (player.gold >= cost && (player.unitExperience[fromUnitId] || 0) >= xpCost) {
                    addLogEntry(`[AI] ${UNITS[fromUnitId].name}을(를) ${toUnit.name}(으)로 훈련시킵니다.`, 'system');
                    handleUpgradeUnits(fromUnitId, toUnitId, 1);
                    setDay(d => d + 1);
                    return;
                }
            }
        }
        
        const currentLoc = locations[currentLocationId];
        const baseRecruitCost = UNITS['recruit'].recruitCost || 10;
        if (currentArmySize < maxArmySize && player.gold > baseRecruitCost * 5 && currentLoc?.recruitsAvailable > 0 && currentLoc?.status !== 'looted') {
            if (player.gold >= baseRecruitCost) {
                addLogEntry(`[AI] 신병을 모집합니다.`, 'system');
                handleRecruit();
                setDay(d => d + 1);
                return;
            }
        }

        // Priority 5: Economic decisions
        const currentLocationData = locations[currentLocationId];
        if (currentLocationData && player.gold > 10000 && !player.enterprises.some(e => e.locationId === currentLocationId)) {
            const bestEnterprise = Object.values(ENTERPRISE_TYPES).sort((a,b) => b.baseWeeklyProfit - a.baseWeeklyProfit)[0];
            if (bestEnterprise && player.gold >= bestEnterprise.cost) {
                addLogEntry(`[AI] ${currentLocationData.name}에 ${bestEnterprise.name}을(를) 건설합니다.`, 'system');
                handleBuyEnterprise(bestEnterprise.id);
                setDay(d => d + 1);
                return;
            }
        }

        // Priority 6: Default Action
        addLogEntry(`[AI] 특별한 할 일이 없어 다른 곳으로 이동합니다.`, 'system');
        travelToRandomConnectedCity();

    } catch (error) {
        console.error("Error during AI decision:", error);
        if (error && error.toString().includes('429')) {
            setApiError("API 요청 한도를 초과하여 AI 위임을 일시 중지합니다. 잠시 후 다시 시도해주세요.");
            setIsDelegated(false); // Safety break
        } else {
            addLogEntry("[AI] 알 수 없는 오류로 행동을 결정할 수 없습니다. 하루를 보냅니다.", 'system');
            setDay(d => d + 1);
        }
        if(isLoading) setIsLoading(false);
    }
  }, [player, companions, locations, currentLocationId, isLoading, addLogEntry, handleTravel, handleSeekBattle, handleSeekQuest, handleRecruitCompanion, handleUpgradeUnits, handleRecruit, handleBuyEnterprise, updateTokenUsage]);
  
  useInterval(() => {
    if (isDelegated) {
      handleAIDecision();
    }
  }, 2000);


  const renderContent = () => {
    const totalIsLoading = isLoading || isApiKeyLoading;

    if (totalIsLoading && gamePhase === GamePhase.START_SCREEN) {
      return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xl">로딩 중...</div>
    }

    switch (gamePhase) {
      case GamePhase.START_SCREEN:
        return <StartScreen onStartGame={handleStartGame} isLoading={totalIsLoading} apiKeyStatus={apiKeyStatus} />;
      case GamePhase.GAMEPLAY:
        if (player && locations[currentLocationId]) {
          return (
            <GameScreen
              player={player}
              locations={locations}
              currentLocation={locations[currentLocationId]}
              log={log}
              isLoading={totalIsLoading || isResolvingEvent}
              apiKeyStatus={apiKeyStatus}
              questOffer={questOffer}
              statChanges={statChanges}
              highlightedLocationId={highlightedLocationId}
              companions={companions}
              aiLords={aiLords}
              wars={wars}
              isDelegated={isDelegated}
              tokenUsage={tokenUsage}
              onToggleDelegation={toggleDelegation}
              onHighlightLocation={handleHighlightLocation}
              onTravel={handleTravel}
              onRecruit={handleRecruit}
              onRecruitCompanion={handleRecruitCompanion}
              onSeekBattle={handleSeekBattle}
              onBuyGood={handleBuyGood}
              onSellGood={handleSellGood}
              onBuyItem={handleBuyItem}
              onBuyEnterprise={handleBuyEnterprise}
              onGatherRumors={handleGatherRumors}
              onUpgradeUnits={handleUpgradeUnits}
              onSeekQuest={() => handleSeekQuest(false)}
              onAcceptQuest={handleAcceptQuest}
              onDeclineQuest={handleDeclineQuest}
              onJoinFaction={handleJoinFaction}
              onRequestFief={handleRequestFief}
              onCollectTaxes={handleCollectTaxes}
              onManageGarrison={handleManageGarrison}
              onEquipItem={handleEquipItem}
              onUnequipItem={handleUnequipItem}
              onResetGame={handleResetGame}
              onSpendSkillPoint={handleSpendSkillPoint}
              onRaidLocation={handleRaidLocation}
              onHealParty={handleHealParty}
            />
          );
        }
        // This case is hit if the game is loading from storage but not finished yet.
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xl">게임 불러오는 중...</div>;
      default:
        // Fallback for any unexpected state
        return <StartScreen onStartGame={handleStartGame} isLoading={totalIsLoading} apiKeyStatus={apiKeyStatus} />;
    }
  };

  return (
    <div className="bg-slate-900">
      {showResetConfirm && (
        <ConfirmModal
          title="게임 초기화"
          message="정말로 게임을 초기화하시겠습니까? 모든 진행 상황이 사라집니다."
          onConfirm={executeReset}
          onCancel={() => setShowResetConfirm(false)}
          confirmText="초기화"
          cancelText="취소"
        />
      )}
      {apiError && (
        <ErrorModal
            title="API 오류"
            message={apiError}
            onClose={() => setApiError(null)}
        />
      )}
      {travelEvent && player && (
        <TravelEventModal 
          event={travelEvent}
          isResolving={isResolvingEvent}
          onResolve={(choice) => handleEventResolution(choice, travelEvent.destinationId)}
        />
      )}
      {renderContent()}
      <ApiKeyManager status={apiKeyStatus} onSaveKey={handleSaveApiKey} isLoading={isApiKeyLoading} />
    </div>
  );
};

export default App;
