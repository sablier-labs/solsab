#!/usr/bin/env bash

# This script deploys SolSab programs to Devnet and initializes it.
# It must be run from the root of the SolSab repo.
#
# USAGE:
#   ./scripts/bash/deploy-programs.sh [OPTIONS]
#
# OPTIONS:
#   --program PROGRAM [PROGRAM...]  Specify which program(s) to deploy
#                                   Valid programs: sablier_lockup, sablier_merkle_instant
#                                   Can specify one or multiple programs
#   --no-init                       Do not run the post-deployment initialization script
#
# EXAMPLES:
#   ./scripts/bash/deploy-programs.sh --program sablier_lockup            # Deploy & initialize just the lockup program
#   ./scripts/bash/deploy-programs.sh --program sablier_merkle_instant    # Deploy & initialize just the merkle_instant program
#   ./scripts/bash/deploy-programs.sh --program lk mi                     # Deploy & initialize both programs
#   ./scripts/bash/deploy-programs.sh --no-init --program sablier_lockup  # Deploy the lockup program without the initialization
#   ./scripts/bash/deploy-programs.sh --no-init --program lk mi           # Deploy both programs without the initialization
#
# WHAT THIS SCRIPT DOES:
#   1. Switches to main branch and pulls latest changes
#   2. Generates new keypairs for specified programs
#   3. Builds programs verifiably using anchor build -v -p <program>
#   4. Creates deployment branch and commits changes
#   5. Deploys programs to devnet using anchor deploy -v -p <program>
#   6. Creates separate ZIP files with IDL and types for each program
#   7. Runs post-deployment initialization script (unless the --no-init flag has been passed)
#
# OUTPUT FILES:
#   - {program_name}_IDL_types.zip for each deployed program
#   - Updated Anchor.toml and lib.rs files committed to deployment branch

# Strict mode: https://gist.github.com/vncsna/64825d5609c146e80de8b1fd623011ca
set -euo pipefail

# Pre-requisites:
# - see README.md

# Initialize variables
NO_INIT_FLAG=false
PROGRAMS=()

# Configuration
CLUSTER="devnet"
VALID_PROGRAMS=("sablier_lockup" "sablier_merkle_instant")

# Program configuration mapping
declare -A PROGRAM_CONFIG
PROGRAM_CONFIG["sablier_lockup"]="programs/lockup/src/lib.rs"
PROGRAM_CONFIG["sablier_merkle_instant"]="programs/merkle_instant/src/lib.rs"

# Map short forms to full program names
map_program_name() {
    case "$1" in
        "lk") echo "sablier_lockup" ;;
        "mi") echo "sablier_merkle_instant" ;;
        "sablier_lockup"|"sablier_merkle_instant") echo "$1" ;;
        *) echo "$1" ;;  # Return as-is for validation to catch invalid names
    esac
}

# Error handling with usage display
show_usage_and_exit() {
    local error_msg="$1"
    echo "❌ Error: $error_msg"
    echo ""
    echo "Usage: $0 --program PROGRAM [PROGRAM...] [--no-init]"
    echo "Valid programs: ${VALID_PROGRAMS[*]}"
    echo "Short forms: lk=sablier_lockup, mi=sablier_merkle_instant"
    echo ""
    echo "Examples:"
    echo "  $0 --program lk"
    echo "  $0 --program sablier_lockup"
    echo "  $0 --program lk mi"
    echo "  $0 --program lk --no-init"
    exit 1
}

# Logging functions
log_info() { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_warning() { echo "⚠️  $1"; }
log_error() { echo "❌ $1"; }
log_action() { echo "🎯 $1"; }

# Parse the command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-init)
            NO_INIT_FLAG=true
            shift
            ;;
        --program)
            shift
            # Collect all program names until we hit another flag or end of args
            while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
                mapped_program=$(map_program_name "$1")
                PROGRAMS+=("$mapped_program")
                shift
            done
            ;;
        *)
            show_usage_and_exit "Unknown option: $1"
            ;;
    esac
done

