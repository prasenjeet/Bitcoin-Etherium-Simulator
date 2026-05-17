const { doubleSha256 } = require('../utils/crypto');
const { buildMerkleTree } = require('../utils/merkle');

class BitcoinBlock {
  constructor({ index, previousHash, transactions, difficulty, miner }) {
    this.index = index;
    this.previousHash = previousHash;
    this.transactions = transactions;
    this.difficulty = difficulty;
    this.miner = miner;
    this.timestamp = Date.now();
    this.nonce = 0;
    this.merkleRoot = buildMerkleTree(transactions.map(tx => tx.txid || tx));
    this.hash = '';
  }

  computeHash() {
    const data = JSON.stringify({
      index: this.index,
      previousHash: this.previousHash,
      merkleRoot: this.merkleRoot,
      timestamp: this.timestamp,
      difficulty: this.difficulty,
      nonce: this.nonce,
    });
    return doubleSha256(data);
  }

  mine() {
    const target = '0'.repeat(this.difficulty);
    const start = Date.now();
    while (true) {
      this.hash = this.computeHash();
      if (this.hash.startsWith(target)) {
        this.miningTime = Date.now() - start;
        return;
      }
      this.nonce++;
    }
  }

  isValid(previousBlock) {
    if (this.hash !== this.computeHash()) return false;
    if (previousBlock && this.previousHash !== previousBlock.hash) return false;
    if (!this.hash.startsWith('0'.repeat(this.difficulty))) return false;
    return true;
  }

  toJSON() {
    return {
      index: this.index,
      hash: this.hash,
      previousHash: this.previousHash,
      merkleRoot: this.merkleRoot,
      timestamp: this.timestamp,
      nonce: this.nonce,
      difficulty: this.difficulty,
      miner: this.miner,
      miningTime: this.miningTime,
      transactionCount: this.transactions.length,
    };
  }
}

module.exports = BitcoinBlock;
