import { Champion, Realm, Card, CardType } from './types';
import { Flame, Snowflake, Cpu, Trees } from 'lucide-react';

export const CHAMPIONS: Champion[] = [
  {
    id: 'c1',
    name: 'Ignis',
    title: 'The Burning Soul',
    realm: Realm.FIRE,
    health: 30,
    maxHealth: 30,
    ability: { name: 'Inferno', description: 'Deal 3 damage to enemy.', cost: 3 },
    description: 'A master of pyromancy who believes the world must be cleansed by fire.',
    image: 'https://picsum.photos/seed/ignis/300/400'
  },
  {
    id: 'c2',
    name: 'Frostbite',
    title: 'Warden of the North',
    realm: Realm.ICE,
    health: 35,
    maxHealth: 35,
    ability: { name: 'Glacial Wall', description: 'Gain 4 Shield.', cost: 3 },
    description: 'Cold and calculating, she freezes her enemies in their tracks.',
    image: 'https://picsum.photos/seed/frost/300/400'
  },
  {
    id: 'c3',
    name: 'Unit-734',
    title: 'Prime Sentinel',
    realm: Realm.TECH,
    health: 32,
    maxHealth: 32,
    ability: { name: 'Overclock', description: 'Draw 2 cards.', cost: 4 },
    description: 'A rogue AI construct seeking to optimize the realms.',
    image: 'https://picsum.photos/seed/mech/300/400'
  },
  {
    id: 'c4',
    name: 'Sylva',
    title: 'Nature\'s Wrath',
    realm: Realm.FOREST,
    health: 40,
    maxHealth: 40,
    ability: { name: 'Regrowth', description: 'Heal 3 Health.', cost: 3 },
    description: 'Guardian of the ancient woods, she commands the flora and fauna.',
    image: 'https://picsum.photos/seed/druid/300/400'
  }
];

export const CARDS: Card[] = [
  // Neutral
  { id: 'n1', name: 'Quick Strike', cost: 1, type: CardType.ATTACK, value: 3, description: 'Deal 3 damage.', realm: Realm.FIRE },
  { id: 'n2', name: 'Iron Shield', cost: 2, type: CardType.SPELL, value: 5, description: 'Gain 5 shield.', realm: Realm.TECH },
  { id: 'n3', name: 'Health Potion', cost: 2, type: CardType.SPELL, value: 4, description: 'Heal 4 health.', realm: Realm.FOREST },
  
  // Fire
  { id: 'f1', name: 'Fireball', cost: 3, type: CardType.SPELL, value: 6, description: 'Deal 6 damage.', realm: Realm.FIRE },
  { id: 'f2', name: 'Lava Golem', cost: 5, type: CardType.MINION, value: 8, description: 'Summon a Golem (8 dmg).', realm: Realm.FIRE },
  { id: 'f3', name: 'Flame Sword', cost: 3, type: CardType.WEAPON, value: 5, description: 'Equip: +5 Atk power.', realm: Realm.FIRE },

  // Ice
  { id: 'i1', name: 'Ice Shard', cost: 1, type: CardType.ATTACK, value: 2, description: 'Deal 2 damage.', realm: Realm.ICE },
  { id: 'i2', name: 'Blizzard', cost: 4, type: CardType.SPELL, value: 4, description: 'Deal 4 dmg to all enemies.', realm: Realm.ICE },
  { id: 'i3', name: 'Frost Armor', cost: 3, type: CardType.SPELL, value: 8, description: 'Gain 8 shield.', realm: Realm.ICE },

  // Tech
  { id: 't1', name: 'Laser Beam', cost: 2, type: CardType.ATTACK, value: 4, description: 'Deal 4 damage.', realm: Realm.TECH },
  { id: 't2', name: 'Drone Swarm', cost: 4, type: CardType.MINION, value: 6, description: 'Deploy drones (6 dmg).', realm: Realm.TECH },
  { id: 't3', name: 'Recharge', cost: 0, type: CardType.SPELL, value: 2, description: 'Gain 2 Mana.', realm: Realm.TECH },

  // Forest
  { id: 'g1', name: 'Vine Whip', cost: 2, type: CardType.ATTACK, value: 3, description: 'Deal 3 damage.', realm: Realm.FOREST },
  { id: 'g2', name: 'Bear Form', cost: 5, type: CardType.MINION, value: 7, description: 'Transform (7 dmg).', realm: Realm.FOREST },
  { id: 'g3', name: 'Nature\'s Touch', cost: 3, type: CardType.SPELL, value: 8, description: 'Heal 8 health.', realm: Realm.FOREST },
];

export const REALM_COLORS = {
  [Realm.FIRE]: 'from-red-900 to-orange-600',
  [Realm.ICE]: 'from-cyan-900 to-blue-600',
  [Realm.TECH]: 'from-gray-900 to-purple-600',
  [Realm.FOREST]: 'from-green-900 to-emerald-600',
};

export const REALM_ICONS = {
  [Realm.FIRE]: Flame,
  [Realm.ICE]: Snowflake,
  [Realm.TECH]: Cpu,
  [Realm.FOREST]: Trees,
};