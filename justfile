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
build program_name="all":
    #!/usr/bin/env sh
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

# Run verification script
verify:
    bash ./scripts/bash/verify.sh
alias v := verify

# ---------------------------------------------------------------------------- #
#                                  CODE CHECKS                                 #
# ---------------------------------------------------------------------------- #

# Run all code checks
full-check: _build-if-needed rust-check prettier-check biome-check tsc-check

_build-if-needed:
    #!/usr/bin/env sh
    if [ -z "$(ls -A target/idl 2>/dev/null)" ]; then
        just build
    fi

# Run all code fixes
full-write: prettier-write biome-write rust-write

# Run Rust checks
rust-check:
    cargo fmt --check
    cargo clippy -- --deny warnings
alias rc := rust-check

# Format Rust code
rust-write:
    cargo fmt
    cargo clippy --fix
alias rw := rust-write

# ============================================================================ #
#                                 TESTING                                      #
# ============================================================================ #

# Run all tests (anchor lockup + merkle instant + trident lockup)
# To debug the Solana logs, run this as `RUST_LOG=debug just test`
[group("test")]
test *args: build
    @echo "🧪 Running all tests..."
    @echo "\n📦 Anchor tests (lockup + merkle instant)..."
    just test-anchor {{ args }}
    @echo "\n🔥 Trident fuzz tests (lockup)..."
    just test-trident-lockup
alias t := test

# Run both anchor & trident tests for the Lockup program
[group("test")]
test-lockup *args: build
    @echo "🧪 Running all lockup tests..."
    @echo "\n 📦 Anchor lockup tests..."
    just test-anchor-lockup
    @echo "\n 🔥 Trident lockup fuzz tests..."
    just test-trident-lockup
alias tlk := test-lockup


# Run anchor tests with UI
[group("test")]
test-ui *args: build
    na vitest --hideSkippedTests --ui {{args}}
alias tui := test-ui

# ---------------------------------------------------------------------------- #
#                               ANCHOR TESTS                                   #
# ---------------------------------------------------------------------------- #

# Run Anchor Lockup tests only
[group("test")]
test-anchor-lockup *args="tests/lockup":
    na vitest run --hideSkippedTests tests/lockup {{ args }}
alias talk := test-anchor-lockup

# Run Anchor Merkle Instant tests only
[group("test")]
test-anchor-merkle-instant *args="tests/merkle-instant":
    just test-anchor {{ args }}
alias tami := test-anchor-merkle-instant

# Run all Anchor tests (lockup + merkle instant)
[group("test")]
test-anchor *args: build
    na vitest run --hideSkippedTests {{ args }}
alias ta := test-anchor

# ---------------------------------------------------------------------------- #
#                               TRIDENT TESTS                                  #
# ---------------------------------------------------------------------------- #

# Run Trident Lockup fuzz tests
[group("test")]
test-trident-lockup: build
    just --justfile trident-tests/justfile test-lockup
alias ttlk := test-trident-lockup
