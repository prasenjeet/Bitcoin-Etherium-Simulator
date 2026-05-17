const { generateKeyPair, keccak256 } = require('../utils/crypto');

function deriveEthAddress(publicKeyHex) {
  // Remove the '04' prefix (uncompressed key marker) if present
  const pubKey = publicKeyHex.startsWith('04') ? publicKeyHex.slice(2) : publicKeyHex;
  const hash = keccak256(Buffer.from(pubKey, 'hex'));
  return '0x' + hash.slice(-40);
}

function toChecksumAddress(address) {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = keccak256(addr);
  let result = '0x';
  for (let i = 0; i < addr.length; i++) {
    result += parseInt(hash[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i];
  }
  return result;
}

class EthereumWallet {
  constructor() {
    const { privateKey, publicKey } = generateKeyPair();
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.address = toChecksumAddress(deriveEthAddress(publicKey));
    this.label = '';
  }

  static fromPrivateKey(privateKeyHex) {
    const EC = require('elliptic').ec;
    const ec = new EC('secp256k1');
    const key = ec.keyFromPrivate(privateKeyHex, 'hex');
    const wallet = Object.create(EthereumWallet.prototype);
    wallet.privateKey = privateKeyHex;
    wallet.publicKey = key.getPublic('hex');
    wallet.address = toChecksumAddress(deriveEthAddress(wallet.publicKey));
    wallet.label = '';
    return wallet;
  }

  toString() {
    return `EthereumWallet { address: ${this.address} }`;
  }
}

module.exports = EthereumWallet;
