#!/usr/bin/env bash

# Strict mode: https://gist.github.com/vncsna/64825d5609c146e80de8b1fd623011ca
set -euo pipefail

# Config
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROGRAM_NAME=$(awk '/\[programs\.devnet\]/ {getline; print $1}' "$REPO_DIR/Anchor.toml")
CLUSTER="devnet"
PROGRAM_KEYPAIR_PATH="target/deploy/sablier_lockup-keypair.json"

# Go to the repo
cd "$REPO_DIR" || { echo "Repo not found"; exit 1; }

# Create or replace the program keypair file
solana-keygen new --outfile "$PROGRAM_KEYPAIR_PATH" --no-bip39-passphrase --force

# Clean the build artifacts
anchor clean

# Update the program id in Anchor.toml & lib.rs
anchor keys sync

# Build verifiably
anchor build -v

# Commit the changes
git add Anchor.toml programs/lockup/src/lib.rs
git commit -m "chore: deployment"

# For extra safety, close any existing buffer accounts
# Otherwise, we risk getting the "Buffer account data size is smaller than the minimum size" error
solana program close --buffers

# Deploy verifiably
anchor deploy -v

# Output summary
echo ""
echo "✅ Deployment complete!"
echo "Program ID: $(solana address -k "$PROGRAM_KEYPAIR_PATH")"
echo "Commit: $(git rev-parse HEAD) (⚠️ Don't forget to create a PR for it! ⚠️)"
echo "IDL Path: target/idl/${PROGRAM_NAME}.json"
echo "Types Path: target/types/${PROGRAM_NAME}.ts"
