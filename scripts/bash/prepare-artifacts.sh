#!/usr/bin/env bash

# Strict mode: https://gist.github.com/vncsna/64825d5609c146e80de8b1fd623011ca
set -euo pipefail

# Clean the target directory
just clean

# Build the programs
just build

# Delete the current artifacts
artifacts=./artifacts
idl=$artifacts/idl
types=$artifacts/types
rm -rf $artifacts

# Create the new artifacts directories
mkdir $artifacts $idl $types

# Move all idl and types files to the new artifacts directories
cp target/idl/* $idl/
cp target/types/* $types/
