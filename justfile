# See https://github.com/sablier-labs/devkit/blob/main/just/base.just
import "./node_modules/@sablier/devkit/just/base.just"

# ---------------------------------------------------------------------------- #
#                                 DEPENDENCIES                                 #
# ---------------------------------------------------------------------------- #

# Anchor: https://solana.com/docs/intro/installation#install-anchor-cli
anchor := require("anchor")
# Solana: https://solana.com/docs/intro/installation#install-the-solana-cli
solana := require("solana")

# ---------------------------------------------------------------------------- #
#                                  ENVIRONMENT                                 #
# ---------------------------------------------------------------------------- #

export RUST_LOG := env("RUST_LOG", "off")
# See https://github.com/sablier-labs/solsab/issues/180
export RUSTUP_TOOLCHAIN := "nightly"

# ---------------------------------------------------------------------------- #
#                                   CONSTANTS                                  #
# ---------------------------------------------------------------------------- #

GLOBS_CLEAN := "{.anchor,target}"
GLOBS_PRETTIER := "**/*.{md,yml}"

# ---------------------------------------------------------------------------- #
#                                    RECIPES                                   #
# ---------------------------------------------------------------------------- #

# Default recipe - show available commands
default:
    just --list

# Build all programs
[group("build")]
build program_name="all":
    #!/usr/bin/env sh
    if [ "{{ program_name }}" = "all" ]; then
        anchor build
    else
        anchor build --program-name {{ program_name }}
    fi
    echo ""
    just codegen-errors {{ program_name }}
alias b := build

# Build Lockup program only
[group("build")]
build-lockup: (build "sablier_lockup")
alias blk := build-lockup

# Build Merkle Instant program only
[group("build")]
build-merkle-instant: (build "sablier_merkle_instant")
alias bmi := build-merkle-instant

# Codegen errors
@codegen-errors program_name="all":
    bun run ./scripts/ts/codegen-errors.ts {{ program_name }}

# Clean build artifacts
clean globs=GLOBS_CLEAN:
    nlx del-cli "{{ globs }}"

# Setup Husky - you should run this the first time you clone the repo
setup:
    pnpm husky

# Run verification script
verify:
    bash ./scripts/bash/verify.sh
alias v := verify

# ---------------------------------------------------------------------------- #
#                                  CODE CHECKS                                 #
# ---------------------------------------------------------------------------- #

# Run all code checks
full-check: prettier-check biome-check tsc-check rust-check

# Run all code fixes
full-write: prettier-write biome-write rust-write

# Check Prettier formatting
prettier-check globs=GLOBS_PRETTIER:
    na prettier --check --cache "{{ globs }}"

# Format using Prettier
prettier-write globs=GLOBS_PRETTIER:
    na prettier --write --cache "{{ globs }}"

# Check Rust formatting
rust-check:
    cargo fmt --check
alias rc := rust-check

# Format Rust code
rust-write:
    cargo fmt
alias rw := rust-write

# ============================================================================ #
#                                 TESTING                                      #
# ============================================================================ #

# Run all tests
[group("test")]
test *args: build
    na vitest run --hideSkippedTests {{args}}
alias t := test

# Run all tests without building
test-lite *args:
    na vitest run --hideSkippedTests {{args}}
alias tl := test-lite

# Run Lockup tests only
[group("test")]
test-lockup *args="tests/lockup/**/*.test.ts":
    just test {{ args }}
alias tlk := test-lockup

# Run Merkle Instant tests only
[group("test")]
test-merkle-instant *args="tests/merkle-instant/**/*.test.ts":
    just test {{ args }}
alias tmi := test-merkle-instant
