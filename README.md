## SolSab

Sablier programs on Solana

## Pre-Requisites

Ensure you have the following software installed and configured on your machine:

- **[Git](https://git-scm.com/downloads)** (has to be installed manually)
- **[Rust](https://www.rust-lang.org/)**
- **[Solana CLI](https://solana.com/)**
- **[Anchor CLI](https://www.anchor-lang.com/)**

**Tip**: Follow the _[Quick Installation](https://www.anchor-lang.com/docs/installation#quick-installation)_ guide from Anchor to install the above dependencies, and the _[Solana CLI Basics](https://www.anchor-lang.com/docs/installation#solana-cli-basics)_ section - to configure the Solana CLI upon installation.

## Set Up

Clone the SolSab repository:

```bash
git clone https://github.com/sablier-labs/solsab.git
```

Navigate to the project’s directory:

```bash
cd solsab
```

## Building & Testing

Build the project with:

```bash
anchor build
```

or the shortcut:

```bash
anchor b
```

Test it with:

```bash
anchor test
```

or the shortcut:

```bash
anchor t
```

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
