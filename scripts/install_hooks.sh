#!/bin/bash
# Install git hooks

HOOKS_DIR=".git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "Error: .git directory not found. Are you in the project root?"
    exit 1
fi

echo "Installing pre-push hook..."

cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash

echo "Running pre-push checks..."

# Run Backend Lint
echo "Checking Backend Lint (ruff)..."
source venv/bin/activate && ruff check .
if [ $? -ne 0 ]; then
    echo "Backend lint failed. Fix issues before pushing."
    exit 1
fi

# Run Backend Tests
echo "Running Backend Tests (pytest)..."
source venv/bin/activate && pytest
if [ $? -ne 0 ]; then
    echo "Backend tests failed. Fix issues before pushing."
    exit 1
fi

# Run Frontend Lint
echo "Checking Frontend Lint (eslint)..."
cd frontend && npm run lint
if [ $? -ne 0 ]; then
    echo "Frontend lint failed. Fix issues before pushing."
    exit 1
fi

# Run Frontend Tests
echo "Running Frontend Tests (vitest)..."
npm run test -- --run
if [ $? -ne 0 ]; then
    echo "Frontend tests failed. Fix issues before pushing."
    exit 1
fi

echo "Pre-push checks passed!"
exit 0
EOF

chmod +x "$HOOKS_DIR/pre-push"

echo "Done! Pre-push hook installed."
