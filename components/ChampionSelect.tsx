import React from 'react';
import { motion } from 'framer-motion';
import { Champion, Realm } from '../types';
import { REALM_COLORS, REALM_ICONS } from '../constants';

interface ChampionSelectProps {
  champions: Champion[];
  onSelect: (champion: Champion) => void;
}

export const ChampionSelect: React.FC<ChampionSelectProps> = ({ champions, onSelect }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] p-6 pt-24">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 to-amber-600 font-cinzel mb-4 drop-shadow-sm">
          Select Your Champion
        </h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Choose a warrior to lead your deck into the arena. Each realm offers unique powers and strategies.
        </p>
      </motion.div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 w-full max-w-7xl px-4">
        {champions.map((champ, index) => {
          const Icon = REALM_ICONS[champ.realm];
          const bgGradient = REALM_COLORS[champ.realm];

          return (
            <motion.div
              key={champ.id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -15, scale: 1.02 }}
              onClick={() => onSelect(champ)}
              className="relative cursor-pointer h-[500px] rounded-3xl overflow-hidden group border border-slate-700 hover:border-white/50 transition-all duration-300 shadow-2xl"
            >
              {/* Background & Image */}
              <div className={`absolute inset-0 bg-gradient-to-b ${bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="absolute inset-0 bg-slate-900 transition-colors duration-300 group-hover:bg-transparent" />
              
              <img 
                src={champ.image} 
                alt={champ.name} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100" 
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent opacity-90 group-hover:opacity-60 transition-opacity duration-300" />

              {/* Content */}
              <div className="absolute inset-0 p-8 flex flex-col justify-end">
                <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-2 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-white/70 font-bold">{champ.realm}</span>
                  </div>

                  <h3 className="text-4xl font-black text-white mb-1 font-cinzel leading-none">{champ.name}</h3>
                  <p className="text-amber-400 font-medium italic mb-4">{champ.title}</p>
                  
                  <div className="space-y-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                    <p className="text-sm text-slate-200 leading-relaxed">{champ.description}</p>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-black/50 backdrop-blur-sm p-3 rounded-xl border border-white/10 text-center">
                        <div className="text-xs text-slate-400 uppercase font-bold">Health</div>
                        <div className="text-xl font-bold text-green-400">{champ.maxHealth}</div>
                      </div>
                      <div className="bg-black/50 backdrop-blur-sm p-3 rounded-xl border border-white/10 text-center">
                        <div className="text-xs text-slate-400 uppercase font-bold">Ability Cost</div>
                        <div className="text-xl font-bold text-blue-400">{champ.ability.cost}</div>
                      </div>
                    </div>
                    
                    <button className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-colors">
                      Select
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
