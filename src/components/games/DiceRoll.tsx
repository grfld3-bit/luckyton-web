import React, { useState } from 'react';
import { Dice3D } from '../animations/Dice3D';
import { motion, AnimatePresence } from 'motion/react';

interface DiceRollProps {
  onRoll: (choice: number) => Promise<{ diceResult: number, houseChoice: number, win: boolean, payout: number }>;
}

export const DiceRoll: React.FC<DiceRollProps> = ({ onRoll }) => {
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<number>(1);
  const [houseChoice, setHouseChoice] = useState<number | null>(null);
  const [userChoice, setUserChoice] = useState<number | null>(null);
  const [win, setWin] = useState<boolean | null>(null);

  const handleRoll = async (choice: number) => {
    if (isRolling) return;
    setUserChoice(choice);
    setIsRolling(true);
    setWin(null);
    setHouseChoice(null);

    const res = await onRoll(choice);
    
    // Smooth roll for 2 seconds
    setTimeout(() => {
      setResult(res.diceResult);
      setHouseChoice(res.houseChoice);
      setWin(res.win);
      setIsRolling(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-slate-800 rounded-3xl border border-slate-700">
      <h2 className="text-2xl font-bold text-white">Dice Battle</h2>
      
      <Dice3D rolling={isRolling} result={result} />

      <div className="w-full text-center">
        <p className="text-slate-400 text-sm mb-4">
          Pilih angka yang paling dekat dengan hasil dadu.<br/>
          Jika seri, Bandar menang!
        </p>
        
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6].map((num) => (
            <button
              key={num}
              onClick={() => handleRoll(num)}
              disabled={isRolling}
              className={`w-12 h-12 rounded-xl font-bold text-xl transition-all ${userChoice === num ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'} disabled:opacity-50`}
            >
              {num}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {!isRolling && houseChoice !== null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4 bg-slate-900/50 rounded-2xl border border-slate-700"
            >
              <div className="flex justify-around w-full px-4">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-400 uppercase tracking-widest">Kamu</span>
                  <span className="text-2xl font-black text-white">{userChoice}</span>
                  <span className="text-[10px] text-slate-500">Selisih: {Math.abs(result - (userChoice || 0))}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-xs text-slate-400 uppercase tracking-widest">Bandar</span>
                  <span className="text-2xl font-black text-rose-500">{houseChoice}</span>
                  <span className="text-[10px] text-slate-500">Selisih: {Math.abs(result - houseChoice)}</span>
                </div>
              </div>
              
              <div className={`text-2xl font-black ${win ? 'text-green-400' : 'text-rose-500'}`}>
                {win ? 'KAMU MENANG!' : 'BANDAR MENANG!'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
