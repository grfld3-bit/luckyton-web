import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, ArrowDown, Club, Heart, Spade, Diamond } from 'lucide-react';

interface HigherLowerProps {
  onStart: () => Promise<{ card: number }>;
  onGuess: (currentCard: number, guess: 'higher' | 'lower') => Promise<{ nextCard: number, win: boolean, payout: number }>;
}

const Card: React.FC<{ value: number }> = ({ value }) => {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const rank = ranks[value - 2];
  
  return (
    <motion.div
      initial={{ x: 100, opacity: 0, rotate: 10 }}
      animate={{ x: 0, opacity: 1, rotate: 0 }}
      exit={{ x: -100, opacity: 0, rotate: -10 }}
      className="w-24 h-36 bg-white rounded-xl shadow-2xl flex flex-col items-center justify-center border-2 border-slate-200"
    >
      <span className={`text-3xl font-black ${[2, 4, 6].includes(value % 4) ? 'text-red-500' : 'text-slate-900'}`}>
        {rank}
      </span>
      <div className="grid grid-cols-2 gap-1 opacity-20">
        <Heart className="w-4 h-4" />
        <Spade className="w-4 h-4" />
        <Diamond className="w-4 h-4" />
        <Club className="w-4 h-4" />
      </div>
    </motion.div>
  );
};

export const HigherLower: React.FC<HigherLowerProps> = ({ onStart, onGuess }) => {
  const [currentCard, setCurrentCard] = useState<number | null>(null);
  const [nextCard, setNextCard] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [win, setWin] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    onStart().then(res => setCurrentCard(res.card));
  }, []);

  const handleGuess = async (guess: 'higher' | 'lower') => {
    if (isProcessing || !currentCard) return;
    setIsProcessing(true);
    setWin(null);

    const res = await onGuess(currentCard, guess);
    setNextCard(res.nextCard);
    setWin(res.win);

    setTimeout(() => {
      if (res.win) {
        setScore(s => s + 1);
        setCurrentCard(res.nextCard);
        setNextCard(null);
      } else {
        setScore(0);
        // Reset after bit of delay
        setTimeout(() => {
           onStart().then(r => {
             setCurrentCard(r.card);
             setNextCard(null);
             setWin(null);
           });
        }, 2000);
      }
      setIsProcessing(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-slate-900 rounded-[40px] border border-white/5 shadow-inner">
      <div className="flex justify-between w-full px-4">
        <h2 className="text-xl font-black text-white italic">HILO</h2>
        <div className="bg-indigo-500/20 px-3 py-1 rounded-full border border-indigo-500/30">
          <span className="text-indigo-400 font-bold text-sm">STREAK: {score}</span>
        </div>
      </div>

      <div className="relative h-48 flex items-center justify-center gap-4">
        <AnimatePresence mode="wait">
          {currentCard && <Card key={currentCard} value={currentCard} />}
        </AnimatePresence>
        
        {nextCard && (
           <Card key={`next-${nextCard}`} value={nextCard} />
        )}
      </div>

      <div className="flex gap-4 w-full">
        <button
          onClick={() => handleGuess('higher')}
          disabled={isProcessing}
          className="flex-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl flex flex-col items-center gap-1 transition-all"
        >
          <ArrowUp className="w-6 h-6" />
          <span className="text-xs font-black uppercase">Higher</span>
        </button>
        <button
          onClick={() => handleGuess('lower')}
          disabled={isProcessing}
          className="flex-1 py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl flex flex-col items-center gap-1 transition-all"
        >
          <ArrowDown className="w-6 h-6" />
          <span className="text-xs font-black uppercase">Lower</span>
        </button>
      </div>

      <AnimatePresence>
        {win !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-2xl font-black ${win ? 'text-emerald-400' : 'text-rose-500'}`}
          >
            {win ? 'CORRECT!' : 'WRONG!'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
