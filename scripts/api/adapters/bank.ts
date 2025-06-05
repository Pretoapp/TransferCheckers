// /scripts/api/adapters/bank.ts
import type { NormalizedTransaction, FailedResponse, NativeTransfer } from '../types'; // Adjust imported types as needed

// Your existing bankMockDB
const bankMockDB: Record<string, any> = {
  TRN58392017365928: {
    // ─── Top-Level SWIFT-Style Payment Fields ───
    status:         'Completed',                 // SWIFT “processing status”
    transactionID:  'TX746290BD23',               // Internal TX reference
    amount:         '49,000,000.00',              // Always store as string (no “£” here)
    currency:       'GBP',
    valueDate:      '2025-05-05',                 // The “credit date” in SWIFT parlance
    remittanceInfo: 'Invoice 2025-391',           // Free-text remittance information

    // ─── Ordering (Sender) Customer Fields ───
    orderingCustomer: {
      name:        'Ogden Pedro',
      account:     '••••0275',                     // Last 4 digits of account number
      bic:         'HBUKGB4BXXX',                 // BIC/SWIFT code
      bankName:    'HSBC UK',
      bankAddress: '8 Canada Square, London, E14 5HQ, United Kingdom'
    },

    // ─── Beneficiary Customer Fields ───
    beneficiaryCustomer: {
      name:         'AL SHAWI C.',
      account:      'INV-2025-391',                // Internal invoice/ref
      bic:          'KRTHHBK',                    // BIC/SWIFT code
      bankName:     'Krungthai Bank',
      bankAddress:  'Bangbo Branch, 296-196/1 Village No. 1, Rattanarat Road, Bang Bo Subdistrict, Bang Bo District, Samut Prakan Province 10560, Thailand'
    }
  },

  UETR7890XYZ: {
    status: 'success',
    amount: '£2,000,000.00',
    date: '2025-05-05',
    from: 'Ogden Pedro (Savings ••••0275)',
    to: 'AL SHAWI C.',
    currency: 'GBP',
    transactionID: 'TX198475BC00'
  },

  TXID9876ABC: {
    status: 'failed',
    reason: 'Transaction reference not found or reversed.'
  },

  PENDG000001: {
    status: 'pending',
    amount: '¥150,000',
    date: '2025-05-09',
    from: 'Eve Holdings Intl. (••••1122)',
    to: 'Future Systems Co. Ltd.',
    currency: 'JPY',
    estimatedCompletion: 'Within 2 business days.',
    transactionID: 'TXPEND5001A'
  }
};


export type BankProvider = 'mock' | 'swift' | 'partnerX';

// Helper to convert mock data to NormalizedTransaction
// THIS IS A CRITICAL STEP: You need to map your mock data fields to the NormalizedTransaction structure
function normalizeMockEntry(entry: any, ref: string): NormalizedTransaction | FailedResponse {
  // If status is “failed,” return a FailedResponse immediately:
  if (entry.status === 'failed') {
    return {
      status: entry.status,
      reason: entry.reason ?? 'Unknown error from mock bank.',
      chain: 'mock',
      transactionID: ref
    };
  }

  // At this point we assume status is “Completed” or “Pending” (SWIFT style).
  // Build a NormalizedTransaction object with exactly the SWIFT‐style fields:

  // 1) Parse the numeric portion of “amount” (e.g. "49,000,000.00")
  const parsedAmount = entry.amount.replace(/,/g, ''); // "49000000.00"
  // 2) Build our NormalizedTransaction:
  const normalized: NativeTransfer = {
    status:        entry.status.toLowerCase(),            // “completed” or “pending”
    chain:         'mock',
    transactionID: entry.transactionID || ref,

    // Use “EXECUTION” (NATIVE_TRANSFER) to signal a bank payment:
    transactionType: 'NATIVE_TRANSFER',

    // SWIFT “valueDate” => timestamp
    timestamp: entry.valueDate ? new Date(entry.valueDate).getTime() : null,

    // We place the orderingCustomer as “from[0]”:
    from: [{
      address: entry.orderingCustomer.name,
      amount:  parsedAmount,
      symbol:  entry.currency
    }],

    // And beneficiaryCustomer as “to[0]”:
    to: [{
      address: entry.beneficiaryCustomer.name,
      amount:  parsedAmount,
      symbol:  entry.currency
    }],

    // Include every field in rawValue so the modal can pick them up.
    rawValue: {
      // SWIFT “header” fields:
      status:        entry.status,
      transactionID: entry.transactionID,
      valueDate:     entry.valueDate,
      amount:        entry.amount,
      currency:      entry.currency,
      remittanceInfo: entry.remittanceInfo,

      // SWIFT “orderingCustomer” block:
      orderingCustomer: {
        name:        entry.orderingCustomer.name,
        account:     entry.orderingCustomer.account,
        bic:         entry.orderingCustomer.bic,
        bankName:    entry.orderingCustomer.bankName,
        bankAddress: entry.orderingCustomer.bankAddress
      },

      // SWIFT “beneficiaryCustomer” block:
      beneficiaryCustomer: {
        name:         entry.beneficiaryCustomer.name,
        account:      entry.beneficiaryCustomer.account,
        bic:          entry.beneficiaryCustomer.bic,
        bankName:     entry.beneficiaryCustomer.bankName,
        bankAddress:  entry.beneficiaryCustomer.bankAddress
      }
    }
  };

  // If the SWIFT “status” is still “Pending,” we can set a “reason” for UI:
  if (entry.status.toLowerCase() === 'pending' && entry.remittanceInfo) {
    normalized.reason = `Pending: ${entry.remittanceInfo}`;
  }

  return normalized;
}



export async function fetchBankTransfer(
  reference: string,
  provider: BankProvider = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BANK_PROVIDER as BankProvider) || 'mock'
): Promise<NormalizedTransaction | FailedResponse> {
  if (provider === 'mock') {
    const upper = reference.toUpperCase();
    const mockEntry = bankMockDB[upper];
    if (!mockEntry) {
      return { status: 'failed', reason: `Bank reference '${reference}' not found in mock DB.`, chain: 'mock' };
    }
    return normalizeMockEntry(mockEntry, reference);
  }

  if (provider === 'swift') {
    // TODO: call SWIFT gpi API with OAuth2 + MT204 parsing
    return { status: 'failed', reason: 'SWIFT provider not yet implemented.', chain: 'mock' };
  }

  if (provider === 'partnerX') {
    // TODO: call partner’s REST with apiKey + HMAC
    return { status: 'failed', reason: 'PartnerX provider not yet implemented.', chain: 'mock' };
  }

  return { status: 'failed', reason: 'Unsupported bank provider or provider not set.', chain: 'mock' };
}
