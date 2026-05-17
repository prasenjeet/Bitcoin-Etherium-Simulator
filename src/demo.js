/**
 * Bitcoin & Ethereum Simulator — Full Demo
 */

const BitcoinBlockchain = require('./bitcoin/Blockchain');
const BitcoinWallet = require('./bitcoin/Wallet');
const { BitcoinTransaction } = require('./bitcoin/Transaction');

const EthereumBlockchain = require('./ethereum/Blockchain');
const EthereumWallet = require('./ethereum/Wallet');
const EthereumTransaction = require('./ethereum/Transaction');
const { createERC20Token, createSimpleDEX } = require('./ethereum/SmartContract');

const SEP = '─'.repeat(60);

function log(msg) { console.log(msg); }
function section(title) { log(`\n${SEP}\n  ${title}\n${SEP}`); }

// ════════════════════════════════════════════════════════════
// BITCOIN DEMO
// ════════════════════════════════════════════════════════════

async function runBitcoinDemo() {
  section('BITCOIN SIMULATOR');

  const btc = new BitcoinBlockchain();

  log('\n[1] Creating wallets...');
  const alice = new BitcoinWallet();
  const bob   = new BitcoinWallet();
  const miner = new BitcoinWallet();

  alice.label = 'Alice';
  bob.label   = 'Bob';
  miner.label = 'Miner';

  log(`  Alice : ${alice.address}`);
  log(`  Bob   : ${bob.address}`);
  log(`  Miner : ${miner.address}`);

  log('\n[2] Mining block #1 (miner earns 50 BTC block reward)...');
  const block1 = btc.mineBlock(miner.address);
  log(`  Block #${block1.index} mined! Hash: ${block1.hash.slice(0, 20)}...`);
  log(`  Nonce: ${block1.nonce} | Time: ${block1.miningTime}ms`);
  log(`  Miner balance: ${btc.getBalance(miner.address)} BTC`);

  log('\n[3] Miner sends 10 BTC to Alice...');
  const utxos = btc.getUTXOsForAddress(miner.address);
  const tx1 = new BitcoinTransaction();
  utxos.forEach(u => tx1.addInput(u.txid, u.outputIndex, miner.publicKey));
  tx1.addOutput(alice.address, 10);
  tx1.addOutput(miner.address, utxos.reduce((s, u) => s + u.amount, 0) - 10 - 0.001); // change
  tx1.signInputs(miner.privateKey);

  const txid1 = btc.addToMempool(tx1);
  log(`  Transaction submitted: ${txid1.slice(0, 20)}...`);

  log('\n[4] Mining block #2 (confirms Alice\'s transaction)...');
  const block2 = btc.mineBlock(miner.address);
  log(`  Block #${block2.index} mined! Hash: ${block2.hash.slice(0, 20)}...`);
  log(`  Alice balance  : ${btc.getBalance(alice.address)} BTC`);
  log(`  Miner balance  : ${btc.getBalance(miner.address).toFixed(8)} BTC`);

  log('\n[5] Alice sends 3 BTC to Bob...');
  const aliceUTXOs = btc.getUTXOsForAddress(alice.address);
  const tx2 = new BitcoinTransaction();
  aliceUTXOs.forEach(u => tx2.addInput(u.txid, u.outputIndex, alice.publicKey));
  tx2.addOutput(bob.address, 3);
  tx2.addOutput(alice.address, aliceUTXOs.reduce((s, u) => s + u.amount, 0) - 3 - 0.0005);
  tx2.signInputs(alice.privateKey);

  btc.addToMempool(tx2);

  log('\n[6] Mining block #3...');
  btc.mineBlock(miner.address);
  log(`  Bob balance   : ${btc.getBalance(bob.address)} BTC`);
  log(`  Alice balance : ${btc.getBalance(alice.address).toFixed(8)} BTC`);

  log('\n[7] Blockchain validation...');
  const stats = btc.getStats();
  log(`  Height         : ${stats.height}`);
  log(`  Difficulty     : ${stats.difficulty}`);
  log(`  UTXO count     : ${stats.utxoCount}`);
  log(`  Total supply   : ${stats.totalSupply} BTC`);
  log(`  Chain valid    : ${stats.isValid}`);
}

// ════════════════════════════════════════════════════════════
// ETHEREUM DEMO
// ════════════════════════════════════════════════════════════

