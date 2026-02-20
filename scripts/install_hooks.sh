#!/bin/bash
# Install git hooks

HOOKS_DIR=".git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "Error: .git directory not found. Are you in the project root?"
    exit 1
fi

echo "Installing pre-commit hook (Auto-fixers)..."

cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

echo "Running pre-commit auto-fixes..."

# 1. Backend Fixes (Ruff)
if command -v ruff &> /dev/null; then
    echo "Applying Ruff fixes..."
    ruff check . --fix
elif [ -f "venv/bin/ruff" ]; then
    echo "Applying Ruff fixes (via venv)..."
    source venv/bin/activate && ruff check . --fix
fi

# 2. Frontend Fixes (ESLint)
if [ -d "frontend" ]; then
    echo "Applying ESLint fixes..."
    cd frontend
    # Use npx to ensure we use the local version
    npx eslint . --fix &> /dev/null
    cd ..
fi

# 3. Re-stage files that were modified by auto-fixes
# We only want to add back files that were already staged
for FILE in $STAGED_FILES; do
    if [ -f "$FILE" ]; then
        git add "$FILE"
    fi
done

echo "Auto-fixes applied and staged."
EOF

chmod +x "$HOOKS_DIR/pre-commit"

echo "Installing pre-push hook (Validation)..."

cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash

echo "Running pre-push validation..."

# 1. Backend Check
echo "Validating Backend (ruff & pytest)..."
source venv/bin/activate
ruff check .
if [ $? -ne 0 ]; then
    echo "❌ Backend lint failed. Please fix remaining issues."
    exit 1
fi

pytest
if [ $? -ne 0 ]; then
    echo "❌ Backend tests failed."
    exit 1
fi

# 2. Frontend Check
echo "Validating Frontend (eslint & vitest)..."
cd frontend
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Frontend lint failed."
    exit 1
fi

npm run test -- --run
if [ $? -ne 0 ]; then
    echo "❌ Frontend tests failed."
    exit 1
fi

echo "✅ All checks passed! Pushing..."
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-push"

echo "Done! Hooks installed."
echo "- Pre-commit: Automatically runs 'ruff --fix' and 'eslint --fix' on your staged files."
echo "- Pre-push: Runs full test suite and final lint check to ensure everything is perfect."
