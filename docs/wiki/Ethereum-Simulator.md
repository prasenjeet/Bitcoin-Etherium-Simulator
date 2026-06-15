# Ethereum Simulator

## Overview

The Ethereum simulator implements Ethereum's account-based ledger with gas metering, nonce-based replay protection, and a smart contract execution engine.

## Wallets (`src/ethereum/Wallet.js`)

Ethereum wallets are secp256k1 key pairs whose addresses are derived from the public key via Keccak-256.

```js
const EthereumWallet = require('./src/ethereum/Wallet');

const alice = new EthereumWallet();
console.log(alice.address);    // 0xAbc...  (EIP-55 checksum)
console.log(alice.privateKey); // 64-char hex
console.log(alice.publicKey);  // 130-char uncompressed point
```

**Address derivation:**
1. Generate secp256k1 key pair
2. Remove the `04` prefix from the uncompressed public key
3. Keccak-256 hash the remaining 64 bytes
4. Take the last 20 bytes (40 hex chars) → raw address
5. Apply EIP-55 checksum capitalisation

## Accounts

Unlike Bitcoin's UTXO model, Ethereum tracks each address as an **account** with:

```
{ balance: <ETH amount>, nonce: <tx count> }
```

The nonce prevents replay attacks — every transaction must use the sender's current nonce and increments it upon execution.

## Transactions (`src/ethereum/Transaction.js`)

```js
const EthereumTransaction = require('./src/ethereum/Transaction');

const tx = new EthereumTransaction({
  from:     alice.address,
  to:       bob.address,
  value:    5,             // ETH to send
  gasPrice: 20,            // Gwei per gas unit
  gasLimit: 21000,         // max gas this tx may consume
  nonce:    eth.getNonce(alice.address),
  data:     null,          // null for plain ETH transfers
});
tx.sign(alice.privateKey, alice.publicKey);
```

### Transaction Types

| `to` | `data` | Type |
|------|--------|------|
| address | `null` | Plain ETH transfer |
| `null` | contract spec | Contract deployment |
| contract address | call data | Contract method call |

### Gas

Gas is the fee mechanism. Each operation costs a fixed amount of gas:

| Operation | Gas cost |
|-----------|----------|
| ETH transfer | 21,000 |
| Contract deployment | 200,000 |
| Contract method call | 50,000 |

**Fee formula:**
```
fee (ETH) = gasPrice (Gwei) × gasUsed / 1,000,000,000
```

At `gasPrice = 20 Gwei` and `21,000` gas used:
```
fee = 20 × 21,000 / 1e9 = 0.00042 ETH
```

### Mempool Validation

Before entering the mempool a transaction must satisfy:
- Valid ECDSA signature
- `nonce === sender's current nonce`
- `sender.balance >= value + gasPrice * gasLimit / 1e9`

## Blocks (`src/ethereum/Block.js`)

| Field | Description |
|-------|-------------|
| `index` | Block number |
| `parentHash` | Hash of the parent block |
| `transactionsRoot` | Merkle root of tx hashes |
| `miner` | Address receiving the block reward |
| `difficulty` | Leading zeros required in hash |
| `gasLimit` | Max cumulative gas per block (30,000,000) |
| `gasUsed` | Actual gas used by all included txs |
| `baseFeePerGas` | EIP-1559 style base fee (simplified) |
| `nonce` | PoW nonce |
| `hash` | Keccak-256 of header fields |

## Blockchain (`src/ethereum/Blockchain.js`)

### API

```js
const EthereumBlockchain = require('./src/ethereum/Blockchain');
const eth = new EthereumBlockchain();

// Fund an account directly (simulates faucet / genesis allocation)
eth.getAccount(address).balance = 100;

// Get balance / nonce
eth.getBalance(address);
eth.getNonce(address);

// Submit a signed transaction to the mempool
eth.addToMempool(signedTx);

// Mine a block (executes mempool txs, awards 2 ETH reward to miner)
const { block, receipts } = eth.mineBlock(minerAddress);

// Deploy a contract (returns a tx you must submit to mempool)
const deployTx = eth.deployContract(contractSpec, deployerWallet);

// Call a contract method (returns a tx you must submit to mempool)
const callTx = eth.callContract(contractAddress, method, args, callerWallet, value);

// Validate chain integrity
eth.isChainValid();

// Statistics
eth.getStats();
// { height, difficulty, mempoolSize, accounts, contracts, totalSupply, isValid }
```

### Transaction Lifecycle

```
Sign tx → addToMempool → validate sig + nonce + balance
       → mineBlock → execute each tx in gas-price order
       → on success: transfer value, update state, deduct gas fee, increment nonce
       → on failure: revert state changes, still deduct gas fee, increment nonce
       → return receipt { txHash, status, gasUsed, events, error }
```

### Block Reward

Each mined block awards the miner **2 ETH** plus the sum of all transaction fees included in that block.
