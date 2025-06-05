// /scripts/api/utils/detect.ts

// Consider making this an enum for better type safety if you use TypeScript extensively elsewhere
export type DetectedTransferKind =
  | 'ethereum_tx'
  | 'tron_addr'
  | 'tron_tx_or_btc_tx' // For generic hex64 that could be Tron or Bitcoin
  | 'bank_ref'          // Combined bank mock types
  | 'unknown_format';

export function detectTransferType(ref: string): DetectedTransferKind {
  const r = ref.trim();

  if (/^0x[a-fA-F0-9]{64}$/.test(r)) return 'ethereum_tx'; // Typically Ethereum, could be other EVM
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(r)) return 'tron_addr';

  // This is for TX Hashes that are 64 hex chars, could be Tron, Bitcoin, or others.
  // The orchestrator will try Tron then Bitcoin for this.
  if (/^[0-9a-fA-F]{64}$/.test(r)) return 'tron_tx_or_btc_tx';

  if (/^UETR[0-9A-Z-]{32,36}$/i.test(r)) return 'bank_ref';
  if (/^TRN\d{12,20}$/i.test(r)) return 'bank_ref';
  // Add more specific bank reference patterns if needed before falling to 'unknown_format'

  return 'unknown_format';
}
