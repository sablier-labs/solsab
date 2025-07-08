# SolSab

Sablier programs on Solana

## Pre-Requisites

Ensure you have the following software installed and configured on your machine:

- **[Git](https://git-scm.com/downloads)**
- **[Rust](https://rust-lang.org/tools/install)**
- **[Bun](https://bun.sh/docs/installation)**
- **[Solana CLI](https://solana.com/docs/intro/installation#quick-installation)**
- **[Anchor CLI](https://www.anchor-lang.com/docs/installation#install-anchor-cli)**

## Set Up

### Solana config

Make sure to configure your local [Solana wallet](https://www.anchor-lang.com/docs/installation#solana-cli-basics).

### Clone the SolSab repository:

```bash
git clone https://github.com/sablier-labs/solsab.git
```

### Navigate to the project’s directory:

```bash
cd solsab
```

### Install dependencies

```bash
bun install
```

## Building & Testing

Build the project with:

```bash
bun run build
```

Test it with:

```bash
bun run t
```

## Architecture

SolSab uses a monorepo structure with two main Solana programs.

### Lockup

Sablier Lockup is a token distribution protocol that enables onchain vesting and payments. Our flagship model is the linear stream, which distributes tokens on a continuous, by-the-second basis.

The way it works is that the sender of a payment stream first deposits a specific amount of SPL, or Token2022, tokens in a program. Then, the program progressively allocates the funds to the recipient, who can access them as they become available over time. The payment rate is influenced by various factors, including the start and end times, as well as the total amount of tokens deposited.

### Merkle Instant

Merkle Instant is a program that enables the creation of token airdrop campaigns using Merkle trees, allowing users to instantly claim and receive their allocation through a single transaction.

## Recommended VS Code Extensions

To improve your development experience, consider installing the following Visual Studio Code extensions:

1. **[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)**
2. **[Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml)**
3. **[Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)**

## Other useful information

Solana Cluster RPC URLs:

- **Mainnet Beta**: [https://api.mainnet-beta.solana.com](https://api.mainnet-beta.solana.com)
- **Devnet**: [https://api.devnet.solana.com](https://api.devnet.solana.com)
- **Testnet**: [https://api.testnet.solana.com](https://api.testnet.solana.com)
- **Localnet**: [http://127.0.0.1:8899](http://127.0.0.1:8899)

---

Congrats, you’re, now, all set for SolSab!
