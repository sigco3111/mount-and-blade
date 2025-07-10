

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { BattleResult, CharacterBackground, Player, Location, Unit, Quest, Item, EquipmentSlot, Companion } from '../types';
import { UNITS, ITEMS, FACTIONS } from "../constants";

let ai: GoogleGenAI | null = null;

export const initializeAi = (apiKey: string) => {
    if (!apiKey) {
        console.error("Attempted to initialize AI with no key.");
        ai = null;
        return;
    }
    ai = new GoogleGenAI({ apiKey: apiKey });
};

export const verifyApiKey = async (key: string): Promise<boolean> => {
    if (!key) return false;
    try {
        const testAi = new GoogleGenAI({ apiKey: key });
        const response = await testAi.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Hi',
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return !!response.text;
    } catch (e) {
        console.error("API Key verification failed:", e);
        return false;
    }
};

const parseJsonResponse = <T,>(text: string): T | null => {
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response:", e, "Raw text:", text);
    return null;
  }
};

export const generateCharacter = async (background: CharacterBackground): Promise<{ data: Player | null; tokens: number }> => {
  if (!ai) {
      console.error("AI not initialized. Cannot generate character.");
      return { data: null, tokens: 0 };
  }
  const prompt = `
    Mount & Blade 게임 세계관을 기반으로, 플레이어 캐릭터를 생성합니다.
    선택한 배경: "${background.name} - ${background.description}"
    이 배경에 어울리는 캐릭터 이름, 짧은 배경 이야기, 초기 자금(골드), 초기 명성, 초기 병력, 초기 장비를 생성해주세요.
    
    규칙:
    - 골드: 상인은 2000-2500, 귀족은 1500-2000, 나머지는 1000-1500 사이에서 무작위로 정해주세요.
    - 명성: 귀족은 50-100, 나머지는 10-30 사이에서 무작위로 정해주세요.
    - 초기 병력: 밀렵꾼은 5-8명, 나머지는 2-5명의 '신병(recruit)'으로 구성됩니다.
    - 이름은 배경에 어울리는 유럽 중세 스타일로 만들어주세요.
    - 모든 캐릭터는 기본적으로 '낡은 누더기(tattered_rags)'를 몸에 장착합니다.
    - 대장장이(blacksmith) 배경은 추가로 '녹슨 검(rusty_sword)'을 무기로 장착합니다.

    결과는 반드시 다음 JSON 형식으로 반환해야 합니다. 다른 텍스트는 포함하지 마세요.
    {
      "name": "string",
      "backstory": "string (1-2 sentences, 반드시 한국어로 작성)",
      "gold": number,
      "renown": number,
      "level": 1,
      "xp": 0,
      "skillPoints": 1,
      "skills": {},
      "unitExperience": {},
      "factionId": null,
      "army": { "recruit": number },
      "woundedArmy": {},
      "inventory": {},
      "equipment": { "body": "tattered_rags", "weapon": "string | null" },
      "activeQuest": null,
      "factionRelations": {},
      "companions": [],
      "enterprises": [],
      "fiefs": [],
      "hp": 100,
      "isWounded": false
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.9,
      },
    });
    const tokens = response.usageMetadata?.totalTokenCount || 0;
    const player = parseJsonResponse<Player>(response.text);
    if (player) {
      player.inventory = player.inventory || {};
      player.army = player.army || { recruit: 3 };
      player.woundedArmy = player.woundedArmy || {};
      player.equipment = player.equipment || { body: 'tattered_rags' };
      if (!player.equipment.body) player.equipment.body = 'tattered_rags';
      player.activeQuest = null;
      player.factionId = null;
      player.factionRelations = player.factionRelations || {};
      player.companions = player.companions || [];
      player.enterprises = player.enterprises || [];
      player.fiefs = player.fiefs || [];
      player.level = 1;
      player.xp = 0;
      player.skillPoints = 1;
      player.skills = {};
      player.unitExperience = {};
      player.hp = 100;
      player.isWounded = false;
    }
    return { data: player, tokens };
  } catch (error) {
    console.error("Error generating character:", error);
    throw error;
  }
};

const formatArmyForPrompt = (army: Record<string, number>): string => {
  if (Object.keys(army).length === 0) return '없음';
  return Object.entries(army)
    .map(([unitId, quantity]) => `${UNITS[unitId]?.name || unitId}: ${quantity}명`)
    .join(', ');
};

const formatEquipmentForPrompt = (equipment: Partial<Record<EquipmentSlot, string>>): { text: string, effects: Record<string, number> } => {
    const equippedItems = Object.values(equipment).map(itemId => ITEMS[itemId]).filter(Boolean);
    if (equippedItems.length === 0) return { text: '없음', effects: {} };

    const effects: Record<string, number> = { attack: 0, armor: 0 };
    equippedItems.forEach(item => {
        for (const [effect, value] of Object.entries(item.effects)) {
            effects[effect] = (effects[effect] || 0) + value;
        }
    });

    const text = equippedItems.map(item => item.name).join(', ');
    return { text, effects };
};

const formatCompanionsForPrompt = (companionIds: string[], allCompanions: Record<string, Companion>): string => {
    if (companionIds.length === 0) return '없음';
    return companionIds.map(id => {
        const comp = allCompanions[id];
        if (!comp) return '';
        const { text: equipmentText } = formatEquipmentForPrompt(comp.equipment);
        const skillsText = Object.entries(comp.skills).map(([skill, val]) => `${skill} ${val}`).join(', ');
        return `- ${comp.name} (상태: ${comp.isWounded ? '부상' : '정상'}, 장비: ${equipmentText}, 기술: ${skillsText})`;
    }).join('\n');
};

export const simulateBattle = async (player: Player, enemyName: string, enemySize: number, wars: string[], allCompanions: Record<string, Companion>, effectiveTactics: number, effectiveSurgery: number): Promise<{ data: BattleResult | null; tokens: number }> => {
  if (!ai) {
      console.error("AI not initialized. Cannot simulate battle.");
      return { data: null, tokens: 0 };
  }
  const totalPlayerTroops = Object.values(player.army).reduce((sum, count) => sum + count, 0);
  const armyComposition = formatArmyForPrompt(player.army);
  const { text: equipmentText, effects: equipmentEffects } = formatEquipmentForPrompt(player.equipment);
  const companionsPromptPart = formatCompanionsForPrompt(player.companions, allCompanions);
  
  const questPromptPart = player.activeQuest && player.activeQuest.type === 'bounty'
    ? `
    플레이어는 현재 활성 퀘스트를 가지고 있습니다:
    - 퀘스트: "${player.activeQuest.title}"
    - 목표: ${player.activeQuest.targetEnemyName} 소탕
    전투 시뮬레이션 시, 조우한 적(${enemyName})이 이 퀘스트 목표와 관련이 있는지 판단해주세요.
    만약 관련이 있고 플레이어가 승리하면, "questUpdate" 필드에 퀘스트 완료 정보를 포함시켜주세요.`
    : `플레이어는 현재 현상금 사냥 퀘스트가 없습니다.`;


  const prompt = `
    Mount & Blade 스타일의 텍스트 기반 전투를 시뮬레이션합니다.
    
    플레이어 정보:
    - 소속 세력: ${player.factionId ? FACTIONS[player.factionId].name : '없음'}
    - 현재 전쟁 중인 세력: ${wars.length > 0 ? wars.map(fid => FACTIONS[fid]?.name || fid).join(', ') : '없음'}
    - 군대 규모: ${totalPlayerTroops}명 (+ 동료 ${player.companions.length}명)
    - 군대 구성: ${armyComposition}
    - 명성: ${player.renown}
    - 플레이어 상태: ${player.isWounded ? '부상' : '정상'}
    - 장비: ${equipmentText}
    - 장비 보너스: 공격력 +${equipmentEffects.attack || 0}, 방어력 +${equipmentEffects.armor || 0}
    - 파티 전술 스킬 레벨: ${effectiveTactics}
    - 파티 수술 스킬 레벨: ${effectiveSurgery}
    - 동료:
    ${companionsPromptPart}

    적 정보:
    - 적 유형: ${enemyName}
    - 적 군대 규모: ${enemySize}명

    퀘스트 정보:
    ${questPromptPart}

    시뮬레이션 규칙:
    1. 전투 결과를 'player_victory', 'player_defeat', 'draw' 중 하나로 결정합니다.
    2. **플레이어의 '기술', '장비', '동료', 군대의 '질'을 최우선으로 고려해야 합니다.**
       - 전술 스킬(Tactics): 레벨이 높을수록 플레이어는 더 유리한 위치에서 전투를 시작하여, 아군의 손실이 극적으로 줄어들고 적에게 더 큰 피해를 입힐 수 있습니다. 레벨 ${effectiveTactics}은 상당한 이점을 제공합니다.
       - 수술 스킬(Surgery): **매우 중요합니다.** 레벨 ${effectiveSurgery}는 전투에서 사망할 병사를 '부상(wounded)' 상태로 만들 확률을 높여줍니다. 수술 레벨이 높을수록 사망자(losses)가 줄고 부상자(wounded)가 늘어납니다. 부상자는 전투 후 회복할 수 있습니다.
       - 장비 보너스는 전투에 막대한 영향을 줍니다.
       - 동료는 매우 강력한 유닛이며, 부상당한 상태에서는 전투에 참여할 수 없습니다. 전투에서 패배하더라도 죽지 않고 '부상'만 당합니다.
       - 플레이어가 부상당한 상태라면, 전투를 지휘할 수 없어 매우 불리하게 시작됩니다.
    3. 전투 과정을 묘사하는 2-3 문장의 짧고 극적인 서사를 생성합니다.
    4. **손실 계산:** 결과에 따라 플레이어의 '사망자(playerLosses)'와 '부상자(playerWounded)'를 군대 구성에 맞게 분배하여 계산합니다. 약한 유닛이 더 많이 피해를 입습니다. 동료는 손실에 포함되지 않습니다.
       - 수술 스킬 레벨에 따라 사망자 대신 부상자가 더 많이 발생해야 합니다.
    5. **패배 시 결과:** 플레이어가 패배하면, \`playerDefeated\`를 true로 설정해주세요. 이는 플레이어와 모든 동료가 '부상' 상태가 됨을 의미합니다.
    6. 승리 시 약탈한 골드의 양을 계산합니다. (보통 적 규모의 10~20배) 동료의 'looting' 스킬은 이 양을 증가시킬 수 있습니다.
    7. **경험치 계산:**
       - 플레이어 경험치 (playerXpGained): 적 규모 * 10. 승리 시 100%, 무승부 시 50%, 패배 시 20%.
       - 부대 경험치 (xpGained): 적 규모 * 5. 승리 시 100%, 무승부 시 50%, 패배 시 20%.
       - 값은 반드시 정수로 반환해주세요.
    8. 만약 위에서 언급된 현상금 사냥 퀘스트가 완료되었다면, questUpdate 필드를 JSON에 추가합니다.

    결과는 반드시 다음 JSON 형식으로 반환해야 합니다. 다른 텍스트는 포함하지 마세요.
    {
      "narrative": "string",
      "outcome": "player_victory" | "player_defeat" | "draw",
      "playerLosses": { "recruit": 1, "swadian_footman": 0 },
      "playerWounded": { "recruit": 5, "swadian_footman": 2 },
      "playerDefeated": boolean,
      "enemyLosses": number,
      "goldLooted": number,
      "xpGained": number,
      "playerXpGained": number,
      "questUpdate": { "completed": boolean, "narrative": "string" } | null
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 1.0,
        thinkingConfig: { thinkingBudget: 0 } 
      },
    });
    const tokens = response.usageMetadata?.totalTokenCount || 0;
    const result = parseJsonResponse<BattleResult>(response.text);
    if(result) {
        result.playerLosses = result.playerLosses || {};
        result.playerWounded = result.playerWounded || {};
    }
    return { data: result, tokens };
  } catch (error) {
    console.error("Error simulating battle:", error);
    throw error;
  }
};

export const getTavernRumor = async (location: Location): Promise<{ data: string | null; tokens: number }> => {
  if (!ai) {
      console.error("AI not initialized. Cannot get tavern rumor.");
      return { data: null, tokens: 0 };
  }
  const prompt = `
    당신은 Mount & Blade 세계관의 한 선술집에 있는 수다쟁이 손님입니다. 이 대화는 소식을 묻는 한 여행자와 나누는 것입니다.
    당신은 현재 ${location.name} 도시에 있습니다.
    이 도시의 설명: "${location.description}".

    현재 도시와 세계관에 대한 지식을 바탕으로 짧고 흥미로운 소문(1-2 문장)을 한국어로 하나 생성해주세요.
    소문은 교역, 영주, 도적, 정치, 혹은 선술집 구석에 앉아있는 특별한 인물(동료)에 관한 것일 수 있습니다.
    인사말이나 다른 추가 텍스트 없이 소문 내용만 문자열로 반환해주세요.

    예시: "사르고스에 있는 상인들이 요즘 포도주에 값을 잘 쳐준다고 들었소. 노르드 전사들이 축제를 벌이고 있다나 뭐라나."
    예시: "왠 상인 출신 남자가 보이던데, 일행을 찾고 있는 것 같더군."
  `;

  try {
     const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 1.0,
      },
    });
    const tokens = response.usageMetadata?.totalTokenCount || 0;
    return { data: response.text.trim(), tokens };
  } catch (error) {
    console.error("Error getting tavern rumor:", error);
    throw error;
  }
};

export const generateQuest = async (player: Player, location: Location): Promise<{ data: Quest | null; tokens: number }> => {
  if (!ai) {
      console.error("AI not initialized. Cannot generate quest.");
      return { data: null, tokens: 0 };
  }
  const totalArmySize = Object.values(player.army).reduce((sum, count) => sum + count, 0);

  const prompt = `
    You are a quest generator for a Mount & Blade inspired web game.
    Generate a quest for a player in ${location.name}.
    The lord of this city is ${location.ownerId}. This lord belongs to faction ${location.factionId}.

    Player Info:
    - Level: ${player.level}
    - Renown: ${player.renown}
    - Army Size: ${totalArmySize}
    - Gold: ${player.gold}
    - Faction: ${player.factionId ? FACTIONS[player.factionId].name : 'Unaligned'}
    - Number of Companions: ${player.companions.length}

    Rules:
    1. Quest Type: Choose between 'bounty' (hunt specific enemies) or 'delivery' (transport goods).
    2. Difficulty & Context: Tailor the quest to the player's info. A low-level/low-renown player should get simple quests. A high-level player can get harder quests.
        - If the player is in a faction (not 'Unaligned'), the quest should be relevant to that faction's interests. For example, hunting enemies of the state, or delivering military supplies to a friendly castle.
        - If unaligned, quests should be more generic (e.g. helping villagers, merchant requests).
    3. Logic:
        - 'delivery' quests must target a *different* city.
        - 'bounty' quests should name a specific enemy type found in the region.
        - The quest should be something the player can reasonably accomplish.
    4. Rewards: Gold and Renown should be proportional to the difficulty. (e.g., Delivery: 100-300g, 5-10 renown. Bounty: 200-800g, 10-25 renown).

    Return ONLY a JSON object in the following format. Do not include any other text.
    {
      "id": "string (a unique kebab-case id, e.g., 'bounty-sea-raiders-tihr')",
      "title": "string (e.g., '티르의 해적 소탕')",
      "description": "string (The lord's words describing the quest in Korean)",
      "type": "bounty" | "delivery",
      "giver": "${location.ownerId}",
      "factionId": "${location.factionId}",
      "status": "active",
      "targetLocationId": "string | null (e.g., 'sargoth')",
      "targetItemId": "string | null (e.g., 'wine')",
      "targetItemQuantity": "number | null",
      "targetEnemyName": "string | null (e.g., '해적 두목')",
      "targetEnemyLocationHint": "string | null (e.g., '티르 해안')",
      "rewardGold": "number",
      "rewardRenown": "number"
    }
  `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 1.2,
          },
        });
        const tokens = response.usageMetadata?.totalTokenCount || 0;
        const quest = parseJsonResponse<Quest>(response.text);
        return { data: quest, tokens };
    } catch (error) {
        console.error("Error generating quest:", error);
        throw error;
    }
};

export const getAIDestinationForBountyQuest = async (quest: Quest, locations: Record<string, Location>): Promise<{ data: string | null; tokens: number }> => {
  if (!ai) {
    console.error("AI not initialized. Cannot get AI destination.");
    return { data: null, tokens: 0 };
  }

  const simplifiedLocations = Object.values(locations).map(l => ({
    id: l.id,
    name: l.name,
    description: l.description,
  }));

  const prompt = `
    You are an AI assistant in a text-based RPG. The player has a bounty quest and needs to decide which location to travel to in order to find the target.
    Based on the quest information and the list of available locations, choose the single most logical location ID to travel to.

    Player's Current Quest:
    - Title: "${quest.title}"
    - Target: "${quest.targetEnemyName}"
    - Location Hint: "${quest.targetEnemyLocationHint}"

    Available Locations in the world:
    ${JSON.stringify(simplifiedLocations)}

    Your Task:
    1.  Analyze the "Location Hint". This is the most important piece of information.
    2.  Match the hint to a location's name or description. For example:
        - If the hint is "티르 해안" (Tihr coast), the correct destination is "tihr".
        - If the hint is "디림과 욱스칼 사이의 길" (the road between Dhirim and Uxkhal), a good choice would be either "dhirim" or "uxkhal".
        - If the hint is "초원 지대" (the steppe), look for locations described as being in the steppe, like "tulga" or "khudan".
    3.  Choose the single best location ID from the provided list.
    4.  The output MUST BE ONLY a valid JSON object in the specified format. Do not include any other text, reasoning, or markdown fences.

    JSON Output Format:
    {
      "destinationId": "string"
    }
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });
    const tokens = response.usageMetadata?.totalTokenCount || 0;
    const result = parseJsonResponse<{ destinationId: string }>(response.text);
    // Validate that the returned ID is a real location
    if (result && locations[result.destinationId]) {
        return { data: result.destinationId, tokens };
    }
    console.warn("AI returned an invalid or null destination ID:", result);
    return { data: null, tokens };
  } catch (error) {
    console.error("Error getting AI destination for bounty quest:", error);
    throw error;
  }
};