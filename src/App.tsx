import { useEffect, useState } from 'react';
import { TonConnectUIProvider, useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { useAppStore } from './store/useAppStore';
import io from 'socket.io-client';
import { 
  Coins, Dice5, Club, Wallet, Play, Plus, ArrowUpRight, 
  ArrowDownLeft, Gift, Trophy, User as UserIcon, 
  Layers, CreditCard, History, Zap, CheckCircle2, AlertCircle,
  Shield, X, Search, Ban, DollarSign, Activity, Settings as SettingsIcon,
  LayoutDashboard, Users, FileText, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const API_URL = (import.meta as any).env?.VITE_API_URL || window.location.origin;
let socket: any;

// --- UTILS ---
const formatTON = (val: number = 0) => val.toFixed(2);

function LuckyTONApp() {
  const { user, setUser, games, setGames, addGame, updateGame, updateBalances } = useAppStore();
  const address = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [activeTab, setActiveTab] = useState<'PVP' | 'SOLO' | 'TOURNEY' | 'PROFILE'>('PVP');
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChestModal, setShowChestModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [tournament, setTournament] = useState<any>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) tg.ready();
    
    // Simulate TG User in Local
    const mockUser = { id: 12345678, first_name: "Garf", last_name: "Field", username: "garf_field" };
    
    const initAuth = async () => {
      try {
        console.log("Initializing auth...");
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initDataUnsafe: tg?.initDataUnsafe?.user ? tg.initDataUnsafe : { user: mockUser } })
        });
        
        const data = await response.json();
        if (data.user) {
          setUser(data.user);
          console.log("Auth successful");
        } else if (data.error) {
          console.error("Auth error from server:", data.error);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    socket = io(API_URL);
    socket.on('gameCreated', (game: any) => addGame(game));
    socket.on('gameUpdated', (game: any) => updateGame(game));
    socket.on('tournamentUpdated', () => fetchTournament());

    fetch(`${API_URL}/api/games`).then(r => r.json()).then(setGames).catch(console.error);
    fetchTournament();

    return () => { socket?.disconnect(); }
  }, []);

  const fetchTournament = () => {
    fetch(`${API_URL}/api/tournaments/active`).then(r => r.json()).then(setTournament).catch(console.error);
  };

  const claimChest = async () => {
    if (!user) return;
    try {
      const r = await fetch(`${API_URL}/api/chest/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await r.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      // Refresh user
      const loginRes = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initDataUnsafe: { user: { id: user.id } } })
      });
      const userData = await loginRes.json();
      if (userData.user) setUser(userData.user);
      setShowChestModal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const isAdmin = user && (import.meta as any).env?.VITE_ADMIN_IDS?.split(',').includes(user.telegramId);
  const [showAdmin, setShowAdmin] = useState(false);

  if (loading) return (
    <div 
      className="min-h-screen flex items-center justify-center bg-[#0d1117] text-white flex-col gap-4" 
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 20px)', 
        paddingBottom: 'env(safe-area-inset-bottom, 20px)', 
        paddingLeft: 'env(safe-area-inset-left, 0px)', 
        paddingRight: 'env(safe-area-inset-right, 0px)' 
      }}
    >
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <div className="font-bold tracking-tight">Loading Arena...</div>
    </div>
  );

  if (showAdmin && isAdmin) {
    return <AdminPanel user={user} onClose={() => setShowAdmin(false)} />;
  }

  return (
    <div 
      className="min-h-screen bg-[#0d1117] text-[#c9d1d9] pb-32 max-w-lg mx-auto relative overflow-hidden flex flex-col font-sans"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      {/* Header */}
      <header className="p-4 flex justify-between items-center sticky top-0 z-30 bg-[#0d1117]/80 backdrop-blur-md border-b border-[#30363d]">
        <div className="flex flex-col">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-blue-500">Lucky</span>TON
            </h1>
            <div className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Safe & Fair PvP</div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setShowAdmin(true)}
              className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500/20 transition-all"
            >
              <Shield size={18} />
            </button>
          )}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 bg-[#161b22] border border-[#30363d] px-3 py-1 rounded-full">
              <span className="text-sm font-mono text-white">{formatTON(user?.mainBalance)}</span>
              <span className="text-[10px] text-blue-400 font-bold">TON</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* Daily Bonus Quick Link */}
        <button 
          onClick={claimChest}
          className="w-full mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-between group hover:border-blue-500/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <Gift size={24} />
            </div>
            <div className="text-left">
              <div className="font-bold text-white">Daily Chest</div>
              <div className="text-xs text-blue-300">Claim your free bonus TON & Tickets</div>
            </div>
          </div>
          <ArrowUpRight className="text-blue-400 opacity-50 group-hover:opacity-100" />
        </button>

        {activeTab === 'PVP' && <PvpLobby games={games} onCreate={() => setShowCreateModal(true)} />}
        {activeTab === 'SOLO' && <SoloGames user={user} />}
        {activeTab === 'TOURNEY' && <TournamentView tournament={tournament} user={user} fetchTournament={fetchTournament} />}
        {activeTab === 'PROFILE' && (
          <ProfileView 
            user={user} 
            address={address} 
            connect={() => tonConnectUI.connectWallet()} 
            onDeposit={() => setShowDepositModal(true)}
            onWithdraw={() => setShowWithdrawModal(true)}
          />
        )}
      </main>

      {/* Navigation */}
      <nav 
        className="fixed bottom-0 w-full max-w-lg bg-[#0d1117]/90 backdrop-blur-xl border-t border-[#30363d] p-3 flex justify-around items-center z-40"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {[
          { tab: 'PVP', icon: Zap, label: 'Arena' },
          { tab: 'SOLO', icon: Layers, label: 'Solo' },
          { tab: 'TOURNEY', icon: Trophy, label: 'Event' },
          { tab: 'PROFILE', icon: UserIcon, label: 'Profile' }
        ].map(({ tab, icon: Icon, label }) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex flex-col items-center gap-1.5 flex-1 transition-all ${activeTab === tab ? 'text-blue-500' : 'text-gray-500'}`}
          >
            <div className={`p-1.5 rounded-xl ${activeTab === tab ? 'bg-blue-500/10' : ''}`}>
              <Icon size={22} strokeWidth={activeTab === tab ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </nav>

      {/* MODALS */}
      <CreateGameModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        user={user} 
      />

      <ChestRewardModal 
        isOpen={showChestModal} 
        onClose={() => setShowChestModal(false)}
        user={user}
      />

      <DepositModal 
        isOpen={showDepositModal} 
        onClose={() => setShowDepositModal(false)}
        user={user}
      />

      <WithdrawModal 
        isOpen={showWithdrawModal} 
        onClose={() => setShowWithdrawModal(false)}
        user={user}
        address={address}
        refreshUser={() => {
          fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initDataUnsafe: { user: { id: user.id } } })
          })
          .then(r => r.json())
          .then(data => data.user && setUser(data.user));
        }}
      />
    </div>
  );
}

