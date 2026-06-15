# Getting Started

## Prerequisites

- Node.js 16 or higher
- npm 7 or higher

Check your versions:
```bash
node --version
npm --version
```

## Installation

```bash
git clone https://github.com/prasenjeet/Bitcoin-Etherium-Simulator
cd Bitcoin-Etherium-Simulator
npm install
```

The project has three runtime dependencies:

| Package | Purpose |
|---------|---------|
| `elliptic` | secp256k1 ECDSA key generation and signing |
| `js-sha256` | SHA-256 hashing |
| `js-sha3` | Keccak-256 hashing (Ethereum) |

## Running the Demo

The demo runs a complete walkthrough of both chains — wallet creation, mining, transfers, ERC-20 deployment, DEX liquidity, and swaps:

```bash
npm run demo
```

Expected output (abbreviated):

```
──────────────────────────────────────────────────────────
  BITCOIN SIMULATOR
──────────────────────────────────────────────────────────

[1] Creating wallets...
  Alice : 12iLZf4PBaWHVMgR...
  Bob   : 1NRvvkNt5HXU...
  Miner : 12toy86qTpN...

[2] Mining block #1 (miner earns 50 BTC block reward)...
  Block #1 mined! Hash: 0000d4125685dc97a8...
  Nonce: 30326 | Time: 132ms
  Miner balance: 50 BTC
...
```

## Running the Tests

```bash
npm test
```

14 tests cover wallet creation, mining, UTXO transactions, double-spend prevention, chain validation, ERC-20 deploy/transfer/failure, and nonce replay protection.

## Interactive CLI

```bash
npm start
```

Type `help` at the prompt to see all available commands. See the [CLI Reference](CLI-Reference) page for the full guide.

## Project Layout

```
src/
├── bitcoin/         Bitcoin chain modules
├── ethereum/        Ethereum chain modules
├── utils/           Shared crypto utilities
├── demo.js          Automated demo script
├── test.js          Unit tests
└── index.js         Interactive CLI entry point
```
