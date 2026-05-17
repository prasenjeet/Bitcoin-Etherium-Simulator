const { keccak256 } = require('../utils/crypto');
const { buildMerkleTree } = require('../utils/merkle');

class EthereumBlock {
  constructor({ index, parentHash, transactions, miner, difficulty, gasLimit }) {
    this.index = index;
    this.parentHash = parentHash;
    this.transactions = transactions;
    this.miner = miner;
    this.difficulty = difficulty;
    this.gasLimit = gasLimit || 30_000_000;
    this.gasUsed = 0;
    this.timestamp = Date.now();
    this.nonce = 0;
    this.extraData = '';
    this.transactionsRoot = buildMerkleTree(transactions.map(tx => tx.hash));
    this.stateRoot = '';
    this.receiptsRoot = '';
    this.hash = '';
    this.baseFeePerGas = 1;
    this.uncles = [];
  }

  computeHash() {
    const data = JSON.stringify({
      index: this.index,
      parentHash: this.parentHash,
      transactionsRoot: this.transactionsRoot,
      stateRoot: this.stateRoot,
      timestamp: this.timestamp,
      difficulty: this.difficulty,
      nonce: this.nonce,
      miner: this.miner,
      baseFeePerGas: this.baseFeePerGas,
    });
    return '0x' + keccak256(data);
  }

  mine() {
    const target = '0'.repeat(this.difficulty);
    const start = Date.now();
    while (true) {
      this.hash = this.computeHash();
      if (this.hash.slice(2).startsWith(target)) {
        this.miningTime = Date.now() - start;
        return;
      }
      this.nonce++;
    }
  }

  isValid(parentBlock) {
    if (this.hash !== this.computeHash()) return false;
    if (parentBlock && this.parentHash !== parentBlock.hash) return false;
    if (!this.hash.slice(2).startsWith('0'.repeat(this.difficulty))) return false;
    return true;
  }

  toJSON() {
    return {
      index: this.index,
      hash: this.hash,
      parentHash: this.parentHash,
      miner: this.miner,
      transactionsRoot: this.transactionsRoot,
      timestamp: this.timestamp,
      nonce: this.nonce,
      difficulty: this.difficulty,
      gasLimit: this.gasLimit,
      gasUsed: this.gasUsed,
      baseFeePerGas: this.baseFeePerGas,
      miningTime: this.miningTime,
      transactionCount: this.transactions.length,
    };
  }
}

module.exports = EthereumBlock;
