/* ------------------------------------------------------
  /scripts/api/transferService.js
  Hybrid live + mock lookup • 2025-06-04
  UPDATED to normalize bankMock data for main.js
--------------------------------------------------------- */

/* ---------- ENV KEYS (works in Vite & Node) ----------- */
const ENV = (k, def = '') =>
  typeof import.meta !== 'undefined' && import.meta.env?.[k] !== undefined
    ? import.meta.env[k]
    : (typeof process !== 'undefined' ? process.env[k] : def) ?? def;

const ETHERSCAN_KEY   = ENV('VITE_ETHERSCAN_KEY');
const BLOCKCYPHER_KEY = ENV('VITE_BLOCKCYPHER_KEY');
const TRONSCAN_KEY    = ENV('VITE_TRONSCAN_KEY');
const TRON_API        = 'https://apilist.tronscanapi.com';   // stable edge



/* ---------- MOCK BANK DATA (kept for now) ------------- */
const bankMockDB = {
TRN58392017365928: {
  // ─── Top‐Level SWIFT‐Style Payment Fields ───
  status:           'Completed',
  transactionID:    'TX746290BD23',
  amount:           '49,000,000.00',
  currency:         'EUR',
  valueDate:        '2025-05-05',
  remittanceInfo:   'Invoice 2025-391',

  orderingCustomer: {
    name:       'Ogden Pedro',
    
    bic:        'HBUKGB4BXXX',
    bankName:   'HSBC UK',
    account:    '••••0275'
   
  },
  beneficiaryCustomer: {
    name:         'Ms. Princess Am••••',

    bic:          'KRTHHBK',
    bankName:     'Krungthai Bank',
    account:    '••••743-0',
    
  }
},
  UETR7890XYZ: { // This entry will also need normalization if its details are to be shown fully
    status: 'success', // Note: main.js getStatusClass maps 'success' to status-success
    amount: '2,000,000.00', // For consistency, remove currency symbols from amount
    currency: 'GBP',
    valueDate: '2025-05-05', // Use valueDate for consistency
    transactionID: 'TX198475BC00',
    // To show full details, add orderingCustomer & beneficiaryCustomer objects here
    orderingCustomer: { name: 'Ogden Pedro (Savings ••••0275)', account: '••••0275', bic: 'N/A', bankName: 'N/A', bankAddress: 'N/A' },
    beneficiaryCustomer: { name: 'AL SHAWI C.', account: 'N/A', bic: 'N/A', bankName: 'N/A', bankAddress: 'N/A' }
  },
  TXID9876ABC: {
    status: 'failed',
    reason: 'Transaction reference not found or reversed.'
  },
  PENDG000001: { // This entry will also need normalization
    status: 'pending',
    amount: '150,000', // For consistency, remove currency symbols
    currency: 'JPY',
    valueDate: '2025-05-09', // Use valueDate for consistency
    transactionID: 'TXPEND5001A',
    remittanceInfo: 'Payment for order P001', // Example, if needed for pending reason
    // To show full details, add orderingCustomer & beneficiaryCustomer objects here
    orderingCustomer: { name: 'Eve Holdings Intl. (••••1122)', account: '••••1122', bic: 'N/A', bankName: 'N/A', bankAddress: 'N/A' },
    beneficiaryCustomer: { name: 'Future Systems Co. Ltd.', account: 'N/A', bic: 'N/A', bankName: 'N/A', bankAddress: 'N/A' },
    estimatedCompletion: 'Within 2 business days.' // This can be put in 'reason' by normalization
  }
};

/* ---------- Type Detection (Patched) ------------------ */
function detectType(ref) {
  const r = ref.trim();

  if (/^0x[a-fA-F0-9]{64}$/.test(r))          return 'ethereum';
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(r))  return 'tronAddr';
  if (/^[0-9a-fA-F]{64}$/.test(r))            return 'hex64';
  if (/^UETR[0-9A-Z-]{32,36}$/i.test(r))      return 'bankMock'; // UETR for bank mock
  if (/^TRN\d{12,20}$/i.test(r))              return 'bankMock'; // TRN... for bank mock

  return 'unknown';
}


