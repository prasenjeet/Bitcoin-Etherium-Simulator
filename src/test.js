/**
 * Unit tests for Bitcoin & Ethereum Simulator
 */

const BitcoinBlockchain = require('./bitcoin/Blockchain');
const BitcoinWallet = require('./bitcoin/Wallet');
const { BitcoinTransaction } = require('./bitcoin/Transaction');

const EthereumBlockchain = require('./ethereum/Blockchain');
const EthereumWallet = require('./ethereum/Wallet');
const EthereumTransaction = require('./ethereum/Transaction');
const { createERC20Token } = require('./ethereum/SmartContract');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

// ─────────────────────────────────────────
// Bitcoin Tests
// ─────────────────────────────────────────

console.log('\nBitcoin Tests');
console.log('─'.repeat(40));

test('Creates a wallet with address, public and private key', () => {
  const w = new BitcoinWallet();
  assert(w.address.startsWith('1'), 'Address should start with 1');
  assert(w.privateKey.length === 64, 'Private key should be 64 hex chars');
  assert(w.publicKey.length > 0, 'Public key should exist');
});

test('Genesis block is created automatically', () => {
  const btc = new BitcoinBlockchain();
  assertEqual(btc.chain.length, 1);
  assertEqual(btc.height, 0);
});

test('Mining a block increases chain height and awards reward', () => {
  const btc = new BitcoinBlockchain();
  const miner = new BitcoinWallet();
  btc.mineBlock(miner.address);
  assertEqual(btc.height, 1);
  assertEqual(btc.getBalance(miner.address), 50);
});

test('Transaction moves BTC between wallets', () => {
  const btc = new BitcoinBlockchain();
  const miner = new BitcoinWallet();
  const alice = new BitcoinWallet();

  btc.mineBlock(miner.address);
  const utxos = btc.getUTXOsForAddress(miner.address);

  const tx = new BitcoinTransaction();
  utxos.forEach(u => tx.addInput(u.txid, u.outputIndex, miner.publicKey));
  tx.addOutput(alice.address, 10);
  tx.addOutput(miner.address, 39.999);
  tx.signInputs(miner.privateKey);

  btc.addToMempool(tx);
  btc.mineBlock(miner.address);

  assertEqual(btc.getBalance(alice.address), 10);
  assert(btc.getBalance(miner.address) > 39, 'Miner should have remainder + new reward');
});

test('Double-spend is rejected', () => {
  const btc = new BitcoinBlockchain();
  const miner = new BitcoinWallet();
  const alice = new BitcoinWallet();
  const bob   = new BitcoinWallet();

  btc.mineBlock(miner.address);
  const utxos = btc.getUTXOsForAddress(miner.address);

  // First spend
  const tx1 = new BitcoinTransaction();
  utxos.forEach(u => tx1.addInput(u.txid, u.outputIndex, miner.publicKey));
  tx1.addOutput(alice.address, 25);
  tx1.addOutput(miner.address, 24.999);
  tx1.signInputs(miner.privateKey);
  btc.addToMempool(tx1);
  btc.mineBlock(miner.address);

  // Attempt to spend same UTXOs again
  const tx2 = new BitcoinTransaction();
  utxos.forEach(u => tx2.addInput(u.txid, u.outputIndex, miner.publicKey));
  tx2.addOutput(bob.address, 25);
  tx2.addOutput(miner.address, 24.999);
  tx2.signInputs(miner.privateKey);

  let threw = false;
  try { btc.addToMempool(tx2); } catch { threw = true; }
  assert(threw, 'Double-spend should throw');
});

test('Blockchain validates correctly', () => {
  const btc = new BitcoinBlockchain();
  const miner = new BitcoinWallet();
  btc.mineBlock(miner.address);
  btc.mineBlock(miner.address);
  assert(btc.isChainValid(), 'Chain should be valid');
});

test('Block reward halves at halving interval boundary', () => {
  const btc = new BitcoinBlockchain();
  assertEqual(btc.blockReward(0), 50);
  assertEqual(btc.blockReward(210000), 25);
  assertEqual(btc.blockReward(420000), 12.5);
});

// ─────────────────────────────────────────
// Ethereum Tests
// ─────────────────────────────────────────

console.log('\nEthereum Tests');
console.log('─'.repeat(40));

test('Creates an Ethereum wallet with checksummed address', () => {
  const w = new EthereumWallet();
  assert(w.address.startsWith('0x'), 'Address should start with 0x');
  assertEqual(w.address.length, 42);
  assert(w.privateKey.length === 64);
});

