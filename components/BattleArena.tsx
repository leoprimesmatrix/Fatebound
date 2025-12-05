import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Champion, Card, GameState, PlayerState, CardType, Realm, NetworkMessage } from '../types';
import { REALM_COLORS, CHAMPIONS, CARDS } from '../constants';
import { generateBattleCommentary, getTacticalTip } from '../services/geminiService';
import { Heart, Shield, Zap, Sword, RefreshCw, MessageSquare, Skull, HelpCircle, X, ChevronsUp, Layers, Info, Flame, Snowflake, Cpu, Trees, Wifi } from 'lucide-react';
import { DataConnection } from 'peerjs';

interface BattleArenaProps {
  champion: Champion;
  playerDeck: Card[];
  onEndGame: (winner: 'player' | 'opponent') => void;
  isOnline?: boolean;
  connection?: DataConnection;
  opponentChampion?: Champion;
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
  HOVER: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', 
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3',
  ABILITY: 'https://assets.mixkit.co/active_storage/sfx/1469/1469-preview.mp3'
};

const playSfx = (key: keyof typeof SFX) => {
  const audio = new Audio(SFX[key]);
  audio.volume = key === 'HOVER' ? 0.05 : 0.3;
  audio.play().catch(() => {}); 
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

export const BattleArena: React.FC<BattleArenaProps> = ({ champion, playerDeck, onEndGame, isOnline = false, connection, opponentChampion }) => {
  // Initialize Game State
  const [gameState, setGameState] = useState<GameState>(() => {
    // Determine Opponent
    let finalOpponent: Champion;
    let finalOpponentDeck: Card[];

    if (isOnline && opponentChampion) {
       finalOpponent = opponentChampion;
       // In online, we don't know the exact deck order of opponent yet, so use a placeholder or random legal deck
       // Visuals only:
       finalOpponentDeck = Array(8).fill(CARDS[0]); 
    } else {
        // AI Logic
        const possibleOpponents = CHAMPIONS.filter(c => c.id !== champion.id);
        finalOpponent = possibleOpponents[Math.floor(Math.random() * possibleOpponents.length)];
        
        const availableCards = CARDS.filter(c => 
            c.realm === finalOpponent.realm || Math.random() > 0.4
        );
        const cardPool = availableCards.length >= 8 ? availableCards : CARDS;
        finalOpponentDeck = [...cardPool].sort(() => Math.random() - 0.5).slice(0, 8);
    }

    return {
      player: createInitialState(champion, playerDeck),
      opponent: createInitialState(finalOpponent, finalOpponentDeck),
      turn: 1,
      isPlayerTurn: true, // Default to true, in real online we might flip a coin
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
  const [manaGainAnim, setManaGainAnim] = useState(false);

  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Track mana changes for animation
  const prevPlayerMana = useRef(gameState.player.mana);
  useEffect(() => {
    if (gameState.player.mana > prevPlayerMana.current) {
        setManaGainAnim(true);
        setTimeout(() => setManaGainAnim(false), 800);
    }
    prevPlayerMana.current = gameState.player.mana;
  }, [gameState.player.mana]);

  // Handle Online Incoming Data
  useEffect(() => {
    if (isOnline && connection) {
      connection.on('data', (data: any) => {
        const msg = data as NetworkMessage;
        
        if (msg.type === 'PLAY_CARD') {
           const card = msg.payload as Card;
           playCard(card, 'opponent');
        }
        if (msg.type === 'USE_ABILITY') {
           castAbility('opponent');
        }
        if (msg.type === 'END_TURN') {
           endTurn();
        }
      });
    }
  }, [isOnline, connection]);

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

  useEffect(() => {
    setGameState(prev => {
      const p = drawCard(prev.player, 3);
      // If online, we don't simulate opponent draw logic for hand visuals perfectly, 
      // but we need them to have cards to represent the UI
      const o = drawCard(prev.opponent, 3);
      return { ...prev, player: p, opponent: o };
    });
    getTacticalTip(gameState.player.hand, gameState.opponent.health, 1).then(setTacticalTip);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endTurn = useCallback(() => {
    playSfx('TURN');
    
    // Online Sync
    if (isOnline && connection && gameStateRef.current.isPlayerTurn) {
        connection.send({ type: 'END_TURN' });
    }

    setGameState(prev => {
      const nextTurnNum = prev.isPlayerTurn ? prev.turn : prev.turn + 1;
      const nextIsPlayer = !prev.isPlayerTurn;
      const activeEntityKey = nextIsPlayer ? 'player' : 'opponent';
      
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
        abilityUsed: false,
      };

      nextState[activeEntityKey] = drawCard(nextState[activeEntityKey], 1);
      nextState.battleLog = [...nextState.battleLog, `${nextIsPlayer ? "Player's" : "Opponent's"} Turn`];

      return nextState;
    });
    
    const nextIsPlayer = !gameStateRef.current.isPlayerTurn;
    setShowTurnBanner(nextIsPlayer ? 'player' : 'opponent');
    setTimeout(() => setShowTurnBanner(null), 1200);
  }, [isOnline, connection]);

  // --- Ability Logic ---
  const castAbility = async (user: 'player' | 'opponent') => {
    playSfx('ABILITY');
    const opponentKey = user === 'player' ? 'opponent' : 'player';
    
    // Online Sync
    if (isOnline && user === 'player' && connection) {
        connection.send({ type: 'USE_ABILITY' });
    }

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

      if (ability.name.includes('Inferno') || ability.name.includes('damage')) {
         triggerFlash('damage');
         addFloatingText('-3', '#ef4444', user === 'player' ? 80 : 20, 30);
         newState[opponentKey].health = Math.max(0, targetChar.health - 3);
      } else if (ability.name.includes('Glacial') || ability.name.includes('Shield')) {
         triggerFlash('shield');
         addFloatingText('+4 Shield', '#0ea5e9', user === 'player' ? 20 : 80, 50);
         newState[user].shield += 4;
      } else if (ability.name.includes('Regrowth') || ability.name.includes('Heal')) {
         triggerFlash('heal');
         addFloatingText('+3 HP', '#22c55e', user === 'player' ? 20 : 80, 50);
         newState[user].health = Math.min(activeChar.maxHealth, activeChar.health + 3);
      } else if (ability.name.includes('Overclock') || ability.name.includes('Draw')) {
         playSfx('BUFF');
         addFloatingText('+2 Cards', '#a855f7', user === 'player' ? 20 : 80, 50);
         newState[user] = drawCard(newState[user], 2);
      }

      return newState;
    });

    await new Promise(r => setTimeout(r, 600)); 
  };

  const playCard = async (card: Card, user: 'player' | 'opponent') => {
    if (gameStateRef.current.winner) return;

    playSfx('PLAY');
    const opponentKey = user === 'player' ? 'opponent' : 'player';

    // Online Sync
    if (isOnline && user === 'player' && connection) {
        connection.send({ type: 'PLAY_CARD', payload: card });
    }

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

    await new Promise(r => setTimeout(r, 600));

    let flavor = "";
    try {
        flavor = await generateBattleCommentary(card.name, card.realm, user === 'player');
    } catch(e) { flavor = `${user} uses ${card.name}`; }

    setGameState(prev => {
      let newState = { ...prev, battleLog: [...prev.battleLog, flavor] };
      const activeChar = newState[user];
      const targetChar = newState[opponentKey];

      triggerFlash(card.realm);

      let damage = 0;
      let heal = 0;
      let shield = 0;
      let manaGain = 0;

      if (card.type === CardType.ATTACK || card.type === CardType.MINION || (card.type === CardType.SPELL && card.description.toLowerCase().includes('dmg'))) {
        damage = card.value;
      } 
      
      if (card.type === CardType.SPELL || card.type === CardType.WEAPON) {
        if (card.description.includes('Heal')) heal = card.value;
        if (card.description.includes('Shield')) shield = card.value;
        if (card.description.includes('Mana')) manaGain = card.value;
        if (card.type === CardType.WEAPON && card.description.includes('Atk')) damage = card.value; 
      }
      
      if (damage === 0 && heal === 0 && shield === 0 && manaGain === 0) {
          if (card.type === CardType.ATTACK) damage = card.value;
      }

      if (damage > 0) {
        playSfx('ATTACK');
        triggerShake(opponentKey);
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

      if (heal > 0) {
        playSfx('BUFF');
        triggerFlash('heal');
        activeChar.health = Math.min(activeChar.maxHealth, activeChar.health + heal);
        addFloatingText(`+${heal}`, '#22c55e', user === 'player' ? 20 : 80, 60);
      }

      if (shield > 0) {
        playSfx('BUFF');
        triggerFlash('shield');
        activeChar.shield += shield;
        addFloatingText(`+${shield}`, '#0ea5e9', user === 'player' ? 20 : 80, 60);
      }
      
      if (manaGain > 0) {
          playSfx('BUFF');
          activeChar.mana = Math.min(10, activeChar.mana + manaGain);
          addFloatingText(`+${manaGain} Mana`, '#3b82f6', user === 'player' ? 20 : 80, 60);
      }

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
    
    await new Promise(r => setTimeout(r, 400));
    setGameState(prev => ({ ...prev, lastPlayedCard: null }));
  };

  // --- AI Logic (Sequential) ---
  const runAiTurn = async () => {
     // Skip AI if Online
     if (isOnline) return;

     setIsAiProcessing(true);
     await new Promise(r => setTimeout(r, 800)); 

     let keepPlaying = true;
     
     while(keepPlaying) {
         const current = gameStateRef.current;
         if (current.winner) break;

         const { hand, mana, health, maxHealth, abilityUsed, champion: oppChamp } = current.opponent;
         const playerHealth = current.player.health;
         const playableCards = hand.filter(c => c.cost <= mana);
         const canUseAbility = !abilityUsed && mana >= oppChamp.ability.cost;

         if (playableCards.length === 0 && !canUseAbility) {
            keepPlaying = false;
            break;
         }

         // AI Scoring
         let bestAction: { type: 'card', card: Card } | { type: 'ability' } | null = null;
         let bestScore = -Infinity;

         playableCards.forEach(card => {
             let score = 0;
             score += card.cost * 10; 

             let estimatedDmg = 0;
             if (card.type === CardType.ATTACK || card.type === CardType.MINION || card.description.includes('dmg')) {
                 estimatedDmg = card.value;
             }
             if (estimatedDmg >= playerHealth) score += 99999;

             const isLowHp = health < (maxHealth * 0.35); 
             const isDefensive = card.description.includes('Heal') || card.description.includes('Shield');
             if (isLowHp && isDefensive) score += 500;
             if (card.description.includes('Heal') && health === maxHealth) score -= 1000;

             const remainingManaAfterPlay = mana - card.cost;
             if (remainingManaAfterPlay === 0) score += 50;

             if (score > bestScore) {
                 bestScore = score;
                 bestAction = { type: 'card', card };
             }
         });

         if (canUseAbility) {
             let abilityScore = 0;
             const cost = oppChamp.ability.cost;
             abilityScore += cost * 10;
             if (mana - cost === 0) abilityScore += 50;

             // Prioritize usage if no cards played yet or extra mana
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
        // Only run AI if NOT online
        if (!isOnline) {
            runAiTurn();
        }
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
        <div className={`absolute inset-0 bg-gradient-to-br ${REALM_COLORS[card.realm]} opacity-30`} />
        
        <div className="relative z-10 p-2 flex justify-between items-start">
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-lg shadow-md ${isPlayable ? 'bg-slate-900 border-blue-400 text-blue-100' : 'bg-slate-800 border-slate-500 text-slate-400'}`} title="Mana Cost">
                {card.cost}
            </div>
            {card.type === CardType.ATTACK && <Sword className="w-5 h-5 text-red-400 drop-shadow" />}
            {card.type === CardType.SPELL && <Zap className="w-5 h-5 text-purple-400 drop-shadow" />}
            {card.type === CardType.MINION && <Skull className="w-5 h-5 text-green-400 drop-shadow" />}
            {card.type === CardType.WEAPON && <Sword className="w-5 h-5 text-amber-400 drop-shadow" />}
        </div>
        
        <div className="absolute inset-0 top-8 bottom-16 flex items-center justify-center z-0">
             <div className="bg-black/30 p-4 rounded-full backdrop-blur-sm">
                {card.realm === Realm.FIRE && <Flame className="w-12 h-12 text-orange-500/80" />}
                {card.realm === Realm.ICE && <Snowflake className="w-12 h-12 text-cyan-500/80" />}
                {card.realm === Realm.TECH && <Cpu className="w-12 h-12 text-purple-500/80" />}
                {card.realm === Realm.FOREST && <Trees className="w-12 h-12 text-green-500/80" />}
             </div>
        </div>

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

      {/* Tutorial Overlay */}
      <AnimatePresence>
         {showTutorial && (
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
               onClick={() => setShowTutorial(false)}
            >
               <motion.div 
                  initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                  className="bg-slate-900 border-2 border-amber-500 rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative"
                  onClick={e => e.stopPropagation()}
               >
                  <button onClick={() => setShowTutorial(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                  <h2 className="text-3xl font-cinzel font-bold text-amber-500 mb-6 text-center">How to Play</h2>
                  
                  <div className="space-y-6">
                     <div className="flex gap-4">
                        <div className="bg-slate-800 p-3 rounded-xl h-fit"><Heart className="text-red-500" /></div>
                        <div>
                           <h4 className="font-bold text-white text-lg">Objective</h4>
                           <p className="text-slate-400">Reduce the opponent's Health to 0 before they defeat you.</p>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <div className="bg-slate-800 p-3 rounded-xl h-fit"><Zap className="text-blue-500" /></div>
                        <div>
                           <h4 className="font-bold text-white text-lg">Mana & Cards</h4>
                           <p className="text-slate-400">You gain Mana each turn. Cards cost Mana to play. Use your Mana wisely to deploy minions, cast spells, or equip weapons.</p>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <div className="bg-slate-800 p-3 rounded-xl h-fit"><Layers className="text-purple-500" /></div>
                        <div>
                           <h4 className="font-bold text-white text-lg">Turns</h4>
                           <p className="text-slate-400">Draw 1 card each turn. You can play as many cards as your Mana allows. Click "End Turn" when finished.</p>
                        </div>
                     </div>
                  </div>
                  
                  <button 
                     onClick={() => setShowTutorial(false)}
                     className="w-full mt-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl uppercase tracking-widest transition-colors"
                  >
                     Ready to Battle
                  </button>
               </motion.div>
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
                     <div className="flex items-center gap-2 text-red-400 font-bold text-2xl drop-shadow-sm font-cinzel">
                        {gameState.opponent.champion.name}
                        {isOnline && <Wifi className="w-4 h-4 text-green-500" />}
                     </div>
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

         {/* Center Arena */}
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

             {/* Player Hand */}
             <div className="flex-1 flex justify-center -mb-20 perspective-[1000px] hover:-mb-4 transition-all duration-300 relative">
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

             {/* Controls */}
             <div className="flex flex-col gap-4 items-end min-w-[220px]">
                 {gameState.isPlayerTurn && tacticalTip && !isOnline && (
                     <motion.div initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} className="bg-indigo-900/90 p-3 rounded-l-xl border-r-4 border-indigo-400 text-xs text-indigo-100 max-w-[200px] shadow-lg backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-1 font-bold text-indigo-300 uppercase tracking-wider">
                            <MessageSquare className="w-3 h-3" /> Advisor
                        </div>
                        {tacticalTip}
                    </motion.div>
                 )}

                 <div className="relative flex items-center gap-2 bg-black/60 p-3 rounded-full backdrop-blur-md border border-white/10 overflow-visible" title="Available Mana">
                    {/* Mana Gain Burst Effect */}
                    <AnimatePresence>
                        {manaGainAnim && (
                            <>
                              <motion.div 
                                  initial={{ opacity: 0.8, scale: 0.8 }}
                                  animate={{ opacity: 0, scale: 2.5 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.8, ease: "easeOut" }}
                                  className="absolute inset-0 bg-blue-500 rounded-full blur-2xl z-[-1]"
                              />
                              <motion.div
                                  initial={{ scale: 1, opacity: 1, borderWidth: '4px' }}
                                  animate={{ scale: 1.8, opacity: 0, borderWidth: '0px' }}
                                  transition={{ duration: 0.6 }}
                                  className="absolute inset-0 border-blue-400 rounded-full pointer-events-none z-0"
                              />
                            </>
                        )}
                    </AnimatePresence>
                    
                    <div className="mr-1 text-xs font-bold text-blue-400 uppercase tracking-widest relative z-10">Mana</div>
                    {[...Array(gameState.player.maxMana)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-300 relative z-10 ${i < gameState.player.mana ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)] scale-110' : 'bg-slate-700'}`}>
                           {/* Individual Crystal Pulse on fill */}
                           {i === gameState.player.mana - 1 && manaGainAnim && (
                               <motion.div 
                                 initial={{ scale: 1, opacity: 1 }}
                                 animate={{ scale: 3, opacity: 0 }}
                                 className="absolute inset-0 rounded-full bg-white blur-[1px]"
                               />
                           )}
                        </div>
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