// +++ START NORMALIZATION FUNCTION FOR BANK MOCK DATA +++
function normalizeBankMockEntry(entry, originalReference) {
  // Handle failed status directly from mockDB
  if (entry.status && entry.status.toLowerCase() === 'failed') {
    return {
      status: entry.status, // Keep original case for consistency here
      reason: entry.reason ?? 'Unknown error from mock bank.',
      transactionID: originalReference, // Use the searched reference if TX ID is missing in mock
    };
  }

  // For successful/pending entries, structure for main.js
  const normalizedData = {
    // Top-level fields expected by displayApiResultInModal's general section
    status: entry.status, // e.g., "Completed", "Pending", "success"
    transactionID: entry.transactionID || originalReference,
    amount: entry.amount, // Assumes amount string is pre-formatted without currency symbol
    currency: entry.currency,
    valueDate: entry.valueDate || entry.date, // Prefer valueDate, fallback to date
    remittanceInfo: entry.remittanceInfo,

    // The rawValue object for detailed party information expected by displayApiResultInModal
    rawValue: {
      status: entry.status,
      transactionID: entry.transactionID || originalReference,
      valueDate: entry.valueDate || entry.date,
      amount: entry.amount,
      currency: entry.currency,
      remittanceInfo: entry.remittanceInfo,

      // Copy orderingCustomer and beneficiaryCustomer if they exist
      orderingCustomer: entry.orderingCustomer ? { ...entry.orderingCustomer } : undefined,
      beneficiaryCustomer: entry.beneficiaryCustomer ? { ...entry.beneficiaryCustomer } : undefined,
    }
  };

  // Add/override a 'reason' at the top level for displayApiResultInModal
  // if the status suggests it and more specific info is available.
  const lowerStatus = entry.status ? entry.status.toLowerCase() : '';
  if (lowerStatus === 'pending') {
    if (entry.estimatedCompletion) {
      normalizedData.reason = `Estimated completion: ${entry.estimatedCompletion}`;
    } else if (entry.remittanceInfo) {
      // displayApiResultInModal already handles this via its own logic if reason isn't set
      // but we can be explicit: normalizedData.reason = `Pending: ${entry.remittanceInfo}`;
    }
  }
  // For other statuses like 'success', main.js `getStatusClass` handles it.

  return normalizedData;
}
// +++ END NORMALIZATION FUNCTION FOR BANK MOCK DATA +++


