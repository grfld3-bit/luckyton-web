import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Club, Heart, Spade, Diamond } from 'lucide-react';

interface PokerHeadsUpProps {
  onPlay: () => Promise<{ win: boolean, payout: number, userCards: string[], houseCards: string[] }>;
}

const Card: React.FC<{ suit: string, rank: string, hidden?: boolean }> = ({ suit, rank, hidden }) => {
  const getIcon = () => {
    switch(suit) {
      case 'd': return <Diamond className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'h': return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 's': return <Spade className="w-4 h-4 text-slate-900 fill-slate-900" />;
      case 'c': return <Club className="w-4 h-4 text-slate-900 fill-slate-900" />;
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ scale: 0, rotate: -20, y: 100 }}
      animate={{ scale: 1, rotate: 0, y: 0 }}
      className={`w-16 h-24 bg-white rounded-lg border shadow-lg flex flex-col items-center justify-between p-2 ${hidden ? 'bg-indigo-700' : ''}`}
    >
      {hidden ? (
        <div className="w-full h-full bg-indigo-800 rounded flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-400 opacity-30" />
        </div>
      ) : (
        <>
          <div className="self-start font-bold text-sm leading-none">{rank}</div>
          <div className="flex-1 flex items-center justify-center">{getIcon()}</div>
          <div className="self-end font-bold text-sm leading-none rotate-180">{rank}</div>
        </>
      )}
    </motion.div>
  );
};

export const PokerHeadsUp: React.FC<PokerHeadsUpProps> = ({ onPlay }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [userCards, setUserCards] = useState<string[]>([]);
  const [houseCards, setHouseCards] = useState<string[]>([]);
  const [win, setWin] = useState<boolean | null>(null);
  const [stage, setStage] = useState<'IDLE' | 'DEALING' | 'REVEAL'>('IDLE');

  const play = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    setStage('DEALING');
    setUserCards([]);
    setHouseCards([]);
    setWin(null);

    const res = await onPlay();
    
    // Animate cards one by one
    setTimeout(() => setUserCards([res.userCards[0]]), 500);
    setTimeout(() => setHouseCards([res.houseCards[0]]), 1000);
    setTimeout(() => setUserCards([res.userCards[0], res.userCards[1]]), 1500);
    setTimeout(() => {
      setHouseCards([res.houseCards[0], res.houseCards[1]]);
      setWin(res.win);
      setStage('REVEAL');
      setIsPlaying(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center gap-8 p-8 bg-green-900 rounded-3xl border-4 border-amber-900 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-800 to-green-950 opacity-50" />
      
      {/* Dealer/House Section */}
      <div className="z-10 flex flex-col items-center gap-2">
        <span className="text-white/50 text-[10px] uppercase font-bold tracking-widest">Dealer</span>
        <div className="flex gap-2 h-24">
          {houseCards.map((c, i) => (
            <Card key={i} suit={c.slice(-1)} rank={c.slice(0, -1)} hidden={stage === 'DEALING'} />
          ))}
          {houseCards.length === 0 && Array(2).fill(0).map((_, i) => <div key={i} className="w-16 h-24 border-2 border-dashed border-white/10 rounded-lg" />)}
        </div>
      </div>

      {/* Result Backdrop */}
      <AnimatePresence>
        {stage === 'REVEAL' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="z-20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-8 py-3 bg-black/80 backdrop-blur-md rounded-full border border-white/20"
          >
            <span className={`text-3xl font-black ${win ? 'text-yellow-400' : 'text-rose-500'}`}>
              {win ? 'YOU WIN!' : 'DEALER WINS'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Section */}
      <div className="z-10 flex flex-col items-center gap-2">
        <div className="flex gap-2 h-24">
           {userCards.map((c, i) => (
            <Card key={i} suit={c.slice(-1)} rank={c.slice(0, -1)} />
          ))}
          {userCards.length === 0 && Array(2).fill(0).map((_, i) => <div key={i} className="w-16 h-24 border-2 border-dashed border-white/10 rounded-lg" />)}
        </div>
        <span className="text-white/50 text-[10px] uppercase font-bold tracking-widest">Your Hand</span>
      </div>

      <button
        onClick={play}
        disabled={isPlaying}
        className="z-10 px-12 py-3 bg-amber-600 hover:bg-amber-500 text-amber-950 font-black rounded-full shadow-lg transition-transform active:scale-95 disabled:opacity-50"
      >
        {isPlaying ? 'DEALING...' : 'PLAY ALL-IN'}
      </button>
    </div>
  );
};
