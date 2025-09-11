# SolSab [![Github Actions][gha-badge]][gha] [![Anchor][anchor-badge]][anchor] [![Discord][discord-badge]][discord] [![Twitter][twitter-badge]][twitter]

[gha]: https://github.com/sablier-labs/lockup/actions
[gha-badge]: https://github.com/sablier-labs/lockup/actions/workflows/ci.yml/badge.svg
[discord]: https://discord.gg/bSwRCwWRsT
[discord-badge]: https://img.shields.io/discord/659709894315868191
[anchor]: https://www.anchor-lang.com/docs
[anchor-badge]: https://img.shields.io/badge/Built%20with-Anchor-2298BD.svg
[twitter-badge]: https://img.shields.io/twitter/follow/Sablier
[twitter]: https://x.com/Sablier

Sablier programs on Solana, in-depth documentation is available at [docs.sablier.com](https://docs.sablier.com).

## Architecture

SolSab uses a monorepo structure with two main Solana programs.

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

## Contributing 🤝

We welcome contributions!

- 🐛 [Bug reports](../../issues/new)
- 💬 [Discussions](../../discussions/new)
- 💬 [Discord](https://discord.sablier.com)

For guidance on how to make PRs, see the [CONTRIBUTING](./CONTRIBUTING.md) guide.

## License

See [LICENSE.md](./LICENSE.md).
