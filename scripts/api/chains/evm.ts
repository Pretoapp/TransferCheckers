// /scripts/api/chains/evm.ts
import { ENV, safeJsonFetch } from '../utils/http';
import { cached } from '../adapters/cache';
import type { NormalizedTransaction, FailedResponse, TokenTransfer, NativeTransfer } from '../types'; // Import necessary types

const ETHERSCAN_KEY = ENV('VITE_ETHERSCAN_KEY');

// Normalization function for Ethereum (Example)
// YOU MUST IMPLEMENT THIS LOGIC BASED ON ETHERSCAN'S RESPONSE AND YOUR `NormalizedTransaction` TYPE
function normalizeEthResponse(txData: any, receiptStatus: any, txHash: string): NormalizedTransaction | FailedResponse {
    if (receiptStatus?.result?.status !== '1') {
        return { status: 'failed', reason: 'Tx not confirmed or not found on Ethereum (receipt status).', chain: 'ethereum', transactionID: txHash };
    }

    const tx = txData?.result;
    if (!tx) {
        return { status: 'failed', reason: 'Could not retrieve Ethereum transaction details.', chain: 'ethereum', transactionID: txHash };
    }

    const wei = BigInt(tx.value || '0');
    const ethValue = (Number(wei) / 1e18);

    // This is a simplification. You need to check for ERC20, ERC721, etc.
    // For ERC20, you'd parse logs or use another Etherscan API for token transfers.
    // The current 'transferService.js' doesn't seem to handle ERC20 value/symbol beyond ETH.
    // This example assumes a native ETH transfer for simplicity.

    // Placeholder: In a real scenario, you'd get block timestamp via another call or from tx data if available
    const timestamp = tx.timestamp ? parseInt(tx.timestamp, 16) * 1000 : (txData.block?.timestamp ? parseInt(txData.block.timestamp, 16) * 1000 : Date.now());


    // Basic Native Transfer Example
    const normalized: NativeTransfer = {
        status: 'success',
        chain: 'ethereum',
        transactionID: txHash,
        transactionType: 'NATIVE_TRANSFER',
        from: [{ address: tx.from ?? '—', amount: ethValue.toFixed(18), symbol: 'ETH' }], // Etherscan value is for native ETH
        to: [{ address: tx.to ?? '—', amount: ethValue.toFixed(18), symbol: 'ETH' }],
        timestamp: timestamp, // You might need to fetch block details for a proper timestamp
        blockNumber: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null,
        fee: tx.gasPrice && tx.gasUsed ? {
            amount: (Number(BigInt(tx.gasPrice) * BigInt(tx.gasUsed)) / 1e18).toFixed(18),
            symbol: 'ETH'
        } : undefined,
        rawValue: {tx, receiptStatus}, // Store the original response
    };
    return normalized;
}


export async function fetchEvmTx(
    txHash: string,
    chainName: 'ethereum' /* | 'polygon' | ... */ // Chain name for targeting correct API if this function handles multiple EVM chains
): Promise<NormalizedTransaction | FailedResponse> {
    if (!ETHERSCAN_KEY) {
        return { status: 'failed', reason: 'Ethereum lookup unavailable (no API key).', chain: 'ethereum', transactionID: txHash };
    }

    // Use chainName to select base URL if needed, e.g. api.etherscan.io vs api.polygonscan.com
    const base = 'https://api.etherscan.io/api'; // Modify if handling multiple EVM chains

    try {
        // You can cache individual API calls or the final normalized result.
        // Caching the final result might be simpler here.
        return await cached(`evm:<span class="math-inline">\{chainName\}\:</span>{txHash}`, async () => {
            const receiptURL = `<span class="math-inline">\{base\}?module\=transaction&action\=gettxreceiptstatus&txhash\=</span>{txHash}&apikey=${ETHERSCAN_KEY}`;
            const receiptResJson = await safeJsonFetch<any>(receiptURL); // Specify expected raw type

            // If receipt status indicates failure early, you might return here,
            // or proceed to get full tx details for a more complete 'failed' response.
            if (receiptResJson?.result?.status === '0') {
                 return { status: 'failed', reason: 'Transaction reverted or failed on Ethereum (receipt status 0).', chain: 'ethereum', transactionID: txHash, rawValue: {receiptResJson} };
            }
             if (receiptResJson?.status === '0' && receiptResJson?.message === 'NOTOK') { // Etherscan can return status 0 for "No data found"
                return { status: 'failed', reason: `Transaction not found or invalid (Etherscan: ${receiptResJson.result}).`, chain: 'ethereum', transactionID: txHash, rawValue: {receiptResJson} };
            }


            const txURL = `<span class="math-inline">\{base\}?module\=proxy&action\=eth\_getTransactionByHash&txhash\=</span>{txHash}&apikey=${ETHERSCAN_KEY}`;
            const txResJson = await safeJsonFetch<any>(txURL); // Specify expected raw type

            return normalizeEthResponse(txResJson, receiptResJson, txHash);
        });
    } catch (e: any) {
        console.error(`[EVM Fetcher] Error fetching ${chainName} tx ${txHash}:`, e);
        return {
            status: 'failed',
            reason: `Network or API error fetching ${chainName} transaction: ${e.message}`,
            chain: 'ethereum', // or dynamically chainName if it's a variable
            transactionID: txHash
        };
    }
}
