const EthereumBlock = require('./Block');
const EthereumTransaction = require('./Transaction');
const { SmartContract, ExecutionContext } = require('./SmartContract');
const { keccak256 } = require('../utils/crypto');

const BLOCK_REWARD = 2;       // ETH (post-merge: no PoW, but we simulate PoW here)
const GAS_PRICE_GWEI = 20;
const BASE_GAS_COST = 21000;
const INITIAL_DIFFICULTY = 3;
const MAX_GAS_PER_BLOCK = 30_000_000;
const CONTRACT_DEPLOY_GAS = 200_000;
const CONTRACT_CALL_GAS = 50_000;

class EthereumBlockchain {
  constructor() {
    this.chain = [];
    this.accounts = new Map();  // address -> { balance, nonce }
    this.contracts = new Map(); // address -> SmartContract
    this._contractTemplates = new Map(); // templateId -> contractSpec with live abi
    this.mempool = [];
    this.difficulty = INITIAL_DIFFICULTY;
    this._createGenesisBlock();
  }

  _createGenesisBlock() {
    const genesis = new EthereumBlock({
      index: 0,
      parentHash: '0x' + '0'.repeat(64),
      transactions: [],
      miner: '0x0000000000000000000000000000000000000000',
      difficulty: this.difficulty,
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

  getAccount(address) {
    if (!this.accounts.has(address)) {
      this.accounts.set(address, { balance: 0, nonce: 0 });
    }
    return this.accounts.get(address);
  }

  getBalance(address) {
    return this.getAccount(address).balance;
  }

  getNonce(address) {
    return this.getAccount(address).nonce;
  }

  getPendingNonce(address) {
    const pendingCount = this.mempool.filter(t => t.from === address).length;
    return this.getAccount(address).nonce + pendingCount;
  }

  addToMempool(tx) {
    if (!tx.verify()) throw new Error('Invalid transaction signature');

    const sender = this.getAccount(tx.from);
    const pendingCount = this.mempool.filter(t => t.from === tx.from).length;
    const expectedNonce = sender.nonce + pendingCount;
    if (expectedNonce !== tx.nonce) {
      throw new Error(`Invalid nonce: expected ${expectedNonce}, got ${tx.nonce}`);
    }

    const pendingCost = this.mempool
      .filter(t => t.from === tx.from)
      .reduce((sum, t) => sum + t.value + t.maxFee() / 1e9, 0);
    const maxCost = tx.value + tx.maxFee() / 1e9;
    if (sender.balance < pendingCost + maxCost) {
      throw new Error(`Insufficient balance: need ${(pendingCost + maxCost).toFixed(6)} ETH, have ${sender.balance} ETH`);
    }

    this.mempool.push(tx);
    return tx.hash;
  }

  mineBlock(minerAddress) {
    const byGas = [...this.mempool].sort((a, b) => b.gasPrice - a.gasPrice);
    const selected = [];
    let blockGas = 0;
    const nextNonce = new Map();
    const remaining = [];

    for (const tx of byGas) {
      const expected = nextNonce.get(tx.from) ?? this.getAccount(tx.from).nonce;
      if (tx.nonce !== expected) { remaining.push(tx); continue; }
      const gasNeeded = tx.isContractCreation() ? CONTRACT_DEPLOY_GAS
        : tx.isContractCall() ? CONTRACT_CALL_GAS
        : BASE_GAS_COST;
      if (blockGas + gasNeeded > MAX_GAS_PER_BLOCK) break;
      selected.push(tx);
      blockGas += gasNeeded;
      nextNonce.set(tx.from, expected + 1);
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const tx = remaining[i];
        const expected = nextNonce.get(tx.from) ?? this.getAccount(tx.from).nonce;
        if (tx.nonce !== expected) continue;
        const gasNeeded = tx.isContractCreation() ? CONTRACT_DEPLOY_GAS
          : tx.isContractCall() ? CONTRACT_CALL_GAS
          : BASE_GAS_COST;
        if (blockGas + gasNeeded > MAX_GAS_PER_BLOCK) continue;
        selected.push(tx);
        blockGas += gasNeeded;
        nextNonce.set(tx.from, expected + 1);
        remaining.splice(i, 1);
        changed = true;
      }
    }

    const block = new EthereumBlock({
      index: this.chain.length,
      parentHash: this.latestBlock.hash,
      transactions: selected,
      miner: minerAddress,
      difficulty: this.difficulty,
    });
    block.gasUsed = blockGas;

    console.log(`  Mining Ethereum block #${block.index} (difficulty: ${this.difficulty})...`);
    block.mine();

    // Execute all transactions
    const receipts = [];
    for (const tx of selected) {
      const receipt = this._executeTransaction(tx, block.index);
      receipts.push(receipt);
    }
    block.receiptsRoot = keccak256(JSON.stringify(receipts));

    // Award block reward + fees
    const totalFees = selected.reduce((sum, tx) => {
      const gas = tx.isContractCreation() ? CONTRACT_DEPLOY_GAS
        : tx.isContractCall() ? CONTRACT_CALL_GAS
        : BASE_GAS_COST;
      return sum + (tx.gasPrice * gas) / 1e9;
    }, 0);
    const miner = this.getAccount(minerAddress);
    miner.balance += BLOCK_REWARD + totalFees;

    this.chain.push(block);

    // Remove confirmed txs from mempool
    const confirmedHashes = new Set(selected.map(tx => tx.hash));
    this.mempool = this.mempool.filter(tx => !confirmedHashes.has(tx.hash));

    return { block, receipts };
  }

  _executeTransaction(tx, blockNumber) {
    const sender = this.getAccount(tx.from);
    const receipt = { txHash: tx.hash, status: 'success', gasUsed: 0, events: [], error: null };

    try {
      if (tx.isContractCreation()) {
        receipt.gasUsed = CONTRACT_DEPLOY_GAS;
        this._deployContract(tx, blockNumber);
      } else if (tx.isContractCall()) {
        receipt.gasUsed = CONTRACT_CALL_GAS;
        const result = this._callContract(tx, blockNumber);
        receipt.returnValue = result.returnValue;
        receipt.events = result.events;
      } else {
        receipt.gasUsed = BASE_GAS_COST;
        const recipient = this.getAccount(tx.to);
        if (sender.balance < tx.value) throw new Error('Insufficient balance for transfer');
        sender.balance -= tx.value;
        recipient.balance += tx.value;
      }

      // gasPrice is in Gwei; divide by 1e9 to get ETH cost
      const gasCost = (tx.gasPrice * receipt.gasUsed) / 1e9;
      sender.balance -= gasCost;
      sender.nonce++;
      tx.status = 'success';
      tx.gasUsed = receipt.gasUsed;

    } catch (err) {
      receipt.status = 'failed';
      receipt.error = err.message;
      const gasCost = (tx.gasPrice * Math.min(receipt.gasUsed || BASE_GAS_COST, tx.gasLimit)) / 1e9;
      sender.balance -= gasCost;
      sender.nonce++;
      tx.status = 'failed';
    }

    tx.receipt = receipt;
    return receipt;
  }

  _deployContract(tx, blockNumber) {
    const { templateId, bytecode } = JSON.parse(tx.data);
    const spec = this._contractTemplates.get(templateId);
    if (!spec) throw new Error(`Contract template ${templateId} not found`);

    const address = SmartContract.computeAddress(tx.from, this.getNonce(tx.from));

    const contract = new SmartContract({
      name: spec.name,
      address,
      creator: tx.from,
      abi: spec.abi,
      bytecode: bytecode || '',
      initialState: JSON.parse(JSON.stringify(spec.initialState || {})), // deep-copy state
    });
    contract.deployedAt = blockNumber;
    contract.balance = tx.value;

    this.contracts.set(address, contract);
    tx.contractAddress = address;
    return address;
  }

  _callContract(tx, blockNumber) {
    const contract = this.contracts.get(tx.to);
    if (!contract) throw new Error(`No contract at ${tx.to}`);

    const callData = JSON.parse(tx.data);
    const ctx = new ExecutionContext({
      sender: tx.from,
      value: tx.value,
      blockNumber,
      blockchain: this,
    });

    if (tx.value > 0) {
      const sender = this.getAccount(tx.from);
      sender.balance -= tx.value;
      contract.balance += tx.value;
    }

    let returnValue;
    try {
      returnValue = contract.call(callData.method, callData.args || [], ctx);
    } catch (err) {
      if (tx.value > 0) {
        const sender = this.getAccount(tx.from);
        sender.balance += tx.value;
        contract.balance -= tx.value;
      }
      throw err;
    }

    contract.events.push(...ctx._events);
    return { returnValue, events: ctx._events };
  }

  deployContract(contractSpec, deployerWallet) {
    // Store the live spec (with real function references) in the registry
    const templateId = keccak256(contractSpec.name + Date.now() + Math.random());
    this._contractTemplates.set(templateId, contractSpec);

    const nonce = this.getPendingNonce(deployerWallet.address);
    const tx = new EthereumTransaction({
      from: deployerWallet.address,
      to: null,
      value: 0,
      gasPrice: GAS_PRICE_GWEI,
      gasLimit: CONTRACT_DEPLOY_GAS,
      data: JSON.stringify({ templateId, bytecode: contractSpec.bytecode || '' }),
      nonce,
    });
    tx.sign(deployerWallet.privateKey, deployerWallet.publicKey);
    return tx;
  }

  callContract(contractAddress, method, args, callerWallet, value = 0) {
    const nonce = this.getPendingNonce(callerWallet.address);
    const tx = new EthereumTransaction({
      from: callerWallet.address,
      to: contractAddress,
      value,
      gasPrice: GAS_PRICE_GWEI,
      gasLimit: CONTRACT_CALL_GAS,
      data: JSON.stringify({ method, args }),
      nonce,
    });
    tx.sign(callerWallet.privateKey, callerWallet.publicKey);
    return tx;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      if (!this.chain[i].isValid(this.chain[i - 1])) return false;
    }
    return true;
  }

  getStats() {
    const totalETH = Array.from(this.accounts.values()).reduce((s, a) => s + a.balance, 0)
      + Array.from(this.contracts.values()).reduce((s, c) => s + c.balance, 0);
    return {
      height: this.height,
      difficulty: this.difficulty,
      mempoolSize: this.mempool.length,
      accounts: this.accounts.size,
      contracts: this.contracts.size,
      totalSupply: totalETH.toFixed(6),
      isValid: this.isChainValid(),
    };
  }
}

module.exports = EthereumBlockchain;
