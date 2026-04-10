#!/bin/bash

# LMS Localization Audit Script
# This script scans the frontend for potentially hardcoded strings.

SRC_DIR="frontend-next/src"
EXCLUDE_FILES="translations.ts"

echo "🔍 Starting Localization Audit..."
echo "---------------------------------"

# 1. Search for Cyrillic characters (Russian/Kazakh) outside of the translation file
echo "Checking for hardcoded Cyrillic strings (RU/KK)..."
grep -r "[а-яА-ЯёЁ]" "$SRC_DIR" --exclude-dir=node_modules --exclude="$EXCLUDE_FILES" | grep -v "//" | grep -v "/*"

# 2. Search for English strings that might be missing t() wrapper
# Look for strings in double or single quotes that start with a capital letter and aren't in a t() or console call
echo ""
echo "Checking for potential untranslated English strings..."
# This is a bit noisy but helps find things like label="Email address"
grep -rnE "['\"][A-Z][a-z0-9 ]+['\"]" "$SRC_DIR" --exclude-dir=node_modules --exclude="$EXCLUDE_FILES" | grep -v "t(" | grep -v "console." | grep -v "import" | head -n 20

# 3. Check for specific common untranslated fields in forms or profiles
echo ""
echo "Checking common UI patterns (labels, placeholders)..."
grep -rn "label=" "$SRC_DIR" | grep -v "t(" | head -n 10
grep -rn "placeholder=" "$SRC_DIR" | grep -v "t(" | head -n 10

echo "---------------------------------"
echo "Audit complete. Please review the findings above."
