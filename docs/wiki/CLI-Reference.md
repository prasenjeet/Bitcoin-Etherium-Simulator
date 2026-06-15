# CLI Reference

Start the interactive CLI:

```bash
npm start
```

Type `help` at any time to print the command list. Type `exit` or `quit` to leave.

---

## Bitcoin Commands

### `btc wallet <name>`

Creates a new Bitcoin wallet and registers it under `<name>` for use in subsequent commands.

```
> btc wallet alice
  Created BTC wallet "alice"
  Address:    12iLZf4PBaWHVMgRWq8bqGVfnuW...
  PublicKey:  04a3b9c2d1e5f0...
```

### `btc mine <miner>`

Mines the next Bitcoin block. The miner receives the block reward (50 BTC initially, halving every 210,000 blocks) plus all transaction fees from confirmed mempool transactions.

```
> btc mine miner
  Block #1 mined!
  Hash:         0000d4125685dc97...
  Nonce:        30326
  Mining time:  132ms
  Reward:       50 BTC
```

### `btc send <from> <to> <amount>`

Builds a transaction spending all UTXOs owned by `<from>`, sending `<amount>` BTC to `<to>` and returning the change (minus a 0.0001 BTC fee) back to `<from>`. The transaction is placed in the mempool and confirmed when the next block is mined.

```
> btc send miner alice 10
  Transaction submitted (pending)
  TxID:    cfcf780c3a131b46d71e...
  Amount:  10 BTC
  Fee:     0.0001 BTC
```

### `btc status`

Displays chain statistics and all registered wallet balances.

```
> btc status
  Bitcoin Blockchain Status
  Height:        3
  Difficulty:    4
  Mempool:       0 txs
  UTXO set:      5
  Total supply:  150.00000000 BTC
  Chain valid:   true

  Wallets:
    alice       10.00000000 BTC   12iLZ...
    miner       90.00000000 BTC   12toy...
```

---

## Ethereum Commands

### `eth wallet <name>`

Creates a new Ethereum wallet.

```
> eth wallet alice
  Created ETH wallet "alice"
  Address:  0xeAaf9fEDBA5e454BD38B9027BbB06B627AbaB25D
```

### `eth faucet <name> <amount>`

Directly credits `<amount>` ETH to `<name>`'s account (simulates a test faucet or genesis allocation).

```
> eth faucet alice 100
  Faucet: sent 100 ETH to alice (0xeAaf...)
```

### `eth mine <miner>`

Mines the next Ethereum block, executing all pending mempool transactions in descending gas-price order.

```
> eth mine miner
  Block #1 mined!
  Hash:         0x0000d7d14a5223...
  Nonce:        7842
  Mining time:  45ms
  Gas used:     21000
```

### `eth send <from> <to> <amount>`

Submits a signed ETH transfer transaction to the mempool.

```
> eth send alice bob 5
  Transaction submitted
  Hash:   0xabc123...
  Value:  5 ETH
```

### `eth erc20 <deployer> <name> <symbol> <supply>`

Creates and queues a contract deployment transaction for an ERC-20 token. The full `<supply>` is assigned to `<deployer>`'s token balance. Mine a block to confirm.

```
> eth erc20 deployer MyToken MTK 1000000
  ERC-20 deploy transaction queued. Mine a block to confirm.
  (Token: MyToken / MTK, supply: 1000000)

> eth mine miner
  (contract is deployed and its address is shown in eth status)
```

### `eth status`

Displays chain statistics, all registered wallets, and all deployed contracts.

```
> eth status
  Ethereum Blockchain Status
  Height:     4
  Difficulty: 3
  Mempool:    0 txs
  Accounts:   5
  Contracts:  1
  Chain valid: true

  Wallets:
    alice     94.9996 ETH   0xeAaf...
    bob       55.0000 ETH   0x6880...
    deployer  499.996 ETH   0x6596...

  Contracts:
    MyToken   0x5fd5c9128ff04d...
```

---

## Other Commands

| Command | Description |
|---------|-------------|
| `demo` | Run the full automated demo and exit the CLI |
| `help` | Print the command reference |
| `exit` | Quit the CLI |
| `quit` | Quit the CLI |

---

## Example Session

```
> btc wallet alice
> btc wallet bob
> btc wallet miner
> btc mine miner
> btc send miner alice 20
> btc mine miner
> btc send alice bob 5
> btc mine miner
> btc status

> eth wallet alice
> eth wallet bob
> eth wallet deployer
> eth faucet alice 100
> eth faucet deployer 500
> eth mine miner
> eth send alice bob 10
> eth mine miner
> eth erc20 deployer CryptoToken CTK 500000
> eth mine miner
> eth status
```
