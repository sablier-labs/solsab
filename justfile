# See https://github.com/sablier-labs/devkit/blob/main/just/base.just
import "./node_modules/@sablier/devkit/just/base.just"

# ---------------------------------------------------------------------------- #
#                                 DEPENDENCIES                                 #
# ---------------------------------------------------------------------------- #

# Anchor: https://solana.com/docs/intro/installation#install-anchor-cli
anchor := require("anchor")
# Solana: https://solana.com/docs/intro/installation#install-the-solana-cli
solana := require("solana")
# Trident: https://ackee.xyz/trident/docs/latest/basics/installation/
trident := require("trident")

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

# Build programs using Anchor
[group("build")]
[script]
build program_name="all":
    if [ "{{ program_name }}" = "all" ]; then
        cmd="anchor build"
    else
        cmd="anchor build --program-name {{ program_name }}"
    fi
    echo "🔨 Building {{ program_name }}..."
    # Suppressing the annoying "Compiling" and "Downloaded" messages
    # Remove this once this gets implemented: https://github.com/solana-foundation/anchor/issues/3788
    $cmd 2>&1 | grep -v "Compiling\|Downloaded"
    echo "✅ Successful build\n"
    just codegen {{ program_name }}
alias b := build

# Build Lockup program only using Anchor
[group("build")]
build-lockup: (build "sablier_lockup")
alias blk := build-lockup

# Build Merkle Instant program only using Anchor
[group("build")]
build-merkle-instant: (build "sablier_merkle_instant")
alias bmi := build-merkle-instant

# Codegen errors and struct types
@codegen program_name="all":
    na run ./scripts/ts/codegen-errors.ts {{ program_name }}
    na run ./scripts/ts/codegen-structs.ts {{ program_name }}

# Clean build artifacts
clean globs=GLOBS_CLEAN:
    nlx del-cli "{{ globs }}"

# Execute setup script
setup:
    bun setup

# ---------------------------------------------------------------------------- #
#                                  CODE CHECKS                                 #
# ---------------------------------------------------------------------------- #

# Run all code checks
full-check:
    just _run-with-status codegen
    just _run-with-status prettier-check
    just _run-with-status biome-check
    just _run-with-status tsc-check
    just _run-with-status rust-check

# Run all code fixes
full-write:
    just _run-with-status prettier-write
    just _run-with-status biome-write
    just _run-with-status rust-write

# Run Rust checks
rust-check:
    cargo fmt --check
    cargo clippy -- --deny warnings
alias rc := rust-check

# Format Rust code
rust-write:
    cargo fmt
    cargo clippy --fix --allow-dirty
alias rw := rust-write

# ---------------------------------------------------------------------------- #
#                                    TESTING                                   #
# ---------------------------------------------------------------------------- #

# Run all tests (Anchor + Trident)
[group("test")]
test: test-anchor test-trident
alias t := test

# ---------------------------------------------------------------------------- #
#                                 ANCHOR TESTS                                 #
# ---------------------------------------------------------------------------- #

# Run all Anchor tests (lockup + merkle instant)
# To debug the Solana logs, run this as `RUST_LOG=debug just test-anchor`
[group("test")]
test-anchor *args: build _setup-fixtures
    na vitest run --hideSkippedTests {{ args }}
alias ta := test-anchor

# Run Anchor tests with UI
[group("test")]
test-anchor-ui *args: build _setup-fixtures
    na vitest --hideSkippedTests --ui {{ args }}
alias taui := test-anchor-ui

# Run Anchor Lockup tests only
[group("test")]
test-anchor-lockup *args="tests/lockup": build _setup-fixtures
    na vitest run --hideSkippedTests {{ args }}
alias talk := test-anchor-lockup

# Run Anchor Merkle Instant tests only
[group("test")]
test-anchor-merkle-instant *args="tests/merkle-instant": build _setup-fixtures
    na vitest run --hideSkippedTests {{ args }}
alias tami := test-anchor-merkle-instant

# ---------------------------------------------------------------------------- #
#                                TRIDENT TESTS                                 #
# ---------------------------------------------------------------------------- #

# Run all Trident fuzz tests
[group("test")]
test-trident: test-trident-lockup
alias tt := test-trident

# Run Trident Lockup fuzz tests
[group("test")]
test-trident-lockup: build
    just --justfile trident-tests/justfile test-lockup
alias ttlk := test-trident-lockup

# Download external program fixtures for testing
_setup-fixtures:
    #!/usr/bin/env sh
    FIXTURES_DIR="tests/fixtures"

    if [ ! -d "$FIXTURES_DIR" ]; then
        echo "📦 Setting up fixtures..."
        mkdir -p "$FIXTURES_DIR"

        # Token Metadata Program
        echo "📥 Downloading Token Metadata program..."
        solana program dump -u m metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s "$FIXTURES_DIR/token_metadata_program.so"

        # Chainlink Program
        echo "📥 Downloading Chainlink program..."
        solana program dump -u m HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny "$FIXTURES_DIR/chainlink_program.so"
    fi