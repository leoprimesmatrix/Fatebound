import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Champion, Card, GameState, PlayerState, CardType, Realm } from '../types';
import { REALM_COLORS, CHAMPIONS, CARDS } from '../constants';
import { generateBattleCommentary, getTacticalTip } from '../services/geminiService';
import { Heart, Shield, Zap, Sword, RefreshCw, MessageSquare, Skull, HelpCircle, X, ChevronsUp, Layers, Info, Flame, Snowflake, Cpu, Trees } from 'lucide-react';

interface BattleArenaProps {
  champion: Champion;
  playerDeck: Card[];
  onEndGame: (winner: 'player' | 'opponent') => void;
  isOnline?: boolean;
}

// SFX Configuration
const SFX = {
  DRAW: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  PLAY: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  ATTACK: 'https://assets.mixkit.co/active_storage/sfx/212/212-preview.mp3',
  BUFF: 'https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3',
  TURN: 'https://assets.mixkit.co/active_storage/sfx/1122/1122-preview.mp3',
  VICTORY: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  DEFEAT: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3',
  HOVER: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Reusing play for subtle click
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
  ABILITY: 'https://assets.mixkit.co/active_storage/sfx/1469/1469-preview.mp3'
};

const playSfx = (key: keyof typeof SFX) => {
  const audio = new Audio(SFX[key]);
  audio.volume = key === 'HOVER' ? 0.1 : 0.3;
  audio.play().catch(() => {}); // Ignore interaction errors
};

// Helper to create initial state
const createInitialState = (champ: Champion, deck: Card[]): PlayerState => ({
  champion: champ,
  health: champ.maxHealth,
  maxHealth: champ.maxHealth,
  mana: 1,
  maxMana: 1,
  deck: [...deck].sort(() => Math.random() - 0.5),
  hand: [],
  graveyard: [],
  shield: 0,
  abilityUsed: false,
});

