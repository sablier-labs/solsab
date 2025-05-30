#!/usr/bin/env bash

# This script deploys SolSab programs to Devnet.
# It must be run from the root of the SolSab repo.
#
# USAGE:
#   ./scripts/bash/deploy_programs.sh [OPTIONS]
#
# OPTIONS:
#   --program PROGRAM [PROGRAM...]  Specify which program(s) to deploy
#                                   Valid programs: sablier_lockup, sablier_merkle_instant
#                                   Can specify one or multiple programs
#   --init                          Run post-deployment initialization script
#
# EXAMPLES:
#   ./scripts/bash/deploy_programs.sh --program sablier_lockup            # Deploy lockup program only
#   ./scripts/bash/deploy_programs.sh --program sablier_merkle_instant    # Deploy merkle_instant program only
#   ./scripts/bash/deploy_programs.sh --program lk mi                     # Deploy both programs
#   ./scripts/bash/deploy_programs.sh --init --program sablier_lockup     # Deploy lockup + run initialization
#   ./scripts/bash/deploy_programs.sh --init --program lk mi              # Deploy both + initialization
#
# WHAT THIS SCRIPT DOES:
#   1. Switches to main branch and pulls latest changes
#   2. Generates new keypairs for specified programs
#   3. Builds programs verifiably using anchor build -p <program>
#   4. Creates deployment branch and commits changes
#   5. Deploys programs to devnet using anchor deploy -p <program>
#   6. Creates separate ZIP files with IDL and types for each program
#   7. Optionally runs post-deployment initialization (with --init flag)
#
# OUTPUT FILES:
#   - {program_name}_IDL_types.zip for each deployed program
#   - Updated Anchor.toml and lib.rs files committed to deployment branch

# Strict mode: https://gist.github.com/vncsna/64825d5609c146e80de8b1fd623011ca
set -euo pipefail

# Pre-requisites:
# - see README.md

# Initialize variables
INIT_FLAG=false
PROGRAMS=()

# Map short forms to full program names
map_program_name() {
    case "$1" in
        "lk") echo "sablier_lockup" ;;
        "mi") echo "sablier_merkle_instant" ;;
        "sablier_lockup"|"sablier_merkle_instant") echo "$1" ;;  # This line handles full names
        *) echo "$1" ;;  # Return as-is for validation to catch invalid names
    esac
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --init)
            INIT_FLAG=true
            shift
            ;;
        --program)
            shift
            # Collect all program names until we hit another flag or end of args
            while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
                # Map short forms to full names
                mapped_program=$(map_program_name "$1")
                PROGRAMS+=("$mapped_program")
                shift
            done
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--init] [--program program1 [program2 ...]]"
            echo "Example: $0 --program lk"
            echo "Example: $0 --program lk mi --init"
            echo "Short forms: lk=sablier_lockup, mi=sablier_merkle_instant"
            exit 1
            ;;
    esac
done

# If no programs specified, default to sablier_lockup for backward compatibility
if [[ ${#PROGRAMS[@]} -eq 0 ]]; then
    PROGRAMS=("sablier_lockup")
    echo "ℹ️  No programs specified, defaulting to sablier_lockup"
fi

echo "🎯 Programs to deploy: ${PROGRAMS[*]}"

# Config
CLUSTER="devnet"

# Validate programs are supported
VALID_PROGRAMS=("sablier_lockup" "sablier_merkle_instant")
for program in "${PROGRAMS[@]}"; do
    if [[ ! " ${VALID_PROGRAMS[*]} " =~ " ${program} " ]]; then
        echo "❌ Error: Program '$program' is not supported"
        echo "Supported programs: ${VALID_PROGRAMS[*]}"
        exit 1
    fi
    echo "✅ Program '$program' is valid"
done

# Switch to the main branch
git switch main

# Pull the latest changes from origin
git pull

# Generate keypairs for all programs
for program in "${PROGRAMS[@]}"; do
    PROGRAM_KEYPAIR_PATH="target/deploy/${program}-keypair.json"
    echo "🔑 Generating keypair for $program..."
    solana-keygen new --outfile "$PROGRAM_KEYPAIR_PATH" --no-bip39-passphrase --force
done

# Clean the build artifacts
anchor clean

# Update the program ids in Anchor.toml & lib.rs files
anchor keys sync

# Start Colima (if it's already running, the command is being ignored automatically)
colima start

# Build verifiably for specified programs
for program in "${PROGRAMS[@]}"; do
    echo "🔨 Building $program..."
    anchor build -v -p "$program"
done

# Delete the chore/deployment branch if it already exists, silencing the error if it doesn't
git branch -D chore/deployment 2>/dev/null

# Create the chore/deployment branch
git switch -c chore/deployment

# Prepare git add command for all modified files
git_files_to_add=("Anchor.toml")
for program in "${PROGRAMS[@]}"; do
    # Determine the correct lib.rs path based on program structure
    if [[ "$program" == "sablier_lockup" ]]; then
        git_files_to_add+=("programs/lockup/src/lib.rs")
    elif [[ "$program" == "sablier_merkle_instant" ]]; then
        git_files_to_add+=("programs/merkle_instant/src/lib.rs")
    else
        # Generic approach: try to find the lib.rs file
        lib_path=$(find programs -name "lib.rs" -path "*/${program#sablier_}/*" | head -1)
        if [[ -n "$lib_path" ]]; then
            git_files_to_add+=("$lib_path")
        else
            echo "⚠️  Warning: Could not find lib.rs for $program"
        fi
    fi
done

# Commit the changes
git add "${git_files_to_add[@]}"
git commit -m "chore: deployment for ${PROGRAMS[*]}"

# For extra safety, close any existing buffer accounts
# Otherwise, we risk getting the "Buffer account data size is smaller than the minimum size" error
solana program close --buffers

# Deploy verifiably for specified programs
for program in "${PROGRAMS[@]}"; do
    echo "🚀 Deploying $program..."
    anchor deploy -v -p "$program"
done

# Create zip files for each program
for program in "${PROGRAMS[@]}"; do
    # Define source and destination paths
    IDL_SOURCE_PATH="target/idl/${program}.json"
    TYPES_SOURCE_PATH="target/types/${program}.ts"
    IDL_DEST_PATH="${program}.json"
    TYPES_DEST_PATH="${program}.ts"
    ZIP_FILE="${program}_IDL_types.zip"
    
    echo "📦 Creating zip file for $program..."
    
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
done

# Run initialization script only if --init flag is passed
if [[ "$INIT_FLAG" == true ]]; then
    echo "🚀 Running post-deployment initialization..."
    ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
    ANCHOR_WALLET=~/.config/solana/id.json \
    bun run ts-mocha -p ./tsconfig.json -t 1000000 scripts/ts/post-deployment-initialization.ts
    echo "✅ Initialization completed"
else
    echo "ℹ️  Skipping initialization (use --init flag to run post-deployment initialization)"
fi

echo "🎉 Deployment completed for programs: ${PROGRAMS[*]}"