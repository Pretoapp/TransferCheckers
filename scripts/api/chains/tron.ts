// /scripts/api/chains/tron.ts
import { ENV, safeJsonFetch } from '../utils/http';
import { cached } from '../adapters/cache';
import type { NormalizedTransaction, FailedResponse, NativeTransfer, TokenTransfer } from '../types';

const TRONSCAN_KEY = ENV('VITE_TRONSCAN_KEY');
const TRON_API_BASE = ENV('VITE_TRON_API_BASE', 'https://apilist.tronscanapi.com'); // Allow override, default to your existing

// Attempt to get TronWeb instance if loaded globally (e.g. by a CDN script in the browser for TronLink)
// For backend or build environments, you might need to import it differently or handle its absence.
const TronWebGlobal = typeof window !== 'undefined' && (window as any).TronWeb
    ? (window as any).TronWeb
    : null;

if (!TronWebGlobal) {
    console.warn("[TronService] TronWeb is not available globally. Address conversion from hex might not work for some cases.");
}

// --- Normalization Function for Tron ---
// This function will take the raw transaction data from Tronscan (the 'd' object from your old fetchTron)
// and convert it into either a NativeTransfer, TokenTransfer, or FailedResponse.
function normalizeTronResponse(data: any, txId: string): NormalizedTransaction | FailedResponse {
    if (!data || !data.hash) {
        return { status: 'failed', reason: 'TRON tx empty or invalid response.', chain: 'tron', transactionID: txId, rawValue: data };
    }

    // --- Re-use and adapt logic from your original fetchTron's parsing section ---
    let amountVal = '0';
    let parsedSymbol = 'TRX'; // Default currency/symbol
    let fromAddr = data.ownerAddress || data.trigger_info?.owner_address || '—';
    let toAddr = '—'; // Will be determined below
    let transactionType: 'NATIVE_TRANSFER' | 'TOKEN_TRANSFER' = 'NATIVE_TRANSFER'; // Default
    let tokenDetails: TokenTransfer['token'] | undefined = undefined;

    const timestamp = data.timestamp ? new Date(data.timestamp).getTime() : null;
    const blockNumber = data.block > 0 ? data.block : null;

    // Priority 1: TRC-20 Transfer (from trc20TransferInfo array or contractRet SUCCESS with tokenInfo)
    if (data.trc20TransferInfo && data.trc20TransferInfo.length > 0) {
        const transferInfo = data.trc20TransferInfo[0]; // Assuming primary transfer
        const rawAmountStr = transferInfo.amount_str || '0';
        const decimals = Number(transferInfo.decimals ?? 6); // Default to 6 if not present
        parsedSymbol = (transferInfo.symbol || 'TOKEN').toUpperCase();

        amountVal = (Number(BigInt(rawAmountStr)) / (10 ** decimals)).toFixed(decimals);
        fromAddr = transferInfo.from_address || fromAddr;
        toAddr = transferInfo.to_address || '—';
        transactionType = 'TOKEN_TRANSFER';
        tokenDetails = {
            name: transferInfo.name || parsedSymbol,
            symbol: parsedSymbol,
            decimals: decimals,
            contractAddress: transferInfo.contract_address || data.trigger_info?.contract_address || 'Unknown Contract'
        };
    }
    // Priority 2: Contract Interactions (like transfer, approve) often found in trigger_info for TRC20
    else if (data.trigger_info?.methodName && data.trigger_info?.parameter && (data.tokenInfo || data.contractData?.tokenInfo)) {
        const tokenInfo = data.tokenInfo || data.contractData?.tokenInfo; // data.contractData.tokenInfo for TRC10
        if (tokenInfo) { // Must have tokenInfo to be a token transfer
            const methodName = data.trigger_info.methodName.toLowerCase();
            let rawAmountFromParam: string | number | undefined = undefined;

            if ((methodName.includes('transfer') || methodName.includes('approve')) && data.trigger_info.parameter) {
                // Common parameter names for value/amount
                rawAmountFromParam = data.trigger_info.parameter._value ?? data.trigger_info.parameter.value ?? data.trigger_info.parameter._amount ?? data.trigger_info.parameter.amount ?? data.trigger_info.parameter.tokens ?? data.trigger_info.parameter._tokens;
                if (methodName === 'transfer' && data.trigger_info.parameter?._to) {
                     const recipientHex = data.trigger_info.parameter._to;
                     toAddr = TronWebGlobal?.address.fromHex(recipientHex) || recipientHex;
                } else if (data.trigger_info.to_address) {
                     toAddr = data.trigger_info.to_address;
                } else {
                     toAddr = data.trigger_info.contract_address || '—'; // Target is the contract itself
                }
            } else if (data.contractData?.amount !== undefined) { // TRC10 transfer in contractData
                 rawAmountFromParam = data.contractData.amount;
                 toAddr = data.contractData.to_address ? (TronWebGlobal?.address.fromHex(data.contractData.to_address) || data.contractData.to_address) : '—';
            }


            if (rawAmountFromParam !== undefined) {
                const rawAmount = BigInt(String(rawAmountFromParam));
                const decimals = Number(tokenInfo.tokenDecimal ?? tokenInfo.tokenInfo?.tokenDecimal ?? tokenInfo.decimals ?? tokenInfo.tokenInfo?.decimals ?? (tokenInfo.tokenPrecision ?? 6));
                parsedSymbol = (tokenInfo.tokenAbbr ?? tokenInfo.tokenInfo?.tokenAbbr ?? tokenInfo.symbol ?? tokenInfo.tokenInfo?.symbol ?? tokenInfo.tokenSymbol ?? 'TOKEN').toUpperCase();

                amountVal = (Number(rawAmount) / (10 ** decimals)).toFixed(decimals);
                transactionType = 'TOKEN_TRANSFER';
                tokenDetails = {
                    name: tokenInfo.tokenName ?? tokenInfo.tokenInfo?.tokenName ?? tokenInfo.name ?? parsedSymbol,
                    symbol: parsedSymbol,
                    decimals: decimals,
                    contractAddress: tokenInfo.tokenId ?? tokenInfo.tokenInfo?.tokenId ?? data.trigger_info.contract_address  // tokenId for TRC10, contract_address for TRC20
                };
            }
        }
    }
    // Priority 3: Native TRX Transfer (from contractData.amount or data.amount for internal tx)
    else if (data.contractData?.amount !== undefined || data.internal_transactions?.[0]?.call_value_info?.[0]?.amount !== undefined || data.amount !== undefined) {
        // data.amount is often present for internal transactions related to contract calls
        // data.internal_transactions[0].call_value_info[0].amount is for TRC20 involving smart contracts not emitting trc20TransferInfo
        let trxAmountRaw = data.contractData?.amount ?? data.internal_transactions?.[0]?.call_value_info?.[0]?.amount ?? data.amount ?? '0';
        const trxAmount = BigInt(trxAmountRaw);
        amountVal = (Number(trxAmount) / 1e6).toFixed(6); // TRX has 6 decimals
        parsedSymbol = 'TRX';
        transactionType = 'NATIVE_TRANSFER';
        // For native TRX transfers, 'to' might be in contractData.to_address or determined by trigger_info
        if (data.contractData?.to_address) {
            const recipientHex = data.contractData.to_address;
            toAddr = TronWebGlobal?.address.fromHex(recipientHex) || recipientHex;
        } else if (data.toAddress) {
            toAddr = data.toAddress;
        } else if (data.trigger_info?.to_address) {
            toAddr = data.trigger_info.to_address;
        } else if (data.internal_transactions?.[0]?.to_address) {
            toAddr = data.internal_transactions[0].to_address;
        } else {
            toAddr = data.trigger_info?.contract_address || '—'; // Fallback
        }
    } else { // If no amount identifiable, it might be a different kind of interaction
        // Keep amountVal as '0', symbol 'TRX', and perhaps classify differently or fail.
        // For now, we'll let it be a 0-value TRX interaction if no other info.
        toAddr = data.toAddress || data.trigger_info?.contract_address || '—';
    }


    // Determine status
    const isReverted = data.contractRet === 'REVERT';
    const isSuccess = data.contractRet === 'SUCCESS' || (data.confirmed && data.block > 0 && !isReverted);
    let status: 'success' | 'pending' | 'failed' = 'pending'; // Default
    let reason: string | undefined = undefined;

    if (isReverted) {
        status = 'failed';
        reason = `Tron transaction reverted: ${data.resMessage || 'Contract execution failed.'}`.trim();
    } else if (isSuccess) {
        status = 'success';
    } else { // Not reverted, but not clearly success (e.g. not confirmed, or no contractRet)
        status = 'pending';
        reason = 'Awaiting block confirmation or execution success.';
    }

    // Build the common part of the response
    const baseResponse: Omit<NativeTransfer | TokenTransfer, 'transactionType' | 'token' | 'from' | 'to' | 'fee'> = {
        status: status,
        chain: 'tron',
        transactionID: txId,
        timestamp: timestamp,
        blockNumber: blockNumber,
        reason: reason,
        rawValue: data,
    };

    // Construct specific transaction type
    if (transactionType === 'TOKEN_TRANSFER' && tokenDetails) {
        const tokenTx: TokenTransfer = {
            ...baseResponse,
            transactionType: 'TOKEN_TRANSFER',
            token: tokenDetails,
            from: [{ address: fromAddr, amount: amountVal, symbol: tokenDetails.symbol, tokenContract: tokenDetails.contractAddress }],
            to: [{ address: toAddr, amount: amountVal, symbol: tokenDetails.symbol, tokenContract: tokenDetails.contractAddress }],
            // Fee data for Tron is complex, usually paid in Bandwidth/Energy (TRX)
            // It's not directly in this part of Tronscan response in a simple 'fee' field.
            // It might be obtainable from `data.cost` object (net_fee, energy_penalty_total etc.)
        };
        return tokenTx;
    } else { // NativeTransfer or other interaction treated as NativeTransfer (possibly 0-value)
        const nativeTx: NativeTransfer = {
            ...baseResponse,
            transactionType: 'NATIVE_TRANSFER',
            from: [{ address: fromAddr, amount: amountVal, symbol: parsedSymbol }],
            to: [{ address: toAddr, amount: amountVal, symbol: parsedSymbol }],
        };
        return nativeTx;
    }
}

