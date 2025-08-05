# Security

Ensuring the security of the Sablier Protocol is our utmost priority. We have dedicated significant efforts towards the
design and testing of the protocol to guarantee its safety and reliability. However, we are aware that security is a
continuous process. If you believe you have found a security vulnerability, please read the
[Bug Bounty Program](https://sablier.notion.site/bug-bounty), and share a report privately with us.

## Assumptions

The `SolSab` programs (`sablier_lockup` and `sablier_merkle_instant`) have been developed with the following assumptions
in mind (which any disclosure must respect to qualify as a vulnerability):

### General

1. Programs are initialized before they are used.
2. Only standard SPL and Token2022 tokens are supported. Tokens with custom features are not compatible. Here are some
   examples of tokens that are **not supported**:

   - Tokens implementing transfer fees ("fee-on-transfer" tokens).
   - Interest-bearing tokens or rebasing tokens, i.e. tokens whose balances can change independently of explicit
     transfer calls.

3. The maximum token supply must remain within reasonable limits to avoid integer over- and underflows.
4. The `fee_collector`, `chainlink_program` and `chainlink_sol_usd_feed` accounts specified during program
   initialization are valid Solana accounts.
5. Loss of access or control over the `fee_collector` account does **not** constitute a security vulnerability.

### `sablier_lockup`

1. Creating a stream requires a unique "salt" to generate the Stream NFT Mint account. Collisions or duplicate salts are
   considered a misuse by the Stream creator, and not a security flaw of the program itself.

### `sablier_merkle_instant`

1. Creating `MerkleInstant` campaigns before program initialization is acceptable and not considered a vulnerability.

   - These campaigns are unusable at first, but they become fully functional immediately post-initialization.
   - The time window between program deployment and initialization is expected to be negligible.

2. We accept campaigns created with $\mathtt{start\_time} \geq \mathtt{expiration\_time}$, as the program does not allow
   claims for such campaigns. If any tokens are transferred into them, they can be clawed back by the campaign creator.
3. The creator can fund the campaign in a separate transaction, after its creation. The campaign creator can clawback
   unclaimed tokens within a 7-day grace period, or after the expiration time (if it's set).
