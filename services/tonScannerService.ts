import axios from 'axios';

const TONCENTER_API = 'https://toncenter.com/api/v2';
const API_KEY = process.env.TON_API_KEY!;
const MERCHANT_WALLET = process.env.MERCHANT_WALLET_ADDRESS!;

interface TonTransaction {
  transaction_id: { hash: string };
  in_msg: {
    source: string;
    destination: string;
    value: string; // dalam nanoTON
    message?: string;
  };
}

export async function fetchRecentTransactions(limit: number = 20): Promise<TonTransaction[]> {
  try {
    const response = await axios.get(`${TONCENTER_API}/getTransactions`, {
      params: { address: MERCHANT_WALLET, limit, archival: false },
      headers: { 'X-API-Key': API_KEY },
    });
    return response.data.result;
  } catch (error) {
    console.error('Error fetching transactions from TON Center:', error);
    return [];
  }
}

export function extractCommentFromTx(tx: TonTransaction): string | null {
  if (tx.in_msg.message) {
    try {
      // Message is typically in base64 if it's a simple text comment
      const decoded = Buffer.from(tx.in_msg.message, 'base64').toString('utf-8');
      return decoded;
    } catch {
      return null;
    }
  }
  return null;
}
