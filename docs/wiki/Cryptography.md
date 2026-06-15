# Cryptography

All cryptographic primitives are in `src/utils/crypto.js`.

## Hash Functions

### SHA-256 (`sha256`)

Used throughout the Bitcoin chain.

```js
const { sha256 } = require('./src/utils/crypto');
sha256('hello') // → 64-char hex string
```

### Double SHA-256 (`doubleSha256`)

Bitcoin's standard — applying SHA-256 twice for added collision resistance:

```js
const { doubleSha256 } = require('./src/utils/crypto');
doubleSha256(data) // sha256(sha256(data))
```

Used for:
- Block hash computation
- Bitcoin address derivation checksum

### Keccak-256 (`keccak256`)

Ethereum's primary hash function (note: **not** the NIST SHA-3 standard, though both derive from Keccak):

```js
const { keccak256 } = require('./src/utils/crypto');
keccak256(data) // → 64-char hex string
```

Used for:
- Ethereum address derivation (last 20 bytes of the public key hash)
- Ethereum block hash computation
- Contract address computation
- Transaction hash computation
- Smart contract template IDs

## Elliptic Curve Digital Signatures (ECDSA)

Both chains use the **secp256k1** elliptic curve — the same curve used by real Bitcoin and Ethereum (before Ethereum's planned migration to BLS12-381 for validators).

### Key Generation

```js
const { generateKeyPair } = require('./src/utils/crypto');

const { privateKey, publicKey } = generateKeyPair();
// privateKey: 64-char hex (256-bit random scalar)
// publicKey:  130-char hex (uncompressed point: 04 + x + y)
```

Internally uses `elliptic.ec('secp256k1').genKeyPair()`.

### Signing

```js
const { sign } = require('./src/utils/crypto');

const signature = sign(privateKeyHex, dataObject);
// 1. JSON.stringify(dataObject) → string
// 2. sha256(string) → 32-byte digest
// 3. secp256k1 ECDSA sign → DER-encoded hex string
```

### Verification

```js
const { verify } = require('./src/utils/crypto');

const ok = verify(publicKeyHex, dataObject, signature);
// Recomputes sha256(JSON.stringify(dataObject)) and verifies DER signature
// Returns true/false (never throws)
```

## Address Derivation

### Bitcoin

```
privateKey (256-bit random)
    │  secp256k1 multiply by generator point
    ▼
publicKey (uncompressed, 65 bytes)
    │  doubleSha256
    ▼
hash (32 bytes)
    │  take first 4 bytes of doubleSha256(hash) as checksum
    ▼
payload = hash + checksum (36 bytes as hex)
    │  Base58 encode
    ▼
address: "1" + Base58(payload)
```

**Base58 alphabet** (no 0, O, I, l to avoid visual ambiguity):
```
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

### Ethereum

```
privateKey (256-bit random)
    │  secp256k1 multiply by generator point
    ▼
publicKey (uncompressed, 65 bytes: 04 || x || y)
    │  strip leading 04
    ▼
64-byte raw key (x + y)
    │  keccak256
    ▼
32-byte hash
    │  take last 20 bytes
    ▼
raw address (40 hex chars)
    │  EIP-55 checksum capitalisation
    ▼
address: "0x" + mixedCaseHex
```

**EIP-55 checksum:**
```
For each character c at index i in the lowercase address:
  if keccak256(lowercase_address)[i] >= 8 → uppercase(c)
  else → c
```

This makes checksummed addresses self-verifying — an incorrect character almost certainly changes a lowercase letter that should be upper, or vice versa.

## Contract Address Derivation (Ethereum)

Contract addresses are deterministic — they are derived from the deployer's address and their current nonce:

```js
SmartContract.computeAddress(creator, nonce)
// keccak256(`${creator}${nonce}`).slice(-40)
// Returns "0x" + last 20 bytes
```

This mirrors Ethereum's `CREATE` opcode behaviour (simplified — real Ethereum uses RLP encoding of `[creator, nonce]`).

## Security Note

This simulator uses real cryptographic libraries (`elliptic`, `js-sha3`) and real secp256k1 ECDSA. However:

- Private keys are held in memory as plain strings (no hardware wallet, no key stretching)
- The "blockchain" lives in a single Node.js process — there is no network, no peer discovery, and no consensus among nodes
- It is **not** suitable for managing real funds or running on a public network

Its purpose is **education** — understanding the concepts, not production use.
