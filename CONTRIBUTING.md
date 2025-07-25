# Contributing to SolSab

Thank you for your interest in contributing to SolSab! This guide will help you get set up for development.

## Pre-Requisites

Ensure you have the following software installed and configured on your machine:

- [Rust (Nightly)](https://rust-lang.org/tools/install)
- [Solana CLI](https://solana.com/docs/intro/installation#install-the-solana-cli)
- [Anchor CLI](https://solana.com/docs/intro/installation#install-anchor-cli) (Solana development framework)
- [Node.js v23+](https://nodejs.org/en)
- [Just](https://github.com/casey/just) (command runner)
- [Bun](https://bun.sh/docs/installation) (package manager)
- [Ni](https://github.com/antfu-collective/ni) (package manager resolver)

> [!NOTE] Consider running this one-time script to install all Sablier dependencies.
>
> ```sh
> curl -fsSL https://raw.githubusercontent.com/sablier-labs/team-setup/main/sablier.sh | sh
> ```

## Set Up

### Wallet

Make sure to configure your local [Solana wallet](https://anchor-lang.com/docs/installation#solana-cli-basics).

### Clone the SolSab repository:

```bash
git clone https://github.com/sablier-labs/solsab.git && cd solsab
```

### Install dependencies

```bash
bun install
```

### Building

Build the project:

```bash
bun run build
```

### Testing

Test the project:

```bash
bun run t
```

## VSCode Extensions

See the recommended VSCode extensions in [`.vscode/extensions.json`](./.vscode/extensions.json).

## Other useful information

Solana Cluster RPC URLs:

- **Mainnet Beta**: https://api.mainnet-beta.solana.com
- **Devnet**: https://api.devnet.solana.com
- **Testnet**: https://api.testnet.solana.com
- **Localnet**: http://127.0.0.1:8899
