// /scripts/api/chains/evm.test.ts
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { rest } from 'msw';
import { setupServer } from 'msw/node'; // or browser setup if applicable
import { fetchEvmTx } from './evm';
import { ENV } from '../utils/http'; // To access API keys for URLs

// Mock API responses
const mockEtherscanReceiptSuccess = { status: "1", message: "OK", result: { status: "1" } };
const mockEtherscanTxDetails = {
    jsonrpc: "2.0",
    id: 1,
    result: {
        blockHash: "0x...",
        blockNumber: "0xaf319a", // 11481498
        from: "0xfromAddress",
        to: "0xtoAddress",
        value: "0xde0b6b3a7640000", // 1 ETH
        gasPrice: "0x4a817c800",
        gasUsed: "0x5208", // This would be in receipt usually, proxy tx doesn't have it.
        // ... other fields
        hash: "0xknownEthTxHash"
    }
};

const server = setupServer(
  rest.get('https://api.etherscan.io/api', (req, res, ctx) => {
    const txhash = req.url.searchParams.get('txhash');
    const module = req.url.searchParams.get('module');
    const action = req.url.searchParams.get('action');

    if (module === 'transaction' && action === 'gettxreceiptstatus' && txhash === '0xknownEthTxHash') {
      return res(ctx.json(mockEtherscanReceiptSuccess));
    }
    if (module === 'proxy' && action === 'eth_getTransactionByHash' && txhash === '0xknownEthTxHash') {
      return res(ctx.json(mockEtherscanTxDetails));
    }
    return res(ctx.status(404), ctx.json({ message: 'Not Mocked' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock VITE_ETHERSCAN_KEY
process.env.VITE_ETHERSCAN_KEY = 'test_key';


describe('fetchEvmTx - Ethereum', () => {
  it('should return success for a known Ethereum transaction', async () => {
    const result = await fetchEvmTx('0xknownEthTxHash', 'ethereum');
    expect(result.status).toBe('success');
    expect(result.chain).toBe('ethereum');
    expect(result.transactionID).toBe('0xknownEthTxHash');
    // Add more specific assertions based on your normalization
    if (result.status === 'success' && result.transactionType === 'NATIVE_TRANSFER') {
         expect(result.from[0].address).toBe('0xfromAddress');
         expect(result.to[0].address).toBe('0xtoAddress');
         expect(result.from[0].amount).toBe('1.000000000000000000'); // 18 decimal places for ETH
         expect(result.from[0].symbol).toBe('ETH');
    } else {
        throw new Error("Transaction was not a successful native transfer as expected");
    }
  });
});
