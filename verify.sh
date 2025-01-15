#!/bin/bash

# Options:
#   --skip              Skip the build step
#   --commit <hash>     Verify against a specific commit
#   --cluster <url>     Specify the Solana cluster URL

PROGRAM_ID="uwuJk35aCL3z2FzfPr8fQE1U19A8N18qdA5YfdfUbPt"
CLUSTER=$(solana config get | grep 'RPC URL' | awk '{print $3}')
COMMIT_HASH=$(git rev-parse --short HEAD)
SKIP_BUILD=false
SPECIFIC_COMMIT=""

cleanup() {
    docker rm -f anchor-program 2>/dev/null
    exit 1
}

trap cleanup SIGINT SIGTERM SIGQUIT

fail() {
    echo "❌ $1"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip)
            SKIP_BUILD=true
            shift
            ;;
        --commit)
            SPECIFIC_COMMIT="$2"
            shift 2
            ;;
        --cluster)
            CLUSTER="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--skip] [--commit <hash>] [--cluster <url>]"
            exit 1
            ;;
    esac
done

if [ -n "$SPECIFIC_COMMIT" ]; then
    ORIGINAL_COMMIT=$(git rev-parse HEAD)
    echo "📍 Checking out commit: $SPECIFIC_COMMIT"
    git checkout $SPECIFIC_COMMIT || fail "Failed to checkout commit: $SPECIFIC_COMMIT"
fi

if [ "$SKIP_BUILD" = false ]; then
    echo "🔨 Building program..."
    anchor build -v || fail "Build failed"
else
    echo "🔨 Skipping build step..."
fi

echo "🌐 Cluster: $CLUSTER"
echo "📝 Program ID: $PROGRAM_ID"
echo "🔍 Commit hash: $COMMIT_HASH"

DEPLOYED_HASH=$(solana-verify get-program-hash -u $CLUSTER $PROGRAM_ID) || fail "Failed to get deployed program hash"
LOCAL_HASH=$(solana-verify get-executable-hash target/verifiable/solsab.so) || fail "Failed to get local program hash"

echo "🔍 Local program hash: $LOCAL_HASH"
echo "🔍 Deployed program hash: $DEPLOYED_HASH"

if [ "$LOCAL_HASH" == "$DEPLOYED_HASH" ]; then
    echo "✅ Verification successful!"
else
    echo "❌ Verification failed: Hash mismatch!"
fi

if [ -n "$SPECIFIC_COMMIT" ]; then
    echo "📍 Returning to current branch"
    git checkout - || fail "Failed to return to previous branch. Please checkout manually."
fi

exit 0
