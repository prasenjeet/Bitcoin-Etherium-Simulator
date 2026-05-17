/**
 * Bitcoin & Ethereum Simulator — Interactive CLI
 */

const readline = require('readline');

const BitcoinBlockchain = require('./bitcoin/Blockchain');
const BitcoinWallet = require('./bitcoin/Wallet');
const { BitcoinTransaction } = require('./bitcoin/Transaction');

const EthereumBlockchain = require('./ethereum/Blockchain');
const EthereumWallet = require('./ethereum/Wallet');
const EthereumTransaction = require('./ethereum/Transaction');
const { createERC20Token, createSimpleDEX } = require('./ethereum/SmartContract');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

// ── State ────────────────────────────────────────────────────
const btc = new BitcoinBlockchain();
const eth = new EthereumBlockchain();
const btcWallets = new Map();
const ethWallets = new Map();

function pad(str, n = 20) { return String(str).padEnd(n); }

function printTable(rows) {
  rows.forEach(([k, v]) => console.log(`  ${pad(k + ':')} ${v}`));
}

// ── Bitcoin helpers ──────────────────────────────────────────

function btcCreateWallet(name) {
  const w = new BitcoinWallet();
  w.label = name;
  btcWallets.set(name, w);
  console.log(`\n  Created BTC wallet "${name}"`);
  printTable([
    ['Address', w.address],
    ['PublicKey', w.publicKey.slice(0, 30) + '...'],
  ]);
}

function btcMine(minerName) {
  let miner = btcWallets.get(minerName);
  if (!miner) { miner = new BitcoinWallet(); miner.label = minerName; btcWallets.set(minerName, miner); }
  console.log(`\n  Mining BTC block...`);
  const block = btc.mineBlock(miner.address);
  printTable([
    ['Block', block.index],
    ['Hash', block.hash.slice(0, 30) + '...'],
    ['Nonce', block.nonce],
    ['Mining time', block.miningTime + 'ms'],
    ['Reward', btc.blockReward(block.index) + ' BTC'],
  ]);
}

function btcSend(fromName, toName, amount) {
  const sender   = btcWallets.get(fromName);
  const receiver = btcWallets.get(toName);
  if (!sender)   return console.log(`  Wallet "${fromName}" not found.`);
  if (!receiver) return console.log(`  Wallet "${toName}" not found.`);

  const utxos = btc.getUTXOsForAddress(sender.address);
  const total = utxos.reduce((s, u) => s + u.amount, 0);
  const fee   = 0.0001;
  if (total < amount + fee) return console.log(`  Insufficient balance (${total} BTC)`);

  const tx = new BitcoinTransaction();
  utxos.forEach(u => tx.addInput(u.txid, u.outputIndex, sender.publicKey));
  tx.addOutput(receiver.address, amount);
  tx.addOutput(sender.address, total - amount - fee);
  tx.signInputs(sender.privateKey);

  const txid = btc.addToMempool(tx);
  console.log(`\n  Transaction submitted (pending)`);
  printTable([['TxID', txid.slice(0, 30) + '...'], ['Amount', amount + ' BTC'], ['Fee', fee + ' BTC']]);
}

function btcStatus() {
  const stats = btc.getStats();
  console.log('\n  Bitcoin Blockchain Status');
  printTable([
    ['Height', stats.height],
    ['Difficulty', stats.difficulty],
    ['Mempool', stats.mempoolSize + ' txs'],
    ['UTXO set', stats.utxoCount],
    ['Total supply', stats.totalSupply + ' BTC'],
    ['Chain valid', stats.isValid],
  ]);
  if (btcWallets.size > 0) {
    console.log('\n  Wallets:');
    btcWallets.forEach((w, name) => {
      console.log(`    ${pad(name)} ${btc.getBalance(w.address).toFixed(8)} BTC   ${w.address}`);
    });
  }
}

// ── Ethereum helpers ─────────────────────────────────────────

function ethCreateWallet(name) {
  const w = new EthereumWallet();
  w.label = name;
  ethWallets.set(name, w);
  console.log(`\n  Created ETH wallet "${name}"`);
  printTable([['Address', w.address]]);
}

function ethFaucet(name, amount) {
  const w = ethWallets.get(name);
  if (!w) return console.log(`  Wallet "${name}" not found.`);
  eth.getAccount(w.address).balance += amount;
  console.log(`  Faucet: sent ${amount} ETH to ${name} (${w.address})`);
}

function ethMine(minerName) {
  let miner = ethWallets.get(minerName);
  if (!miner) { miner = new EthereumWallet(); miner.label = minerName; ethWallets.set(minerName, miner); }
  console.log(`\n  Mining ETH block...`);
  const { block } = eth.mineBlock(miner.address);
  printTable([
    ['Block', block.index],
    ['Hash', block.hash.slice(0, 30) + '...'],
    ['Nonce', block.nonce],
    ['Mining time', block.miningTime + 'ms'],
    ['Gas used', block.gasUsed],
  ]);
}

