#!/bin/bash
set -e
PROJECT_DIR="$1"
cd "$PROJECT_DIR"

# ensure gradlew executable
chmod +x ./gradlew

# Clean then assemble release
./gradlew clean
./gradlew assembleRelease -x lint
