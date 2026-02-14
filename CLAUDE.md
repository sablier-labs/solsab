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
  describe("given LL model", () => { ... });
  describe("given LT model", () => { ... });
});
```

Follow the Rust validation order when structuring the binary tree (check the corresponding `check_*` function in
`programs/lockup/src/utils/validations.rs`).