export const BattleArena: React.FC<BattleArenaProps> = ({ champion, playerDeck, onEndGame, isOnline = false }) => {
  // Initialize Game State with a unique opponent
  const [gameState, setGameState] = useState<GameState>(() => {
    // 1. Pick a random opponent that is NOT the player's champion
    const possibleOpponents = CHAMPIONS.filter(c => c.id !== champion.id);
    const opponentChampion = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];

    // 2. Generate a valid deck for the opponent
    const availableCards = CARDS.filter(c => 
      c.realm === opponentChampion.realm || Math.random() > 0.4
    );
    const cardPool = availableCards.length >= 8 ? availableCards : CARDS;
    const opponentDeck = [...cardPool].sort(() => Math.random() - 0.5).slice(0, 8);

    return {
      player: createInitialState(champion, playerDeck),
      opponent: createInitialState(opponentChampion, opponentDeck),
      turn: 1,
      isPlayerTurn: true,
      battleLog: ['Battle Started!'],
      winner: null,
      lastPlayedCard: null,
      floatingTexts: [],
      shake: { target: 'none', intensity: 0 }
    };
  });

  const [tacticalTip, setTacticalTip] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showTurnBanner, setShowTurnBanner] = useState<'player' | 'opponent' | null>('player');
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);
  const [screenFlash, setScreenFlash] = useState<string | null>(null);

  // Ref to access state inside async loops without stale closures
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Sound Effect Triggers
  const prevPlayerHandSize = useRef(0);
  useEffect(() => {
    if (gameState.player.hand.length > prevPlayerHandSize.current) {
      playSfx('DRAW');
    }
    prevPlayerHandSize.current = gameState.player.hand.length;
  }, [gameState.player.hand.length]);

  // --- Visual Effects Helpers ---

  const addFloatingText = (text: string, color: string, x: number, y: number) => {
    const id = Date.now().toString() + Math.random();
    setGameState(prev => ({
      ...prev,
      floatingTexts: [...prev.floatingTexts, { id, text, color, x, y }]
    }));
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        floatingTexts: prev.floatingTexts.filter(ft => ft.id !== id)
      }));
    }, 1500);
  };

  const triggerShake = (target: 'player' | 'opponent') => {
    setGameState(prev => ({ ...prev, shake: { target, intensity: 10 } }));
    setTimeout(() => setGameState(prev => ({ ...prev, shake: { target: 'none', intensity: 0 } })), 500);
  };

  const triggerFlash = (type: 'damage' | 'heal' | 'shield' | 'impact' | Realm) => {
    if (type === 'damage') setScreenFlash('bg-red-600/30');
    if (type === 'impact') setScreenFlash('bg-white/40');
    if (type === 'heal') setScreenFlash('bg-green-500/20');
    if (type === 'shield') setScreenFlash('bg-cyan-500/20');
    if (type === Realm.FIRE) setScreenFlash('bg-orange-600/20');
    if (type === Realm.ICE) setScreenFlash('bg-cyan-600/20');
    if (type === Realm.TECH) setScreenFlash('bg-purple-600/20');
    if (type === Realm.FOREST) setScreenFlash('bg-green-600/20');
    
    setTimeout(() => setScreenFlash(null), 150);
  };

  // --- Core Game Logic ---

  const drawCard = (state: PlayerState, count: number): PlayerState => {
    const newDeck = [...state.deck];
    const newHand = [...state.hand];
    for (let i = 0; i < count; i++) {
      if (newDeck.length > 0 && newHand.length < 6) { 
        newHand.push(newDeck.shift()!);
      }
    }
    return { ...state, deck: newDeck, hand: newHand };
  };

  // Initialize Game
  useEffect(() => {
    setGameState(prev => {
      const p = drawCard(prev.player, 3);
      const o = drawCard(prev.opponent, 3);
      return { ...prev, player: p, opponent: o };
    });
    getTacticalTip(gameState.player.hand, gameState.opponent.health, 1).then(setTacticalTip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endTurn = useCallback(() => {
    playSfx('TURN');
    setGameState(prev => {
      const nextTurnNum = prev.isPlayerTurn ? prev.turn : prev.turn + 1;
      const nextIsPlayer = !prev.isPlayerTurn;
      const activeEntityKey = nextIsPlayer ? 'player' : 'opponent';
      const prevEntityKey = nextIsPlayer ? 'opponent' : 'player';
      
      let nextState = { ...prev };
      nextState.turn = nextTurnNum;
      nextState.isPlayerTurn = nextIsPlayer;
      nextState.lastPlayedCard = null; 
      
      const entity = nextState[activeEntityKey];
      const newMaxMana = Math.min(10, nextTurnNum);
      
      nextState[activeEntityKey] = {
        ...entity,
        maxMana: newMaxMana,
        mana: newMaxMana,
        shield: 0, 
        abilityUsed: false, // Reset ability usage for the new active player
      };

      // Ensure previous player's ability flag is also reset? No, abilityUsed is per turn.
      // We just reset it when it becomes their turn.
      
      nextState[activeEntityKey] = drawCard(nextState[activeEntityKey], 1);
      nextState.battleLog = [...nextState.battleLog, `${nextIsPlayer ? "Player's" : "Opponent's"} Turn`];

      return nextState;
    });
    
    // Show banner
    const nextIsPlayer = !gameStateRef.current.isPlayerTurn;
    setShowTurnBanner(nextIsPlayer ? 'player' : 'opponent');
    setTimeout(() => setShowTurnBanner(null), 1200); // Fast banner
  }, []);

  // --- Ability Logic ---
  const castAbility = async (user: 'player' | 'opponent') => {
    playSfx('ABILITY');
    const opponentKey = user === 'player' ? 'opponent' : 'player';
    
    setGameState(prev => {
      const activeChar = prev[user];
      const targetChar = prev[opponentKey];
      const ability = activeChar.champion.ability;

      if (activeChar.mana < ability.cost || activeChar.abilityUsed) return prev;

      let newState = {
        ...prev,
        [user]: {
          ...activeChar,
          mana: activeChar.mana - ability.cost,
          abilityUsed: true
        },
        battleLog: [...prev.battleLog, `${user === 'player' ? 'You' : 'Opponent'} used ${ability.name}!`]
      };

      // Ability Effects based on Champion Name or Ability Name
      // We'll use simple string matching for now
      if (ability.name === 'Inferno' || ability.name.includes('damage')) {
         // Fire: Deal 3 dmg
         triggerFlash('damage');
         addFloatingText('-3', '#ef4444', user === 'player' ? 80 : 20, 30);
         newState[opponentKey].health = Math.max(0, targetChar.health - 3);
      } else if (ability.name === 'Glacial Wall' || ability.name.includes('Shield')) {
         // Ice: Gain 4 shield
         triggerFlash('shield');
         addFloatingText('+4 Shield', '#0ea5e9', user === 'player' ? 20 : 80, 50);
         newState[user].shield += 4;
      } else if (ability.name === 'Regrowth' || ability.name.includes('Heal')) {
         // Forest: Heal 3
         triggerFlash('heal');
         addFloatingText('+3 HP', '#22c55e', user === 'player' ? 20 : 80, 50);
         newState[user].health = Math.min(activeChar.maxHealth, activeChar.health + 3);
      } else if (ability.name === 'Overclock' || ability.name.includes('Draw')) {
         // Tech: Draw 2
         playSfx('BUFF');
         addFloatingText('+2 Cards', '#a855f7', user === 'player' ? 20 : 80, 50);
         newState[user] = drawCard(newState[user], 2);
      }

      return newState;
    });

    await new Promise(r => setTimeout(r, 600)); // Pause for effect
  };

  const playCard = async (card: Card, user: 'player' | 'opponent') => {
    if (gameStateRef.current.winner) return;

    playSfx('PLAY');
    const opponentKey = user === 'player' ? 'opponent' : 'player';

    // 1. Pay Cost & Move Card
    setGameState(prev => {
      const newHand = prev[user].hand.filter(c => c.id !== card.id);
      return {
        ...prev,
        lastPlayedCard: card,
        [user]: {
          ...prev[user],
          hand: newHand,
          graveyard: [...prev[user].graveyard, card],
          mana: prev[user].mana - card.cost
        }
      };
    });

    // 2. Faster Animation Wait (Significantly reduced from 1200ms)
    await new Promise(r => setTimeout(r, 600));

    // 3. Apply Effects & Commentary
    let flavor = "";
    try {
        flavor = await generateBattleCommentary(card.name, card.realm, user === 'player');
    } catch(e) { flavor = `${user} uses ${card.name}`; }

    setGameState(prev => {
      let newState = { ...prev, battleLog: [...prev.battleLog, flavor] };
      const activeChar = newState[user];
      const targetChar = newState[opponentKey];

      // Trigger Visuals based on Realm
      triggerFlash(card.realm);

      // Effect Logic
      let damage = 0;
      let heal = 0;
      let shield = 0;
      let manaGain = 0;

      // Parsing Logic
      if (card.type === CardType.ATTACK || card.type === CardType.MINION || (card.type === CardType.SPELL && card.description.toLowerCase().includes('dmg'))) {
        damage = card.value;
      } 
      
      if (card.type === CardType.SPELL || card.type === CardType.WEAPON) {
        if (card.description.includes('Heal')) heal = card.value;
        if (card.description.includes('Shield')) shield = card.value;
        if (card.description.includes('Mana')) manaGain = card.value;
        if (card.type === CardType.WEAPON && card.description.includes('Atk')) damage = card.value; 
      }
      
      // Fallback if parsing fails but value exists
      if (damage === 0 && heal === 0 && shield === 0 && manaGain === 0) {
          if (card.type === CardType.ATTACK) damage = card.value;
      }

      // Apply Damage
      if (damage > 0) {
        playSfx('ATTACK');
        triggerShake(opponentKey);
        
        // Trigger Flash based on who took damage
        if (opponentKey === 'player') triggerFlash('damage');
        else triggerFlash('impact');

        let actualDmg = damage;
        if (targetChar.shield > 0) {
          if (targetChar.shield >= actualDmg) {
            targetChar.shield -= actualDmg;
            addFloatingText(`Blocked`, '#60a5fa', user === 'player' ? 70 : 30, 40);
            actualDmg = 0;
          } else {
            actualDmg -= targetChar.shield;
            targetChar.shield = 0;
          }
        }
        targetChar.health = Math.max(0, targetChar.health - actualDmg);
        if (actualDmg > 0) addFloatingText(`-${actualDmg}`, '#ef4444', user === 'player' ? 80 : 20, 30);
      }

      // Apply Heal
      if (heal > 0) {
        playSfx('BUFF');
        triggerFlash('heal');
        activeChar.health = Math.min(activeChar.maxHealth, activeChar.health + heal);
        addFloatingText(`+${heal}`, '#22c55e', user === 'player' ? 20 : 80, 60);
      }

      // Apply Shield
      if (shield > 0) {
        playSfx('BUFF');
        triggerFlash('shield');
        activeChar.shield += shield;
        addFloatingText(`+${shield}`, '#0ea5e9', user === 'player' ? 20 : 80, 60);
      }
      
      // Apply Mana
      if (manaGain > 0) {
          playSfx('BUFF');
          activeChar.mana = Math.min(10, activeChar.mana + manaGain);
          addFloatingText(`+${manaGain} Mana`, '#3b82f6', user === 'player' ? 20 : 80, 60);
      }

      // Check Win Condition
      if (newState.player.health <= 0) {
          newState.winner = 'opponent';
          playSfx('DEFEAT');
      }
      if (newState.opponent.health <= 0) {
          newState.winner = 'player';
          playSfx('VICTORY');
      }

      return newState;
    });
    
    // 4. Short pause after effect
    await new Promise(r => setTimeout(r, 400));
    setGameState(prev => ({ ...prev, lastPlayedCard: null }));
  };

  // --- AI Logic (Sequential & Strategic) ---
  const runAiTurn = async () => {
     setIsAiProcessing(true);
     // Reduced initial thinking time
     await new Promise(r => setTimeout(r, 800)); 

     let keepPlaying = true;
     
     while(keepPlaying) {
         const current = gameStateRef.current;
         if (current.winner) break;

         const { hand, mana, health, maxHealth, abilityUsed, champion: oppChamp } = current.opponent;
         const playerHealth = current.player.health;

         // Find playable cards
         const playableCards = hand.filter(c => c.cost <= mana);
         
         // Check if ability is playable
         const canUseAbility = !abilityUsed && mana >= oppChamp.ability.cost;

         if (playableCards.length === 0 && !canUseAbility) {
            keepPlaying = false;
            break;
         }

         // --- Advanced AI Scoring ---
         let bestAction: { type: 'card', card: Card } | { type: 'ability' } | null = null;
         let bestScore = -Infinity;

         // Score Cards
         playableCards.forEach(card => {
             let score = 0;
             // 1. Efficiency
             score += card.cost * 10; 

             // 2. Lethal
             let estimatedDmg = 0;
             if (card.type === CardType.ATTACK || card.type === CardType.MINION || card.description.includes('dmg')) {
                 estimatedDmg = card.value;
             }
             if (estimatedDmg >= playerHealth) score += 99999;

             // 3. Survival
             const isLowHp = health < (maxHealth * 0.35); 
             const isDefensive = card.description.includes('Heal') || card.description.includes('Shield');
             if (isLowHp && isDefensive) score += 500;
             if (card.description.includes('Heal') && health === maxHealth) score -= 1000;

             // 4. Aggression
             if (playerHealth < 12 && estimatedDmg > 0) score += 100;

             // 5. Mana Efficiency
             const remainingManaAfterPlay = mana - card.cost;
             if (remainingManaAfterPlay === 0) score += 50;

             if (score > bestScore) {
                 bestScore = score;
                 bestAction = { type: 'card', card };
             }
         });

         // Score Ability
         if (canUseAbility) {
             let abilityScore = 0;
             const cost = oppChamp.ability.cost;
             abilityScore += cost * 10; // Baseline efficiency
             
             // Analyze ability type loosely
             const name = oppChamp.ability.name;
             if (name.includes('Inferno')) { // Dmg
                 if (3 >= playerHealth) abilityScore += 99999;
                 else abilityScore += 40;
             } else if (name.includes('Glacial')) { // Shield
                 if (health < maxHealth * 0.5) abilityScore += 200;
                 else abilityScore += 20;
             } else if (name.includes('Regrowth')) { // Heal
                 if (health < maxHealth - 5) abilityScore += 300;
                 else abilityScore -= 500;
             } else if (name.includes('Overclock')) { // Draw
                 if (hand.length < 3) abilityScore += 200; // Need cards
                 else abilityScore += 30;
             }

             // Mana efficiency check for ability
             if (mana - cost === 0) abilityScore += 50;

             if (abilityScore > bestScore) {
                 bestAction = { type: 'ability' };
             }
         }

         if (bestAction) {
            if (bestAction.type === 'card') {
                await playCard(bestAction.card, 'opponent');
            } else {
                await castAbility('opponent');
            }
            // Faster pause between multiple actions
            await new Promise(r => setTimeout(r, 600)); 
         } else {
             keepPlaying = false;
         }
     }

     setIsAiProcessing(false);
     endTurn();
  };

  useEffect(() => {
    if (!gameState.isPlayerTurn && !gameState.winner && !isAiProcessing) {
        runAiTurn();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isPlayerTurn]); 

  useEffect(() => {
    if (gameState.winner) setTimeout(() => onEndGame(gameState.winner!), 3000);
  }, [gameState.winner, onEndGame]);

  // --- Render Helpers ---

  const renderCard = (card: Card, isPlayable: boolean, onClick?: () => void) => (
    <motion.div
       layoutId={card.id}
       initial={{ y: 200, scale: 0.5, opacity: 0, rotate: 0 }}
       animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
       exit={{ y: -100, opacity: 0, scale: 0.5 }}
       whileHover={isPlayable ? { y: -60, scale: 1.15, zIndex: 100, rotate: 2, transition: { duration: 0.2 } } : {}}
       onMouseEnter={() => { setHoveredCard(card); if(isPlayable) playSfx('HOVER'); }}
       onMouseLeave={() => setHoveredCard(null)}
       onClick={onClick}
       className={`
           relative w-32 h-44 lg:w-40 lg:h-56 rounded-xl border-[3px] shadow-2xl flex-shrink-0 cursor-pointer transition-colors duration-200 group overflow-hidden
           ${isPlayable 
               ? 'border-amber-400/80 hover:border-amber-300 hover:shadow-[0_0_25px_rgba(251,191,36,0.6)] bg-slate-800' 
               : 'border-slate-600 bg-slate-900 grayscale-[0.5] opacity-80 cursor-not-allowed'}
       `}
    >
        {/* Card Background Gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${REALM_COLORS[card.realm]} opacity-30`} />
        
        {/* Card Header */}
        <div className="relative z-10 p-2 flex justify-between items-start">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-lg shadow-md ${isPlayable ? 'bg-slate-900 border-blue-400 text-blue-100' : 'bg-slate-800 border-slate-500 text-slate-400'}`} title="Mana Cost">
                {card.cost}
            </div>
            {card.type === CardType.ATTACK && <Sword className="w-5 h-5 text-red-400 drop-shadow" />}
            {card.type === CardType.SPELL && <Zap className="w-5 h-5 text-purple-400 drop-shadow" />}
            {card.type === CardType.MINION && <Skull className="w-5 h-5 text-green-400 drop-shadow" />}
            {card.type === CardType.WEAPON && <Sword className="w-5 h-5 text-amber-400 drop-shadow" />}
        </div>
        
        {/* Card Image Area (Icon) */}
        <div className="absolute inset-0 top-8 bottom-16 flex items-center justify-center z-0">
             <div className="bg-black/30 p-4 rounded-full backdrop-blur-sm">
                {card.realm === Realm.FIRE && <Flame className="w-12 h-12 text-orange-500/80" />}
                {card.realm === Realm.ICE && <Snowflake className="w-12 h-12 text-cyan-500/80" />}
                {card.realm === Realm.TECH && <Cpu className="w-12 h-12 text-purple-500/80" />}
                {card.realm === Realm.FOREST && <Trees className="w-12 h-12 text-green-500/80" />}
             </div>
        </div>

        {/* Card Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-10 h-[45%] flex flex-col justify-end">
            <div className="font-bold text-sm text-white leading-tight mb-1 drop-shadow-md text-center">{card.name}</div>
            <div className="text-[10px] text-slate-300 leading-tight text-center font-medium line-clamp-2">{card.description}</div>
        </div>
    </motion.div>
  );

  return (
    <div className="relative h-screen bg-slate-950 overflow-hidden flex flex-col font-sans select-none">
      {/* Dynamic Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${REALM_COLORS[champion.realm]} opacity-20 pointer-events-none`} />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay"></div>

      {/* Screen Flash FX */}
      <AnimatePresence>
        {screenFlash && (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`fixed inset-0 z-[150] pointer-events-none ${screenFlash}`}
            />
        )}
      </AnimatePresence>

      {/* --- TUTORIAL MODAL --- */}
      <AnimatePresence>
        {showTutorial && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-3xl font-cinzel font-bold text-white flex items-center gap-3">
                  <HelpCircle className="w-8 h-8 text-amber-500" /> How to Play
                </h2>
                <button onClick={() => setShowTutorial(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-8 grid md:grid-cols-2 gap-8">
                <div>
                   <h3 className="text-amber-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Sword className="w-5 h-5" /> The Objective</h3>
                   <p className="text-slate-300 mb-6">Reduce the Enemy Champion's <span className="text-red-400 font-bold">Health</span> to zero before they defeat you.</p>

                   <h3 className="text-blue-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Zap className="w-5 h-5" /> Mana & Turns</h3>
                   <p className="text-slate-300 mb-2">You gain <span className="text-blue-400 font-bold">Mana</span> every turn (up to 10).</p>
                   <ul className="list-disc list-inside text-slate-400 space-y-1 mb-6">
                     <li>Cards cost Mana to play (top-left number).</li>
                     <li>If a card glows, you can play it.</li>
                     <li>Click "End Turn" when you are done.</li>
                   </ul>
                </div>
                <div>
                   <h3 className="text-purple-400 font-bold uppercase tracking-wider mb-4 flex items-center gap-2"><Shield className="w-5 h-5" /> Card Types</h3>
                   <div className="space-y-3">
                     <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <Sword className="w-5 h-5 text-red-400" />
                        <span className="text-slate-200 text-sm"><strong>Attack:</strong> Deals damage to the enemy.</span>
                     </div>
                     <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <Shield className="w-5 h-5 text-cyan-400" />
                        <span className="text-slate-200 text-sm"><strong>Spell/Shield:</strong> Blocks incoming damage.</span>
                     </div>
                     <div className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg border border-slate-700">
                        <Skull className="w-5 h-5 text-green-400" />
                        <span className="text-slate-200 text-sm"><strong>Minion:</strong> Summons allies for damage/effects.</span>
                     </div>
                   </div>
                   
                   <div className="mt-8">
                     <button onClick={() => setShowTutorial(false)} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg uppercase tracking-wider transition-colors">
                        Got it, Let's Fight!
                     </button>
                   </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TURN BANNER --- */}
      <AnimatePresence>
        {showTurnBanner && (
          <motion.div 
             initial={{ x: showTurnBanner === 'player' ? '-100%' : '100%', opacity: 0 }}
             animate={{ x: 0, opacity: 1 }}
             exit={{ x: showTurnBanner === 'player' ? '100%' : '-100%', opacity: 0 }}
             transition={{ type: "spring", stiffness: 100, damping: 20 }}
             className={`fixed top-1/2 left-0 right-0 -translate-y-1/2 h-24 z-[90] flex items-center justify-center pointer-events-none
                ${showTurnBanner === 'player' ? 'bg-gradient-to-r from-transparent via-blue-900/90 to-transparent' : 'bg-gradient-to-r from-transparent via-red-900/90 to-transparent'}
             `}
          >
             <h2 className="text-6xl font-black italic tracking-tighter uppercase text-white font-cinzel drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
               {showTurnBanner === 'player' ? 'YOUR TURN' : 'ENEMY TURN'}
             </h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Bar for Tutorial Button */}
      <div className="absolute top-4 right-4 z-[50]">
         <button 
           onClick={() => { playSfx('CLICK'); setShowTutorial(true); }}
           className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-full border border-slate-600 backdrop-blur-md transition-all hover:scale-105 shadow-lg"
         >
            <HelpCircle className="w-5 h-5 text-amber-500" />
            <span className="font-bold">How to Play</span>
         </button>
      </div>

      {/* Floating Damage Numbers Overlay */}
      <AnimatePresence>
        {gameState.floatingTexts.map(ft => (
          <motion.div
            key={ft.id}
            initial={{ opacity: 1, y: `${ft.y}%`, x: `${ft.x}%`, scale: 0.5 }}
            animate={{ opacity: 0, y: `${ft.y - 15}%`, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="absolute z-[100] text-6xl font-black drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] pointer-events-none"
            style={{ color: ft.color, left: 0, top: 0 }} 
          >
            {ft.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* --- OPPONENT SECTION (Top) --- */}
      <motion.div 
        animate={gameState.shake.target === 'opponent' ? { x: [-10, 10, -10, 10, 0] } : {}}
        className="flex-none p-4 relative z-10 pt-16"
      >
         <div className="max-w-6xl mx-auto flex items-start justify-between">
            {/* Opponent Profile */}
             <div className="flex items-center gap-6 bg-slate-900/60 backdrop-blur-md p-4 rounded-br-3xl rounded-tl-xl border border-white/10 shadow-xl">
                 <div className="relative">
                     <div className="w-20 h-20 rounded-full border-4 border-red-500/50 overflow-hidden relative shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        <img src={gameState.opponent.champion.image} className="w-full h-full object-cover" alt="Enemy" />
                        {gameState.opponent.shield > 0 && <div className="absolute inset-0 border-4 border-cyan-400 rounded-full animate-pulse" />}
                     </div>
                 </div>
                 <div>
                     <div className="text-red-400 font-bold text-2xl drop-shadow-sm font-cinzel">{isOnline ? 'Player 2' : gameState.opponent.champion.name}</div>
                     <div className="flex items-center gap-4 text-white mt-1">
                        <div className="flex items-center gap-2 bg-red-950/80 px-3 py-1 rounded-lg border border-red-500/30" title="Enemy Health">
                            <Heart className="w-5 h-5 text-red-500 fill-current" /> 
                            <span className="font-mono text-xl">{gameState.opponent.health}</span>
                        </div>
                        {gameState.opponent.shield > 0 && (
                            <div className="flex items-center gap-2 bg-cyan-950/80 px-3 py-1 rounded-lg border border-cyan-500/30" title="Enemy Shield">
                                <Shield className="w-5 h-5 text-cyan-400 fill-current" /> 
                                <span className="font-mono text-xl">{gameState.opponent.shield}</span>
                            </div>
                        )}
                     </div>
                 </div>
             </div>

             {/* Opponent Hand & Mana */}
             <div className="flex flex-col items-end gap-2">
                 <div className="flex items-center gap-4">
                    {/* Opponent Deck Pile */}
                    <div className="relative w-16 h-24 bg-slate-800 rounded border border-slate-600 shadow-xl flex items-center justify-center">
                        <div className="absolute inset-1 border border-slate-600 rounded opacity-50" />
                        <Layers className="text-slate-500 w-6 h-6" />
                        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border border-black">{gameState.opponent.deck.length}</div>
                    </div>
                    {/* Hand */}
                    <div className="flex gap-1">
                        {[...Array(gameState.opponent.hand.length)].map((_, i) => (
                            <div key={i} className="w-10 h-14 bg-gradient-to-br from-red-900 to-slate-900 rounded border border-red-900/50 shadow-lg -ml-4 first:ml-0" />
                        ))}
                    </div>
                 </div>
                 <div className="flex gap-1 mt-2 bg-black/40 p-2 rounded-full backdrop-blur-sm" title="Enemy Mana">
                    {[...Array(gameState.opponent.maxMana)].map((_, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${i < gameState.opponent.mana ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-110' : 'bg-slate-800'}`} />
                    ))}
                 </div>
             </div>
         </div>
      </motion.div>

      {/* --- BATTLEFIELD (Middle) --- */}
      <div className="flex-1 flex flex-col relative items-center justify-center">
         
         {/* Battle Log (Left) */}
         <div className="absolute left-4 top-4 bottom-4 w-72 hidden xl:flex flex-col gap-2 pointer-events-none">
             {gameState.battleLog.slice(-6).map((log, i) => (
                 <motion.div 
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className="text-sm text-slate-200 bg-black/40 backdrop-blur-md p-3 rounded-r-xl border-l-4 border-amber-500 shadow-lg"
                 >
                     {log}
                 </motion.div>
             ))}
         </div>

         {/* Center Arena - Card Resolution Zone */}
         <div className="relative w-full max-w-lg h-64 flex items-center justify-center">
            <AnimatePresence mode="wait">
                {gameState.lastPlayedCard && (
                    <motion.div
                        key="played-card"
                        initial={{ scale: 0.2, opacity: 0, y: 100 }}
                        animate={{ scale: 1.2, opacity: 1, y: 0 }}
                        exit={{ scale: 1.5, opacity: 0, filter: 'blur(10px)' }}
                        className="relative z-50"
                    >
                        {/* Simplified Large Card View for Resolution */}
                        <div className={`w-48 h-64 rounded-xl shadow-[0_0_50px_rgba(255,255,255,0.3)] bg-slate-800 border-4 border-white flex flex-col items-center justify-center relative overflow-hidden`}>
                             <div className={`absolute inset-0 bg-gradient-to-br ${REALM_COLORS[gameState.lastPlayedCard.realm]} opacity-50`} />
                             <h3 className="relative z-10 text-2xl font-bold text-white text-center px-2 drop-shadow-md">{gameState.lastPlayedCard.name}</h3>
                             <p className="relative z-10 text-white/80 text-sm mt-2 font-mono bg-black/30 px-2 py-1 rounded">{gameState.lastPlayedCard.description}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Thinking Indicator */}
            {isAiProcessing && !gameState.lastPlayedCard && (
                 <motion.div 
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-12 bg-slate-800/90 text-amber-300 px-6 py-2 rounded-full flex items-center gap-3 border border-amber-500/30 shadow-xl backdrop-blur-md z-40"
                 >
                     <RefreshCw className="w-5 h-5 animate-spin" /> 
                     <span className="font-bold tracking-wide">OPPONENT THINKING...</span>
                 </motion.div>
            )}

            {/* Game Over Screen */}
            <AnimatePresence>
                {gameState.winner ? (
                    <motion.div 
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute z-50 bg-black/90 backdrop-blur-xl p-12 rounded-3xl border-4 border-amber-500 text-center shadow-[0_0_100px_rgba(245,158,11,0.5)]"
                    >
                        <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-600 mb-4 font-cinzel">
                            {gameState.winner === 'player' ? 'VICTORY' : 'DEFEAT'}
                        </h1>
                        <button onClick={() => { playSfx('CLICK'); onEndGame(gameState.winner!); }} className="text-white hover:text-amber-400 underline decoration-2 underline-offset-4">Continue</button>
                    </motion.div>
                ) : null}
            </AnimatePresence>
         </div>
      </div>

      {/* --- PLAYER SECTION (Bottom) --- */}
      <motion.div 
        animate={gameState.shake.target === 'player' ? { x: [-10, 10, -10, 10, 0] } : {}}
        className="flex-none pt-12 pb-6 px-4 bg-gradient-to-t from-slate-950 via-slate-900 to-transparent relative z-20"
      >
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-end justify-between gap-6">
             
             {/* Player Stats & Ability */}
             <div className="flex flex-col gap-2 min-w-[320px]">
                 <div className="flex items-center gap-5 bg-slate-900/80 p-4 rounded-tr-3xl rounded-bl-xl border border-slate-700/50 backdrop-blur-md shadow-2xl">
                     <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-amber-500 overflow-hidden bg-slate-800 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                            <img src={gameState.player.champion.image} className="w-full h-full object-cover" alt="Me" />
                        </div>
                        {/* Mana Indicator on Portrait */}
                        <div className="absolute -bottom-3 -right-3 bg-blue-950/90 w-10 h-10 rounded-full border-2 border-blue-400 flex items-center justify-center text-blue-100 font-bold shadow-lg" title="Current Mana">
                           {gameState.player.mana}
                        </div>
                     </div>
                     <div className="flex-1">
                         <div className="text-amber-100 font-bold text-2xl font-cinzel">{gameState.player.champion.name}</div>
                         <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-2 bg-red-950/80 px-3 py-1 rounded-md border border-red-500/30" title="Your Health">
                                <Heart className="w-5 h-5 text-red-500 fill-current" /> 
                                <span className="text-white font-mono text-xl">{gameState.player.health}</span>
                                <span className="text-xs text-red-300 font-bold uppercase ml-1">HP</span>
                            </div>
                            {gameState.player.shield > 0 && (
                                 <div className="flex items-center gap-2 bg-cyan-950/80 px-3 py-1 rounded-md border border-cyan-500/30" title="Your Shield">
                                    <Shield className="w-5 h-5 text-cyan-400 fill-current" /> 
                                    <span className="text-white font-mono text-xl">{gameState.player.shield}</span>
                                </div>
                            )}
                         </div>
                     </div>
                 </div>
                 
                 {/* Ability Button */}
                 <button
                    disabled={gameState.player.abilityUsed || gameState.player.mana < gameState.player.champion.ability.cost || !gameState.isPlayerTurn}
                    onClick={() => castAbility('player')}
                    className={`
                        py-2 px-4 rounded-xl border border-white/10 flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-all
                        ${!gameState.player.abilityUsed && gameState.player.mana >= gameState.player.champion.ability.cost && gameState.isPlayerTurn
                            ? 'bg-gradient-to-r from-purple-900 to-indigo-900 hover:from-purple-800 hover:to-indigo-800 text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                            : 'bg-slate-900 text-slate-600 cursor-not-allowed opacity-60'}
                    `}
                 >
                    <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center font-mono text-xs text-blue-300 border border-blue-500/30">
                        {gameState.player.champion.ability.cost}
                    </div>
                    {gameState.player.champion.ability.name}
                 </button>
             </div>

             {/* Player Hand & Tooltip */}
             <div className="flex-1 flex justify-center -mb-20 perspective-[1000px] hover:-mb-4 transition-all duration-300 relative">
                 {/* Card Tooltip */}
                 <AnimatePresence>
                   {hoveredCard && (
                     <motion.div
                       initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                       className="absolute bottom-64 z-[60] bg-slate-900/95 border border-amber-500/50 p-4 rounded-xl shadow-2xl w-64 backdrop-blur-xl pointer-events-none"
                     >
                       <div className="flex justify-between items-start mb-2">
                         <h4 className="text-lg font-bold text-white font-cinzel">{hoveredCard.name}</h4>
                         <span className="text-blue-300 font-bold">{hoveredCard.cost} Mana</span>
                       </div>
                       <div className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-2">
                         <Info className="w-3 h-3" /> {hoveredCard.type}
                       </div>
                       <p className="text-sm text-slate-200 leading-relaxed mb-3">{hoveredCard.description}</p>
                       <div className="text-xs text-slate-500 italic">
                         {hoveredCard.realm} Card
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>

                 {/* Hand */}
                 <div className="flex gap-[-2rem] items-end px-12 pb-24 hover:gap-2 transition-all duration-300">
                    <AnimatePresence>
                    {gameState.player.hand.map((card, idx) => {
                        const canAfford = card.cost <= gameState.player.mana && gameState.isPlayerTurn;
                        return (
                            <div key={card.id + idx} className="transform origin-bottom transition-all duration-300 hover:-translate-y-8 first:rotate-[-5deg] last:rotate-[5deg] hover:rotate-0 -ml-8 first:ml-0">
                                {renderCard(card, canAfford, () => canAfford && playCard(card, 'player'))}
                            </div>
                        );
                    })}
                    </AnimatePresence>
                 </div>
             </div>

             {/* Controls & Mana & Deck */}
             <div className="flex flex-col gap-4 items-end min-w-[220px]">
                 {gameState.isPlayerTurn && tacticalTip && (
                     <motion.div initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} className="bg-indigo-900/90 p-3 rounded-l-xl border-r-4 border-indigo-400 text-xs text-indigo-100 max-w-[200px] shadow-lg backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-1 font-bold text-indigo-300 uppercase tracking-wider">
                            <MessageSquare className="w-3 h-3" /> Advisor
                        </div>
                        {tacticalTip}
                    </motion.div>
                 )}

                 {/* Deck Pile Visual */}
                 <div className="flex items-center gap-4 self-end mr-2">
                    <div className="relative w-16 h-24 bg-slate-800 rounded border border-slate-600 shadow-xl flex items-center justify-center group cursor-pointer hover:border-amber-500/50 transition-colors">
                        <div className="absolute inset-1 border border-slate-600 rounded opacity-50" />
                        <Layers className="text-slate-500 w-6 h-6 group-hover:text-amber-500 transition-colors" />
                        <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border border-black">{gameState.player.deck.length}</div>
                    </div>
                 </div>

                 <div className="flex items-center gap-2 bg-black/60 p-3 rounded-full backdrop-blur-md border border-white/10" title="Available Mana">
                    <div className="mr-1 text-xs font-bold text-blue-400 uppercase tracking-widest">Mana</div>
                    {[...Array(gameState.player.maxMana)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 ${i < gameState.player.mana ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] scale-110' : 'bg-slate-700'}`} />
                    ))}
                 </div>

                 <button 
                    disabled={!gameState.isPlayerTurn}
                    onClick={() => { playSfx('CLICK'); endTurn(); }}
                    className={`
                        w-full py-4 rounded-xl font-black text-lg uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2
                        ${gameState.isPlayerTurn 
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black hover:scale-105 active:scale-95' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}
                    `}
                 >
                     {gameState.isPlayerTurn ? <>End Turn <ChevronsUp className="w-5 h-5 animate-bounce" /></> : 'Opponent Turn'}
                 </button>
             </div>
         </div>
      </motion.div>
    </div>
  );
};