test('ETH transfer updates balances correctly', () => {
  const eth = new EthereumBlockchain();
  const alice = new EthereumWallet();
  const bob   = new EthereumWallet();
  const miner = new EthereumWallet();

  eth.getAccount(alice.address).balance = 100;

  const tx = new EthereumTransaction({
    from: alice.address, to: bob.address,
    value: 20, gasPrice: 1, gasLimit: 21000,
    nonce: 0,
  });
  tx.sign(alice.privateKey, alice.publicKey);
  eth.addToMempool(tx);
  eth.mineBlock(miner.address);

  assertEqual(eth.getBalance(bob.address), 20);
  assert(eth.getBalance(alice.address) < 80, 'Alice should have paid gas too');
});

test('Invalid nonce is rejected', () => {
  const eth = new EthereumBlockchain();
  const alice = new EthereumWallet();
  const bob   = new EthereumWallet();

  eth.getAccount(alice.address).balance = 100;

  const tx = new EthereumTransaction({
    from: alice.address, to: bob.address,
    value: 10, gasPrice: 1, gasLimit: 21000,
    nonce: 5, // wrong nonce
  });
  tx.sign(alice.privateKey, alice.publicKey);

  let threw = false;
  try { eth.addToMempool(tx); } catch { threw = true; }
  assert(threw, 'Wrong nonce should throw');
});

test('ERC-20 token deploys and initializes supply', () => {
  const eth = new EthereumBlockchain();
  const deployer = new EthereumWallet();
  const miner    = new EthereumWallet();

  eth.getAccount(deployer.address).balance = 500;
  const { abi, initialState } = createERC20Token({ name: 'TestToken', symbol: 'TST', totalSupply: 1000000 });
  initialState.balances[deployer.address] = 1000000;

  const deployTx = eth.deployContract({ name: 'TestToken', abi, initialState }, deployer);
  eth.addToMempool(deployTx);
  eth.mineBlock(miner.address);

  const contract = eth.contracts.get(deployTx.contractAddress);
  assert(contract !== undefined, 'Contract should be deployed');
  assertEqual(contract.state.totalSupply, 1000000);
  assertEqual(contract.state.balances[deployer.address], 1000000);
});

test('ERC-20 transfer works correctly', () => {
  const eth = new EthereumBlockchain();
  const deployer = new EthereumWallet();
  const alice    = new EthereumWallet();
  const miner    = new EthereumWallet();

  eth.getAccount(deployer.address).balance = 500;
  eth.getAccount(alice.address).balance    = 10;

  const { abi, initialState } = createERC20Token({ name: 'T', symbol: 'T', totalSupply: 10000 });
  initialState.balances[deployer.address] = 10000;

  const deployTx = eth.deployContract({ name: 'T', abi, initialState }, deployer);
  eth.addToMempool(deployTx);
  eth.mineBlock(miner.address);

  const addr = deployTx.contractAddress;
  const transferTx = eth.callContract(addr, 'transfer', [alice.address, 500], deployer);
  eth.addToMempool(transferTx);
  eth.mineBlock(miner.address);

  const contract = eth.contracts.get(addr);
  assertEqual(contract.state.balances[alice.address], 500);
  assertEqual(contract.state.balances[deployer.address], 9500);
});

test('ERC-20 transfer fails with insufficient balance', () => {
  const eth = new EthereumBlockchain();
  const deployer = new EthereumWallet();
  const alice    = new EthereumWallet();
  const miner    = new EthereumWallet();

  eth.getAccount(deployer.address).balance = 500;
  eth.getAccount(alice.address).balance    = 10;

  const { abi, initialState } = createERC20Token({ name: 'T', symbol: 'T', totalSupply: 100 });
  initialState.balances[deployer.address] = 100;

  const deployTx = eth.deployContract({ name: 'T', abi, initialState }, deployer);
  eth.addToMempool(deployTx);
  eth.mineBlock(miner.address);

  const addr = deployTx.contractAddress;
  const transferTx = eth.callContract(addr, 'transfer', [alice.address, 9999], deployer);
  eth.addToMempool(transferTx);
  const { receipts } = eth.mineBlock(miner.address);

  assertEqual(receipts[0].status, 'failed');
});

test('Ethereum chain is valid after multiple blocks', () => {
  const eth = new EthereumBlockchain();
  const miner = new EthereumWallet();
  eth.mineBlock(miner.address);
  eth.mineBlock(miner.address);
  eth.mineBlock(miner.address);
  assert(eth.isChainValid(), 'Chain should be valid');
});

// ─────────────────────────────────────────
// Summary
// ─────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
