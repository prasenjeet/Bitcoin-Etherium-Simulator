const crypto = require('node:crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function doubleSha256(data) {
  return sha256(sha256(data));
}

function keccak256(data) {
  const { keccak256: k } = require('js-sha3');
  return k(data);
}

function generateKeyPair() {
  const EC = require('elliptic').ec;
  const ec = new EC('secp256k1');
  const key = ec.genKeyPair();
  return {
    privateKey: key.getPrivate('hex'),
    publicKey: key.getPublic('hex'),
    _key: key,
  };
}

function sign(privateKeyHex, data) {
  const EC = require('elliptic').ec;
  const ec = new EC('secp256k1');
  const key = ec.keyFromPrivate(privateKeyHex, 'hex');
  const hash = sha256(JSON.stringify(data));
  const sig = key.sign(hash);
  return sig.toDER('hex');
}

function verify(publicKeyHex, data, signature) {
  try {
    const EC = require('elliptic').ec;
    const ec = new EC('secp256k1');
    const key = ec.keyFromPublic(publicKeyHex, 'hex');
    const hash = sha256(JSON.stringify(data));
    return key.verify(hash, signature);
  } catch {
    return false;
  }
}

function randomHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { sha256, doubleSha256, keccak256, generateKeyPair, sign, verify, randomHex };
