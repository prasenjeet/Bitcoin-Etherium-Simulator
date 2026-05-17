const { keccak256 } = require('../utils/crypto');

// Simple EVM-like execution environment for simulated smart contracts
class ExecutionContext {
  constructor({ sender, value, blockNumber, blockchain }) {
    this.msg = { sender, value };
    this.block = { number: blockNumber, timestamp: Date.now() };
    this._blockchain = blockchain;
    this._events = [];
    this._returnValue = null;
    this._reverted = false;
    this._revertReason = '';
  }

  emit(eventName, args) {
    this._events.push({ event: eventName, args, blockNumber: this.block.number });
  }

  revert(reason = 'execution reverted') {
    this._reverted = true;
    this._revertReason = reason;
    throw new Error(reason);
  }

  require(condition, reason) {
    if (!condition) this.revert(reason);
  }
}

class SmartContract {
  constructor({ name, address, creator, abi, bytecode, initialState }) {
    this.name = name;
    this.address = address;
    this.creator = creator;
    this.abi = abi || {};
    this.bytecode = bytecode || '';
    this.state = { ...initialState };
    this.balance = 0;
    this.events = [];
    this.deployedAt = null;
  }

  call(method, args, context) {
    if (!this.abi[method]) throw new Error(`Method '${method}' not found on contract ${this.name}`);
    return this.abi[method].call(this, args, context);
  }

  static computeAddress(creator, nonce) {
    return '0x' + keccak256(`${creator}${nonce}`).slice(-40);
  }
}

// ──────────────────────────────────────────────────────────────
// ERC-20 Token template
// ──────────────────────────────────────────────────────────────
function createERC20Token({ name, symbol, totalSupply, decimals = 18 }) {
  const abi = {
    name(_, ctx) { return this.state.name; },
    symbol(_, ctx) { return this.state.symbol; },
    decimals(_, ctx) { return this.state.decimals; },
    totalSupply(_, ctx) { return this.state.totalSupply; },

    balanceOf([account], ctx) {
      return this.state.balances[account] || 0;
    },

    transfer([to, amount], ctx) {
      const from = ctx.msg.sender;
      ctx.require(this.state.balances[from] >= amount, 'ERC20: insufficient balance');
      this.state.balances[from] -= amount;
      this.state.balances[to] = (this.state.balances[to] || 0) + amount;
      ctx.emit('Transfer', { from, to, amount });
      return true;
    },

    approve([spender, amount], ctx) {
      const owner = ctx.msg.sender;
      if (!this.state.allowances[owner]) this.state.allowances[owner] = {};
      this.state.allowances[owner][spender] = amount;
      ctx.emit('Approval', { owner, spender, amount });
      return true;
    },

    allowance([owner, spender], ctx) {
      return (this.state.allowances[owner] || {})[spender] || 0;
    },

    transferFrom([from, to, amount], ctx) {
      const spender = ctx.msg.sender;
      const allowed = (this.state.allowances[from] || {})[spender] || 0;
      ctx.require(allowed >= amount, 'ERC20: insufficient allowance');
      ctx.require(this.state.balances[from] >= amount, 'ERC20: insufficient balance');
      this.state.allowances[from][spender] -= amount;
      this.state.balances[from] -= amount;
      this.state.balances[to] = (this.state.balances[to] || 0) + amount;
      ctx.emit('Transfer', { from, to, amount });
      return true;
    },

    mint([to, amount], ctx) {
      ctx.require(ctx.msg.sender === this.creator, 'ERC20: only owner can mint');
      this.state.balances[to] = (this.state.balances[to] || 0) + amount;
      this.state.totalSupply += amount;
      ctx.emit('Transfer', { from: '0x0', to, amount });
      return true;
    },

    burn([amount], ctx) {
      const from = ctx.msg.sender;
      ctx.require(this.state.balances[from] >= amount, 'ERC20: insufficient balance');
      this.state.balances[from] -= amount;
      this.state.totalSupply -= amount;
      ctx.emit('Transfer', { from, to: '0x0', amount });
      return true;
    },
  };

  const initialState = {
    name,
    symbol,
    decimals,
    totalSupply,
    balances: {},
    allowances: {},
  };

  return { abi, initialState };
}

// ──────────────────────────────────────────────────────────────
// Simple DEX (Uniswap-style constant product AMM)
// ──────────────────────────────────────────────────────────────
function createSimpleDEX() {
  const abi = {
    getReserves(_, ctx) {
      return { reserveA: this.state.reserveA, reserveB: this.state.reserveB };
    },

    addLiquidity([amountA, amountB], ctx) {
      const provider = ctx.msg.sender;
      ctx.require(amountA > 0 && amountB > 0, 'DEX: invalid amounts');
      this.state.reserveA += amountA;
      this.state.reserveB += amountB;
      const liquidity = Math.sqrt(amountA * amountB);
      this.state.liquidity[provider] = (this.state.liquidity[provider] || 0) + liquidity;
      this.state.totalLiquidity += liquidity;
      ctx.emit('LiquidityAdded', { provider, amountA, amountB, liquidity });
      return liquidity;
    },

    swapAForB([amountIn], ctx) {
      ctx.require(amountIn > 0, 'DEX: invalid input');
      ctx.require(this.state.reserveA > 0 && this.state.reserveB > 0, 'DEX: no liquidity');
      const amountInWithFee = amountIn * 997; // 0.3% fee
      const amountOut = (amountInWithFee * this.state.reserveB) /
        (this.state.reserveA * 1000 + amountInWithFee);
      ctx.require(amountOut > 0, 'DEX: insufficient output');
      this.state.reserveA += amountIn;
      this.state.reserveB -= amountOut;
      ctx.emit('Swap', { trader: ctx.msg.sender, amountIn, amountOut, direction: 'A→B' });
      return amountOut;
    },

    swapBForA([amountIn], ctx) {
      ctx.require(amountIn > 0, 'DEX: invalid input');
      ctx.require(this.state.reserveA > 0 && this.state.reserveB > 0, 'DEX: no liquidity');
      const amountInWithFee = amountIn * 997;
      const amountOut = (amountInWithFee * this.state.reserveA) /
        (this.state.reserveB * 1000 + amountInWithFee);
      ctx.require(amountOut > 0, 'DEX: insufficient output');
      this.state.reserveB += amountIn;
      this.state.reserveA -= amountOut;
      ctx.emit('Swap', { trader: ctx.msg.sender, amountIn, amountOut, direction: 'B→A' });
      return amountOut;
    },

    getPrice([direction], ctx) {
      if (direction === 'AtoB') return this.state.reserveB / this.state.reserveA;
      return this.state.reserveA / this.state.reserveB;
    },
  };

  const initialState = {
    reserveA: 0,
    reserveB: 0,
    liquidity: {},
    totalLiquidity: 0,
  };

  return { abi, initialState };
}

module.exports = { SmartContract, ExecutionContext, createERC20Token, createSimpleDEX };
