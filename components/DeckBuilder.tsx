import React, { useState } from 'react';
import { Card, Champion } from '../types';
import { CARDS, REALM_COLORS } from '../constants';
import { Shield, Zap, Sword, Check, ArrowLeft, Play, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface DeckBuilderProps {
  champion: Champion;
  onConfirm: (deck: Card[]) => void;
  onBack: () => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ champion, onConfirm, onBack }) => {
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const DECK_LIMIT = 8; 

  const toggleCard = (card: Card) => {
    if (selectedCards.find(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
    } else {
      if (selectedCards.length < DECK_LIMIT) {
        setSelectedCards([...selectedCards, card]);
      }
    }
  };

  const availableCards = CARDS.filter(c => 
    c.realm === champion.realm || ['Fire Realm', 'Ice Realm', 'Tech Realm', 'Forest Realm'].includes(c.realm)
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 flex flex-col pt-24">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col md:flex-row gap-8">
        
        {/* Card Pool */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-4xl font-cinzel font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Build Your Deck</h2>
              <div className="flex items-center gap-2 text-slate-400 mt-1">
                <Info className="w-4 h-4" />
                <p>Choose exactly {DECK_LIMIT} cards to bring into battle.</p>
              </div>
            </div>
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" /> Change Champion
            </button>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
            {availableCards.map((card) => {
              const isSelected = selectedCards.find(c => c.id === card.id);
              
              return (
                <motion.div
                  key={card.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleCard(card)}
                  className={`
                    relative p-4 rounded-xl border-2 cursor-pointer transition-all overflow-hidden group
                    ${isSelected 
                      ? 'border-amber-500 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}
                  `}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${REALM_COLORS[card.realm]} opacity-10 group-hover:opacity-20 transition-opacity`} />
                  
                  <div className="relative z-10 flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-blue-500 text-blue-200 text-sm font-bold shadow-md" title="Mana Cost">
                        {card.cost}
                      </span>
                    </div>
                    {isSelected && <div className="bg-amber-500 rounded-full p-1"><Check className="w-4 h-4 text-black" /></div>}
                  </div>
                  
                  <h4 className="relative z-10 font-bold text-lg text-white mb-1 font-cinzel">{card.name}</h4>
                  <p className="relative z-10 text-xs text-slate-300 leading-relaxed mb-4 min-h-[40px]">{card.description}</p>
                  
                  <div className="relative z-10 flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-black/20 p-2 rounded-lg">
                    {card.type === 'Attack' && <Sword className="w-4 h-4 text-red-400" />}
                    {card.type === 'Spell' && <Zap className="w-4 h-4 text-purple-400" />}
                    {card.type === 'Minion' && <Shield className="w-4 h-4 text-green-400" />}
                    {card.type} <span className="text-white ml-auto font-mono text-sm">{card.value}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Current Deck Sidebar */}
        <div className="w-full md:w-96 flex-shrink-0">
          <div className="bg-slate-900/80 border border-slate-700 rounded-2xl p-6 shadow-2xl sticky top-24 backdrop-blur-xl">
             <div className="flex items-center gap-4 mb-6 border-b border-slate-700 pb-4">
                <div className="w-16 h-16 rounded-full border-2 border-amber-500 overflow-hidden bg-black">
                   <img src={champion.image} className="w-full h-full object-cover" alt="Champ" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-cinzel">{champion.name}</h3>
                  <div className={`text-sm font-bold ${selectedCards.length === DECK_LIMIT ? 'text-green-400' : 'text-amber-500'}`}>
                    {selectedCards.length}/{DECK_LIMIT} Cards Selected
                  </div>
                </div>
             </div>

             <div className="space-y-2 mb-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {selectedCards.length === 0 && (
                  <div className="text-center text-slate-600 py-12 italic border-2 border-dashed border-slate-800 rounded-xl">
                     Select cards from the library to build your deck
                  </div>
                )}
                {selectedCards.map((card) => (
                  <motion.div 
                    layoutId={`deck-${card.id}`}
                    key={card.id} 
                    className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700 group hover:border-slate-500 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                       <span className="w-6 h-6 rounded-full bg-blue-900/50 text-blue-200 text-xs font-bold flex items-center justify-center border border-blue-500/30">{card.cost}</span>
                       <span className="text-slate-200 font-medium">{card.name}</span>
                    </div>
                    <button onClick={() => toggleCard(card)} className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                  </motion.div>
                ))}
             </div>

             <button
                disabled={selectedCards.length !== DECK_LIMIT}
                onClick={() => onConfirm(selectedCards)}
                className={`
                  w-full py-4 rounded-xl font-bold text-lg uppercase tracking-widest flex items-center justify-center gap-2 transition-all
                  ${selectedCards.length === DECK_LIMIT 
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] transform hover:scale-105' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}
                `}
              >
                Enter Battle <Play className="w-5 h-5 fill-current" />
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};