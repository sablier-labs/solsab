#!/bin/bash

# solana config set --url https://api.devnet.solana.com
# solana config set --url http://127.0.0.1:8899

PROGRAM_ID="uwuJk35aCL3z2FzfPr8fQE1U19A8N18qdA5YfdfUbPt"
CLUSTER=$(solana config get | grep 'RPC URL' | awk '{print $3}')
COMMIT_HASH=$(git rev-parse --short HEAD)
LOCAL_HASH=$(shasum -a 256 target/verifiable/solsab.so | awk '{print $1}')

echo "🌐 Cluster: $CLUSTER"
echo "📝 Program ID: $PROGRAM_ID"
echo "🔍 Commit hash: $COMMIT_HASH"
echo "🔍 Local program hash: $LOCAL_HASH"

if ! solana program dump $PROGRAM_ID target/solsab.dump.so; then
    echo "❌ Verification failed."
    exit 1
fi

DEPLOYED_HASH=$(shasum -a 256 target/solsab.dump.so | awk '{print $1}')
echo "🔍 Deployed program hash: $DEPLOYED_HASH"

if [ "$LOCAL_HASH" == "$DEPLOYED_HASH" ]; then
    echo "✅ Verification successful."
    exit 0
else
    echo "❌ Verification failed: Hash mismatch!"
    exit 1
fi

