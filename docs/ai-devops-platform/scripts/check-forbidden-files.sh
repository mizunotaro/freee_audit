#!/bin/bash
set -e

# Forbidden file patterns
FORBIDDEN_PATTERNS=(
    ".env"
    ".env.local"
    ".env.*.local"
    "*.pem"
    "*.key"
    "*credentials*"
    "*secrets*"
    "id_rsa"
    "*.p12"
    "*.pfx"
)

# Get staged files
FILES=$(git diff --cached --name-only)

for FILE in $FILES; do
    for PATTERN in "${FORBIDDEN_PATTERNS[@]}"; do
        if [[ "$FILE" == *"$PATTERN"* ]]; then
            echo "❌ FORBIDDEN: $FILE matches forbidden pattern '$PATTERN'"
            exit 1
        fi
    done
done

echo "✅ No forbidden files detected"
exit 0
