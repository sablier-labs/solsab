#!/usr/bin/env bash

# This script deploys SolSab programs to Devnet or Mainnet, and initializes them.
# It must be run from the root of the SolSab repo.
#
# USAGE:
#   ./scripts/bash/deploy-programs.sh [OPTIONS]
#
# OPTIONS:
#   --program PROGRAM [PROGRAM...]  Specify which program(s) to deploy
#                                   Valid programs: sablier_lockup, sablier_merkle_instant
#                                   Can specify one or multiple programs, as well as their short forms (lk=sablier_lockup, mi=sablier_merkle_instant)
#   --mainnet                       Deploy to mainnet-beta (default is devnet)
#                                   Note: devnet deployments include demo data setup, mainnet deployments are init-only
#
# EXAMPLES:
#   ./scripts/bash/deploy-programs.sh --program sablier_lockup            # Deploy the lockup program to devnet & set it up with demo streams
#   ./scripts/bash/deploy-programs.sh --program sablier_merkle_instant    # Deploy & initialize just the merkle_instant program
#   ./scripts/bash/deploy-programs.sh --mainnet --program sablier_lockup  # Deploy the lockup program to mainnet (init-only, no demo data)
#   ./scripts/bash/deploy-programs.sh --program lk mi --keep-keypairs     # Deploy both programs to devnet with current keypairs & setup with demo data
#
# WHAT THIS SCRIPT DOES:
#   1. Parses arguments and validates input
#   2. Generates new keypairs for the specified programs (or uses the existing ones in case --keep-keypairs has been passed)
#   3. Cleans build artifacts and starts Colima
#   4. Builds the specified programs with anchor
#   5. Deploys the specified programs to the selected cluster (devnet/mainnet)
#   6. Closes the associated buffer accounts, if any (in order to recover the rent SOL from them)
#   7. Runs the post-deployment initialization script (demo data for devnet, init-only for mainnet)
#   8. Switches to the main branch, pulls the latest changes and syncs anchor keys
#   9. Creates a deployment branch and commits the changes
#  10. Creates separate ZIP files with IDL and types for each program
#
# OUTPUT FILES:
#   - {program_name}_IDL_types.zip for each deployed program
#   - Updated Anchor.toml and lib.rs files committed to deployment branch

# Strict mode: https://gist.github.com/vncsna/64825d5609c146e80de8b1fd623011ca
set -euo pipefail

# Pre-requisites:
# - see README.md

# ---------------------------------------------------------------------------- #
#                                USAGE AND LOGS                                #
# ---------------------------------------------------------------------------- #

# Error handling with usage display
show_usage_and_exit() {
    local error_msg="$1"
    echo "❌ Error: $error_msg"
    echo ""
    echo "Usage: $0 --program PROGRAM [PROGRAM...] [--mainnet] [--keep-keypairs]"
    echo "Valid programs: ${VALID_PROGRAMS[*]}"
    echo "Short forms: lk=sablier_lockup, mi=sablier_merkle_instant"
    echo ""
    echo "Flags:"
    echo "  --keep-keypairs                 # Keep existing keypairs if present (default: overwrite)"
    echo ""
    echo "Examples:"
    echo "  $0 --program sablier_lockup     # Deploys the Lockup program to devnet with demo data setup, overwriting keypair"
    echo "  $0 --program lk --keep-keypairs # Same as above, but keeps existing keypair if present"
    echo "  $0 --program mi --mainnet       # Deploys the Merkle Instant program to mainnet (init-only, no demo data)"
    echo "  $0 --program lk mi              # Deploys both programs to devnet with demo data setup"
    exit 1
}

# Logging functions
log_action() { echo "🎯 $1"; }
log_error() { echo "❌ $1"; }
log_info() { echo "ℹ️  $1"; }
log_success() { echo "✅ $1"; }
log_warning() { echo "⚠️  $1"; }

# ---------------------------------------------------------------------------- #
#                                    SET-UP                                    #
# ---------------------------------------------------------------------------- #

# Initialize variables
KEEP_KEYPAIRS=false
MAINNET_FLAG=false
PROGRAMS=()
VALID_PROGRAMS=("sablier_lockup" "sablier_merkle_instant")

