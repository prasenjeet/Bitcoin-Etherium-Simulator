# Smart Contracts

## Contract Engine (`src/ethereum/SmartContract.js`)

The simulator includes a lightweight smart contract execution engine. Contracts are JavaScript objects with:
- **state** — the on-chain storage (a plain JS object, deep-copied at deploy time)
- **abi** — a map of method names to functions
- **balance** — ETH held by the contract

### Execution Context

Every method call receives an `ExecutionContext` that mimics Solidity's globals:

```js
ctx.msg.sender   // address of the caller
ctx.msg.value    // ETH sent with the call
ctx.block.number // current block number
ctx.emit(event, args)          // emit an event (stored in block receipt)
ctx.require(condition, reason) // revert if condition is false
ctx.revert(reason)             // unconditionally revert
```

### Deploying a Contract

```js
// 1. Define the contract spec (abi + initial state)
const spec = {
  name: 'MyContract',
  abi: {
    getValue([], ctx) { return this.state.value; },
    setValue([v], ctx) { this.state.value = v; },
  },
  initialState: { value: 42 },
};

// 2. Create a deploy transaction
const deployTx = eth.deployContract(spec, deployerWallet);
eth.addToMempool(deployTx);
eth.mineBlock(minerAddress);

// 3. Get the deployed address
const contractAddress = deployTx.contractAddress;
```

### Calling a Contract

```js
const callTx = eth.callContract(
  contractAddress,
  'setValue',          // method name
  [99],                // args array
  callerWallet,
  0                    // ETH value to send (optional)
);
eth.addToMempool(callTx);
const { receipts } = eth.mineBlock(minerAddress);

console.log(receipts[0].status);      // 'success' or 'failed'
console.log(receipts[0].returnValue); // method return value
console.log(receipts[0].events);      // emitted events
```

---

## ERC-20 Token

Use `createERC20Token` to get a ready-made ERC-20 contract spec:

```js
const { createERC20Token } = require('./src/ethereum/SmartContract');

const { abi, initialState } = createERC20Token({
  name: 'MyToken',
  symbol: 'MTK',
  totalSupply: 1_000_000,
  decimals: 18,
});

// Give the deployer the initial supply
initialState.balances[deployer.address] = 1_000_000;

const deployTx = eth.deployContract({ name: 'MyToken', abi, initialState }, deployer);
eth.addToMempool(deployTx);
eth.mineBlock(miner.address);

const tokenAddress = deployTx.contractAddress;
```

### Supported Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `name` | `()` | Token name |
| `symbol` | `()` | Token symbol |
| `decimals` | `()` | Decimal places |
| `totalSupply` | `()` | Total token supply |
| `balanceOf` | `(account)` | Token balance of an address |
| `transfer` | `(to, amount)` | Transfer tokens to `to` |
| `approve` | `(spender, amount)` | Approve `spender` to spend up to `amount` |
| `allowance` | `(owner, spender)` | Check approved allowance |
| `transferFrom` | `(from, to, amount)` | Transfer on behalf of `from` |
| `mint` | `(to, amount)` | Mint new tokens (owner only) |
| `burn` | `(amount)` | Burn caller's tokens |

### Events Emitted

| Event | Args |
|-------|------|
| `Transfer` | `{ from, to, amount }` |
| `Approval` | `{ owner, spender, amount }` |

### Example

```js
// Transfer 1000 MTK from deployer to alice
const tx = eth.callContract(tokenAddress, 'transfer', [alice.address, 1000], deployer);
eth.addToMempool(tx);
eth.mineBlock(miner.address);

// Check alice's balance
const contract = eth.contracts.get(tokenAddress);
console.log(contract.state.balances[alice.address]); // 1000

// Alice approves bob to spend 200 MTK
const approveTx = eth.callContract(tokenAddress, 'approve', [bob.address, 200], alice);
eth.addToMempool(approveTx);
eth.mineBlock(miner.address);
```

---

## Simple DEX (Constant-Product AMM)

Use `createSimpleDEX` to deploy a Uniswap v1-style automated market maker. It maintains two token reserves and prices trades using the constant-product formula: `x * y = k`.

```js
const { createSimpleDEX } = require('./src/ethereum/SmartContract');

const dex = createSimpleDEX();
const deployTx = eth.deployContract({ name: 'SimpleDEX', ...dex }, deployer);
eth.addToMempool(deployTx);
eth.mineBlock(miner.address);

const dexAddress = deployTx.contractAddress;
```

### Supported Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getReserves` | `()` | Returns `{ reserveA, reserveB }` |
| `addLiquidity` | `(amountA, amountB)` | Deposit both assets, receive LP units |
| `swapAForB` | `(amountIn)` | Swap token A for token B |
| `swapBForA` | `(amountIn)` | Swap token B for token A |
| `getPrice` | `('AtoB' \| 'BtoA')` | Spot price between the two reserves |

### Events Emitted

| Event | Args |
|-------|------|
| `LiquidityAdded` | `{ provider, amountA, amountB, liquidity }` |
| `Swap` | `{ trader, amountIn, amountOut, direction }` |

### Constant-Product Formula

```
amountOut = (amountIn × 997 × reserveOut) / (reserveIn × 1000 + amountIn × 997)
```

The 0.3% fee (`997/1000`) stays in the pool, accruing to liquidity providers.

### Example

```js
// Add liquidity: 1000 units of A, 500,000 units of B → price: 500 B per A
const addLiq = eth.callContract(dexAddress, 'addLiquidity', [1000, 500000], deployer);
eth.addToMempool(addLiq);
eth.mineBlock(miner.address);

// Swap 10 A for B
const swap = eth.callContract(dexAddress, 'swapAForB', [10], alice);
eth.addToMempool(swap);
const { receipts } = eth.mineBlock(miner.address);

console.log(receipts[0].returnValue); // ~4935 B tokens received
console.log(receipts[0].events[0]);
// { event: 'Swap', args: { trader: '0x...', amountIn: 10, amountOut: 4935.79, direction: 'A→B' } }
```