function ethSend(fromName, toName, amount) {
  const sender   = ethWallets.get(fromName);
  const receiver = ethWallets.get(toName);
  if (!sender)   return console.log(`  Wallet "${fromName}" not found.`);
  if (!receiver) return console.log(`  Wallet "${toName}" not found.`);

  const tx = new EthereumTransaction({
    from: sender.address, to: receiver.address,
    value: amount, gasPrice: 20, gasLimit: 21000,
    nonce: eth.getNonce(sender.address),
  });
  tx.sign(sender.privateKey, sender.publicKey);

  try {
    const hash = eth.addToMempool(tx);
    console.log(`\n  Transaction submitted`);
    printTable([['Hash', hash.slice(0, 30) + '...'], ['Value', amount + ' ETH']]);
  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }
}

function ethDeployERC20(deployerName, tokenName, symbol, supply) {
  const deployer = ethWallets.get(deployerName);
  if (!deployer) return console.log(`  Wallet "${deployerName}" not found.`);

  const { abi, initialState } = createERC20Token({ name: tokenName, symbol, totalSupply: supply });
  initialState.balances[deployer.address] = supply;

  const tx = eth.deployContract({ name: tokenName, abi, initialState }, deployer);
  try {
    eth.addToMempool(tx);
    console.log(`\n  ERC-20 deploy transaction queued. Mine a block to confirm.`);
    console.log(`  (Token: ${tokenName} / ${symbol}, supply: ${supply})`);
  } catch (err) {
    console.log(`  Error: ${err.message}`);
  }
}

function ethStatus() {
  const stats = eth.getStats();
  console.log('\n  Ethereum Blockchain Status');
  printTable([
    ['Height', stats.height],
    ['Difficulty', stats.difficulty],
    ['Mempool', stats.mempoolSize + ' txs'],
    ['Accounts', stats.accounts],
    ['Contracts', stats.contracts],
    ['Chain valid', stats.isValid],
  ]);
  if (ethWallets.size > 0) {
    console.log('\n  Wallets:');
    ethWallets.forEach((w, name) => {
      console.log(`    ${pad(name)} ${eth.getBalance(w.address).toFixed(6)} ETH   ${w.address}`);
    });
  }
  if (eth.contracts.size > 0) {
    console.log('\n  Contracts:');
    eth.contracts.forEach((c, addr) => {
      console.log(`    ${pad(c.name)} ${addr}`);
    });
  }
}

// ── Menu ─────────────────────────────────────────────────────

function printHelp() {
  console.log(`
  ╔═══════════════════════════════════════════════════╗
  ║      Bitcoin & Ethereum Simulator — CLI           ║
  ╚═══════════════════════════════════════════════════╝

  Bitcoin commands:
    btc wallet <name>             Create a BTC wallet
    btc mine <miner>              Mine a block
    btc send <from> <to> <amt>    Send BTC (add to mempool)
    btc status                    Show chain & wallets

  Ethereum commands:
    eth wallet <name>             Create an ETH wallet
    eth faucet <name> <amt>       Fund a wallet (test ETH)
    eth mine <miner>              Mine a block
    eth send <from> <to> <amt>    Send ETH (add to mempool)
    eth erc20 <deployer> <name> <symbol> <supply>
                                  Deploy an ERC-20 token
    eth status                    Show chain & wallets

  Other:
    demo    Run the full demo
    help    Show this help
    exit    Quit
`);
}

async function main() {
  printHelp();

  while (true) {
    const input = (await ask('\n> ')).trim();
    if (!input) continue;

    const [cmd, ...args] = input.split(/\s+/);

    try {
      if (cmd === 'exit' || cmd === 'quit') { rl.close(); break; }
      else if (cmd === 'help') printHelp();
      else if (cmd === 'demo') { rl.close(); require('./demo'); break; }

      else if (cmd === 'btc') {
        const sub = args[0];
        if (sub === 'wallet')  btcCreateWallet(args[1]);
        else if (sub === 'mine')   btcMine(args[1] || 'miner');
        else if (sub === 'send')   btcSend(args[1], args[2], parseFloat(args[3]));
        else if (sub === 'status') btcStatus();
        else console.log('  Unknown btc command. Type "help".');
      }

      else if (cmd === 'eth') {
        const sub = args[0];
        if (sub === 'wallet')  ethCreateWallet(args[1]);
        else if (sub === 'faucet') ethFaucet(args[1], parseFloat(args[2]));
        else if (sub === 'mine')   ethMine(args[1] || 'miner');
        else if (sub === 'send')   ethSend(args[1], args[2], parseFloat(args[3]));
        else if (sub === 'erc20')  ethDeployERC20(args[1], args[2], args[3], parseInt(args[4]));
        else if (sub === 'status') ethStatus();
        else console.log('  Unknown eth command. Type "help".');
      }

      else {
        console.log('  Unknown command. Type "help".');
      }
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
}

main().catch(console.error);