CLUSTER="devnet"
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"

# Define the init scripts mapping
declare -A INIT_SCRIPTS
INIT_SCRIPTS["sablier_lockup"]="scripts/ts/init-lockup-and-create-streams.ts"
INIT_SCRIPTS["sablier_merkle_instant"]="scripts/ts/init-merkle-instant-and-create-campaign.ts"

# Define the program configuration mapping
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

# Parse the command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mainnet)
            MAINNET_FLAG=true
            shift
            ;;
        --keep-keypairs)
            KEEP_KEYPAIRS=true
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

# Set the variables depending on whether the mainnet flag has been passed
if [[ "$MAINNET_FLAG" == true ]]; then
    CLUSTER="mainnet"
    ANCHOR_PROVIDER_URL="https://api.mainnet-beta.solana.com"

    # Note: we don't want to create demo streams/campaigns on mainnet
    INIT_SCRIPTS["sablier_lockup"]="scripts/ts/init-lockup.ts"
    INIT_SCRIPTS["sablier_merkle_instant"]="scripts/ts/init-merkle-instant.ts"
fi

# Configure Solana CLI to use the correct provider
solana config set --url $ANCHOR_PROVIDER_URL

# ---------------------------------------------------------------------------- #
#                               INPUT VALIDATION                               #
# ---------------------------------------------------------------------------- #

# Assert that at least one program has been specified
if [[ ${#PROGRAMS[@]} -eq 0 ]]; then
    show_usage_and_exit "No programs specified"
fi

log_action "Programs to deploy: ${PROGRAMS[*]}"

# Assert that the specified programs are valid
for program in "${PROGRAMS[@]}"; do
    if [[ ! " ${VALID_PROGRAMS[*]} " =~ " ${program} " ]]; then
        show_usage_and_exit "Program '$program' is not supported. Supported programs: ${VALID_PROGRAMS[*]}"
    fi
    log_success "Program '$program' is valid"
done

# ---------------------------------------------------------------------------- #
#                              BUILD AND DEPLOY                                #
# ---------------------------------------------------------------------------- #

# Generate new program keypairs (unless --keep-keypairs is set)
for program in "${PROGRAMS[@]}"; do
    keypair_path="target/deploy/${program}-keypair.json"
    if [[ "$KEEP_KEYPAIRS" == true ]]; then
        if [[ -f "$keypair_path" ]]; then
            log_info "Using existing keypair for $program at $keypair_path"
        else
            log_error "--keep-keypairs was specified, but $keypair_path does not exist for $program. Aborting."
            exit 1
        fi
    else
        # The `anchor build` command will automatically generate new keypairs if those files don’t already exist.
        log_info "Cleaning build artifacts..."
        just clean
    fi
done

# Start Colima (if it's already running, the command is being ignored automatically)
colima start

# Sync the program ids
anchor keys sync

# Build the programs
for program in "${PROGRAMS[@]}"; do
    echo "🔨 Building $program..."
    anchor build -v -p "$program"
done

# Deploy the programs
for program in "${PROGRAMS[@]}"; do
    echo "🚀 Deploying $program"
    anchor deploy -v -p "$program" --provider.cluster $CLUSTER
done

# Closes the associated buffer accounts, if any (in order to recover the rent SOL from them)
log_info "Closing any hanging buffer accounts"
solana program close --buffers

echo "🎉 Deployment completed for programs: ${PROGRAMS[*]}"

# ---------------------------------------------------------------------------- #
#                                 INIT SCRIPTS                                 #
# ---------------------------------------------------------------------------- #

for program in "${PROGRAMS[@]}"; do
    if [[ -n "${INIT_SCRIPTS[$program]}" ]]; then
        ANCHOR_WALLET=~/.config/solana/id.json \
        na vitest --run --mode scripts "${INIT_SCRIPTS[$program]}"
    else
        log_warning "No init script found for $program"
    fi
    log_success "All initializations completed"
done

# ---------------------------------------------------------------------------- #
#                                GIT OPERATIONS                                #
# ---------------------------------------------------------------------------- #

log_info "Switching to main branch and pulling latest changes..."
git switch main
git pull

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
git commit -m "chore($CLUSTER): deployment for ${PROGRAMS[*]}"

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
