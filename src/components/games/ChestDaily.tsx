import React, { useState } from 'react';
import Lottie from 'lottie-react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Coins, Ticket } from 'lucide-react';

// Using a publicly accessible chest animation URL
const CHEST_ANIMATION_URL = "https://assets5.lottiefiles.com/packages/lf20_96py9m.json";

interface ChestDailyProps {
  onOpen: () => Promise<{ reward: { type: 'TON' | 'TICKET' | 'NONE', amount?: number, message: string } }>;
}

export const ChestDaily: React.FC<ChestDailyProps> = ({ onOpen }) => {
  const [stage, setStage] = useState<'IDLE' | 'OPENING' | 'REVEALED'>('IDLE');
  const [reward, setReward] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (stage !== 'IDLE') return;
    setStage('OPENING');
    setError(null);

    try {
      const res = await onOpen();
      setReward(res.reward);
      setTimeout(() => {
        setStage('REVEALED');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Coba lagi besok!");
      setStage('IDLE');
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[32px] border border-white/10 shadow-2xl overflow-hidden relative">
      <h2 className="text-2xl font-black text-white tracking-tight uppercase">Daily Chest</h2>
      
      <div className="w-64 h-64 flex items-center justify-center">
        {stage !== 'REVEALED' ? (
          <div 
            onClick={handleOpen}
            className={`cursor-pointer transition-transform hover:scale-105 active:scale-95 ${stage === 'OPENING' ? 'pointer-events-none' : ''}`}
          >
            <Lottie 
              animationData={null as any} 
              path={CHEST_ANIMATION_URL}
              loop={stage === 'IDLE'}
              autoPlay={true}
              style={{ width: 250, height: 250 }}
              {...({} as any)}
            />
          </div>
        ) : (
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="w-32 h-32 bg-yellow-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(234,179,8,0.5)]">
              {reward?.type === 'TON' && <Coins className="w-16 h-16 text-yellow-950" />}
              {reward?.type === 'TICKET' && <Ticket className="w-16 h-16 text-yellow-950" />}
              {reward?.type === 'NONE' && <Gift className="w-16 h-16 text-yellow-950 opacity-50" />}
            </div>
            <div className="text-center">
              <p className="text-white font-black text-xl">{reward?.message}</p>
              <p className="text-slate-400 text-sm">Kembali lagi dalam 24 jam!</p>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-rose-400 text-sm font-bold bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-500/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {stage === 'IDLE' && (
        <button
          onClick={handleOpen}
          className="px-10 py-4 bg-yellow-500 text-yellow-950 font-black rounded-2xl shadow-lg hover:bg-yellow-400 transition-colors uppercase tracking-widest"
        >
          Buka Chest
        </button>
      )}
    </div>
  );
};
