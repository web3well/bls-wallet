#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_DIR="$SCRIPT_DIR/.."

if [ ! -f "$PROJECT_DIR/config.json" ]; then
  echo {} >"$PROJECT_DIR/config.json"
fi

if [ ! -f "$PROJECT_DIR/build/blsNetworksConfig.json" ]; then
  mkdir -p "$PROJECT_DIR/build"
  echo {} >"$PROJECT_DIR/build/blsNetworksConfig.json"
fi
