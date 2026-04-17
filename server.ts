import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import "dotenv/config";
import cron from "node-cron";
import crypto from "crypto";
import { prisma } from "./lib/prisma";
import { startDepositScanner } from "./workers/depositScanner";
import { sendTONWithdrawal } from "./services/tonWithdrawService";

// Helper for Provably Fair
const generateSeed = () => crypto.randomBytes(32).toString('hex');
const generateHash = (seed: string) => crypto.createHash('sha256').update(seed).digest('hex');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const httpServer = createServer(app);
  
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  try {
    console.log("Checking database connection...");
    await prisma.$connect();
    console.log("Database connected successfully");
  } catch (dbError: any) {
    console.error("CRITICAL: Database connection failed!", dbError.message);
    // We don't exit(1) here so the server can still serve health checks
    // and explain the error via JSON instead of a vague 404/500
  }

  app.use(cors());
  app.use(express.json());

  // Dynamic TON Connect Manifest
  app.get("/tonconnect-manifest.json", (req, res) => {
    const host = req.get('host');
    const protocol = req.protocol;
    const origin = `${protocol}://${host}`;
    
    res.json({
      url: origin,
      name: "LuckyTON",
      iconUrl: `${origin}/tonconnect-icon.png` // make sure to have an icon or use default
    });
  });

  // Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Global API Logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.path}`);
    }
    next();
  });

  // --- TOURNAMENT SCHEDULER ---
  // Runs every hour to create a tournament and handle registration/logic
  cron.schedule("0 * * * *", async () => {
    console.log("Scheduling new tournament...");
    const nextHour = new Date();
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    
    await prisma.tournament.create({
      data: {
        startTime: nextHour,
        status: "REGISTRATION",
        entryFee: 2
      }
    });
    io.emit("tournamentCreated");
  });

  // API: Get Current/Upcoming Tournament
  app.get("/api/tournaments/active", async (req, res) => {
    const tournament = await prisma.tournament.findFirst({
      where: { status: { in: ["REGISTRATION", "IN_PROGRESS"] } },
      include: { participants: { include: { user: true } }, matches: true },
      orderBy: { startTime: "asc" }
    });
    res.json(tournament);
  });

  // API: Join Tournament
  app.post("/api/tournaments/join", async (req, res) => {
    try {
      const { tournamentId, userId } = req.body;
      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: { participants: true }
      });

      if (!tournament || tournament.status !== "REGISTRATION") return res.status(400).json({ error: "Registration closed" });
      if (tournament.participants.length >= 32) return res.status(400).json({ error: "Tournament full" });

      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user || user.mainBalance < tournament.entryFee) return res.status(400).json({ error: "Insufficient balance" });

      await prisma.$transaction([
        prisma.user.update({
          where: { id: String(userId) },
          data: { mainBalance: { decrement: tournament.entryFee } }
        }),
        prisma.tournamentParticipant.create({
          data: { tournamentId, userId }
        }),
        prisma.tournament.update({
          where: { id: tournamentId },
          data: { prizePool: { increment: tournament.entryFee } }
        })
      ]);

      io.emit("tournamentUpdated", tournamentId);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to join tournament" });
    }
  });

  // --- SOLO GAMES ---
  app.post("/api/solo/play", async (req, res) => {
    try {
      const { userId, type, bet, choice } = req.body;
      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user) return res.status(404).json({ error: "User not found" });

      // Determine balance to use
      let isBonus = user.bonusBalance >= bet;
      let usedBalance = isBonus ? user.bonusBalance : user.mainBalance;
      if (usedBalance < bet) return res.status(400).json({ error: "Insufficient balance" });

      // Provably Fair Setup
      const serverSeed = generateSeed();
      const serverHash = generateHash(serverSeed);
      
      let payout = 0;
      let outcome: any = {};

      if (type === "SCRATCH") {
        // Scratch card logic: 9 cells, check for prizes
        const rand = Math.random();
        if (rand < 0.01) payout = bet * 10;
        else if (rand < 0.03) payout = bet * 5;
        else if (rand < 0.08) payout = bet * 2;
        else if (rand < 0.2) payout = bet * 1;
        else if (rand < 0.5) payout = bet * 0.5;
        
        outcome = { rand, result: payout > 0 ? "WIN" : "LOSE" };
      } 
      else if (type === "RED_BLACK") {
        const isRed = Math.random() > 0.52;
        const actualColor = isRed ? "RED" : "BLACK";
        if (choice === actualColor) payout = bet * 1.95;
        outcome = { actualColor, result: payout > 0 ? "WIN" : "LOSE" };
      }

      await prisma.$transaction(async (tx) => {
        // Deduct bet
        if (isBonus) {
          await tx.user.update({
            where: { id: String(userId) },
            data: { 
              bonusBalance: { decrement: bet },
              wageringRemaining: { decrement: bet } 
            }
          });
        } else {
          await tx.user.update({
            where: { id: String(userId) },
            data: { mainBalance: { decrement: bet } }
          });
        }

        // Add payout
        if (payout > 0) {
          if (isBonus) {
             await tx.user.update({
               where: { id: String(userId) },
               data: { bonusBalance: { increment: payout } }
             });
          } else {
             await tx.user.update({
               where: { id: String(userId) },
               data: { mainBalance: { increment: payout } }
             });
          }
        }

        // Record Transaction
        await tx.transaction.create({
          data: {
            userId: String(userId),
            type: payout > 0 ? "game_win" : "game_loss",
            amount: payout > 0 ? payout : -bet,
            balanceType: isBonus ? "bonus" : "main"
          }
        });

        // Update stats
        const wins = payout > 0 ? 1 : 0;
        await tx.user.update({
          where: { id: String(userId) },
          data: { 
            totalBets: { increment: 1 },
            totalWins: { increment: wins }
          }
        });

        // Record game
        await tx.soloGame.create({
          data: {
            userId: String(userId),
            type,
            bet,
            payout,
            resultState: JSON.stringify({ serverHash, serverSeed, outcome })
          }
        });
        
        // Final Bonus Conversion check
        const updatedUser = await tx.user.findUnique({ where: { id: String(userId) } });
        if (updatedUser && updatedUser.wageringRemaining <= 0 && updatedUser.bonusBalance > 0) {
          await tx.user.update({
            where: { id: String(userId) },
            data: {
              mainBalance: { increment: updatedUser.bonusBalance },
              bonusBalance: 0
            }
          });
        }
      });

      const finalUser = await prisma.user.findUnique({ where: { id: String(userId) } });
      res.json({ payout, outcome, serverSeed, user: finalUser });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Solo game failed" });
    }
  });

  // --- DAILY CHEST ---
  app.post("/api/chest/claim", async (req, res) => {
    try {
      const { userId } = req.body;
      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const now = new Date();
      if (user.lastClaim && now.getTime() - user.lastClaim.getTime() < 24 * 3600 * 1000) {
        return res.status(400).json({ error: "Already claimed today" });
      }

      let streak = 1;
      if (user.lastClaim && now.getTime() - user.lastClaim.getTime() < 48 * 3600 * 1000) {
        streak = user.currentStreak + 1;
      }

      // Reward based on streak
      let bonusAmount = 0.02 * streak; // Simple multiplier for demo
      if (bonusAmount > 0.5) bonusAmount = 0.5;

      await prisma.user.update({
        where: { id: String(userId) },
        data: {
          bonusBalance: { increment: bonusAmount },
          wageringRemaining: { increment: bonusAmount * 5 },
          currentStreak: streak,
          lastClaim: now,
          transactions: {
            create: {
              amount: bonusAmount,
              type: "chest_bonus",
              balanceType: "bonus"
            }
          }
        }
      });

      res.json({ bonusAmount, streak });
    } catch (e) {
      res.status(500).json({ error: "Claim failed" });
    }
  });

  // API Route: Login/Profile
  app.post("/api/auth/login", async (req, res) => {
    try {
      console.log("Login attempt received");
      const { initDataUnsafe } = req.body;
      if (!initDataUnsafe || !initDataUnsafe.user) {
        console.warn("Invalid login attempt: missing initDataUnsafe or user");
        return res.status(400).json({ error: "Invalid initData" });
      }
      
      const tgUser = initDataUnsafe.user;
      console.log(`Authenticating user: ${tgUser.username} (${tgUser.id})`);

      let user = await prisma.user.findUnique({ where: { telegramId: tgUser.id.toString() } });
      
      if (!user) {
        console.log(`Creating new user: ${tgUser.username}`);
        user = await prisma.user.create({
          data: {
            telegramId: tgUser.id.toString(),
            username: tgUser.username,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name,
            avatarUrl: tgUser.photo_url,
            mainBalance: 0 
          }
        });
      }

      if (user.isBanned) {
        console.warn(`Banned user attempted login: ${user.username}`);
        return res.status(403).json({ error: "Your account is banned.", reason: user.bannedReason });
      }

      console.log(`User authenticated successfully: ${user.username}`);
      res.json({ user });
    } catch (e) {
      console.error("Authentication error:", e);
      res.status(500).json({ error: "Failed to authenticate" });
    }
  });

  // --- ADMIN MIDDLEWARE ---
  const adminAuth = async (req: any, res: any, next: any) => {
    const telegramId = req.headers['x-telegram-id'];
    const adminIds = process.env.ADMIN_IDS?.split(',') || [];
    
    if (!telegramId || !adminIds.includes(String(telegramId))) {
      console.warn(`Unauthorized admin access attempt from ID: ${telegramId}`);
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
  };

  // --- ADMIN ROUTES ---
  app.get("/api/admin/stats", adminAuth, async (req, res) => {
    try {
      const totalUsers = await prisma.user.count();
      const active24h = await prisma.user.count({
        where: { updatedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }
      });
      const totalVolume = await prisma.transaction.aggregate({
        where: { type: { in: ["BET", "game_win", "game_loss"] } },
        _sum: { amount: true }
      });
      const totalProfit = await prisma.game.aggregate({
        _sum: { fee: true }
      });
      const pendingWithdrawals = await prisma.withdrawal.count({
        where: { status: "pending" }
      });

      res.json({
        totalUsers,
        active24h,
        totalVolume: Math.abs(totalVolume._sum.amount || 0),
        totalProfit: totalProfit._sum.fee || 0,
        pendingWithdrawals
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", adminAuth, async (req, res) => {
    try {
      const { search } = req.query;
      const users = await prisma.user.findMany({
        where: search ? {
          OR: [
            { username: { contains: String(search), mode: 'insensitive' } },
            { telegramId: { contains: String(search) } }
          ]
        } : {},
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      res.json(users);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users/:id/ban", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { banned, reason, adminId } = req.body;
      const user = await prisma.user.update({
        where: { id },
        data: { isBanned: banned, bannedAt: banned ? new Date() : null, bannedReason: reason }
      });
      
      await prisma.adminLog.create({
        data: {
          adminId,
          action: banned ? "BAN_USER" : "UNBAN_USER",
          targetId: id,
          details: `Reason: ${reason || 'N/A'}`
        }
      });

      res.json(user);
    } catch (e) {
      res.status(500).json({ error: "Failed to update ban status" });
    }
  });

  app.post("/api/admin/users/:id/adjust-balance", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, adminId, reason } = req.body;
      const user = await prisma.user.update({
        where: { id },
        data: { mainBalance: { increment: amount } }
      });

      await prisma.adminLog.create({
        data: {
          adminId,
          action: "ADJUST_BALANCE",
          targetId: id,
          details: `Amount: ${amount}, Reason: ${reason}`
        }
      });

      res.json(user);
    } catch (e) {
      res.status(500).json({ error: "Failed to adjust balance" });
    }
  });

  app.get("/api/admin/withdrawals", adminAuth, async (req, res) => {
    try {
      const withdrawals = await prisma.withdrawal.findMany({
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(withdrawals);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch withdrawals" });
    }
  });

  app.post("/api/admin/withdrawals/:id/status", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminId } = req.body;
      
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id }, include: { user: true } });
      if (!withdrawal) return res.status(404).json({ error: "Withdrawal not found" });

      if (status === "failed") {
        // Refund
        await prisma.user.update({
          where: { id: withdrawal.userId },
          data: { mainBalance: { increment: withdrawal.amount } }
        });
      }

      const updated = await prisma.withdrawal.update({
        where: { id },
        data: { status, processedAt: status === "completed" ? new Date() : null }
      });

      await prisma.adminLog.create({
        data: {
          adminId,
          action: `WITHDRAWAL_${status.toUpperCase()}`,
          targetId: withdrawal.userId,
          details: `Withdrawal ID: ${id}`
        }
      });

      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Failed to update withdrawal status" });
    }
  });

  app.get("/api/admin/deposits", adminAuth, async (req, res) => {
    try {
      const deposits = await prisma.depositScan.findMany({
        include: { user: true },
        orderBy: { scannedAt: 'desc' }
      });
      res.json(deposits);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch deposits" });
    }
  });

  app.post("/api/admin/deposits/:id/assign", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { telegramId, adminId } = req.body;
      
      const user = await prisma.user.findUnique({ where: { telegramId } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const deposit = await prisma.depositScan.findUnique({ where: { id } });
      if (!deposit || deposit.status === 'credited') return res.status(400).json({ error: "Deposit already processed or not found" });

      await prisma.$transaction([
        prisma.depositScan.update({
          where: { id },
          data: { userId: user.id, status: 'credited', creditedAt: new Date() }
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { mainBalance: { increment: deposit.amount }, totalDeposit: { increment: deposit.amount } }
        }),
        prisma.transaction.create({
          data: {
            userId: user.id,
            type: "deposit",
            amount: deposit.amount,
            balanceType: "main",
            reference: deposit.txHash
          }
        }),
        prisma.adminLog.create({
          data: {
            adminId,
            action: "ASSIGN_DEPOSIT",
            targetId: user.id,
            details: `Deposit ID: ${id}, Hash: ${deposit.txHash}`
          }
        })
      ]);

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to assign deposit" });
    }
  });

  app.get("/api/admin/logs", adminAuth, async (req, res) => {
    try {
      const logs = await prisma.adminLog.findMany({
        include: { admin: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.get("/api/admin/settings", adminAuth, async (req, res) => {
    try {
      const settings = await prisma.settings.findMany();
      res.json(settings);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/admin/settings", adminAuth, async (req, res) => {
    try {
      const { key, value, adminId } = req.body;
      const setting = await prisma.settings.upsert({
        where: { key },
        update: { value, updatedBy: adminId },
        create: { key, value, updatedBy: adminId }
      });

      await prisma.adminLog.create({
        data: {
          adminId,
          action: "UPDATE_SETTING",
          details: `Key: ${key}, New Value: ${value}`
        }
      });

      res.json(setting);
    } catch (e) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  app.get("/api/games", async (req, res) => {
    const games = await prisma.game.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      include: { participants: { include: { user: true } } }
    });
    res.json(games);
  });

  app.post("/api/games", async (req, res) => {
    try {
      const { type, bet, choice, userId } = req.body;
      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user || user.mainBalance < bet) return res.status(400).json({ error: "Insufficient balance" });
      
      await prisma.$transaction([
        prisma.user.update({
          where: { id: String(userId) },
          data: { mainBalance: { decrement: bet } }
        }),
        prisma.transaction.create({
          data: {
            userId: String(userId),
            amount: -bet,
            type: "BET",
            balanceType: "main"
          }
        })
      ]);
      
      const game = await prisma.game.create({
        data: {
          type, status: "OPEN", pot: bet,
          details: JSON.stringify({ creatorChoice: choice }),
          participants: { create: { userId: String(userId), bet, choice } }
        },
        include: { participants: { include: { user: true } } }
      });
      
      io.emit("gameCreated", game);
      res.json({ game });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to create game" });
    }
  });

  app.post("/api/games/:gameId/join", async (req, res) => {
    try {
      const { gameId } = req.params;
      const { userId, choice } = req.body;
      const game = await prisma.game.findUnique({ where: { id: gameId }, include: { participants: true } });
      if (!game || game.status !== "OPEN") return res.status(400).json({ error: "Game not available" });
      
      const bet = game.pot;
      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user || user.mainBalance < bet) return res.status(400).json({ error: "Insufficient balance" });
      
      const totalPot = game.pot + bet;
      const fee = totalPot * 0.05;
      const payout = totalPot - fee;
      
      const isHeads = Math.random() > 0.5;
      const resultStr = isHeads ? "HEAD" : "TAIL";
      const creatorChoice = JSON.parse(game.details || "{}").creatorChoice;
      const winnerId = (creatorChoice === resultStr) ? game.participants[0].userId : String(userId);

      await prisma.$transaction([
        prisma.user.update({ where: { id: String(userId) }, data: { mainBalance: { decrement: bet } } }),
        prisma.gameParticipant.create({ data: { gameId, userId: String(userId), bet, choice } }),
        prisma.game.update({ where: { id: gameId }, data: { status: "COMPLETED", pot: totalPot, fee, details: JSON.stringify({ result: resultStr }) } }),
        ...(winnerId ? [
            prisma.user.update({ where: { id: String(winnerId) }, data: { mainBalance: { increment: payout } } }),
            prisma.transaction.create({
              data: {
                userId: String(winnerId),
                amount: payout,
                type: "game_win",
                balanceType: "main",
                reference: gameId
              }
            })
        ] : [])
      ]);
      
      const updatedGame = await prisma.game.findUnique({ where: { id: gameId }, include: { participants: { include: { user: true } } } });
      io.emit("gameUpdated", updatedGame);
      res.json({ game: updatedGame, winnerId, payout });
    } catch (e: any) {
       res.status(500).json({ error: e.message });
    }
  });
  
  app.post("/api/wallet/topup", async (req, res) => {
     try {
         const { userId, amount } = req.body;
         const user = await prisma.user.update({ where: { id: String(userId) }, data: { mainBalance: { increment: amount }, totalDeposit: { increment: amount } } });
         res.json({ balance: user.mainBalance });
     } catch (e) { res.status(500).json({ error: "Failed to top up" }); }
  });
  
  // --- REVISED ON-CHAIN WALLET SYSTEM ---
  app.get("/api/wallet/deposit-instructions", async (req, res) => {
    try {
      const { userId } = req.query; // This is internal ID
      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user) return res.status(404).json({ error: "User not found" });

      res.json({
        merchantAddress: process.env.MERCHANT_WALLET_ADDRESS,
        instruction: `Kirim TON ke alamat di atas. Sertakan pesan: "Deposit ${user.telegramId}"`,
        memo: `Deposit ${user.telegramId}`,
        minConfirmations: 1,
      });
    } catch (e) {
      res.status(500).json({ error: "Failed to get deposit info" });
    }
  });

  app.get("/api/wallet/deposit-status", async (req, res) => {
    try {
      const { userId, txHash } = req.query;
      const scan = await prisma.depositScan.findFirst({
        where: { userId: userId as string, txHash: txHash as string },
      });
      res.json({ credited: scan?.status === 'credited' });
    } catch (e) {
      res.status(500).json({ error: "Failed to check deposit status" });
    }
  });

  app.post("/api/wallet/register-address", async (req, res) => {
    try {
      const { userId, address } = req.body;
      await prisma.user.update({
        where: { id: String(userId) },
        data: { depositAddress: address }
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to register address" });
    }
  });

  app.post("/api/wallet/withdraw", async (req, res) => {
    try {
      const { userId, amount } = req.body;
      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user || user.mainBalance < amount) return res.status(400).json({ error: "Insufficient balance" });
      if (!user.depositAddress) return res.status(400).json({ error: "No withdrawal address registered" });

      // Create withdrawal record
      const withdrawal = await prisma.withdrawal.create({
        data: {
          userId: user.id,
          amount,
          toAddress: user.depositAddress,
          status: "processing"
        }
      });

      // Deduct balance immediately
      await prisma.user.update({
        where: { id: user.id },
        data: { mainBalance: { decrement: amount } }
      });

      // Trigger native withdrawal
      sendTONWithdrawal(user.depositAddress, amount)
        .then(async (txHash) => {
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: { status: 'completed', txHash, processedAt: new Date() },
          });
          // Also record transaction
          await prisma.transaction.create({
            data: {
              userId: user.id,
              type: "withdrawal",
              amount: -amount,
              balanceType: "main",
              reference: txHash
            }
          });
          io.emit("walletUpdated", { userId: user.id, amount: -amount });
        })
        .catch(async (error) => {
          console.error("Withdrawal error:", error);
          // Refund logic
          await prisma.user.update({
            where: { id: user.id },
            data: { mainBalance: { increment: amount } }
          });
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: { status: 'failed' },
          });
        });

      res.json({ success: true, message: "Withdrawal processing" });
    } catch (e) {
      res.status(500).json({ error: "Failed to process withdrawal" });
    }
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });

  // Global Error Handler for API routes
  app.use((err: any, req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) {
      console.error("[Global API Error]", err);
      return res.status(500).json({ 
        error: "Internal Server Error", 
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
    next(err);
  });

  // API 404 Handler (Must be after all API routes)
  app.all('/api/*', (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.path}`);
    res.status(404).json({ error: "API Route not found", path: req.path });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    try {
      await initializeBots(io);
    } catch (e) {
      console.error("Failed to initialize bots (DB Connection Error?):", e);
    }
    
    try {
      startDepositScanner();
    } catch (e) {
      console.error("Failed to start deposit scanner:", e);
    }
  });
}

startServer();

// --- BOT SIMULATION SYSTEM ---
const BOT_TELEGRAM_IDS = ["bot_1", "bot_2", "bot_3", "bot_4", "bot_5"];
const BOT_NAMES = ["CryptoKing", "TON_Warrior", "LuckyGarf", "AlphaDegen", "SwiftWhale"];
let botDbIds: string[] = [];

async function initializeBots(io: any) {
  console.log("Initializing Bots...");
  botDbIds = [];
  for (let i = 0; i < BOT_TELEGRAM_IDS.length; i++) {
      const user = await prisma.user.upsert({
      where: { telegramId: BOT_TELEGRAM_IDS[i] },
      update: {},
      create: {
        telegramId: BOT_TELEGRAM_IDS[i],
        username: BOT_NAMES[i],
        firstName: BOT_NAMES[i],
        mainBalance: 1000,
      }
    });
    botDbIds.push(user.id);
  }

  // Create bot challenges periodically (every 2.5 minutes)
  cron.schedule("*/2 * * * *", async () => {
    if (botDbIds.length === 0) return;
    const randomBotIdx = Math.floor(Math.random() * botDbIds.length);
    const botId = botDbIds[randomBotIdx];
    const types = ["COIN_FLIP", "DICE"];
    const type = types[Math.floor(Math.random() * types.length)];
    const bets = [0.1, 0.2, 0.5, 1];
    const bet = bets[Math.floor(Math.random() * bets.length)];
    const choice = type === "COIN_FLIP" ? (Math.random() > 0.5 ? "HEAD" : "TAIL") : "1";

    try {
      const game = await prisma.game.create({
        data: {
          type,
          status: "OPEN",
          pot: bet,
          details: JSON.stringify({ creatorChoice: choice }),
          participants: {
            create: { userId: botId, bet, choice }
          }
        },
        include: { participants: { include: { user: true } } }
      });
      io.emit("gameCreated", game);
      console.log(`Bot ${BOT_NAMES[randomBotIdx]} created challenge.`);
    } catch (e) {
      console.error("Bot challenge failed", e);
    }
  });

  // Bots join human games if they wait too long
  cron.schedule("*/1 * * * *", async () => {
    if (botDbIds.length === 0) return;
    const openGames = await prisma.game.findMany({
      where: { 
        status: "OPEN",
        participants: { none: { userId: { in: botDbIds } } } // Only join human games
      },
      include: { participants: { include: { user: true } } }
    });

    if (openGames.length > 0) {
      // Pick one game and join it with a bot
      const game = openGames[Math.floor(Math.random() * openGames.length)];
      const botId = botDbIds[Math.floor(Math.random() * botDbIds.length)];
      
      const totalPot = game.pot * 2;
      const fee = totalPot * 0.05;
      const payout = totalPot - fee;
      const resultStr = Math.random() > 0.5 ? "HEAD" : "TAIL";
      const creatorChoice = JSON.parse(game.details || "{}").creatorChoice;
      const winnerId = (creatorChoice === resultStr) ? game.participants[0].userId : botId;

      const [updatedGame] = await prisma.$transaction([
        prisma.game.update({
          where: { id: game.id },
          data: { status: "COMPLETED", pot: totalPot, fee, details: JSON.stringify({ result: resultStr }) },
          include: { participants: { include: { user: true } } }
        }),
        prisma.gameParticipant.create({
          data: { gameId: game.id, userId: botId, bet: game.pot, choice: "AUTO" }
        }),
        ...(winnerId ? [
          prisma.user.update({ where: { id: winnerId }, data: { mainBalance: { increment: payout } } })
        ] : [])
      ]);

      io.emit("gameUpdated", updatedGame);
      console.log(`Bot joined and completed game ${game.id}. Result: ${resultStr}`);
    }
  });
}
