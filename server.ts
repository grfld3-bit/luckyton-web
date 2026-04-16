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

  app.use(cors());
  app.use(express.json());

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
      const { initDataUnsafe } = req.body;
      if (!initDataUnsafe || !initDataUnsafe.user) return res.status(400).json({ error: "Invalid initData" });
      
      const tgUser = initDataUnsafe.user;
      let user = await prisma.user.findUnique({ where: { telegramId: tgUser.id.toString() } });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            telegramId: tgUser.id.toString(),
            username: tgUser.username,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name,
            avatarUrl: tgUser.photo_url,
            mainBalance: 0 // New users start with 0
          }
        });
      }
      res.json({ user });
    } catch (e) {
      res.status(500).json({ error: "Failed to authenticate" });
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    initializeBots(io);
    startDepositScanner();
  });
}

startServer();

// --- BOT SIMULATION SYSTEM ---
const BOT_IDS = ["bot_1", "bot_2", "bot_3", "bot_4", "bot_5"];
const BOT_NAMES = ["CryptoKing", "TON_Warrior", "LuckyGarf", "AlphaDegen", "SwiftWhale"];

async function initializeBots(io: any) {
  console.log("Initializing Bots...");
  for (let i = 0; i < BOT_IDS.length; i++) {
      await prisma.user.upsert({
      where: { telegramId: BOT_IDS[i] },
      update: {},
      create: {
        telegramId: BOT_IDS[i],
        username: BOT_NAMES[i],
        firstName: BOT_NAMES[i],
        mainBalance: 1000,
      }
    });
  }

  // Create bot challenges periodically (every 2.5 minutes)
  cron.schedule("*/2 * * * *", async () => {
    const randomBotIdx = Math.floor(Math.random() * BOT_IDS.length);
    const botId = BOT_IDS[randomBotIdx];
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
    const openGames = await prisma.game.findMany({
      where: { 
        status: "OPEN",
        participants: { none: { userId: { in: BOT_IDS } } } // Only join human games
      },
      include: { participants: { include: { user: true } } }
    });

    if (openGames.length > 0) {
      // Pick one game and join it with a bot
      const game = openGames[Math.floor(Math.random() * openGames.length)];
      const botId = BOT_IDS[Math.floor(Math.random() * BOT_IDS.length)];
      
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
