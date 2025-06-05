// /scripts/api/types.ts

export interface BaseTx {
  status: 'success' | 'failed' | 'pending';
  chain: 'ethereum' | 'tron' | 'bitcoin' | 'mock' | 'unknown'; // Add more chains as you support them
  transactionID: string;
  rawValue?: unknown;         // Original, un-normalized data from the API
  reason?: string;
  timestamp?: number | null;    // UNIX timestamp (milliseconds)
  blockNumber?: number | null;
}

export interface NativeTransfer extends BaseTx {
  transactionType: 'NATIVE_TRANSFER';
  from: Array<{ address: string; amount: string; symbol: string }>; // Array to support multiple inputs
  to: Array<{ address: string; amount: string; symbol: string }>;   // Array to support multiple outputs
  fee?: { amount: string; symbol: string };
  // Add any other chain-specific but common native transfer fields
}

export interface TokenTransfer extends BaseTx { // Renamed from ERC20Transfer for broader use (TRC20, etc.)
  transactionType: 'TOKEN_TRANSFER';
  token: {
    name?: string;
    symbol: string;
    decimals: number;
    contractAddress: string;
  };
  from: Array<{ address: string; amount: string; symbol: string; tokenContract?: string }>; // Amount is normalized
  to: Array<{ address: string; amount: string; symbol: string; tokenContract?: string }>;   // Amount is normalized
  // Add any other chain-specific but common token transfer fields
}

// Add more specific transaction types as needed, e.g.:
// export interface ContractInteraction extends BaseTx { /* ... */ }
// export interface NftTransfer extends BaseTx { /* ... */ }

export type NormalizedTransaction = NativeTransfer | TokenTransfer; // Add other types here: | ContractInteraction | NftTransfer ...

export interface FailedResponse {
  status: 'failed';
  reason: string;
  chain?: BaseTx['chain'];
  transactionID?: string;
}

// General purpose API response for internal use before normalization
export type ApiResponse<T = any> = T | FailedResponse;