/* ---------- Live Blockchain Fetchers ------------------ */
// fetchEthereum, fetchBitcoin, fetchTronAddress, fetchTron functions remain unchanged...
async function fetchEthereum(txHash) {
  if (!ETHERSCAN_KEY) return {status:'failed',reason:'Ethereum lookup unavailable (no API key).'};
  const base = 'https://api.etherscan.io/api';

  const okURL = `${base}?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${ETHERSCAN_KEY}`;
  let okResJson;
  try {
    okResJson = await fetch(okURL).then(r => r.json());
  } catch (e) {
    console.error('[TransferService] Ethereum receipt check fetch error:', e);
    return { status: 'failed', reason: 'Network error checking Ethereum transaction status.' };
  }

  if (okResJson?.result?.status !== '1') { // Note: Etherscan '1' is success, '0' is fail/pending for receipt
    // To distinguish failed vs pending, a call to eth_getTransactionByHash and checking blockNumber (null if pending) is needed.
    // For simplicity here, if receipt status is not '1', we consider it not successfully confirmed.
    // A more detailed check could be added if 'pending' status from Etherscan is required.
    return {status:'failed',reason:'Tx not confirmed successfully or not found on Ethereum.'};
  }

  const txURL = `${base}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${ETHERSCAN_KEY}`;
  let txResJson;
  try {
    txResJson = await fetch(txURL).then(r => r.json());
  } catch (e) {
    console.error('[TransferService] Ethereum transaction details fetch error:', e);
    return { status: 'failed', reason: 'Network error fetching Ethereum transaction details.' };
  }
  const tx = txResJson?.result;

  if (!tx) return {status:'failed',reason:'Could not retrieve Ethereum transaction details.'};

  const wei = BigInt(tx.value || '0');
  const eth = (Number(wei) / 1e18).toFixed(6); // Keep more precision if desired
  // Get timestamp from block
  let dateString = '—';
  if (tx.blockNumber) {
    const blockURL = `${base}?module=proxy&action=eth_getBlockByNumber&tag=${tx.blockNumber}&boolean=false&apikey=${ETHERSCAN_KEY}`;
    try {
      const blockResJson = await fetch(blockURL).then(r => r.json());
      if (blockResJson?.result?.timestamp) {
        dateString = new Date(parseInt(blockResJson.result.timestamp, 16) * 1000).toLocaleString();
      }
    } catch (e) { console.error('[TransferService] Ethereum block timestamp fetch error:', e); }
  }


  return {
    status:'completed', // Use 'completed' for consistency with main.js expectation
    amount: eth, // main.js will append currency
    currency:'ETH',
    valueDate: dateString, // Use valueDate
    from: tx.from ?? '—',
    to:   tx.to   ?? '—',
    transactionID:txHash,
    // rawValue can be populated more extensively if needed for ETH
    rawValue: { 
        from: tx.from, 
        to: tx.to,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed ? parseInt(tx.gasUsed, 16).toString() : undefined
    }
  };
}

async function fetchEthereumWallet(address) {
  if (!ETHERSCAN_KEY) return { status: "failed", reason: "Ethereum wallet lookup unavailable (no API key)." };

  const balanceUrl = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_KEY}`;
  const txUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&page=1&offset=5&sort=desc&apikey=${ETHERSCAN_KEY}`;

  try {
    const [balRes, txRes] = await Promise.all([
      fetch(balanceUrl).then(r => r.json()),
      fetch(txUrl).then(r => r.json())
    ]);

    const balanceWei = BigInt(balRes.result || '0');
    const balanceEth = Number(balanceWei) / 1e18;

    return {
      status: "info",
      amount: balanceEth.toFixed(6),
      currency: "ETH",
      transactionID: address,
      valueDate: new Date().toLocaleString(),
      remittanceInfo: "Wallet balance (ETH)",
      rawValue: {
        balanceWei: balanceWei.toString(),
        last5Tx: txRes.result || []
      }
    };
  } catch (e) {
    console.error("[fetchEthereumWallet] Error:", e);
    return { status: "failed", reason: "Error fetching Ethereum wallet details." };
  }
}

async function fetchBitcoinWallet(address) {
  const url = `https://api.blockcypher.com/v1/btc/main/addrs/${address}/full${BLOCKCYPHER_KEY ? `?token=${BLOCKCYPHER_KEY}` : ''}`;

  try {
    const d = await fetch(url).then(r => r.json());
    const balanceBtc = (d.final_balance || 0) / 1e8;

    return {
      status: "info",
      amount: balanceBtc.toFixed(8),
      currency: "BTC",
      transactionID: address,
      valueDate: new Date().toLocaleString(),
      remittanceInfo: "Wallet balance (BTC)",
      rawValue: {
        n_tx: d.n_tx,
        total_received: (d.total_received / 1e8).toFixed(8),
        total_sent: (d.total_sent / 1e8).toFixed(8),
        lastTxs: d.txs?.slice(0, 5) || []
      }
    };
  } catch (e) {
    console.error("[fetchBitcoinWallet] Error:", e);
    return { status: "failed", reason: "Error fetching Bitcoin wallet details." };
  }
}

