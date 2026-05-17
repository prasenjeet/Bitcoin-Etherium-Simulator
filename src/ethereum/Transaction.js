const { keccak256, sign, verify } = require('../utils/crypto');

class EthereumTransaction {
  constructor({ from, to, value, gasPrice, gasLimit, data, nonce }) {
    this.from = from;
    this.to = to;
    this.value = value || 0;
    this.gasPrice = gasPrice || 1;   // Gwei
    this.gasLimit = gasLimit || 21000;
    this.data = data || null;        // Contract call data
    this.nonce = nonce || 0;
    this.timestamp = Date.now();
    this.signature = null;
    this.hash = null;
    this.status = 'pending';
    this.gasUsed = 0;
    this.receipt = null;
  }

  _signingPayload() {
    return {
      from: this.from,
      to: this.to,
      value: this.value,
      gasPrice: this.gasPrice,
      gasLimit: this.gasLimit,
      data: this.data,
      nonce: this.nonce,
    };
  }

  sign(privateKey, publicKey) {
    this.signature = sign(privateKey, this._signingPayload());
    this.publicKey = publicKey;
    this._computeHash();
  }

  _computeHash() {
    const payload = JSON.stringify({
      ...this._signingPayload(),
      signature: this.signature,
      timestamp: this.timestamp,
    });
    this.hash = '0x' + keccak256(payload);
  }

  verify() {
    if (!this.signature || !this.publicKey) return false;
    return verify(this.publicKey, this._signingPayload(), this.signature);
  }

  maxFee() {
    return this.gasPrice * this.gasLimit;
  }

  isContractCreation() {
    return this.to === null && this.data !== null;
  }

  isContractCall() {
    return this.to !== null && this.data !== null;
  }

  toJSON() {
    return {
      hash: this.hash,
      from: this.from,
      to: this.to,
      value: this.value,
      gasPrice: this.gasPrice,
      gasLimit: this.gasLimit,
      gasUsed: this.gasUsed,
      nonce: this.nonce,
      data: this.data ? `${this.data.slice(0, 20)}...` : null,
      status: this.status,
      timestamp: this.timestamp,
    };
  }
}

module.exports = EthereumTransaction;
