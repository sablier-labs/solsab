#!/usr/bin/env bash

# This script deploys a new SolSab version to Devnet.
# It must be run from the root of the SolSab repo.

# Strict mode: https://gist.github.com/vncsna/64825d5609c146e80de8b1fd623011ca
set -euo pipefail

# Pre-requisites:
# - see README.md

# Config
CLUSTER="devnet"
PROGRAM_NAME=$(awk '/\[programs\.devnet\]/ {getline; print $1}' "./Anchor.toml") || error "Could not find program name in Anchor.toml"
PROGRAM_KEYPAIR_PATH="target/deploy/sablier_lockup-keypair.json"

# Create or replace the program keypair file
solana-keygen new --outfile "$PROGRAM_KEYPAIR_PATH" --no-bip39-passphrase --force

# Clean the build artifacts
anchor clean

# Update the program id in Anchor.toml & lib.rs
anchor keys sync

# Start Colima (if it's already running, the command is being ignored automatically)
colima start

# Build verifiably
anchor build -v

# Commit the changes
git checkout -b chore/deployment
git add Anchor.toml programs/lockup/src/lib.rs
git commit -m "chore: deployment"

# For extra safety, close any existing buffer accounts
# Otherwise, we risk getting the "Buffer account data size is smaller than the minimum size" error
solana program close --buffers

# Deploy verifiably
anchor deploy -v

# Define source and destination paths
IDL_SOURCE_PATH="target/idl/${PROGRAM_NAME}.json"
TYPES_SOURCE_PATH="target/types/${PROGRAM_NAME}.ts"
IDL_DEST_PATH="${PROGRAM_NAME}.json"
TYPES_DEST_PATH="${PROGRAM_NAME}.ts"
ZIP_FILE="IDL_types.zip"

# Check if source files exist
if [[ ! -f "$IDL_SOURCE_PATH" ]]; then
    echo "❌ Error: IDL file not found at $IDL_SOURCE_PATH"
    exit 1
fi

if [[ ! -f "$TYPES_SOURCE_PATH" ]]; then
    echo "❌ Error: Types file not found at $TYPES_SOURCE_PATH"
    exit 1
fi

# Copy files to root directory
cp "$IDL_SOURCE_PATH" "$IDL_DEST_PATH"
cp "$TYPES_SOURCE_PATH" "$TYPES_DEST_PATH"

# Remove existing zip file if it exists
if [[ -f "$ZIP_FILE" ]]; then
    rm "$ZIP_FILE"
fi

# Create zip file with the IDL and types files
zip "$ZIP_FILE" "$IDL_DEST_PATH" "$TYPES_DEST_PATH"

# Clean up - remove the copied files from root directory
rm "$IDL_DEST_PATH" "$TYPES_DEST_PATH"

echo "✅ Created $ZIP_FILE with IDL and types files"

# Initialize SolSab on Devnet - and populate it with a bunch of Streams
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
ANCHOR_WALLET=~/.config/solana/id.json \
bun run ts-mocha -p ./tsconfig.json -t 1000000 scripts/ts/post-deployment-initialization.ts