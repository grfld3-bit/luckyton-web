import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Coins } from 'lucide-react';

interface CoinFlipProps {
  onFlip: (choice: 'head' | 'tail') => Promise<{ result: 'head' | 'tail', win: boolean }>;
}

export const CoinFlip: React.FC<CoinFlipProps> = ({ onFlip }) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [result, setResult] = useState<'head' | 'tail' | null>(null);
  const [choice, setChoice] = useState<'head' | 'tail' | null>(null);

  const handleFlip = async (userChoice: 'head' | 'tail') => {
    if (isFlipping) return;
    setChoice(userChoice);
    setIsFlipping(true);
    setResult(null);

    const res = await onFlip(userChoice);
    
    // Simulate animation time
    setTimeout(() => {
      setResult(res.result);
      setIsFlipping(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-slate-800 rounded-3xl border border-slate-700">
      <h2 className="text-2xl font-bold text-white">Coin Flip</h2>
      
      <div className="relative w-32 h-32 perspective-1000">
        <motion.div
          className="w-full h-full relative preserve-3d"
          animate={{ rotateY: isFlipping ? 1800 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        >
          {/* Front (Head) */}
          <div className="absolute inset-0 w-full h-full backface-hidden flex items-center justify-center bg-yellow-500 rounded-full border-4 border-yellow-600 shadow-xl">
            <span className="text-4xl font-black text-yellow-900">H</span>
          </div>
          
          {/* Back (Tail) */}
          <div className="absolute inset-0 w-full h-full backface-hidden flex items-center justify-center bg-slate-300 rounded-full border-4 border-slate-400 rotate-y-180 shadow-xl">
            <span className="text-4xl font-black text-slate-700">T</span>
          </div>
          
          {/* Result Card when stopped */}
          {!isFlipping && result && (
            <div className={`absolute inset-0 w-full h-full flex items-center justify-center rounded-full border-4 ${result === 'head' ? 'bg-yellow-500 border-yellow-600' : 'bg-slate-300 border-slate-400'}`}>
               <span className={`text-4xl font-black ${result === 'head' ? 'text-yellow-900' : 'text-slate-700'}`}>
                 {result === 'head' ? 'H' : 'T'}
               </span>
            </div>
          )}
        </motion.div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => handleFlip('head')}
          disabled={isFlipping}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${choice === 'head' ? 'bg-yellow-500 text-yellow-900' : 'bg-slate-700 text-white hover:bg-slate-600'} disabled:opacity-50`}
        >
          HEAD
        </button>
        <button
          onClick={() => handleFlip('tail')}
          disabled={isFlipping}
          className={`px-6 py-2 rounded-xl font-bold transition-all ${choice === 'tail' ? 'bg-slate-400 text-slate-900' : 'bg-slate-700 text-white hover:bg-slate-600'} disabled:opacity-50`}
        >
          TAIL
        </button>
      </div>

      <AnimatePresence>
        {!isFlipping && result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-xl font-bold ${result === choice ? 'text-green-400' : 'text-red-400'}`}
          >
            {result === choice ? 'YOU WIN!' : 'TRY AGAIN!'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
