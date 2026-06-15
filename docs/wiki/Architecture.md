# Architecture

## Project Structure

```
src/
├── bitcoin/
│   ├── Wallet.js        Key generation & Base58Check address derivation
│   ├── Transaction.js   UTXO inputs/outputs, signing, validation
│   ├── Block.js         PoW mining, Merkle root, hash validation
│   └── Blockchain.js    UTXO set, mempool, chain, difficulty adjustment
│
├── ethereum/
│   ├── Wallet.js        Key generation & EIP-55 checksum address derivation
│   ├── Transaction.js   Signed tx with gas, nonce, ABI call data
│   ├── Block.js         Keccak-256 PoW block, gas accounting
│   ├── SmartContract.js Execution context, ERC-20 template, DEX template
│   └── Blockchain.js    Account state, contract registry, gas metering
│
├── utils/
│   ├── crypto.js        SHA-256d, Keccak-256, secp256k1 sign/verify, key gen
│   └── merkle.js        Binary Merkle tree builder
│
├── demo.js              Automated walkthrough of both chains
├── test.js              14 unit tests (no external test framework)
└── index.js             Interactive CLI (readline-based)
```

## Module Dependency Graph

```
index.js / demo.js / test.js
    │
    ├── bitcoin/Blockchain.js ──► bitcoin/Block.js
    │                         ──► bitcoin/Transaction.js
    │                         ──► utils/merkle.js
    │
    ├── bitcoin/Wallet.js ──► utils/crypto.js
    │
    ├── ethereum/Blockchain.js ──► ethereum/Block.js
    │                          ──► ethereum/Transaction.js
    │                          ──► ethereum/SmartContract.js
    │
    └── ethereum/Wallet.js ──► utils/crypto.js
```

## Design Decisions

### Why no external blockchain library?

The goal is a **learning simulator** — every concept (UTXO, nonce, gas, ECDSA, Merkle tree) is implemented explicitly so the code can be read and understood.

### Why separate Bitcoin and Ethereum implementations?

The two chains use fundamentally different models (UTXO vs. account) and different address/hashing schemes. Sharing code between them would obscure these differences rather than highlight them.

### Why a contract template registry instead of serialising ABI?

Smart contract ABIs are JavaScript functions. `JSON.stringify` discards functions. The blockchain holds a `_contractTemplates` Map that stores the live ABI by template ID; the deploy transaction carries only the template ID. This lets contracts retain their executable methods after deployment.

### Why PoW instead of PoS for Ethereum?

The simulator was designed before Ethereum's Merge. PoW is simpler to implement (find a nonce, check leading zeros) and easier to reason about. PoS would require a validator set, staking, slashing, and randomised selection — all out of scope for an educational demo.

### Gas units vs ETH

Gas prices are specified in **Gwei** (1 Gwei = 10⁻⁹ ETH). Fees are calculated as:
```
fee (ETH) = gasPrice (Gwei) × gasUsed / 1,000,000,000
```
This matches Ethereum's real unit system and keeps balances in human-readable ETH.

### UTXO dust & fees

Bitcoin transactions are built by consuming **all** UTXOs for an address and sending change back. A flat 0.0001 BTC fee is deducted. This is a simplification — real wallets use coin-selection algorithms (e.g. Branch and Bound) to minimise fees and dust.

## Data Flow: Bitcoin Transaction

```
User
 └─ new BitcoinTransaction()
     ├─ addInput(txid, index, pubKey)
     ├─ addOutput(address, amount)
     └─ signInputs(privateKey)
         └─ sign({ inputs, outputs, timestamp }, privateKey) → DER signature
             └─ sha256(JSON payload) → 32-byte digest → secp256k1.sign
             └─ txid = sha256(all fields)

BitcoinBlockchain.addToMempool(tx)
 └─ tx.verify(utxoSet)
     ├─ check UTXO exists & not spent
     ├─ check ECDSA signature
     └─ check totalOut ≤ totalIn

BitcoinBlockchain.mineBlock(minerAddress)
 └─ build coinbase tx (reward + fees)
 └─ pick mempool txs (sorted by fee)
 └─ new BitcoinBlock({ transactions, ... })
 └─ block.mine() → increment nonce until hash starts with '0000'
 └─ _applyBlock: mark inputs spent, add output UTXOs
 └─ push block to chain
```

## Data Flow: Ethereum Contract Call

```
User
 └─ eth.callContract(contractAddress, method, args, wallet)
     └─ new EthereumTransaction({ to: contractAddress, data: JSON({method, args}), ... })
     └─ tx.sign(privateKey, publicKey) → ECDSA sig → keccak256 hash

eth.addToMempool(tx)
 └─ verify signature, nonce, balance

eth.mineBlock(miner)
 └─ _executeTransaction(tx)
     └─ tx.isContractCall() → _callContract(tx)
         └─ contract = contracts.get(tx.to)
         └─ callData = JSON.parse(tx.data)
         └─ ctx = new ExecutionContext({ sender, value, blockNumber })
         └─ contract.call(method, args, ctx) → runs abi[method](args, ctx)
         └─ on success: save events, deduct gas fee, increment nonce
         └─ on revert: restore contract balance, deduct gas fee, increment nonce
     └─ push receipt { status, gasUsed, returnValue, events }
```
