#!/usr/bin/env bash
set -e
echo "Installing dependencies with yarn..."
yarn install --frozen-lockfile
echo "Building production bundle..."
yarn build
echo "Build complete."
