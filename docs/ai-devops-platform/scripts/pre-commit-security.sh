#!/bin/bash
set -e

# Load patterns
PATTERNS_FILE="config/threat-patterns.json"

if [ ! -f "$PATTERNS_FILE" ]; then
    echo "⚠️  Warning: $PATTERNS_FILE not found, skipping pattern-based scan"
    PATTERNS=""
else
    PATTERNS=$(cat "$PATTERNS_FILE")
fi

# Get staged files
FILES=$(git diff --cached --name-only)

# Scan each file
for FILE in $FILES; do
    if [ -f "$FILE" ]; then
        # Check critical patterns
        if grep -E "eval\(|exec\(|Function\(|child_process" "$FILE"; then
            echo "❌ CRITICAL: Potentially dangerous code in $FILE"
            exit 1
        fi
        
        # Check for hardcoded secrets
        if grep -E "(password|api_key|secret)\s*=\s*['\"]" "$FILE"; then
            echo "❌ CRITICAL: Hardcoded credentials in $FILE"
            exit 1
        fi
    fi
done

echo "✅ Security scan passed"
exit 0
