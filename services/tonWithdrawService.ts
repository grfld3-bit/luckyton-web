import { TonClient, WalletContractV4, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

export async function sendTONWithdrawal(destination: string, amountTon: number): Promise<string> {
  try {
    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: process.env.TON_API_KEY,
    });

    const mnemonicStr = process.env.MERCHANT_MNEMONIC!;
    if (!mnemonicStr) throw new Error("MERCHANT_MNEMONIC not set");
    
    const mnemonic = mnemonicStr.split(" ");
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 });

    const contract = client.open(wallet);
    const seqno = await contract.getSeqno();
    const amountNano = BigInt(Math.floor(amountTon * 1e9));

    // Sign and send
    await contract.sendTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      messages: [internal({
        to: destination,
        value: amountNano,
        body: `LuckyTON Withdrawal: ${amountTon} TON`,
        bounce: false,
      })]
    });

    // We generate a local ID for reference since hash might take time to propagate
    return `tx_${Date.now()}`; 
  } catch (error) {
    console.error('Error during TON withdrawal:', error);
    throw error;
  }
}