// --- VIEWS ---

function PvpLobby({ games, onCreate }: any) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#161b22] p-4 rounded-2xl border border-[#30363d]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-white">{games.length} Games Active</span>
        </div>
        <button 
          onClick={onCreate}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <Plus size={16} /> Create
        </button>
      </div>

      <div className="space-y-4">
        {games.length === 0 ? (
          <div className="text-center py-20 bg-[#161b22] border border-dashed border-[#30363d] rounded-2xl">
            <Coins className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-500 text-sm">No open challenges. Create the first one!</p>
          </div>
        ) : games.map((game: any) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            key={game.id} 
            className="bg-[#161b22] border border-[#30363d] p-5 rounded-2xl flex justify-between items-center group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center border border-[#30363d] text-blue-400 group-hover:border-blue-500 transition-colors">
                 {game.type === 'COIN_FLIP' ? <Coins size={24} /> : game.type === 'DICE' ? <Dice5 size={24} /> : <Club size={24} />}
              </div>
              <div>
                <div className="font-bold text-white">{game.type.replace('_', ' ')}</div>
                <div className="text-xs text-gray-500 tracking-tight">Host: {game.participants[0]?.user?.firstName || 'User'}</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
               <div className="text-right">
                  <div className="text-gold font-mono font-bold">{game.pot} TON</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest leading-none mt-1">Pool</div>
               </div>
               <button 
                 onClick={() => handleJoin(game)}
                 className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20"
               >
                 <Play size={18} fill="currentColor" />
               </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
  
  async function handleJoin(game: any) {
    // Basic join call
    try {
      const res = await fetch(`${API_URL}/api/games/${game.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: useAppStore.getState().user?.id, choice: 'TAIL' })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert(data.winnerId === useAppStore.getState().user?.id ? "WINNER!" : "LOST!");
      }
    } catch (e) { console.error(e); }
  }
}

function SoloGames({ user }: any) {
  const [selectedGame, setSelectedGame] = useState<any>(null);

  const soloGames = [
    { id: 'SCRATCH', title: 'Scratch Card', icon: CreditCard, color: 'text-yellow-400', bg: 'bg-yellow-400/5', desc: 'Reveal 9 cells for up to 10x prizes!' },
    { id: 'RED_BLACK', title: 'Red or Black', icon: Club, color: 'text-red-400', bg: 'bg-red-400/5', desc: 'Predict card color. Simple 1.95x win.' },
    { id: 'HIGHER_LOWER', title: 'High/Low', icon: Zap, color: 'text-green-400', bg: 'bg-green-400/5', desc: 'Next card higher or lower? Chain for profits.' }
  ];

  if (selectedGame) return <SoloGamePlay game={selectedGame} onBack={() => setSelectedGame(null)} user={user} />;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white mb-6">Solo Games</h2>
      <div className="grid grid-cols-1 gap-4">
        {soloGames.map(g => (
          <motion.button 
            key={g.id}
            onClick={() => setSelectedGame(g)}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-5 p-5 rounded-2xl border border-[#30363d] text-left hover:bg-[#161b22] transition-colors group ${g.bg}`}
          >
            <div className={`p-4 rounded-xl bg-gray-900 border border-[#30363d] ${g.color} group-hover:scale-110 transition-transform`}>
              <g.icon size={28} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-lg text-white">{g.title}</div>
              <div className="text-sm text-gray-500 leading-snug">{g.desc}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function SoloGamePlay({ game, onBack, user }: any) {
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [bet, setBet] = useState(0.5);

  const play = async (choice?: string) => {
    setPlaying(true);
    try {
      const res = await fetch(`${API_URL}/api/solo/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, type: game.id, bet, choice })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-gray-500 flex items-center gap-2 hover:text-white mb-4">
        &larr; Back to Games
      </button>

      <div className="glass-panel p-8 text-center relative overflow-hidden min-h-[400px] flex flex-col justify-center">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        
        {playing ? (
          <div className="animate-spin text-blue-500 mx-auto w-12 h-12 border-4 border-current border-t-transparent rounded-full" />
        ) : result ? (
          <div className="space-y-6">
            <div className={`text-4xl font-black ${result.payout > 0 ? 'text-green-400' : 'text-gray-500'}`}>
              {result.payout > 0 ? `+${formatTON(result.payout)} TON` : 'TRY AGAIN'}
            </div>
            <div className="text-gray-400 text-sm font-mono bg-gray-900/50 p-4 rounded-xl border border-[#30363d] overflow-hidden truncate">
               <div className="text-[10px] text-gray-600 mb-1">PROVABLY FAIR SEED</div>
               {result.serverSeed}
            </div>
            <button 
              onClick={() => setResult(null)}
              className="w-full py-4 rounded-2xl bg-white text-black font-bold uppercase tracking-widest"
            >
              Play Again
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <h2 className="text-3xl font-black text-white">{game.title}</h2>
            <div className="flex flex-col gap-4">
               {game.id === 'RED_BLACK' && (
                 <div className="flex gap-4">
                   <button onClick={() => play('RED')} className="flex-1 py-10 bg-red-600 rounded-2xl text-2xl font-bold shadow-xl shadow-red-600/20 active:scale-95 transition-transform">RED</button>
                   <button onClick={() => play('BLACK')} className="flex-1 py-10 bg-gray-800 rounded-2xl text-2xl font-bold border border-gray-600 shadow-xl active:scale-95 transition-transform">BLACK</button>
                 </div>
               )}
               {game.id === 'SCRATCH' && (
                 <button onClick={() => play()} className="w-full py-16 bg-gradient-to-tr from-yellow-600 to-yellow-400 rounded-2xl text-black font-black text-3xl shadow-xl shadow-yellow-500/30 active:scale-95 transition-transform">SCRATCH CARDS</button>
               )}
               {game.id === 'HIGHER_LOWER' && (
                 <div className="text-gray-500 p-10 border border-dashed border-gray-700 rounded-2xl italic">Coming Soon</div>
               )}
            </div>
            
            <div className="flex items-center justify-center gap-4 bg-gray-900 p-2 rounded-2xl border border-[#30363d]">
               {[0.5, 1, 2, 5].map(v => (
                 <button key={v} onClick={() => setBet(v)} className={`px-4 py-2 rounded-xl text-sm font-mono ${bet === v ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}>{v}</button>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TournamentView({ tournament, user, fetchTournament }: any) {
  if (!tournament) return (
     <div className="text-center py-20 bg-[#161b22] border border-[#30363d] rounded-2xl">
        <Zap className="mx-auto text-gray-700 mb-4" size={48} />
        <h2 className="text-xl font-bold text-white mb-2">Next Season Starting Soon</h2>
        <p className="text-gray-500 text-sm">Tournaments run automatically every hour.</p>
     </div>
  );

  const handleJoin = async () => {
    const res = await fetch(`${API_URL}/api/tournaments/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId: tournament.id, userId: user.id })
    });
    const d = await res.json();
    if (d.error) alert(d.error);
    else fetchTournament();
  };

  const isJoined = tournament.participants.some((p: any) => p.userId === user.id);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 bg-gradient-to-tr from-blue-600 to-purple-600 text-white border-0">
        <div className="flex justify-between items-start mb-6">
           <div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">Hourly Arena Event</div>
              <h2 className="text-3xl font-black">KNOCKOUT CUP</h2>
           </div>
           <div className="bg-black/20 p-2 rounded-xl text-center min-w-[80px]">
              <div className="text-[10px] uppercase font-bold opacity-60">Prize Pool</div>
              <div className="text-xl font-mono font-bold text-yellow-300">{formatTON(tournament.prizePool)}</div>
           </div>
        </div>

        <div className="flex gap-4 mb-2">
           <div className="flex-1 bg-black/20 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs opacity-60">Status</span>
              <span className="text-xs font-bold uppercase">{tournament.status}</span>
           </div>
           <div className="flex-1 bg-black/20 rounded-xl p-3 flex items-center justify-between">
              <span className="text-xs opacity-60">Players</span>
              <span className="text-xs font-bold">{tournament.participants.length}/32</span>
           </div>
        </div>

        {!isJoined && tournament.status === 'REGISTRATION' && (
          <button 
            onClick={handleJoin}
            className="w-full mt-4 py-4 bg-white text-black font-black uppercase rounded-2xl shadow-xl active:scale-95 transition-transform"
          >
            Join Tournament (2 TON)
          </button>
        )}
        {isJoined && (
          <div className="w-full mt-4 py-4 bg-green-500 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-xl border border-white/20">
            <CheckCircle2 size={20} /> Registered & Ready
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase text-gray-500 tracking-widest">Tournament Participants</h3>
        <div className="grid grid-cols-2 gap-3">
          {tournament.participants.map((p: any) => (
             <div key={p.id} className="flex items-center gap-3 p-3 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-xs font-bold text-blue-400">
                  {p.user?.firstName?.[0]}
                </div>
                <div className="truncate text-xs font-medium text-white">{p.user?.username || p.user?.firstName}</div>
             </div>
          ))}
          {Array.from({ length: 32 - tournament.participants.length }).map((_, i) => (
             <div key={i} className="p-3 border border-dashed border-[#30363d] rounded-xl text-center text-[10px] text-gray-700 uppercase font-mono">
                Empty Slot
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProfileView({ user, address, connect, onDeposit, onWithdraw }: any) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 p-1 mx-auto mb-6 shadow-xl relative z-10">
          <div className="w-full h-full bg-[#0d1117] rounded-full flex items-center justify-center overflow-hidden">
             {user?.avatarUrl ? <img src={user.avatarUrl} referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : <UserIcon size={40} />}
          </div>
        </div>
        <h2 className="text-2xl font-black text-white">{user?.firstName} {user?.lastName}</h2>
        <div className="text-blue-400 text-sm font-mono mb-6">@{user?.username}</div>

        <div className="grid grid-cols-2 gap-4">
           <div className="bg-gray-900 border border-[#30363d] p-4 rounded-2xl">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Bets</div>
              <div className="text-2xl font-mono text-white">{user?.totalBets || 0}</div>
           </div>
           <div className="bg-gray-900 border border-[#30363d] p-4 rounded-2xl">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total Wins</div>
              <div className="text-2xl font-mono text-green-400">{user?.totalWins || 0}</div>
           </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase text-gray-500 tracking-widest ml-1">Wallet Management</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={onDeposit}
            className="p-4 rounded-2xl bg-blue-600/10 border border-blue-500/30 flex flex-col items-center gap-2 hover:bg-blue-600/20 active:scale-95 transition-all text-blue-400"
          >
            <ArrowDownLeft size={20} />
            <span className="text-[10px] font-bold uppercase">Deposit</span>
          </button>
          <button 
            onClick={onWithdraw}
            className="p-4 rounded-2xl bg-purple-600/10 border border-purple-500/30 flex flex-col items-center gap-2 hover:bg-purple-600/20 active:scale-95 transition-all text-purple-400"
          >
            <ArrowUpRight size={20} />
            <span className="text-[10px] font-bold uppercase">Withdraw</span>
          </button>
        </div>

        <div className="space-y-3">
          {!address ? (
            <button onClick={connect} className="w-full p-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-between group hover:bg-blue-500/20">
               <div className="flex items-center gap-4">
                  <Wallet className="text-blue-500" />
                  <span className="font-bold">Connect Wallet</span>
               </div>
               <ArrowUpRight size={18} className="text-blue-500" />
            </button>
          ) : (
            <div className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <Wallet className="text-green-500" />
                  <div className="text-sm font-mono text-white">{address.slice(0, 10)}...{address.slice(-6)}</div>
               </div>
               <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          )}
          
          <button className="w-full p-5 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-between group">
             <div className="flex items-center gap-4">
                <History className="text-gray-500" />
                <span className="font-bold">Account Stats</span>
             </div>
             <div className="text-xs font-mono text-blue-400">Streak: {user?.currentStreak}d</div>
          </button>
        </div>
      </div>

      <div className="bg-[#161b22] p-4 rounded-2xl border border-yellow-500/20 flex gap-4">
        <AlertCircle className="text-yellow-500 shrink-0" size={20} />
        <div className="text-xs text-gray-400 leading-relaxed">
          Akun harus berumur minimal <span className="text-yellow-500 font-bold">7 hari</span> untuk mengaktifkan fitur penarikan otomatis.
        </div>
      </div>
    </div>
  );
}

// --- MODALS ---

function ChestRewardModal({ isOpen, onClose, user }: any) {
  if (!isOpen) return null;
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-xl bg-black/80"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-panel p-10 w-full max-w-sm text-center space-y-8 bg-gradient-to-b from-[#161b22] to-[#0d1117]"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full" />
          <div className="w-24 h-24 bg-yellow-400/20 border-2 border-yellow-400/50 rounded-full flex items-center justify-center mx-auto text-yellow-400 relative z-10 shadow-2xl">
             <Gift size={48} />
          </div>
        </div>
        
        <div>
          <h2 className="text-2xl font-black text-white mb-2">Claim Success!</h2>
          <p className="text-gray-400 text-sm">You received bonus TON and a streak progression.</p>
        </div>

        <div className="bg-yellow-400/10 border border-yellow-500/20 p-4 rounded-2xl text-center">
          <div className="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-1">Current Streak</div>
          <div className="text-3xl font-black text-white">{user?.currentStreak} DAYS</div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest shadow-xl shadow-white/10"
        >
          Sweet!
        </button>
      </motion.div>
    </div>
  );
}

function CreateGameModal({ isOpen, onClose, user }: any) {
  const [type, setType] = useState('COIN_FLIP');
  const [bet, setBet] = useState(1);
  const [choice, setChoice] = useState('HEAD');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (user.mainBalance < bet) return alert("Insufficient balance");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, bet, choice, userId: user.id })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-black/60"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      <motion.div 
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-[#161b22] border border-[#30363d] rounded-3xl w-full max-w-sm p-8 shadow-2xl"
      >
        <h2 className="text-2xl font-black text-white mb-8">Create Challenge</h2>
        
        <div className="space-y-6">
           <div className="grid grid-cols-3 gap-2">
              {['COIN_FLIP', 'DICE', 'POKER'].map(t => (
                <button 
                  key={t} onClick={() => setType(t)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === t ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-[#30363d] text-gray-500 hover:text-white'}`}
                >
                  {t === 'COIN_FLIP' ? <Coins size={20} /> : t === 'DICE' ? <Dice5 size={20} /> : <Club size={20} />}
                  <span className="text-[10px] font-bold uppercase">{t.split('_')[0]}</span>
                </button>
              ))}
           </div>

           <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-2 block">Stake (TON)</label>
              <div className="flex items-center gap-3">
                 {[1, 2, 5, 10].map(v => (
                   <button key={v} onClick={() => setBet(v)} className={`flex-1 py-3 rounded-xl font-mono border transition-all ${bet === v ? 'bg-blue-600 border-blue-600 text-white' : 'bg-[#0d1117] border-[#30363d] text-gray-500'}`}>{v}</button>
                 ))}
                 <input 
                   type="number" value={bet} onChange={(e) => setBet(Number(e.target.value))}
                   className="w-16 bg-[#0d1117] border border-[#30363d] rounded-xl p-3 text-center text-sm font-mono focus:border-blue-500"
                 />
              </div>
           </div>

           {type === 'COIN_FLIP' && (
             <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-2 block">Your Side</label>
                <div className="flex gap-4">
                   {['HEAD', 'TAIL'].map(side => (
                     <button key={side} onClick={() => setChoice(side)} className={`flex-1 py-4 rounded-xl font-bold border transition-all ${choice === side ? 'bg-blue-600 border-blue-600' : 'bg-[#0d1117] border-[#30363d] text-gray-500'}`}>{side}</button>
                   ))}
                </div>
             </div>
           )}

           <div className="flex gap-4 pt-4">
              <button 
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl bg-[#0d1117] border border-[#30363d] font-bold text-gray-500"
              >
                Cancel
              </button>
              <button 
                disabled={loading}
                onClick={handleCreate}
                className="flex-1 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

function DepositModal({ isOpen, onClose, user }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetch(`${API_URL}/api/wallet/deposit-instructions?userId=${user.id}`)
        .then(r => r.json())
        .then(d => {
          setData(d);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-black/60"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-[#161b22] border border-[#30363d] rounded-3xl w-full max-w-sm p-8 shadow-2xl space-y-6"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white">Deposit TON</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white">&times;</button>
        </div>

        {loading ? (
          <div className="py-10 text-center animate-pulse text-gray-500">Generating deposit details...</div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-900/50 border border-[#30363d] p-4 rounded-xl space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-2">Merchant Address</label>
                <div className="text-xs font-mono text-blue-400 break-all bg-black/30 p-3 rounded-lg border border-[#30363d]">
                  {data?.merchantAddress}
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-1">Transfer Comment (CRITICAL)</label>
                <div className="text-xl font-mono text-yellow-500 font-bold bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 text-center">
                  {data?.memo}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Saldo tidak akan bertambah jika komentar salah atau kosong.</p>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 italic">
              <Zap className="text-blue-500 shrink-0" size={16} />
              <p className="text-[10px] text-gray-400">Transfer akan terdeteksi otomatis setelah 1 konfirmasi (~30-60 detik).</p>
            </div>

            <button 
              onClick={onClose}
              className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function WithdrawModal({ isOpen, onClose, user, address, refreshUser }: any) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);

  const handleRegister = async () => {
    if (!address) return alert("Connect wallet first!");
    setRegistering(true);
    try {
      await fetch(`${API_URL}/api/wallet/register-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, address })
      });
      refreshUser();
    } catch (e) {
      console.error(e);
    } finally {
      setRegistering(false);
    }
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return alert("Invalid amount");
    if (user.mainBalance < amt) return alert("Insufficient balance");
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/wallet/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount: amt })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else {
        alert("Withdrawal request sent!");
        onClose();
        refreshUser();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm bg-black/60"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-[#161b22] border border-[#30363d] rounded-3xl w-full max-w-sm p-8 shadow-2xl space-y-6"
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-white">Withdraw TON</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white">&times;</button>
        </div>

        {!user?.depositAddress ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Register your TON wallet address first to receive withdrawals.</p>
            <div className="p-4 bg-gray-900 rounded-xl border border-[#30363d] break-all text-xs font-mono text-blue-400">
               {address || "Wallet not connected"}
            </div>
            <button 
              disabled={!address || registering}
              onClick={handleRegister}
              className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50"
            >
              {registering ? "Registering..." : "Register Address"}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-2">Recipient Address</label>
              <div className="text-xs font-mono text-purple-400 bg-purple-400/5 p-3 rounded-lg border border-purple-500/20 break-all uppercase">
                {user.depositAddress}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-gray-500 tracking-widest block mb-2">Amount (TON)</label>
              <div className="relative">
                <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full py-4 px-4 bg-[#0d1117] border border-[#30363d] rounded-2xl text-white font-mono focus:border-purple-500 outline-none"
                />
                <button 
                  onClick={() => setAmount(user.mainBalance.toString())}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-500 uppercase hover:text-purple-400"
                >
                  MAX
                </button>
              </div>
              <div className="flex justify-between mt-2 px-1">
                <span className="text-[10px] text-gray-500 uppercase">Available: {formatTON(user.mainBalance)} TON</span>
              </div>
            </div>

            <button 
              disabled={loading}
              onClick={handleWithdraw}
              className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest shadow-xl shadow-purple-500/20 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Confirm Withdrawal"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function AdminPanel({ user, onClose }: { user: any, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'STATS' | 'USERS' | 'WITHDRAWS' | 'DEPOSITS' | 'LOGS' | 'SETTINGS'>('STATS');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchWithAuth = async (url: string, options: any = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'x-telegram-id': user.telegramId
      }
    });
  };

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  const refreshData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'STATS') {
        const res = await fetchWithAuth(`${API_URL}/api/admin/stats`);
        setStats(await res.json());
      } else if (activeTab === 'USERS') {
        const res = await fetchWithAuth(`${API_URL}/api/admin/users?search=${searchTerm}`);
        setUsers(await res.json());
      } else if (activeTab === 'WITHDRAWS') {
        const res = await fetchWithAuth(`${API_URL}/api/admin/withdrawals`);
        setWithdrawals(await res.json());
      } else if (activeTab === 'DEPOSITS') {
        const res = await fetchWithAuth(`${API_URL}/api/admin/deposits`);
        setDeposits(await res.json());
      } else if (activeTab === 'LOGS') {
        const res = await fetchWithAuth(`${API_URL}/api/admin/logs`);
        setLogs(await res.json());
      } else if (activeTab === 'SETTINGS') {
        const res = await fetchWithAuth(`${API_URL}/api/admin/settings`);
        setSettings(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string) => {
    const value = prompt(`Enter new value for ${key}:`);
    if (value === null) return;
    try {
      await fetchWithAuth(`${API_URL}/api/admin/settings`, {
        method: 'POST',
        body: JSON.stringify({ key, value, adminId: user.id })
      });
      refreshData();
    } catch (e) { console.error(e); }
  };

  const handleBan = async (id: string, currentlyBanned: boolean) => {
    const reason = prompt("Enter reason for ban/unban:");
    try {
      await fetchWithAuth(`${API_URL}/api/admin/users/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ banned: !currentlyBanned, reason, adminId: user.id })
      });
      refreshData();
    } catch (e) { console.error(e); }
  };

  const handleAdjustBalance = async (id: string) => {
    const amount = prompt("Enter amount to add/subtract (e.g. 10 or -10):");
    const reason = prompt("Enter reason for adjustment:");
    if (!amount || isNaN(Number(amount))) return;
    try {
      await fetchWithAuth(`${API_URL}/api/admin/users/${id}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), reason, adminId: user.id })
      });
      refreshData();
    } catch (e) { console.error(e); }
  };

  const handleWithdrawStatus = async (id: string, status: string) => {
    try {
      await fetchWithAuth(`${API_URL}/api/admin/withdrawals/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, adminId: user.id })
      });
      refreshData();
    } catch (e) { console.error(e); }
  };

  const handleAssignDeposit = async (id: string) => {
    const tgId = prompt("Enter Telegram ID of the user to assign this deposit to:");
    if (!tgId) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/admin/deposits/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ telegramId: tgId, adminId: user.id })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else refreshData();
    } catch (e) { console.error(e); }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-[#0d1117] flex flex-col text-white"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      <header className="p-4 border-b border-[#30363d] flex justify-between items-center bg-[#161b22]">
        <div className="flex items-center gap-3">
          <Shield className="text-red-500" />
          <h1 className="font-bold">LuckyTON Admin</h1>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg">
          <X />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'STATS' && stats && (
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
              { label: 'Active 24h', value: stats.active24h, icon: Activity, color: 'text-green-400' },
              { label: 'Total Volume', value: `${stats.totalVolume.toFixed(2)} TON`, icon: LayoutDashboard, color: 'text-purple-400' },
              { label: 'Total Profit', value: `${stats.totalProfit.toFixed(2)} TON`, icon: DollarSign, color: 'text-yellow-400' },
              { label: 'Pending WD', value: stats.pendingWithdrawals, icon: Wallet, color: 'text-red-400' }
            ].map((s, i) => (
              <div key={i} className="bg-[#161b22] p-4 rounded-2xl border border-[#30363d]">
                <s.icon className={`${s.color} mb-2`} size={20} />
                <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">{s.label}</div>
                <div className="text-xl font-black">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'USERS' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search Telegram ID / Username"
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-2 text-sm"
              />
              <button onClick={refreshData} className="bg-blue-600 p-2 rounded-xl"><Search size={20}/></button>
            </div>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="bg-[#161b22] p-4 rounded-xl border border-[#30363d] flex justify-between items-center">
                  <div>
                    <div className="font-bold flex items-center gap-2">
                      {u.username || u.firstName}
                      {u.isBanned && <span className="bg-red-500 text-[8px] px-1 rounded">BANNED</span>}
                    </div>
                    <div className="text-[10px] text-gray-500">ID: {u.telegramId} | Bal: {u.mainBalance.toFixed(2)} TON</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAdjustBalance(u.id)} className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg"><DollarSign size={16}/></button>
                    <button onClick={() => handleBan(u.id, u.isBanned)} className={`p-2 rounded-lg ${u.isBanned ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      <Ban size={16}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'WITHDRAWS' && (
          <div className="space-y-2">
            {withdrawals.map(w => (
              <div key={w.id} className="bg-[#161b22] p-4 rounded-xl border border-[#30363d]">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{w.amount} TON</div>
                    <div className="text-[10px] text-gray-500">To: {w.user?.username || w.user?.firstName}</div>
                    <div className="text-[8px] font-mono text-gray-600 truncate max-w-[150px]">{w.toAddress}</div>
                  </div>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${w.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : w.status === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {w.status}
                  </span>
                </div>
                {w.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleWithdrawStatus(w.id, 'completed')} className="flex-1 py-1 px-2 bg-green-600 text-[10px] font-bold rounded">APPROVE</button>
                    <button onClick={() => handleWithdrawStatus(w.id, 'failed')} className="flex-1 py-1 px-2 bg-red-600 text-[10px] font-bold rounded">REJECT</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'DEPOSITS' && (
          <div className="space-y-2">
            {deposits.map(d => (
              <div key={d.id} className="bg-[#161b22] p-4 rounded-xl border border-[#30363d]">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-blue-400">{d.amount} TON</div>
                    <div className="text-[10px] text-gray-500">From: {d.fromAddress.slice(0, 10)}...</div>
                    <div className="text-[8px] font-mono text-yellow-500 bg-yellow-500/5 px-1 rounded">Memo: {d.comment}</div>
                  </div>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${d.status === 'credited' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                    {d.status}
                  </span>
                </div>
                {d.status === 'pending' && (
                  <button onClick={() => handleAssignDeposit(d.id)} className="w-full mt-2 py-1 bg-blue-600 text-[10px] font-bold rounded">ASSIGN TO USER</button>
                )}
                <div className="text-[8px] text-gray-600 mt-1 truncate">{d.txHash}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'LOGS' && (
          <div className="space-y-2">
            {logs.map(l => (
              <div key={l.id} className="bg-[#161b22] p-3 rounded-lg border border-[#30363d] text-[10px]">
                <div className="flex justify-between text-blue-400 font-bold mb-1">
                  <span>{l.action}</span>
                  <span className="text-gray-600">{new Date(l.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-gray-300">{l.details}</div>
                <div className="text-gray-500 mt-1">Admin: {l.admin?.username || l.adminId}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="space-y-4 pb-32">
            <div className="bg-[#161b22] p-4 rounded-xl border border-[#30363d] space-y-4">
              {[
                { key: 'PLATFORM_FEE_PERCENT', label: 'Platform Fee (%)', desc: 'Biaya admin tiap game' },
                { key: 'MIN_WITHDRAW_AMOUNT', label: 'Min Withdrawal (TON)', desc: 'Minimal penarikan saldo' },
                { key: 'WAGERING_REQUIREMENT_MULTIPLIER', label: 'Wagering Multiplier', desc: 'Turnover bonus (e.g. 5 means 5x)' }
              ].map(s => {
                const setting = settings.find(st => st.key === s.key);
                return (
                  <div key={s.key} className="flex justify-between items-center p-3 bg-[#0d1117] rounded-xl border border-[#30363d]">
                    <div>
                      <div className="font-bold text-sm text-white">{s.label}</div>
                      <div className="text-[10px] text-gray-500">{s.desc}</div>
                      <div className="text-xs font-mono text-blue-400 mt-1">Value: {setting?.value || 'N/A'}</div>
                    </div>
                    <button onClick={() => updateSetting(s.key)} className="p-2 bg-blue-600 rounded-lg"><Plus size={16}/></button>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-500 italic px-2">* Perubahan mungkin memerlukan restart worker jika digunakan secara internal.</p>
          </div>
        )}
      </main>

      <nav 
        className="fixed bottom-0 w-full max-w-lg bg-[#161b22] border-t border-[#30363d] p-3 flex justify-around items-center"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        {[
          { tab: 'STATS', icon: LayoutDashboard },
          { tab: 'USERS', icon: Users },
          { tab: 'WITHDRAWS', icon: Wallet },
          { tab: 'DEPOSITS', icon: FileText },
          { tab: 'SETTINGS', icon: SettingsIcon },
          { tab: 'LOGS', icon: History }
        ].map(({ tab, icon: Icon }) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab ? 'text-red-500' : 'text-gray-500'}`}
          >
            <Icon size={18} />
            <span className="text-[7px] font-bold">{tab}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <TonConnectUIProvider manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}>
      <AppRoot>
        <LuckyTONApp />
      </AppRoot>
    </TonConnectUIProvider>
  );
}

