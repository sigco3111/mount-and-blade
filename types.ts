export enum GamePhase {
  START_SCREEN,
  GAMEPLAY,
  BATTLE,
}

export enum CharacterBackgroundId {
  NOMAD = 'nomad',
  MERCHANT = 'merchant',
  POACHER = 'poacher',
  NOBLE = 'noble',
  BLACKSMITH = 'blacksmith',
}

export interface CharacterBackground {
  id: CharacterBackgroundId;
  name: string;
  description: string;
}

export interface Faction {
  id: string;
  name:string;
}

export interface Unit {
  id: string;
  name: string;
  description: string;
  attack: number;
  defense: number;
  // Upgrade details
  upgradeFrom?: string;
  upgradeCost?: number;
  xpToUpgrade?: number;
  upgradeRequiresItems?: Record<string, number>;
  upgradeRequiresLocation?: string[];
  upgradeRequiresCompanion?: string[];
  // Recruit details
  recruitCost?: number;
}

export type QuestStatus = 'active' | 'completed';
export type QuestType = 'bounty' | 'delivery';

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  giver: string;
  factionId: string;
  status: QuestStatus;
  
  // For 'delivery' quests
  targetLocationId?: string;
  targetItemId?: string;
  targetItemQuantity?: number;

  // For 'bounty' quests
  targetEnemyName?: string;
  targetEnemyLocationHint?: string;

  rewardGold: number;
  rewardRenown: number;
}

export enum EquipmentSlot {
  WEAPON = 'weapon',
  HEAD = 'head',
  BODY = 'body',
  FEET = 'feet',
  HORSE = 'horse',
}

export interface Item {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  price: number;
  effects: Record<string, number>; // e.g. { "armor": 5, "attack": 2 }
}

export interface Companion {
  id: string;
  name: string;
  backstory: string;
  skills: Record<string, number>; // e.g. { "trade": 5, "looting": 15 }
  equipment: Partial<Record<EquipmentSlot, string>>;
  cost: number;
  status: 'unrecruited' | 'recruited';
  locationId: string; // The tavern they are currently in
  hp: number;
  isWounded: boolean;
}

export interface EnterpriseType {
  id: string;
  name: string;
  cost: number;
  baseWeeklyProfit: number;
  outputGoodId: string;
}

export interface PlayerEnterprise {
  typeId: string;
  locationId: string;
}

export interface Skill {
  id: string;
  name: string;
  description: (level: number) => string;
  maxLevel: number;
}

export interface Player {
  name:string;
  backstory: string;
  gold: number;
  renown: number;
  level: number;
  xp: number;
  skillPoints: number;
  skills: Record<string, number>; // skillId -> level
  unitExperience: Record<string, number>; // unitId -> total XP pool
  factionId: string | null;
  army: Record<string, number>; // unitId -> quantity
  woundedArmy: Record<string, number>; // unitId -> quantity
  inventory: Record<string, number>; // goodId or itemId -> quantity
  equipment: Partial<Record<EquipmentSlot, string>>; // slot -> itemId
  activeQuest: Quest | null;
  factionRelations: Record<string, number>;
  companions: string[]; // Array of companion IDs
  enterprises: PlayerEnterprise[];
  fiefs: string[]; // Array of location IDs
  hp: number;
  isWounded: boolean;
}

export interface AILord {
  id: string;
  name: string;
  factionId: string;
  army: Record<string, number>;
  currentLocationId: string;
  isDefeated: boolean;
  defeatedUntilDay: number;
}

export interface TradeGood {
  id: string;
  name: string;
  basePrice: number;
}

export interface MarketGood {
  goodId: string;
  // multiplier > 1 means high demand (expensive), < 1 means high supply (cheap)
  priceMultiplier: number;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  ownerId: string; // Can be an NPC lord's name or 'player'
  factionId: string;
  connectedTo: string[];
  recruitsAvailable: number;
  x: number;
  y: number;
  market: MarketGood[];
  garrison: Record<string, number>; // unitId -> quantity
  accumulatedTaxes: number;
  status: 'normal' | 'looted';
  lootedUntilDay: number;
  production: string[]; // IDs of goods produced here
}

export interface LogEntry {
  id: number;
  message: string;
  type: 'event' | 'battle' | 'system' | 'rumor' | 'quest' | 'market';
}

export enum BattleOutcome {
  PLAYER_VICTORY = 'player_victory',
  PLAYER_DEFEAT = 'player_defeat',
  DRAW = 'draw',
}

export interface BattleResult {
  narrative: string;
  outcome: BattleOutcome;
  playerLosses: Record<string, number>; // unitId -> deaths
  playerWounded: Record<string, number>; // unitId -> wounded
  playerDefeated: boolean; // True if player and companions are knocked out
  enemyLosses: number;
  goldLooted: number;
  xpGained: number; // For units
  playerXpGained: number; // For player
  questUpdate?: {
      completed: boolean;
      narrative: string;
  }
}

export interface GameEventChoice {
  text: string;
  resultNarrative: string;
  goldChange?: number;
  renownChange?: number;
  hpChange?: number;
  itemChanges?: Record<string, number>; // itemId -> quantity change (+ or -)
  startBattle?: {
    enemyName: string;
    enemySize: number;
  };
}

export interface GameEvent {
  id: string;
  title: string;
  narrative: string;
  choices: GameEventChoice[];
}
