# Bitcoin & Ethereum Simulator — Wiki

Welcome to the wiki for the **Bitcoin & Ethereum Simulator**, a Node.js project that simulates core blockchain functionality from scratch — no external blockchain libraries required.

## Table of Contents

| Page | Description |
|------|-------------|
| [Home](Home) | This page |
| [Getting Started](Getting-Started) | Installation, setup, and your first run |
| [Bitcoin Simulator](Bitcoin-Simulator) | UTXO model, wallets, mining, transactions |
| [Ethereum Simulator](Ethereum-Simulator) | Account model, wallets, gas, transaction lifecycle |
| [Smart Contracts](Smart-Contracts) | Contract engine, ERC-20 token, DEX |
| [CLI Reference](CLI-Reference) | Interactive command-line interface guide |
| [Architecture](Architecture) | Project structure and design decisions |
| [Cryptography](Cryptography) | Keys, hashing, signatures, addresses |

## Overview

This simulator models two major blockchain networks side-by-side so you can compare their fundamentals:

```
Bitcoin                          Ethereum
───────────────────────────────  ──────────────────────────────────
UTXO model                       Account/balance model
SHA-256d Proof-of-Work           Keccak-256 Proof-of-Work
Base58Check addresses (1...)     Checksummed hex addresses (0x...)
Block reward + halving           Block reward (fixed in this sim)
No native smart contracts        Smart contract engine + ERC-20/DEX
```

## Quick Start

```bash
git clone https://github.com/prasenjeet/Bitcoin-Etherium-Simulator
cd Bitcoin-Etherium-Simulator
npm install
npm run demo      # full demo
npm test          # 14 unit tests
npm start         # interactive CLI
```
