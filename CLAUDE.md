# Project Instructions

## Post-Session Validation

When a working session modifies TypeScript, Rust, Markdown, or YAML files, run `just full-check` before committing or
handing off. If it fails, run `just full-write`, then re-run `just full-check` to confirm it passes. Additionally,
`just tsc-check` must also pass.

Skip this step when changes are limited to non-code files (e.g., documentation-only conversations, config files not
covered by the checker).

## Binary Test Pattern

All `describe` blocks in test files must follow a binary pair structure. Every failure-condition `describe` must have a
complementary `describe` that wraps all subsequent siblings.

```ts
// CORRECT — binary pairs
describe("given X is zero", () => {
  it("should fail", ...);
});
describe("given X is not zero", () => {
  describe("given Y overflows", () => {
    it("should fail", ...);
  });
  describe("given Y does not overflow", () => {
    it("should succeed", ...);
  });
});

// WRONG — flat siblings without complement wrappers
describe("given X is zero", () => { ... });
describe("given Y overflows", () => { ... });
describe("given valid parameters", () => { ... });
```

When testing model variants (LL vs LT), wrap them in a shared parent:

```ts
describe("given a null stream", () => { /* fail */ });
describe("given a valid stream", () => {
  describe("given a LL stream", () => { ... });
  describe("given a LT stream", () => { ... });
});
```

Conditions belong in `describe`, not `it`. The `it` block should only contain the outcome ("should fail", "should create
the stream"). If an `it` description contains "when", "with", "given", or "if", extract the condition into a wrapping
`describe`.

```ts
// CORRECT
describe("when start time equals first tranche timestamp", () => {
  it("should fail", async () => { ... });
});

// WRONG — condition leaked into it()
it("should fail when start time equals first tranche timestamp", async () => { ... });
```

Follow the Rust validation order when structuring the binary tree (check the corresponding `check_*` function in
`programs/lockup/src/utils/validations.rs`).

## Test Label Grammar

Use proper grammar in `describe` and `it` labels. Include verbs and articles unless doing so would make the label
unreasonably long. Examples:

- `"when signer is not sender"` not `"when signer not sender"`
- `"given a non-cancelable stream"` not `"given non cancelable stream"`
- `"when deposit amount is zero"` not `"when deposit amount zero"`

## Test File Naming

The top-level `describe` in each test file must match the filename (without `.test.ts`). For example, `cancelLl.test.ts`
must use `describe("cancelLl", ...)`, not `describe("cancel", ...)`.

## Anchor Error Aliases

When importing Anchor error codes from `@coral-xyz/anchor-errors`, always alias them with an `ERR_` prefix:

```ts
// CORRECT
import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ERR_ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";

// WRONG — missing ERR_ prefix
import { ANCHOR_ERROR__ACCOUNT_NOT_INITIALIZED as ACCOUNT_NOT_INITIALIZED } from "@coral-xyz/anchor-errors";
```
