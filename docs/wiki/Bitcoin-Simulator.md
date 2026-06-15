# Bitcoin Simulator

## Overview

The Bitcoin simulator implements the core mechanics of Bitcoin: a UTXO-based ledger secured by Proof-of-Work, where ownership of coins is proven by digital signatures.

## Wallets (`src/bitcoin/Wallet.js`)

Each wallet is a secp256k1 key pair with a derived Bitcoin-style address.

```js
const BitcoinWallet = require('./src/bitcoin/Wallet');

const alice = new BitcoinWallet();
console.log(alice.address);    // 1Abc...  (Base58Check)
console.log(alice.publicKey);  // 04ab...  (uncompressed)
console.log(alice.privateKey); // hex string
```

**Address derivation:**
1. Generate secp256k1 key pair
2. Double-SHA256 the public key
3. Prepend version byte (`1`)
4. Append 4-byte checksum (first 4 bytes of SHA256d of the hash)
5. Encode in Base58

## Transactions (`src/bitcoin/Transaction.js`)

Bitcoin uses the **Unspent Transaction Output (UTXO)** model. Every coin is tracked as an output of a previous transaction. To spend, you reference those outputs as inputs and create new outputs.

### Creating a Transaction

```js
const { BitcoinTransaction } = require('./src/bitcoin/Transaction');

const tx = new BitcoinTransaction();

// Reference UTXOs you want to spend
tx.addInput(utxo.txid, utxo.outputIndex, sender.publicKey);

// Define where coins go
tx.addOutput(recipientAddress, 5.0);   // to recipient
tx.addOutput(senderAddress, 4.9999);   // change back to yourself

// Sign all inputs with your private key
tx.signInputs(sender.privateKey);
```

### UTXO Set

The blockchain maintains a UTXO set — a map of all unspent outputs:

```
key:   "txid:outputIndex"
value: UTXO { txid, outputIndex, address, amount, spent }
```

When a transaction is mined, its inputs are marked spent and its outputs are added as new UTXOs.

### Validation

Before a transaction enters the mempool, it is validated:
- Each input references an unspent UTXO
- The ECDSA signature over the inputs/outputs is valid
- Total output ≤ total input (difference = fee)

### Coinbase Transactions

The first transaction in every block is a coinbase — it has no inputs and creates new coins equal to the block reward plus all transaction fees.

## Blocks (`src/bitcoin/Block.js`)

A Bitcoin block contains:

| Field | Description |
|-------|-------------|
| `index` | Block height |
| `previousHash` | Hash of the previous block (links the chain) |
| `merkleRoot` | Root of the Merkle tree over all transaction IDs |
| `timestamp` | Unix timestamp |
| `difficulty` | Number of leading zeros required in the hash |
| `nonce` | The value incremented during mining |
| `hash` | SHA-256d of all block header fields |

### Mining (Proof-of-Work)

```js
block.mine();
// Increments nonce until hash starts with '0'.repeat(difficulty)
```

The difficulty is currently set to **4** (the hash must start with `0000`). A real Bitcoin block at today's difficulty would require ~19 leading zeros in the hash.

## Blockchain (`src/bitcoin/Blockchain.js`)

### API

```js
const BitcoinBlockchain = require('./src/bitcoin/Blockchain');
const btc = new BitcoinBlockchain();

// Mine a block (awards block reward to miner)
const block = btc.mineBlock(minerAddress);

// Submit a signed transaction to the mempool
const txid = btc.addToMempool(signedTx);

// Get balance for an address
const balance = btc.getBalance(address);  // BTC

// Get all spendable UTXOs for an address
const utxos = btc.getUTXOsForAddress(address);

// Validate the entire chain
const valid = btc.isChainValid();

// Chain statistics
const stats = btc.getStats();
// { height, difficulty, mempoolSize, utxoCount, totalSupply, isValid }
```

### Block Reward Schedule

| Blocks mined | Reward per block |
|-------------|-----------------|
| 0 – 209,999 | 50 BTC |
| 210,000 – 419,999 | 25 BTC |
| 420,000 – 629,999 | 12.5 BTC |
| … | … |

```js
btc.blockReward(blockIndex)  // returns the reward for a given block height
```

### Difficulty Adjustment

Every 2,016 blocks the difficulty adjusts to target a 10-minute block time (just like real Bitcoin). In this simulator, with CPU-level PoW, adjustment is simulated but the target times don't match real-world values.

## Flow Diagram

```
[Create Wallet] → generate key pair → derive address
       ↓
[Mine Block]    → coinbase tx (new BTC) → add to chain → update UTXO set
       ↓
[Send BTC]      → pick UTXOs → build tx → sign → mempool
       ↓
[Mine Block]    → pick mempool txs → mine PoW → apply UTXOs → confirm
```
