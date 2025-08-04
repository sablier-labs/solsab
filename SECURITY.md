# Security

Ensuring the security of the Sablier Protocol is our utmost priority. We have dedicated significant efforts towards the
design and testing of the protocol to guarantee its safety and reliability. However, we are aware that security is a
continuous process. If you believe you have found a security vulnerability, please read the
[Bug Bounty Program](https://sablier.notion.site/bug-bounty), and share a report privately with us.

## Assumptions

The `SolSab` programs (`sablier_lockup` and `sablier_merkle_instant`) have been developed with the following assumptions
in mind (which any disclosure must respect to qualify as a vulnerability):

### General Assumptions:

1. Programs are assumed to have been initialized before being used.
2. Only standard SPL and Token2022 tokens without any special behavior are supported. Here are some examples of tokens
   that are **not supported**:

   - Tokens implementing transfer fees (“fee-on-transfer” tokens).
   - Rebase tokens, interest-bearing tokens, or tokens the balances of which can change independently of explicit
     transfer calls.

3. The maximum token supply must remain within reasonable limits to avoid integer over- and underflows.
4. The `fee_collector`, `chainlink_program` and `chainlink_sol_usd_feed` accounts specified during program
   initialization must be a valid Solana account.
5. Loss of access or control over the `fee_collector` account does **not** constitute a security vulnerability.

### `LockupLinear` Assumptions:

1. The total amount for token streaming/vesting is locked upon stream creation and stays locked until the recipient
   withdraws it - or the sender cancels the stream (if the stream is cancelable).
2. Stream creation requires a unique “salt” to generate the Stream NFT Mint account. Collisions or duplicate salts are
   considered a misuse by the Stream creator and not a security flaw in the program itself.

### `MerkleInstant` Assumptions:

1. Although technically possible, creating `MerkleInstant` campaigns before program initialization is acceptable and not
   considered a vulnerability due to the following reasons:

   - Even though the campaigns created like that are unusable, at first, they become fully functional immediately after
     the initialization.
   - The time window between program deployment and initialization is expected to be negligible.
   - Implementing prevention logic for this scenario would’ve introduced unnecessary complexity without proportional
     security benefits.

2. We accept campaigns created with $\texttt{start\_time} \geq \texttt{expiration\_time}$, as the program does not allow
   claims for such campaigns, while any tokens such a campaign has been funded with can be clawed back by the campaign
   creator.
3. The campaign funder is assumed to either be the campaign creator - or be aware of the fact that it's just the
   campaign creator who is authorized to claw back the unclaimed tokens from the campaign.
4. Campaigns must be funded via a separate Tx after their creation. The program allows the campaign creator to clawback
   unclaimed tokens within the defined grace period or after expiration.
