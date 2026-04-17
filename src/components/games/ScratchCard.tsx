import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, XCircle } from 'lucide-react';

const ScratchCard: any = (props: any) => {
  // Fallback if scratch-card-react fails as a component
  return <div className="w-full h-full bg-slate-700 flex items-center justify-center text-slate-400 font-bold">REVEALED</div>;
};

interface ScratchCardGameProps {
  onBuy: () => Promise<{ win: boolean, payout: number }>;
}

export const ScratchCardGame: React.FC<ScratchCardGameProps> = ({ onBuy }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<{ win: boolean, payout: number } | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleBuy = async () => {
    setIsPlaying(true);
    setIsRevealed(false);
    setResult(null);
    const res = await onBuy();
    setResult(res);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-slate-800 rounded-3xl border border-slate-700 shadow-xl">
      <h2 className="text-2xl font-bold text-white uppercase tracking-tighter">Gold Scratch</h2>
      
      <div className="relative w-64 h-64 bg-slate-900 rounded-2xl overflow-hidden border-4 border-slate-700">
        {!isPlaying ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-slate-800 to-slate-900">
            <Star className="w-12 h-12 text-yellow-500 animate-pulse" />
            <button
              onClick={handleBuy}
              className="px-6 py-2 bg-yellow-500 text-yellow-950 font-black rounded-xl hover:bg-yellow-400 transition-colors"
            >
              BELI KARTU (0.1 TON)
            </button>
          </div>
        ) : (
          <div className="w-full h-full relative">
            {/* The actual Prize layer (underneath) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-500 text-yellow-950 p-4 text-center">
              {result?.win ? (
                <>
                  <Star className="w-16 h-16 fill-yellow-900" />
                  <span className="text-2xl font-black">WIN!</span>
                  <span className="text-lg font-bold">{result.payout} TON</span>
                </>
              ) : (
                <>
                  <XCircle className="w-16 h-16 opacity-30" />
                  <span className="text-xl font-bold opacity-50 uppercase">Zonk</span>
                </>
              )}
              {isRevealed && (
                <button
                   onClick={() => setIsPlaying(false)}
                   className="mt-4 px-4 py-1 bg-yellow-900 text-yellow-100 text-xs font-bold rounded-lg"
                >
                  MAIN LAGI
                </button>
              )}
            </div>

            {/* Scratch layer */}
            {!isRevealed && (
              <ScratchCard
                width={256}
                height={256}
                image="/scratch-pattern.png" // Fallback to color if not found
                finishPercent={70}
                onComplete={() => setIsRevealed(true)}
                brushSize={30}
              >
                <div className="w-64 h-64 bg-slate-500 flex items-center justify-center text-slate-300 font-black text-2xl uppercase select-none">
                  Gosok Di Sini
                </div>
              </ScratchCard>
            )}
          </div>
        )}
      </div>

      <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest text-center">
        Gosok 70% untuk mengungkap hadiah!
      </p>
    </div>
  );
};
