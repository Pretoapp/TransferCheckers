// /scripts/api/chains/bitcoin.ts
import { ENV, safeJsonFetch } from '../utils/http';
import { cached } from '../adapters/cache';
import type { NormalizedTransaction, FailedResponse, NativeTransfer } from '../types';

const BLOCKCYPHER_KEY = ENV('VITE_BLOCKCYPHER_KEY');
const BLOCKCYPHER_API_BASE = 'https://api.blockcypher.com/v1/btc/main';

// --- Normalization Function for Bitcoin ---
// YOU NEED TO COMPLETE THIS FUNCTION
function normalizeBitcoinResponse(data: any, txHash: string): NormalizedTransaction | FailedResponse {
    if (!data || data.error) {
        return {
            status: 'failed',
            reason: `Bitcoin lookup failed: ${data.error || 'No data or error in response'}`,
            chain: 'bitcoin',
            transactionID: txHash,
            rawValue: data
        };
    }

    // Determine status: success if confirmed, pending otherwise
    const status = data.confirmations > 0 ? 'success' : 'pending';
    const btcAmount = (data.total / 1e8).toFixed(8); // Blockcypher 'total' is in satoshis

    // Simplification: Blockcypher provides 'addresses' in inputs/outputs.
    // For a more robust solution, you'd iterate through all inputs and outputs
    // to accurately represent the from/to sides, especially for multi-address transactions.
    // The 'from' side is complex in Bitcoin (sum of UTXOs).
    // Blockcypher's 'inputs[0].addresses[0]' is a simplification for the primary sender address.
    // Similarly for 'outputs[0].addresses[0]' as the primary recipient.

    const fromAddresses = data.inputs?.map((input: any) => ({
        address: input.addresses?.[0] || 'Unknown Input Address', // Taking first address of each input
        // Note: Blockcypher input objects don't directly show amount per input address in the main tx data,
        // but rather the output_value of the UTXO being spent.
        // For simplicity, we are not detailing amount per input here. The total tx amount is `btcAmount`.
        // We will assign the full btcAmount to the first 'from' address for our simplified NativeTransfer model.
    }));

    const toAddresses = data.outputs?.map((output: any) => ({
        address: output.addresses?.[0] || 'Unknown Output Address', // Taking first address of each output
        amount: (output.value / 1e8).toFixed(8), // Amount for this specific output
        symbol: 'BTC'
    }));

    // For our NativeTransfer's simplified `from` array (expecting single amount/symbol):
    const primaryFrom = fromAddresses?.length > 0
        ? [{ address: fromAddresses[0].address, amount: btcAmount, symbol: 'BTC' }]
        : [{ address: 'Unknown Coinbase or Complex Input', amount: btcAmount, symbol: 'BTC' }];


    const normalized: NativeTransfer = {
        status: status,
        chain: 'bitcoin',
        transactionID: txHash,
        transactionType: 'NATIVE_TRANSFER',
        timestamp: data.received ? new Date(data.received).getTime() : null,
        blockNumber: data.block_height > 0 ? data.block_height : null, // block_height or block_index
        from: primaryFrom,
        to: toAddresses?.filter(to => to.address !== 'Unknown Output Address' && parseFloat(to.amount) > 0) || // Filter out potentially empty or zero-value script outputs if desired
            [{ address: 'Unknown Output Structure', amount: btcAmount, symbol: 'BTC' }],
        fee: data.fees ? { amount: (data.fees / 1e8).toFixed(8), symbol: 'BTC' } : undefined,
        rawValue: data, // Store the original Blockcypher response
    };

    if (status === 'pending') {
        normalized.reason = data.confirmations !== undefined ? `${data.confirmations} confirmations. Awaiting more.` : 'Awaiting confirmations.';
    }

    return normalized;
}

// --- Public Fetch Function for Bitcoin Transaction ---
export async function fetchBitcoinTx(
    txHash: string
): Promise<NormalizedTransaction | FailedResponse> {
    if (!BLOCKCYPHER_API_BASE) { // Should always be true, but good check
        return { status: 'failed', reason: 'Bitcoin API endpoint not configured.', chain: 'bitcoin', transactionID: txHash };
    }

    const url = `<span class="math-inline">\{BLOCKCYPHER\_API\_BASE\}/txs/</span>{txHash}${BLOCKCYPHER_KEY ? `?token=${BLOCKCYPHER_KEY}` : ''}`;

    try {
        return await cached(`bitcoin:tx:${txHash}`, async () => {
            const rawData = await safeJsonFetch<any>(url); // Specify expected raw type from Blockcypher
            return normalizeBitcoinResponse(rawData, txHash);
        });
    } catch (e: any) {
        console.error(`[Bitcoin Fetcher] Error fetching BTC tx ${txHash}:`, e);
        return {
            status: 'failed',
            reason: e.message || 'Network or API error fetching Bitcoin transaction.',
            chain: 'bitcoin',
            transactionID: txHash,
            rawValue: e.responseBody || e // Include raw error if available
        };
    }
}
