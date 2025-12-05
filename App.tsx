import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Champion, Card, NetworkMessage, HandshakePayload } from './types';
import { ChampionSelect } from './components/ChampionSelect';
import { DeckBuilder } from './components/DeckBuilder';
import { BattleArena } from './components/BattleArena';
import { CHAMPIONS } from './constants';
import { Sword, LayoutGrid, User, Shield, Globe, Users, Copy, ArrowRight, Loader2, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Peer, { DataConnection } from 'peerjs';

// Global Background Component
const GlobalBackground = () => (
  <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-slate-950">
    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-900/0 via-slate-900/50 to-slate-950"></div>
    {/* Floating Particles/Orbs */}
    <motion.div 
      animate={{ x: [0, 100, 0], y: [0, -50, 0], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px]"
    />
    <motion.div 
      animate={{ x: [0, -150, 0], y: [0, 100, 0], opacity: [0.2, 0.5, 0.2] }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]"
    />
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('LOBBY');
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [playerDeck, setPlayerDeck] = useState<Card[]>([]);
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  
  // Online State
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [opponentChampion, setOpponentChampion] = useState<Champion | null>(null);

  // Online Lobby Component
  const OnlineLobby = () => {
    const [mode, setMode] = useState<'HOST' | 'JOIN'>('HOST');
    const [myId, setMyId] = useState("");
    const [joinCode, setJoinCode] = useState("");
    const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'WAITING' | 'CONNECTED'>('IDLE');
    const [error, setError] = useState("");

    // Initialize Peer for Host
    useEffect(() => {
      if (mode === 'HOST' && !peer) {
        setStatus('WAITING');
        const newPeer = new Peer();
        
        newPeer.on('open', (id) => {
          setMyId(id);
          setPeer(newPeer);
        });

        newPeer.on('connection', (conn) => {
          setConnection(conn);
          setStatus('CONNECTED');
          setupConnection(conn);
        });

        newPeer.on('error', (err) => setError("Connection Error: " + err.message));
        
        return () => newPeer.destroy();
      }
    }, [mode]);

    const handleJoin = () => {
      if (!joinCode) return;
      setStatus('CONNECTING');
      
      const newPeer = new Peer();
      setPeer(newPeer);

      newPeer.on('open', () => {
        const conn = newPeer.connect(joinCode);
        
        conn.on('open', () => {
          setConnection(conn);
          setStatus('CONNECTED');
          setupConnection(conn);
        });
        
        conn.on('error', (err) => {
          setError("Failed to connect to host.");
          setStatus('IDLE');
        });
      });
      
      newPeer.on('error', (err) => {
        setError("Network Error");
        setStatus('IDLE');
      });
    };

    const setupConnection = (conn: DataConnection) => {
      // Wait for handshake
      conn.on('data', (data: any) => {
        if (data.type === 'HANDSHAKE') {
          const payload = data.payload as HandshakePayload;
          setOpponentChampion(payload.champion);
          // Wait a moment for visual effect then start
          setTimeout(() => setView('BATTLE'), 1000);
        }
      });

      // Send my handshake
      if (selectedChampion) {
        conn.send({
          type: 'HANDSHAKE',
          payload: { champion: selectedChampion }
        });
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 pt-24">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full"
        >
          <h2 className="text-3xl font-cinzel font-bold text-white mb-6 flex items-center justify-center gap-3">
            <Globe className="w-8 h-8 text-blue-400" /> Online Lobby
          </h2>
          
          <div className="flex bg-slate-800 rounded-lg p-1 mb-8">
            <button 
              onClick={() => { setMode('HOST'); setPeer(null); setStatus('IDLE'); setError(''); }}
              className={`flex-1 py-2 rounded-md font-bold transition-all ${mode === 'HOST' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Host Game
            </button>
            <button 
              onClick={() => { setMode('JOIN'); setPeer(null); setStatus('IDLE'); setError(''); }}
              className={`flex-1 py-2 rounded-md font-bold transition-all ${mode === 'JOIN' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Join Game
            </button>
          </div>

          <div className="min-h-[200px] flex flex-col justify-center">
             {error && (
                <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-sm font-bold border border-red-500/50">
                  {error}
                </div>
             )}

             {status === 'CONNECTED' ? (
                <div className="flex flex-col items-center gap-4">
                  <Wifi className="w-16 h-16 text-green-400 animate-pulse" />
                  <div className="text-green-400 font-bold text-xl">
                    Connected! Synchronizing...
                  </div>
                </div>
             ) : (
               <>
                 {mode === 'HOST' ? (
                   <div className="space-y-4">
                     <p className="text-slate-400 text-sm">Share this ID with your friend:</p>
                     <div className="flex items-center gap-2 bg-black/40 p-4 rounded-xl border border-slate-600 relative overflow-hidden">
                       {myId ? (
                         <>
                           <span className="text-xl font-mono font-bold text-amber-400 flex-1 break-all">{myId}</span>
                           <button 
                             onClick={() => navigator.clipboard.writeText(myId)}
                             className="p-2 hover:bg-slate-700 rounded-lg text-slate-400"
                            >
                             <Copy className="w-5 h-5" />
                           </button>
                         </>
                       ) : (
                         <div className="flex w-full justify-center"><Loader2 className="animate-spin text-amber-500" /></div>
                       )}
                     </div>
                     <div className="flex items-center justify-center gap-2 text-slate-500 text-sm animate-pulse">
                       <Loader2 className="w-4 h-4 animate-spin" /> Waiting for opponent...
                     </div>
                   </div>
                 ) : (
                   <div className="space-y-4">
                     <p className="text-slate-400 text-sm">Enter Host ID:</p>
                     <input 
                       type="text" 
                       value={joinCode}
                       onChange={(e) => setJoinCode(e.target.value)}
                       placeholder="Paste Host ID Here"
                       className="w-full bg-black/40 border border-slate-600 rounded-xl p-4 text-center text-sm font-mono font-bold text-white focus:outline-none focus:border-blue-500 transition-colors"
                     />
                     <button 
                       onClick={handleJoin}
                       disabled={!joinCode || status === 'CONNECTING'}
                       className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                     >
                       {status === 'CONNECTING' ? <Loader2 className="animate-spin" /> : <>Connect <ArrowRight className="w-5 h-5" /></>}
                     </button>
                   </div>
                 )}
               </>
             )}
          </div>
          
          <button onClick={() => setView('LOBBY')} className="mt-6 text-slate-500 hover:text-white text-sm">Cancel</button>
        </motion.div>
      </div>
    );
  };

  // Lobby Component
  const Lobby = () => (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 relative overflow-hidden">
      {/* Background handled by GlobalBackground */}
      <div className="relative z-10 max-w-3xl flex flex-col items-center">
        <motion.div
           initial={{ opacity: 0, y: -50 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 1 }}
        >
          <div className="flex justify-center mb-6">
            <Shield className="w-20 h-20 text-amber-500 fill-amber-500/20" />
          </div>
          <h1 className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-400 to-amber-700 mb-2 drop-shadow-[0_0_25px_rgba(245,158,11,0.5)] font-cinzel">
            FATEBOUND
          </h1>
          <p className="text-2xl md:text-3xl text-slate-300 font-light tracking-[0.3em] mb-12 uppercase border-b border-slate-600 pb-8 inline-block">
            Duel of Realms
          </p>
        </motion.div>

        <div className="flex flex-col gap-4 w-full max-w-sm">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setIsOnlineMode(false); setView('CHAMPION_SELECT'); }}
            className="group relative w-full py-6 bg-amber-600 overflow-hidden rounded-lg shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all hover:shadow-[0_0_50px_rgba(245,158,11,0.6)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-yellow-500 opacity-100 group-hover:opacity-90 transition-opacity"></div>
            <span className="relative text-white font-black text-xl tracking-widest uppercase flex items-center justify-center gap-3">
              Single Player <Sword className="w-5 h-5 fill-white" />
            </span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setIsOnlineMode(true); setView('CHAMPION_SELECT'); }}
            className="group relative w-full py-6 bg-slate-800 overflow-hidden rounded-lg border border-slate-600 transition-all hover:border-blue-400"
          >
            <span className="relative text-blue-100 font-black text-xl tracking-widest uppercase flex items-center justify-center gap-3 group-hover:text-white">
              Online Play <Globe className="w-5 h-5" />
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );

  const handleChampionSelect = (champ: Champion) => {
    setSelectedChampion(champ);
    setView('DECK_BUILDER');
  };

  const handleDeckConfirm = (deck: Card[]) => {
    setPlayerDeck(deck);
    if (isOnlineMode) {
      setView('ONLINE_LOBBY');
    } else {
      setView('BATTLE');
    }
  };

  const handleEndGame = (winner: 'player' | 'opponent') => {
    setView('LOBBY');
    setSelectedChampion(null);
    setPlayerDeck([]);
    if (connection) {
        connection.close();
        setConnection(null);
    }
    if (peer) {
        peer.destroy();
        setPeer(null);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 font-sans selection:bg-amber-500/30 relative">
      <GlobalBackground />
      
      {/* Navigation */}
      <AnimatePresence>
        {view !== 'LOBBY' && view !== 'BATTLE' && view !== 'ONLINE_LOBBY' && (
          <motion.nav 
            initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }}
            className="fixed top-0 left-0 right-0 h-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-md flex items-center px-8 justify-between z-50 shadow-2xl"
          >
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('LOBBY')}>
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/50 group-hover:bg-amber-500/20 transition-colors">
                <Shield className="text-amber-500 w-6 h-6" />
              </div>
              <span className="font-cinzel font-bold text-xl tracking-wider text-slate-200 group-hover:text-white transition-colors">Fatebound</span>
            </div>
            
            <div className="flex items-center gap-2">
              <StepIndicator active={view === 'CHAMPION_SELECT'} label="Hero" icon={User} />
              <div className="w-12 h-[2px] bg-slate-800 rounded-full mx-2" />
              <StepIndicator active={view === 'DECK_BUILDER'} label="Deck" icon={LayoutGrid} />
              <div className="w-12 h-[2px] bg-slate-800 rounded-full mx-2" />
              <StepIndicator active={false} label="Battle" icon={Sword} />
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      <main>
        {view === 'LOBBY' && <Lobby />}
        {view === 'ONLINE_LOBBY' && <OnlineLobby />}
        
        {view === 'CHAMPION_SELECT' && (
          <ChampionSelect 
            champions={CHAMPIONS} 
            onSelect={handleChampionSelect} 
          />
        )}
        
        {view === 'DECK_BUILDER' && selectedChampion && (
          <DeckBuilder 
            champion={selectedChampion} 
            onConfirm={handleDeckConfirm}
            onBack={() => setView('CHAMPION_SELECT')}
          />
        )}
        
        {view === 'BATTLE' && selectedChampion && (
          <BattleArena 
            champion={selectedChampion} 
            playerDeck={playerDeck}
            onEndGame={handleEndGame}
            isOnline={isOnlineMode}
            connection={connection || undefined}
            opponentChampion={opponentChampion || undefined}
          />
        )}
      </main>
    </div>
  );
};

const StepIndicator = ({ active, label, icon: Icon }: { active: boolean, label: string, icon: any }) => (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-full transition-all ${active ? 'bg-amber-500/10 border border-amber-500/30' : 'opacity-50'}`}>
        <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-slate-400'}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${active ? 'text-amber-100' : 'text-slate-500'}`}>{label}</span>
    </div>
);

export default App;