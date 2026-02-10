**Subject:** Re: Security Report - Permissionless Initialization Vulnerability

Thank you for taking the time to submit this security report. We appreciate your diligence in reviewing our codebase.

We have reviewed your findings regarding the permissionless `initialize` instruction in both `sablier_lockup` and
`sablier_merkle_instant` programs. Your technical analysis is accurate—the initialization instruction does not enforce
an authority check and operates on a first-caller-wins basis.

However, this behavior is intentional and documented. Per our
[SECURITY.md](https://github.com/sablier-labs/solsab/blob/main/SECURITY.md), which outlines the assumptions any
disclosure must respect to qualify as a vulnerability:

> **General Assumption #1:** Programs are initialized before they are used.

This is a standard deployment practice for Solana programs. Initialization is performed atomically or immediately after
deployment by the protocol team, before the program address is publicly announced or integrated into any frontend or
downstream system. The attack vector you describe—front-running initialization on a deployed but uninitialized
program—falls outside our threat model because the precondition (public availability of an uninitialized program) is
never expected to exist.

For reference, this pattern is common across the Solana ecosystem. Many protocols (including Anchor's own examples) rely
on controlled deployment sequences rather than on-chain authority checks in their initializers.

We do not consider this a valid vulnerability under our Bug Bounty Program criteria. That said, we appreciate the
thorough analysis and encourage you to review our documented assumptions before future submissions.

Best regards,

[Your Name] Sablier Labs
