---
name: testing-crypto-simulator
description: Test the Bitcoin & Ethereum blockchain simulator end-to-end. Use when verifying blockchain logic, transaction processing, smart contract, or CLI changes.
---

# Testing the Crypto Simulator

## Quick Start

```bash
cd /home/ubuntu/repos/Bitcoin-Etherium-Simulator
npm install
node src/test.js   # 14 unit tests
node src/demo.js   # Full BTC + ETH + ERC-20 + DEX demo
```

## App Structure

- **CLI-only app** — no web UI, no browser testing needed
- `src/index.js` — Interactive CLI (readline-based REPL)
- `src/demo.js` — Non-interactive full demo script
- `src/test.js` — Unit test suite (custom test runner, not Jest)
- `src/bitcoin/` — Bitcoin blockchain, wallet, transaction, block
- `src/ethereum/` — Ethereum blockchain, wallet, transaction, block, smart contracts

## Test Commands

| Command | What it tests |
|---------|---------------|
| `node src/test.js` | Unit tests: wallets, mining, transfers, nonces, ERC-20, chain validation |
| `node src/demo.js` | Integration: full BTC + ETH workflow including DEX swap |
| `node src/index.js` | Interactive CLI — use for manual testing |

## CLI Commands (for interactive testing via `node src/index.js`)

```
btc wallet <name>             Create BTC wallet
btc mine <miner>              Mine BTC block
btc send <from> <to> <amt>    Send BTC
btc status                    Show BTC chain info

eth wallet <name>             Create ETH wallet
eth faucet <name> <amt>       Fund ETH wallet (test ETH)
eth mine <miner>              Mine ETH block
eth send <from> <to> <amt>    Send ETH
eth erc20 <deployer> <name> <symbol> <supply>  Deploy ERC-20
eth status                    Show ETH chain info
```

## Key Test Scenarios for Adversarial Testing

When writing adversarial tests, import modules directly and test programmatically:

```javascript
const BitcoinBlockchain = require('./bitcoin/Blockchain');
const EthereumBlockchain = require('./ethereum/Blockchain');
// etc.
```

### Bitcoin
- **Double-spend in mempool**: Create two txs spending same UTXOs, second should throw "already spent by pending transaction"
- **Coinbase txid stability**: After mining with fees, `coinbase._computeTxid()` should produce same hash (txid computed after fee inclusion)
- **Double-spend in block**: `_applyBlock` skips txs with already-spent UTXOs

### Ethereum
- **Cumulative balance check**: Queue multiple zero-value txs from same sender; each costs ~0.00042 ETH gas. Third tx should fail if balance < cumulative cost
- **Pending nonce ordering**: `getPendingNonce()` returns `confirmedNonce + pendingMempoolCount`. Queue multiple txs and verify sequential nonces are accepted, wrong nonces rejected
- **Multi-pass tx selection**: Create tx0 (low gas) and tx1 (high gas) from same sender. Gas-price sort puts tx1 first but nonce ordering requires tx0 first. The `mineBlock` multi-pass loop should include both
- **Contract deploy + call nonces**: `deployContract()` and `callContract()` both use `getPendingNonce()`. Queue multiple calls without mining between them to verify nonce sequencing

## Important Caveats

- `contractAddress` is only set on a transaction object during block execution (`_deployContract`), NOT at creation time. You must mine a block after deploying before you can reference `deployTx.contractAddress`.
- The `demo.js` uses `getNonce()` (confirmed only) for its first tx from each sender — this works because it's the first tx. For multiple queued txs, always use `getPendingNonce()`.
- Gas price is in Gwei; gas cost in ETH = `gasPrice * gasUsed / 1e9`.
- All tests are synchronous despite `demo.js` being async (mining is CPU-bound).

## Devin Secrets Needed

None — this is a standalone simulator with no external dependencies or APIs.
