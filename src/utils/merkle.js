const { sha256 } = require('./crypto');

function buildMerkleTree(items) {
  if (items.length === 0) return '0'.repeat(64);
  const hashes = items.map(item => sha256(JSON.stringify(item)));
  return computeRoot(hashes);
}

function computeRoot(hashes) {
  if (hashes.length === 1) return hashes[0];
  const next = [];
  for (let i = 0; i < hashes.length; i += 2) {
    const left = hashes[i];
    const right = i + 1 < hashes.length ? hashes[i + 1] : hashes[i];
    next.push(sha256(left + right));
  }
  return computeRoot(next);
}

module.exports = { buildMerkleTree };
