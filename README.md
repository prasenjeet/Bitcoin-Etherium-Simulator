# Bitcoin & Ethereum Simulator

A Node.js project that simulates core Bitcoin and Ethereum blockchain functionality — wallets, transactions, mining, smart contracts, ERC-20 tokens, and a constant-product DEX — all implemented from scratch without any real blockchain library.

## Features

### Bitcoin
- **ECDSA wallets** with secp256k1 key pairs and Base58Check addresses
- **UTXO model** — unspent transaction output tracking
- **Proof-of-Work mining** with SHA-256d and adjustable difficulty
- **Transaction validation** — signature verification, double-spend prevention, fee calculation
- **Merkle tree** for transaction root hashing
- **Block reward halving** every 210,000 blocks

### Ethereum
- **ECDSA wallets** with keccak256-derived checksummed addresses
- **Account model** with nonce-based replay protection
- **Smart contract engine** — deploy and call contracts in pure JS
- **ERC-20 token** — transfer, approve, transferFrom, mint, burn
- **Constant-product AMM DEX** (Uniswap-style) — add liquidity, swap A↔B
- **Gas metering** — Gwei-based pricing, per-block gas limit
- **Transaction receipts** with event logs

## Project Structure

```
src/
├── bitcoin/
│   ├── Wallet.js        # Key generation, Base58Check addressing
│   ├── Transaction.js   # UTXO inputs/outputs, signing, validation
│   ├── Block.js         # PoW mining, Merkle root, hash validation
│   └── Blockchain.js    # Chain state, UTXO set, mempool, difficulty adjustment
├── ethereum/
│   ├── Wallet.js        # secp256k1 keys, EIP-55 checksum addresses
│   ├── Transaction.js   # Signed tx with gas, nonce, contract data
│   ├── Block.js         # PoW block with gas tracking
│   ├── SmartContract.js # Contract execution engine, ERC-20, DEX templates
│   └── Blockchain.js    # Account state, contract registry, tx execution
├── utils/
│   ├── crypto.js        # SHA-256, keccak256, ECDSA sign/verify
│   └── merkle.js        # Merkle tree builder
├── demo.js              # Full walkthrough of both chains
├── test.js              # 14 unit tests
└── index.js             # Interactive CLI
```

## Quick Start

```bash
npm install

# Run the full demo (Bitcoin + Ethereum flows)
npm run demo

# Run unit tests
npm test

# Interactive CLI
npm start
```

## Interactive CLI

```
btc wallet <name>              Create a Bitcoin wallet
btc mine <miner>               Mine a Bitcoin block
btc send <from> <to> <amount>  Submit a BTC transaction
btc status                     Show chain stats and balances

eth wallet <name>              Create an Ethereum wallet
eth faucet <name> <amount>     Fund a wallet with test ETH
eth mine <miner>               Mine an Ethereum block
eth send <from> <to> <amount>  Submit an ETH transfer
eth erc20 <deployer> <name> <symbol> <supply>
                               Deploy an ERC-20 token contract
eth status                     Show chain stats and contracts
```

## Example Session

```
> btc wallet alice
> btc wallet miner
> btc mine miner
> btc send miner alice 10
> btc mine miner
> btc status

> eth wallet alice
> eth faucet alice 100
> eth wallet bob
> eth mine miner
> eth send alice bob 10
> eth mine miner
> eth status
```

## Concepts Demonstrated

| Concept | Where |
|---------|-------|
| SHA-256d hashing | `utils/crypto.js`, `bitcoin/Block.js` |
| Keccak-256 hashing | `utils/crypto.js`, `ethereum/Wallet.js` |
| secp256k1 ECDSA signing | `utils/crypto.js` |
| Base58Check encoding | `bitcoin/Wallet.js` |
| EIP-55 checksum address | `ethereum/Wallet.js` |
| Merkle tree | `utils/merkle.js` |
| UTXO model | `bitcoin/Transaction.js`, `bitcoin/Blockchain.js` |
| Account/nonce model | `ethereum/Blockchain.js` |
| Proof-of-Work | `bitcoin/Block.js`, `ethereum/Block.js` |
| Block reward halving | `bitcoin/Blockchain.js` |
| Smart contract dispatch | `ethereum/SmartContract.js` |
| ERC-20 token standard | `ethereum/SmartContract.js` |
| Constant-product AMM | `ethereum/SmartContract.js` |
| Gas metering (Gwei to ETH) | `ethereum/Blockchain.js` |
