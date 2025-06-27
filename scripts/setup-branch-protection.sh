#!/bin/bash

# Setup branch protection rules for ColdCopy repository
# This script configures protection for main and develop branches

REPO="codevanmoose/coldcopy"

echo "🔒 Setting up branch protection rules for $REPO"

# Configure main branch protection
echo "Configuring protection for 'main' branch..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/main/protection" \
  -f required_status_checks='{"strict":true,"contexts":["test","lint","typecheck","security"]}' \
  -f enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":false,"require_last_push_approval":true}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f block_creations=false \
  -f required_conversation_resolution=true \
  -f lock_branch=false \
  -f allow_fork_syncing=true || echo "Failed to protect main branch"

# Configure develop branch protection
echo "Configuring protection for 'develop' branch..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/develop/protection" \
  -f required_status_checks='{"strict":true,"contexts":["test","lint","typecheck"]}' \
  -f enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":true,"require_code_owner_reviews":false}' \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false \
  -f block_creations=false \
  -f required_conversation_resolution=false \
  -f lock_branch=false \
  -f allow_fork_syncing=true || echo "Failed to protect develop branch"

# Create CODEOWNERS file
echo "Creating CODEOWNERS file..."
cat > .github/CODEOWNERS << 'EOF'
# Default owners for everything in the repo
* @codevanmoose

# Frontend code owners
/apps/web/ @codevanmoose
/packages/ui/ @codevanmoose

# Backend code owners
/apps/api/ @codevanmoose
/packages/database/ @codevanmoose

# Infrastructure and CI/CD
/.github/ @codevanmoose
/infrastructure/ @codevanmoose
/scripts/ @codevanmoose

# Documentation
/docs/ @codevanmoose
*.md @codevanmoose
EOF

echo "✅ Branch protection rules configured successfully!"
echo ""
echo "📋 Protection Summary:"
echo "- main: Requires 1 approval, all checks must pass, no force pushes"
echo "- develop: All checks must pass, no approval required, no force pushes"
echo "- Both branches: Cannot be deleted, strict status checks"
echo ""
echo "🔍 Required status checks:"
echo "- test: Run all tests"
echo "- lint: Code linting"
echo "- typecheck: TypeScript type checking"
echo "- security: Security scanning (main only)"