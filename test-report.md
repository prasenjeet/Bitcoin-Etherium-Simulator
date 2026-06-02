# Test Report: PR #2 Bug Fixes — Bitcoin & Ethereum Simulator

## Summary
Ran shell-based tests against the merged PR #2 code on `main`. All Devin Review findings from PR #2 were already addressed by 3 successive fix commits before merge. Tested all 6 specific bug fixes end-to-end via adversarial scripts.

## Test Results

### Regression Tests
- **Test 1: Unit tests (14/14)** — passed
- **Test 2: Full demo (BTC + ETH + ERC-20 + DEX)** — passed, chain valid = true

### Adversarial Tests (targeting PR #2 fixes)
- **Test 3: BTC mempool double-spend rejection** — passed — tx2 reusing pending UTXOs correctly throws "already spent by pending transaction"
- **Test 4: BTC coinbase txid includes fees** — passed — coinbase output = 50.5 BTC (50 reward + 0.5 fee), txid stable after recomputation
- **Test 5: ETH cumulative balance check** — passed — 3rd tx correctly rejected when cumulative gas cost (0.00126 ETH) exceeds balance (0.001 ETH)
- **Test 6: ETH pending nonce ordering** — passed — sequential nonces 0,1 accepted; wrong nonce 5 rejected with "expected 2, got 5"; both txs mined correctly
- **Test 7: ETH multi-pass tx selection** — passed — tx0 (nonce=0, gasPrice=10) and tx1 (nonce=1, gasPrice=100) both included in block despite gas-price sort putting tx1 first; Bob received 3 ETH (1+2)
- **Test 8: ETH deploy + call with pending nonces** — passed — `deployContract` uses nonce=0, `callContract` gets nonce=1 via `getPendingNonce`, second call gets nonce=2; all 3 txs execute correctly across 2 blocks

### Escalations
- None. All fixes are working as expected.

### Note on Test 8
The initial version of Test 8 attempted to queue a deploy and a contract call in the same block without mining between them. This failed because `contractAddress` is only set on the transaction object during block execution (`_deployContract`), not at transaction creation time. This is expected behavior — the contract must be deployed (mined) before it can be called. The test was redesigned to mine between deploy and call, while still verifying `getPendingNonce` works correctly for queuing multiple calls without mining.

## Environment
- Node.js on Ubuntu
- No web UI — all tests via shell commands
- Test scripts: `src/test.js` (14 unit tests), `src/demo.js` (full demo), `src/adversarial-tests.js` (6 PR-specific tests)
