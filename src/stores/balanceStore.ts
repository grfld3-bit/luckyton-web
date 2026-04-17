import { create } from 'zustand';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';

interface BalanceState {
  mainBalance: number;
  bonusBalance: number;
  socket: any | null;
  connectSocket: (userId: string, apiUrl: string) => void;
  setBalance: (main: number, bonus: number) => void;
  updateBalance: (type: 'main' | 'bonus', amount: number) => void;
}

export const useBalanceStore = create<BalanceState>((set, get) => ({
  mainBalance: 0,
  bonusBalance: 0,
  socket: null,
  connectSocket: (userId, apiUrl) => {
    if (get().socket) return;
    
    const socket = io(apiUrl, { 
      query: { userId },
      transports: ['websocket'],
      reconnection: true
    });

    socket.on('connect', () => {
      console.log('Successfully connected to WebSocket as:', userId);
    });

    socket.on('balance-updated', (data: { mainBalance: number, bonusBalance: number }) => {
      console.log('Balance update received via socket:', data);
      set({ mainBalance: data.mainBalance, bonusBalance: data.bonusBalance });
    });

    set({ socket });
  },
  setBalance: (main, bonus) => set({ mainBalance: main, bonusBalance: bonus }),
  updateBalance: (type, amount) => {
    set((state) => ({
      mainBalance: type === 'main' ? state.mainBalance + amount : state.mainBalance,
      bonusBalance: type === 'bonus' ? state.bonusBalance + amount : state.bonusBalance,
    }));
  },
}));