// --- Public Fetch Function for Tron Transaction by ID ---
export async function fetchTronTx(
    txId: string
): Promise<NormalizedTransaction | FailedResponse> {
    const headers = TRONSCAN_KEY ? { 'TRON-PRO-API-KEY': TRONSCAN_KEY } : {};
    const url = `${TRON_API_BASE}/api/transaction-info?hash=${txId}`;

    try {
        return await cached(`tron:tx:${txId}`, async () => {
            const rawData = await safeJsonFetch<any>(url, { headers });
            return normalizeTronResponse(rawData, txId);
        });
    } catch (e: any) {
        console.error(`[Tron Fetcher] Error fetching Tron TX ${txId}:`, e);
        let reason = e.message || 'Network or API error fetching Tron transaction.';
        if (e.status) { // If status is attached from makeApiRequest
            reason = `TRON API Error ${e.status}: ${e.message}`;
        }
        return {
            status: 'failed',
            reason: reason,
            chain: 'tron',
            transactionID: txId,
            rawValue: e.responseBody || e // Include raw error if available
        };
    }
}

// --- Public Fetch Function for Tron Address (latest TRC20 transaction) ---
export async function fetchTronAddr(
    address: string
): Promise<NormalizedTransaction | FailedResponse> {
    // This adapts your original logic: gets latest TRC20 transfer, then fetches that tx.
    // Consider if you want to fetch latest *any* tx, which might need a different Tronscan endpoint.
    const url = `${TRON_API_BASE}/api/token_trc20/transfers?limit=1&sort=-timestamp&address=${address}`;
    const headers = TRONSCAN_KEY ? { 'TRON-PRO-API-KEY': TRONSCAN_KEY } : {};

    try {
        // Caching for address lookups can be tricky if "latest" is important.
        // Caching the subsequent fetchTronTx call is generally safer.
        // For this example, we cache the result of the address lookup itself for a short period.
        const transferListData = await cached(`tron:addr-latest-trc20:${address}`, () =>
            safeJsonFetch<any>(url, { headers })
        );

        // Tronscan's response for transfers can be in `data` or `token_transfers`
        const transfers = transferListData?.data?.length ? transferListData.data : (transferListData?.token_transfers?.length ? transferListData.token_transfers : []);

        if (!transfers || transfers.length === 0) {
            return {
                status: 'failed',
                reason: 'No TRC-20 transfers found for this address on Tronscan.',
                chain: 'tron' // Address itself isn't a tx, so no txID here
            };
        }
        const latestTxHash = transfers[0].transaction_id;
        if (!latestTxHash) {
            return { status: 'failed', reason: 'No transaction hash found in latest TRC-20 transfer data.', chain: 'tron' };
        }

        return fetchTronTx(latestTxHash); // This will use its own caching for the tx details

    } catch (e: any) {
        console.error(`[Tron Fetcher] Error fetching latest TRC20 for address ${address}:`, e);
        let reason = e.message || 'Network or API error fetching Tron address transactions.';
        if (e.status) {
             reason = `TRON API Error ${e.status}: ${e.message}`;
        }
        return {
            status: 'failed',
            reason: reason,
            chain: 'tron'
        };
    }
}
