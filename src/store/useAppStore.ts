import { create } from 'zustand';

interface User {
  id: string;
  telegramId: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  mainBalance: number;
  bonusBalance: number;
  wageringRemaining: number;
  totalBets: number;
  totalWins: number;
  currentStreak: number;
  lastClaim: string | null;
  ticketsBalance: number;
  isBanned: boolean;
  bannedReason: string | null;
}

interface AppStore {
  user: User | null;
  setUser: (user: User) => void;
  updateBalances: (main: number, bonus: number, wagering?: number) => void;
  games: any[];
  setGames: (games: any[]) => void;
  addGame: (game: any) => void;
  updateGame: (game: any) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  updateBalances: (mainBalance, bonusBalance, wageringRemaining) => 
    set((state) => ({ 
      user: state.user ? { 
        ...state.user, 
        mainBalance, 
        bonusBalance,
        ...(wageringRemaining !== undefined ? { wageringRemaining } : {})
      } : null 
    })),
  games: [],
  setGames: (games) => set({ games }),
  addGame: (game) => set((state) => ({ games: [game, ...state.games] })),
  updateGame: (game) => set((state) => {
    const idx = state.games.findIndex(g => g.id === game.id);
    if (idx === -1) return state;
    const newGames = [...state.games];
    newGames[idx] = game;
    return { games: newGames };
  })
}));
