import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { fetchRecentTransactions, extractCommentFromTx } from '../services/tonScannerService';

const MERCHANT_WALLET = process.env.MERCHANT_WALLET_ADDRESS!;

async function scanDeposits() {
  console.log('Scanning for new on-chain deposits...');
  try {
    const txs = await fetchRecentTransactions(20);

    for (const tx of txs) {
      const txHash = tx.transaction_id.hash;
      const existing = await prisma.depositScan.findUnique({ where: { txHash } });
      if (existing) continue;

      const fromAddress = tx.in_msg.source;
      const toAddress = tx.in_msg.destination;
      const amountNano = BigInt(tx.in_msg.value);
      const amountTON = Number(amountNano) / 1e9;
      const comment = extractCommentFromTx(tx);

      // Verify destination is merchant wallet
      if (toAddress !== MERCHANT_WALLET) {
        // Log skip for unexpected destination
        continue;
      }

      // Identify user from comment (format: "Deposit <telegramId>")
      let userId: string | null = null;
      if (comment) {
        const match = comment.match(/Deposit (\d+)/);
        if (match) {
          const telegramId = match[1];
          const user = await prisma.user.findUnique({ where: { telegramId } });
          if (user) userId = user.id;
        }
      }

      // Save scan result
      await prisma.depositScan.create({
        data: {
          txHash,
          fromAddress: fromAddress || 'unknown',
          toAddress,
          amount: amountTON,
          comment,
          userId,
          status: userId ? 'credited' : 'pending',
          creditedAt: userId ? new Date() : null,
        },
      });

      // Credit user balance if identified
      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            mainBalance: { increment: amountTON },
            totalDeposit: { increment: amountTON },
          },
        });
        
        // Record internal transaction
        await prisma.transaction.create({
          data: {
            userId,
            type: 'deposit',
            amount: amountTON,
            balanceType: 'main',
            reference: txHash
          },
        });
        console.log(`✅ Deposit ${amountTON} TON credited to userTelegramID/InternalID: ${userId}`);
      } else {
        console.log(`⚠️ Deposit ${amountTON} TON from ${fromAddress} unidentified (Comment: ${comment})`);
      }
    }
  } catch (error) {
    console.error('Error scanning deposits:', error);
  }
}

// Every 30 seconds
export function startDepositScanner() {
  cron.schedule('*/30 * * * * *', scanDeposits);
  console.log('On-chain deposit scanner worker started');
}
