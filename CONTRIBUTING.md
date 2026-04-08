# Contributing to SolSab

Thank you for your interest in contributing to SolSab! This guide will help you get set up for development.

## Pre-Requisites

Ensure you have the following software installed and configured on your machine:

- [Rust (Nightly)](https://rust-lang.org/tools/install)
- [Solana CLI v2.1.21](https://solana.com/docs/intro/installation#install-the-solana-cli)
- [Anchor CLI v0.31.1](https://solana.com/docs/intro/installation#install-anchor-cli) (Solana development framework)
- [Node.js v23+](https://nodejs.org/en)
- [Just](https://github.com/casey/just) (command runner)
- [Bun](https://bun.sh/docs/installation) (package manager)
- [Ni](https://github.com/antfu-collective/ni) (package manager resolver)
- [shfmt](https://github.com/mvdan/sh#shfmt) (shell script formatter) - install via `brew install shfmt` (macOS),
  `apt install shfmt` (Ubuntu), or download from [releases](https://github.com/mvdan/sh/releases)

## Set Up

### Wallet

Make sure to configure your local [Solana wallet](https://anchor-lang.com/docs/installation#solana-cli-basics).

### Clone the repository

```shell
git clone git@github.com:sablier-labs/solsab.git && cd solsab
```

### Install dependencies

```shell
bun install
```

Run one-time setup script:

```shell
just setup
```

### List available scripts

To see a list of all available scripts, run this command:

```shell
just --list
```

### Build the programs

```bash
just build
```

### Run full code checks

> [!TIP]
>
> Make sure to build the programs first.

```bash
just full-check
```

This will check:

- TypeScript/JavaScript formatting and linting (Biome)
- Markdown and YAML formatting (Prettier)
- Bash script formatting (shfmt)
- TypeScript type checking
- Rust code formatting and linting

### Testing

```bash
just test
```

## VSCode Extensions

See the recommended VSCode extensions in [`.vscode/extensions.json`](./.vscode/extensions.json).

## Other useful information

Solana Cluster RPC URLs:

- **Mainnet Beta**: https://api.mainnet-beta.solana.com
- **Devnet**: https://api.devnet.solana.com
- **Testnet**: https://api.testnet.solana.com
- **Localnet**: http://127.0.0.1:8899