# Validate input
if [[ ${#PROGRAMS[@]} -eq 0 ]]; then
    show_usage_and_exit "No programs specified"
fi

log_action "Programs to deploy: ${PROGRAMS[*]}"

# Validate programs are supported
for program in "${PROGRAMS[@]}"; do
    if [[ ! " ${VALID_PROGRAMS[*]} " =~ " ${program} " ]]; then
        show_usage_and_exit "Program '$program' is not supported. Supported programs: ${VALID_PROGRAMS[*]}"
    fi
    log_success "Program '$program' is valid"
done

# Git operations
log_info "Switching to main branch and pulling latest changes..."
git switch main
git pull

# Generate keypairs for all programs
for program in "${PROGRAMS[@]}"; do
    keypair_path="target/deploy/${program}-keypair.json"
    echo "🔑 Generating keypair for $program..."
    solana-keygen new --outfile "$keypair_path" --no-bip39-passphrase --force
done

# Build preparation
log_info "Cleaning build artifacts and syncing keys..."
anchor clean
anchor keys sync

# Start Colima (if it's already running, the command is being ignored automatically)
colima start

# Build and deploy programs
for program in "${PROGRAMS[@]}"; do
    echo "🔨 Building $program..."
    anchor build -v -p "$program"
done

for program in "${PROGRAMS[@]}"; do
    echo "🚀 Deploying $program..."
    anchor deploy -v -p "$program"
done

DEPLOYMENT_BRANCH="chore/deployment"

# Git branch management
log_info "Creating deployment branch..."
git branch -D "$DEPLOYMENT_BRANCH" 2>/dev/null || true
git switch -c "$DEPLOYMENT_BRANCH"

# Prepare git files to add
git_files_to_add=("Anchor.toml")
for program in "${PROGRAMS[@]}"; do
    if [[ -n "${PROGRAM_CONFIG[$program]:-}" ]]; then
        git_files_to_add+=("${PROGRAM_CONFIG[$program]}")
    else
        log_warning "No lib.rs path configured for $program"
    fi
done

# Commit changes
git add "${git_files_to_add[@]}"
git commit -m "chore: deployment for ${PROGRAMS[*]}"

# Close buffer accounts for safety
log_info "Closing existing buffer accounts..."
solana program close --buffers

# Create zip files for each program
for program in "${PROGRAMS[@]}"; do
    log_info "Creating zip file for $program..."

    # Define paths
    idl_source="target/idl/${program}.json"
    types_source="target/types/${program}.ts"
    zip_file="${program}_IDL_types.zip"

    # Validate source files exist
    for file in "$idl_source" "$types_source"; do
        if [[ ! -f "$file" ]]; then
            log_error "$file not found"
            exit 1
        fi
    done

    # Create zip file (removes existing file automatically with -o flag)
    zip -o "$zip_file" "$idl_source" "$types_source"
    log_success "Created $zip_file"
done


# Program initialization scripts mapping
declare -A INIT_SCRIPTS
INIT_SCRIPTS["sablier_lockup"]="scripts/ts/lockup-initialization.ts"
INIT_SCRIPTS["sablier_merkle_instant"]="scripts/ts/merkle-instant-initialization.ts"

# Run initialization if requested
if [[ "$NO_INIT_FLAG" == true ]]; then
    log_info "Skipping initialization"
else
    log_info "Running post-deployment initialization for programs: ${PROGRAMS[*]}"

    for program in "${PROGRAMS[@]}"; do
        if [[ -n "${INIT_SCRIPTS[$program]:-}" ]]; then
            init_script="${INIT_SCRIPTS[$program]}"
            log_info "Initializing $program with $init_script..."

            ANCHOR_PROVIDER_URL=https://api.devnet.solana.com \
            ANCHOR_WALLET=~/.config/solana/id.json \
            bun run ts-mocha -p ./tsconfig.json -t 1000000 "$init_script"

            log_success "Initialization completed for $program"
        else
            log_warning "No initialization script found for $program"
        fi
    done

    log_success "All initializations completed"
fi

echo "🎉 Deployment completed for programs: ${PROGRAMS[*]}"
