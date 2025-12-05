export enum Realm {
  FIRE = 'Fire Realm',
  ICE = 'Ice Realm',
  TECH = 'Tech Realm',
  FOREST = 'Forest Realm',
}

export enum CardType {
  ATTACK = 'Attack',
  SPELL = 'Spell',
  MINION = 'Minion',
  WEAPON = 'Weapon',
}

export interface Card {
  id: string;
  name: string;
  cost: number;
  type: CardType;
  value: number; // Damage, Heal amount, or Shield amount
  description: string;
  realm: Realm;
  image?: string;
}

export interface Champion {
  id: string;
  name: string;
  title: string;
  realm: Realm;
  health: number;
  maxHealth: number;
  ability: {
    name: string;
    description: string;
    cost: number; // Mana cost
  };
  image: string;
  description: string;
}

export interface PlayerState {
  champion: Champion;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  deck: Card[];
  hand: Card[];
  graveyard: Card[];
  shield: number;
  abilityUsed: boolean; // Tracks if ability was used this turn
}

export interface FloatingText {
  id: string;
  text: string;
  x: number; // percentage
  y: number; // percentage
  color: string;
}

export interface GameState {
  player: PlayerState;
  opponent: PlayerState; // AI for now
  turn: number;
  isPlayerTurn: boolean;
  battleLog: string[];
  winner: 'player' | 'opponent' | null;
  lastPlayedCard: Card | null; // For animation
  floatingTexts: FloatingText[];
  shake: { target: 'player' | 'opponent' | 'none', intensity: number };
}

export type ViewState = 'LOBBY' | 'CHAMPION_SELECT' | 'DECK_BUILDER' | 'BATTLE' | 'ONLINE_LOBBY';