async function runEthereumDemo() {
  section('ETHEREUM SIMULATOR');

  const eth = new EthereumBlockchain();

  log('\n[1] Creating wallets...');
  const alice   = new EthereumWallet();
  const bob     = new EthereumWallet();
  const carol   = new EthereumWallet();
  const miner   = new EthereumWallet();
  const deployer = new EthereumWallet();

  alice.label   = 'Alice';
  bob.label     = 'Bob';
  carol.label   = 'Carol';
  deployer.label = 'Deployer';

  log(`  Alice    : ${alice.address}`);
  log(`  Bob      : ${bob.address}`);
  log(`  Deployer : ${deployer.address}`);

  // Seed balances directly (simulating faucet / genesis allocation)
  eth.getAccount(alice.address).balance   = 100;
  eth.getAccount(bob.address).balance     = 50;
  eth.getAccount(carol.address).balance   = 30;
  eth.getAccount(deployer.address).balance = 500;

  log('\n[2] Alice sends 5 ETH to Bob...');
  const tx1 = new EthereumTransaction({
    from: alice.address,
    to: bob.address,
    value: 5,
    gasPrice: 20,
    gasLimit: 21000,
    nonce: eth.getNonce(alice.address),
  });
  tx1.sign(alice.privateKey, alice.publicKey);
  eth.addToMempool(tx1);

  log('\n[3] Mining block #1...');
  const { block: b1, receipts: r1 } = eth.mineBlock(miner.address);
  log(`  Block #${b1.index} mined! Hash: ${b1.hash.slice(0, 22)}...`);
  log(`  Alice balance  : ${eth.getBalance(alice.address).toFixed(4)} ETH`);
  log(`  Bob balance    : ${eth.getBalance(bob.address).toFixed(4)} ETH`);
  log(`  Tx status      : ${r1[0].status}`);

  // ── ERC-20 Token Deployment ──────────────────────────────
  log('\n[4] Deployer creates an ERC-20 token (MyToken / MTK)...');
  const { abi, initialState } = createERC20Token({
    name: 'MyToken',
    symbol: 'MTK',
    totalSupply: 1_000_000,
    decimals: 18,
  });
  // Give the deployer an initial balance in the token
  initialState.balances[deployer.address] = 1_000_000;

  const deployTx = eth.deployContract(
    { name: 'MyToken', abi, initialState },
    deployer
  );
  eth.addToMempool(deployTx);

  log('\n[5] Mining block #2 (deploys ERC-20 contract)...');
  const { block: b2 } = eth.mineBlock(miner.address);
  log(`  Block #${b2.index} mined!`);

  const tokenAddress = deployTx.contractAddress;
  log(`  Contract deployed at : ${tokenAddress}`);

  const tokenContract = eth.contracts.get(tokenAddress);
  log(`  Total supply         : ${tokenContract.state.totalSupply.toLocaleString()} MTK`);

  // ── ERC-20 Transfer ─────────────────────────────────────
  log('\n[6] Deployer transfers 10,000 MTK to Alice...');
  const transferTx = eth.callContract(
    tokenAddress,
    'transfer',
    [alice.address, 10000],
    deployer
  );
  eth.addToMempool(transferTx);

  // ── ERC-20 Approve + TransferFrom ───────────────────────
  log('[7] Alice approves Bob to spend 500 MTK on her behalf...');
  const approveTx = eth.callContract(
    tokenAddress,
    'approve',
    [bob.address, 500],
    alice
  );
  eth.addToMempool(approveTx);

  log('\n[8] Mining block #3 (ERC-20 transfers)...');
  eth.mineBlock(miner.address);

  const aliceMTK = tokenContract.state.balances[alice.address] || 0;
  log(`  Alice MTK balance    : ${aliceMTK.toLocaleString()}`);
  log(`  Bob allowance        : ${tokenContract.state.allowances[alice.address]?.[bob.address] || 0} MTK`);

  // ── DEX Deployment ───────────────────────────────────────
  log('\n[9] Deployer launches a simple DEX (ETH/MTK pool)...');
  const dex = createSimpleDEX();
  const dexDeployTx = eth.deployContract(
    { name: 'SimpleDEX', abi: dex.abi, initialState: dex.initialState },
    deployer
  );
  eth.addToMempool(dexDeployTx);
  eth.mineBlock(miner.address);
  const dexAddress = dexDeployTx.contractAddress;
  log(`  DEX deployed at : ${dexAddress}`);

  log('\n[10] Deployer adds liquidity (1000 ETH-units / 500,000 MTK)...');
  const addLiqTx = eth.callContract(
    dexAddress, 'addLiquidity', [1000, 500000], deployer
  );
  eth.addToMempool(addLiqTx);
  eth.mineBlock(miner.address);

  const dexContract = eth.contracts.get(dexAddress);
  log(`  Reserves : ${dexContract.state.reserveA} A | ${dexContract.state.reserveB} B`);

  log('\n[11] Alice swaps 10 A-tokens for B-tokens...');
  const swapTx = eth.callContract(
    dexAddress, 'swapAForB', [10], alice
  );
  eth.addToMempool(swapTx);
  const { receipts: swapReceipts } = eth.mineBlock(miner.address);
  const swapReceipt = swapReceipts[0];
  log(`  Swap status    : ${swapReceipt.status}`);
  if (swapReceipt.status === 'success') {
    log(`  Amount out     : ${swapReceipt.returnValue?.toFixed(4)} B-tokens`);
    const evt = swapReceipt.events[0];
    if (evt) log(`  Event          : ${evt.event} — ${JSON.stringify(evt.args)}`);
  }

  log('\n[12] Blockchain stats...');
  const stats = eth.getStats();
  log(`  Height         : ${stats.height}`);
  log(`  Accounts       : ${stats.accounts}`);
  log(`  Contracts      : ${stats.contracts}`);
  log(`  Mempool        : ${stats.mempoolSize}`);
  log(`  Chain valid    : ${stats.isValid}`);
}

// ════════════════════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════════════════════

(async () => {
  try {
    await runBitcoinDemo();
    await runEthereumDemo();
    section('DEMO COMPLETE');
  } catch (err) {
    console.error('\nDemo error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
