#!/bin/bash
# Copyright (c) Meta Platforms, Inc. and affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

# Build script for examples - builds all examples and copies them to docs output
# This script should be run AFTER build:tgz has created the SDK packages

echo "🚀 Building examples for documentation..."

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLES_DIR="$BASE_DIR/examples"
DOCS_EXAMPLES_DIR="$BASE_DIR/docs/.vitepress/dist/examples"

# Download and setup Meta Spatial Editor CLI for Linux (CI only)
if [[ "$(uname)" == "Linux" ]]; then
    CLI_DIR="$BASE_DIR/.meta-spatial-cli"
    CLI_URL="https://securecdn-sjc6-1.oculus.com/binaries/download/?id=32756129430698033"

    echo "📥 Downloading Meta Spatial Editor CLI..."
    mkdir -p "$CLI_DIR"
    cd "$CLI_DIR"

    if ! curl -L -o meta-spatial-cli.tar.gz "$CLI_URL"; then
        echo "❌ Failed to download CLI"
        exit 1
    fi

    echo "📦 Extracting CLI..."
    if ! tar -xzf meta-spatial-cli.tar.gz; then
        echo "❌ Failed to extract CLI"
        exit 1
    fi

    # Make CLI executable
    chmod +x meta-spatial-editor-cli-linux-dist/MetaSpatialEditorCLI
    chmod +x meta-spatial-editor-cli-linux-dist/meta-spatial-editor-cli

    CLI_PATH="$CLI_DIR/meta-spatial-editor-cli-linux-dist/MetaSpatialEditorCLI"

    # Verify CLI works
    echo "🔍 Verifying CLI installation..."
    if ! "$CLI_PATH" version; then
        echo "❌ CLI verification failed"
        exit 1
    fi

    echo "✅ CLI ready at: $CLI_PATH"
    echo ""

    # Export CLI path for use in builds
    export META_SPATIAL_EDITOR_CLI_PATH="$CLI_PATH"

    cd "$BASE_DIR"
else
    echo "⏭️  Skipping Meta Spatial Editor CLI download (non-Linux environment)"
fi

# Track build results
FAILED_EXAMPLES=()
SUCCESS_COUNT=0

# Get list of example directories (exclude hidden files and non-directories)
EXAMPLES=$(find "$EXAMPLES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '.*' | sort)

# Build each example
echo "📦 Building examples..."
for example_dir in $EXAMPLES; do
    example_name=$(basename "$example_dir")
    echo ""
    echo "   Building $example_name..."

    cd "$example_dir"

    # Use fresh:build which does clean install + build
    if npm run fresh:build; then
        echo "     ✅ $example_name built successfully"
        ((SUCCESS_COUNT++))
    else
        echo "     ❌ $example_name build failed"
        FAILED_EXAMPLES+=("$example_name")
    fi
done

echo ""
echo "📁 Copying built examples to docs output..."

# Create the examples directory in docs output
mkdir -p "$DOCS_EXAMPLES_DIR"

# Copy each example's dist folder
for example_dir in $EXAMPLES; do
    example_name=$(basename "$example_dir")

    if [ -d "$example_dir/dist" ]; then
        echo "   Copying $example_name..."
        cp -r "$example_dir/dist" "$DOCS_EXAMPLES_DIR/$example_name"
    else
        echo "   ⚠️  No dist folder found for $example_name"
    fi
done

echo ""
echo "🎉 Examples built and copied to docs!"
echo ""
echo "📊 Build Summary: $SUCCESS_COUNT succeeded, ${#FAILED_EXAMPLES[@]} failed"
if [ ${#FAILED_EXAMPLES[@]} -gt 0 ]; then
    echo ""
    echo "❌ Failed examples:"
    for failed in "${FAILED_EXAMPLES[@]}"; do
        echo "   - $failed"
    done
    exit 1
fi
echo ""
echo "📋 Examples available at:"
for example_dir in $EXAMPLES; do
    example_name=$(basename "$example_dir")
    echo "   /examples/$example_name/"
done