async function fetchTronWallet(address) {
  const headers = TRONSCAN_KEY ? { "TRON-PRO-API-KEY": TRONSCAN_KEY } : {};
  const accUrl = `${TRON_API}/api/accountv2?address=${address}`;

  try {
    const acc = await fetch(accUrl, { headers }).then(r => r.json());
    const balanceSun = acc?.data?.[0]?.balance || 0;
    const balanceTrx = (Number(balanceSun) / 1e6).toFixed(6);

    // Try to fetch last TRC-20 tx for context
    const txResult = await fetchTronAddress(address);

    return {
      status: "info",
      amount: balanceTrx,
      currency: "TRX",
      transactionID: address,
      valueDate: new Date().toLocaleString(),
      remittanceInfo: "Wallet balance (TRX)",
      rawValue: {
        balanceSun,
        latestTransfer: txResult.rawValue || txResult
      }
    };
  } catch (e) {
    console.error("[fetchTronWallet] Error:", e);
    return { status: "failed", reason: "Error fetching Tron wallet details." };
  }
}



async function fetchBitcoin(txHash) {
  const url = `https://api.blockcypher.com/v1/btc/main/txs/${txHash}` +
              (BLOCKCYPHER_KEY ? `?token=${BLOCKCYPHER_KEY}` : '');
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    console.error('[TransferService] Bitcoin fetch error (network):', e);
    return { status: 'failed', reason: 'Network error fetching Bitcoin transaction.' };
  }

  if (!res.ok) {
    let errorReason = 'Bitcoin tx not found.';
    try {
        const errorData = await res.json();
        if (errorData && errorData.error) {
            errorReason = `Bitcoin lookup failed: ${errorData.error}`;
        }
    } catch (jsonError) { /* Ignore */ }
    return {status:'failed', reason: errorReason};
  }

  const d = await res.json();
  const btc = (d.total/1e8).toFixed(8);
  const dateString = d.received ? new Date(d.received).toLocaleString() : '—';

  const baseReturn = {
    amount: btc, // main.js appends currency
    currency: 'BTC',
    valueDate: dateString,
    from: d.inputs?.[0]?.addresses?.[0]  ?? '—',
    to:   d.outputs?.[0]?.addresses?.[0] ?? '—',
    transactionID:txHash,
    rawValue: {
        confirmations: d.confirmations,
        fees: (d.fees / 1e8).toFixed(8) + ' BTC',
        inputs: d.inputs?.map(inp => inp.addresses?.join(', ') || 'Unknown Input').join('; '),
        outputs: d.outputs?.map(out => `${out.addresses?.join(', ') || 'Unknown Output'}: ${(out.value/1e8).toFixed(8)} BTC`).join('; ')
    }
  };

  return d.confirmations >= 6 ? // Common confirmation threshold for BTC
    { ...baseReturn, status:'completed' } :
    { ...baseReturn, status:'pending', reason: `Awaiting confirmations (${d.confirmations || 0} so far)` };
}

async function fetchTronAddress(addr) {
  const url = `${TRON_API}/api/token_trc20/transfers?address=${addr}&limit=1&sort=-timestamp`;
  const headers = TRONSCAN_KEY ? { 'TRON-PRO-API-KEY': TRONSCAN_KEY } : {};

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (e) {
    console.error('[TransferService] Tron address fetch error (network):', e);
    return { status: 'failed', reason: 'Network error fetching Tron address transactions.' };
  }

  if (!res.ok) {
    let reason = 'Tron address lookup error.';
    try {
      const errorData = await res.json();
      if (errorData && (errorData.message || errorData.error)) {
        reason = `Tron address error: ${errorData.message || errorData.error}`;
      }
    } catch (jsonError) { /* Ignore */ }
    return { status: 'failed', reason };
  }

  const json = await res.json();
  const transfers = json.data?.length ? json.data : (json.token_transfers?.length ? json.token_transfers : []);

  if (!transfers.length) {
    console.warn(`[TransferService] No TRC20 transfers found for address ${addr}. Other transaction types not yet fully supported for address lookup.`);
    return { status: 'failed', reason: 'No TRC-20 transfers found for this address via this lookup.' };
  }

  const txHash = transfers[0].transaction_id;
  if (!txHash) {
    return { status: 'failed', reason: 'No transaction hash found in latest TRC-20 transfer data.' };
  }

  return fetchTron(txHash); // This will return a normalized structure
}

