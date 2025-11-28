# SolSab

Sablier programs on Solana

## Architecture

SolSab uses a monorepo structure with two main Solana programs and a shared utilities crate.

### Lockup

Sablier Lockup is a token distribution protocol that enables onchain vesting and payments. Our flagship model is the
linear stream, which distributes tokens on a continuous, by-the-second basis.

The way it works is that the sender of a payment stream first deposits a specific amount of SPL, or Token2022, tokens in
a program. Then, the program progressively allocates the funds to the recipient, who can access them as they become
available over time. The payment rate is influenced by various factors, including the start and end times, as well as
the total amount of tokens deposited.

### Merkle Instant

Merkle Instant is a program that enables the creation of token airdrop campaigns using Merkle trees, allowing users to
instantly claim and receive their allocation through a single transaction.

### Shared Utilities

The `sablier-common` crate contains shared utility functions used across both the Lockup and Merkle Instant programs.

It eliminates code duplication and ensures consistent behavior across both programs while maintaining their independence
during deployment.

## Contributing 🤝

We welcome contributions!

- 🐛 [Bug reports](../../issues/new)
- 💬 [Discussions](../../discussions/new)
- 💬 [Discord](https://discord.sablier.com)

For guidance on how to make PRs, see the [CONTRIBUTING](./CONTRIBUTING.md) guide.

## License

See [LICENSE.md](./LICENSE.md).
