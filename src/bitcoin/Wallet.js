const { generateKeyPair, doubleSha256 } = require('../utils/crypto');

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58(hex) {
  let num = BigInt('0x' + hex);
  let result = '';
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % 58n)] + result;
    num /= 58n;
  }
  return result || '1';
}

function deriveAddress(publicKeyHex) {
  const hash = doubleSha256(publicKeyHex);
  const checksum = hash.slice(0, 8);
  return '1' + toBase58(hash + checksum);
}

class BitcoinWallet {
  constructor() {
    const { privateKey, publicKey } = generateKeyPair();
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.address = deriveAddress(publicKey);
    this.label = '';
  }

  static fromPrivateKey(privateKeyHex) {
    const EC = require('elliptic').ec;
    const ec = new EC('secp256k1');
    const key = ec.keyFromPrivate(privateKeyHex, 'hex');
    const wallet = Object.create(BitcoinWallet.prototype);
    wallet.privateKey = privateKeyHex;
    wallet.publicKey = key.getPublic('hex');
    wallet.address = deriveAddress(wallet.publicKey);
    wallet.label = '';
    return wallet;
  }

  toString() {
    return `BitcoinWallet { address: ${this.address} }`;
  }
}

module.exports = BitcoinWallet;