async function fetchTron(txId) {
  const headers = TRONSCAN_KEY ? { 'TRON-PRO-API-KEY': TRONSCAN_KEY } : {};
  const url     = `${TRON_API}/api/transaction-info?hash=${txId}`;

  const res = await fetch(url, { headers }).catch(() => null);
  if (!res || !res.ok) {
    let reason = 'TRON tx not found or API error.';
    if (res) {
        try {
            const errorData = await res.json();
            reason = errorData.message || errorData.error || `TRON API Error ${res.status}`;
        } catch (e) { /* ignore */ }
    }
    return { status: 'failed', reason, transactionID: txId };
  }

  const d = await res.json();
  if (!d || !d.hash) {
    return { status: 'failed', reason: 'TRON tx empty or invalid response.', transactionID: txId };
  }

  let amountVal = '0';
  let currency  = 'TRX';
  let fromAddr  = d.ownerAddress ?? d.trigger_info?.owner_address ?? '—';
  let toAddr    = d.toAddress    ?? d.trigger_info?.to_address   ?? d.trigger_info?.contract_address ?? '—';

  const TronWebGlobal = typeof TronWeb !== 'undefined' ? TronWeb : null;

  if (d.trc20TransferInfo && d.trc20TransferInfo.length > 0) {
    const transferInfo = d.trc20TransferInfo[0];
    const rawAmountStr = transferInfo.amount_str || '0';
    const decimals = Number(transferInfo.decimals || 6); // Default to 6 for common tokens like USDT
    const symbol = (transferInfo.symbol || 'TOKEN').toUpperCase();

    amountVal = (Number(BigInt(rawAmountStr)) / (10 ** decimals)).toFixed(decimals);
    currency = symbol;
    fromAddr = transferInfo.from_address || fromAddr;
    toAddr = transferInfo.to_address || toAddr;
  }
  else if (d.trigger_info?.methodName && d.trigger_info?.parameter && d.tokenInfo) {
    const methodName = d.trigger_info.methodName.toLowerCase();
    let rawAmountFromParam = null;
    if ((methodName === 'transfer' || methodName === 'approve') && typeof d.trigger_info.parameter._value !== 'undefined') {
        rawAmountFromParam = d.trigger_info.parameter._value;
    } else if (methodName === 'transferfrom' && typeof d.trigger_info.parameter._amount !== 'undefined') {
        rawAmountFromParam = d.trigger_info.parameter._amount;
    }

    if (rawAmountFromParam !== null) {
        const rawAmount = BigInt(String(rawAmountFromParam));
        const tokenDetails = d.tokenInfo;
        const decimals = Number(tokenDetails?.tokenDecimal ?? tokenDetails?.decimals ?? 6);
        const symbol   = (tokenDetails?.tokenAbbr ?? tokenDetails?.symbol ?? 'TOKEN').toUpperCase();
        amountVal = (Number(rawAmount) / (10 ** decimals)).toFixed(decimals);
        currency  = symbol;
        if (methodName === 'transfer' && d.trigger_info.parameter._to) {
            const recipientHex = d.trigger_info.parameter._to;
            if (TronWebGlobal) {
                try { toAddr = TronWebGlobal.address.fromHex(recipientHex); }
                catch (e) { toAddr = recipientHex; }
            } else { toAddr = recipientHex; }
        }
    }
  }
  else if (d.contractData?.amount || typeof d.amount !== 'undefined') {
    const trxAmount = BigInt(d.contractData?.amount ?? d.amount ?? '0');
    amountVal = (Number(trxAmount) / 1e6).toFixed(6); // TRX has 6 decimals (SUN)
    currency  = 'TRX';
    if (d.contractData?.to_address && TronWebGlobal) {
      try { toAddr = TronWebGlobal.address.fromHex(d.contractData.to_address); }
      catch (e) { toAddr = d.contractData.to_address; }
    } else if (d.contractData?.to_address) {
        toAddr = d.contractData.to_address;
    }
  }

  const dateStr   = d.timestamp ? new Date(d.timestamp).toLocaleString() : '—';
  const isReverted = d.contractRet === 'REVERT';
  const isSuccess  = d.contractRet === 'SUCCESS' || (d.confirmed && d.block > 0 && !isReverted);

  const baseReturn = {
    amount: amountVal, // main.js appends currency
    currency: currency,
    valueDate: dateStr,
    from: fromAddr,
    to: toAddr,
    transactionID: txId,
    rawValue: { // Populate rawValue for Tron transactions too
        contractReturn: d.contractRet,
        confirmed: d.confirmed,
        block: d.block,
        ownerAddress: d.ownerAddress,
        toAddress: d.toAddress,
        contractData: d.contractData, // Can be large
        methodName: d.trigger_info?.methodName
    }
  };

  if (isReverted) {
    return {
        ...baseReturn,
        status: 'failed',
        reason: `Tron transaction reverted: ${d.resMessage || 'Contract execution failed.'}`.trim(),
    };
  }

  return isSuccess
    ? { ...baseReturn, status:'completed' }
    : { ...baseReturn, status:'pending', reason:'Awaiting block confirmation or successful execution' };
}


