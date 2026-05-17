const { sha256, sign, verify } = require('../utils/crypto');

class UTXO {
  constructor(txid, outputIndex, address, amount) {
    this.txid = txid;
    this.outputIndex = outputIndex;
    this.address = address;
    this.amount = amount;
    this.spent = false;
  }
}

class TxInput {
  constructor(txid, outputIndex, publicKey) {
    this.txid = txid;
    this.outputIndex = outputIndex;
    this.publicKey = publicKey;
    this.signature = null;
  }
}

class TxOutput {
  constructor(address, amount) {
    this.address = address;
    this.amount = amount;
  }
}

class BitcoinTransaction {
  constructor() {
    this.inputs = [];
    this.outputs = [];
    this.timestamp = Date.now();
    this.txid = null;
    this.fee = 0;
  }

  addInput(txid, outputIndex, publicKey) {
    this.inputs.push(new TxInput(txid, outputIndex, publicKey));
  }

  addOutput(address, amount) {
    this.outputs.push(new TxOutput(address, amount));
  }

  signInputs(privateKey) {
    const sigData = {
      inputs: this.inputs.map(i => ({ txid: i.txid, outputIndex: i.outputIndex })),
      outputs: this.outputs,
      timestamp: this.timestamp,
    };
    const sig = sign(privateKey, sigData);
    this.inputs.forEach(input => (input.signature = sig));
    this._computeTxid();
  }

  _computeTxid() {
    const data = JSON.stringify({
      inputs: this.inputs,
      outputs: this.outputs,
      timestamp: this.timestamp,
    });
    this.txid = sha256(data);
  }

  verify(utxoSet) {
    for (const input of this.inputs) {
      const utxo = utxoSet.get(`${input.txid}:${input.outputIndex}`);
      if (!utxo || utxo.spent) return { valid: false, reason: 'UTXO not found or already spent' };

      const sigData = {
        inputs: this.inputs.map(i => ({ txid: i.txid, outputIndex: i.outputIndex })),
        outputs: this.outputs,
        timestamp: this.timestamp,
      };
      if (!verify(input.publicKey, sigData, input.signature)) {
        return { valid: false, reason: 'Invalid signature' };
      }
    }

    const totalIn = this.inputs.reduce((sum, input) => {
      const utxo = utxoSet.get(`${input.txid}:${input.outputIndex}`);
      return sum + (utxo ? utxo.amount : 0);
    }, 0);

    const totalOut = this.outputs.reduce((sum, o) => sum + o.amount, 0);

    if (totalOut > totalIn) return { valid: false, reason: 'Insufficient input amount' };

    this.fee = totalIn - totalOut;
    return { valid: true };
  }

  isCoinbase() {
    return this.inputs.length === 0;
  }

  toJSON() {
    return {
      txid: this.txid,
      inputs: this.inputs,
      outputs: this.outputs,
      timestamp: this.timestamp,
      fee: this.fee,
    };
  }
}

module.exports = { BitcoinTransaction, UTXO, TxInput, TxOutput };
