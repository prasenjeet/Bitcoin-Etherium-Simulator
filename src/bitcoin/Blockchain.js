const BitcoinBlock = require('./Block');
const { BitcoinTransaction, UTXO } = require('./Transaction');

const BLOCK_REWARD_INITIAL = 50;
const HALVING_INTERVAL = 210000;
const TARGET_BLOCK_TIME = 600000; // 10 minutes in ms
const DIFFICULTY_ADJUSTMENT_INTERVAL = 2016;
const INITIAL_DIFFICULTY = 4;
const MAX_TRANSACTIONS_PER_BLOCK = 100;

class BitcoinBlockchain {
  constructor() {
    this.chain = [];
    this.utxoSet = new Map();
    this.mempool = [];
    this.difficulty = INITIAL_DIFFICULTY;
    this._createGenesisBlock();
  }

  _createGenesisBlock() {
    const genesis = new BitcoinBlock({
      index: 0,
      previousHash: '0'.repeat(64),
      transactions: [],
      difficulty: this.difficulty,
      miner: 'genesis',
    });
    genesis.hash = genesis.computeHash();
    this.chain.push(genesis);
  }

  get latestBlock() {
    return this.chain[this.chain.length - 1];
  }

  get height() {
    return this.chain.length - 1;
  }

  blockReward(blockIndex) {
    const halvings = Math.floor(blockIndex / HALVING_INTERVAL);
    return BLOCK_REWARD_INITIAL / Math.pow(2, halvings);
  }

  addToMempool(transaction) {
    const result = transaction.verify(this.utxoSet);
    if (!result.valid) throw new Error(`Invalid transaction: ${result.reason}`);

    const pendingSpent = new Set();
    for (const tx of this.mempool) {
      for (const input of tx.inputs) {
        pendingSpent.add(`${input.txid}:${input.outputIndex}`);
      }
    }
    for (const input of transaction.inputs) {
      const key = `${input.txid}:${input.outputIndex}`;
      if (pendingSpent.has(key)) {
        throw new Error(`Invalid transaction: UTXO ${key} already spent by pending transaction`);
      }
    }

    this.mempool.push(transaction);
    return transaction.txid;
  }

  mineBlock(minerAddress) {
    this._adjustDifficulty();

    // Coinbase transaction (block reward)
    const coinbase = new BitcoinTransaction();
    coinbase.addOutput(minerAddress, this.blockReward(this.height + 1));

    // Pick transactions from mempool (highest fee first)
    const sorted = [...this.mempool].sort((a, b) => b.fee - a.fee);
    const selected = sorted.slice(0, MAX_TRANSACTIONS_PER_BLOCK - 1);

    // Add miner fees to coinbase
    const totalFees = selected.reduce((sum, tx) => sum + tx.fee, 0);
    if (totalFees > 0) coinbase.outputs[0].amount += totalFees;
    coinbase._computeTxid();

    const transactions = [coinbase, ...selected];

    const block = new BitcoinBlock({
      index: this.chain.length,
      previousHash: this.latestBlock.hash,
      transactions,
      difficulty: this.difficulty,
      miner: minerAddress,
    });

    console.log(`  Mining Bitcoin block #${block.index} (difficulty: ${this.difficulty})...`);
    block.mine();

    // Apply transactions to UTXO set
    this._applyBlock(block, selected);

    this.chain.push(block);

    // Remove confirmed transactions from mempool
    const confirmedTxids = new Set(selected.map(tx => tx.txid));
    this.mempool = this.mempool.filter(tx => !confirmedTxids.has(tx.txid));

    return block;
  }

  _applyBlock(block, confirmedTxs) {
    for (const tx of block.transactions) {
      let hasDoubleSpend = false;
      for (const input of tx.inputs) {
        const key = `${input.txid}:${input.outputIndex}`;
        const utxo = this.utxoSet.get(key);
        if (utxo && utxo.spent) {
          hasDoubleSpend = true;
          break;
        }
      }
      if (hasDoubleSpend) continue;

      for (const input of tx.inputs) {
        const key = `${input.txid}:${input.outputIndex}`;
        const utxo = this.utxoSet.get(key);
        if (utxo) utxo.spent = true;
      }
      tx.outputs.forEach((output, i) => {
        const key = `${tx.txid}:${i}`;
        this.utxoSet.set(key, new UTXO(tx.txid, i, output.address, output.amount));
      });
    }
  }

  getBalance(address) {
    let balance = 0;
    for (const utxo of this.utxoSet.values()) {
      if (utxo.address === address && !utxo.spent) {
        balance += utxo.amount;
      }
    }
    return balance;
  }

  getUTXOsForAddress(address) {
    return Array.from(this.utxoSet.values()).filter(u => u.address === address && !u.spent);
  }

  _adjustDifficulty() {
    if (this.chain.length % DIFFICULTY_ADJUSTMENT_INTERVAL !== 0) return;
    const lastAdjustment = this.chain[this.chain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeTaken = this.latestBlock.timestamp - lastAdjustment.timestamp;
    const expected = TARGET_BLOCK_TIME * DIFFICULTY_ADJUSTMENT_INTERVAL;
    if (timeTaken < expected / 2) this.difficulty++;
    if (timeTaken > expected * 2 && this.difficulty > 1) this.difficulty--;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      if (!this.chain[i].isValid(this.chain[i - 1])) return false;
    }
    return true;
  }

  getStats() {
    const totalBTC = Array.from(this.utxoSet.values())
      .filter(u => !u.spent)
      .reduce((sum, u) => sum + u.amount, 0);
    return {
      height: this.height,
      difficulty: this.difficulty,
      mempoolSize: this.mempool.length,
      utxoCount: Array.from(this.utxoSet.values()).filter(u => !u.spent).length,
      totalSupply: totalBTC.toFixed(8),
      isValid: this.isChainValid(),
    };
  }
}

module.exports = BitcoinBlockchain;