/* ---------- Public Function (Updated Switch Logic) ------------------- */
export async function fetchTransferData(reference) {
  await new Promise(r => setTimeout(r, 150)); // Simulate slight network delay

  if (!reference || typeof reference !== 'string' || reference.trim() === '') {
    return {
      status: 'failed',
      reason: 'No reference provided.',
    };
  }

  const cleanedReference = reference.trim();
  const type = detectType(cleanedReference);

  try {
    switch (type) {
      // ───── Wallet address lookups ─────
      case 'ethWallet':
        return await fetchEthereumWallet(cleanedReference);

      case 'btcWallet':
        return await fetchBitcoinWallet(cleanedReference);

      case 'tronWallet':
        return await fetchTronWallet(cleanedReference);

      // ───── Blockchain transaction hash lookups ─────
      case 'ethereum':
        return await fetchEthereum(cleanedReference);

      case 'tronAddr':
        return await fetchTronAddress(cleanedReference);

      case 'hex64': {
        // Try TRON first; fallback to Bitcoin if TRON fails definitively
        const tronRes = await fetchTron(cleanedReference);

        if (['completed', 'pending'].includes(tronRes.status)) {
          return tronRes;
        }

        const tronError = tronRes.reason?.toLowerCase() || '';
        const shouldTryBitcoin = tronError.includes('not found') ||
                                 tronError.includes('invalid') ||
                                 tronError.includes('api error') ||
                                 tronError.includes('empty');

        if (shouldTryBitcoin) {
          console.warn(`[TransferService] Tron failed, trying BTC: ${tronRes.reason}`);
          return await fetchBitcoin(cleanedReference);
        }

        return tronRes; // fallback to TRON error
      }

      // ───── Bank mock database (TRN / UETR) ─────
      case 'bankMock': {
        const entry = bankMockDB[cleanedReference.toUpperCase()];
        if (!entry) {
          return {
            status: 'failed',
            reason: `Bank reference '${cleanedReference}' not found in mock DB.`,
            transactionID: cleanedReference,
          };
        }
        return normalizeBankMockEntry(entry, cleanedReference);
      }

      // ───── Unknown input ─────
      default:
        return {
          status: 'failed',
          reason: `Reference type for '${cleanedReference}' is not recognized.`,
          transactionID: cleanedReference,
        };
    }
  } catch (err) {
    console.error('[TransferService] General error during fetchTransferData:', err);
    return {
      status: 'failed',
      reason: 'Internal processing error. Please try again later.',
      transactionID: cleanedReference,
    };
  }
}
export { detectType };   // ✨ simply re-export, no other code touched

