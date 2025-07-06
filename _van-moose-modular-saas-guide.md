# Van Moose Best Practices for Modular Building Complex SaaS Applications

> **Success Through Systematic Modular Development**
>
> This guide ensures every Van Moose project achieves success by following a proven modular building approach optimized for Claude Code's 200k token limit.

---

## 🎯 Quick Start Checklist

Before starting any SaaS project:

- [ ] Create project folder with modular structure
- [ ] Initialize CLAUDE.md as living development journal
- [ ] Break concept into 5-10 core modules
- [ ] Write spec.md for first module
- [ ] Set up GitHub repo with monorepo structure
- [ ] Configure authenticated services (Vercel, Supabase, etc.)

---

## 📋 Table of Contents

1. [Philosophy & Core Principles](#philosophy--core-principles)
2. [Modular Architecture](#modular-architecture)
3. [Module Planning System](#module-planning-system)
4. [Claude Code Workflow](#claude-code-workflow)
5. [Module Templates](#module-templates)
6. [Development Process](#development-process)
7. [Success Patterns](#success-patterns)
8. [Failure Prevention](#failure-prevention)
9. [Integration Strategies](#integration-strategies)
10. [Emergency Recovery](#emergency-recovery)

---

## Philosophy & Core Principles

### Why Modular Building Guarantees Success

1. **Cognitive Load Management**: Each module fits comfortably in Claude's context window
2. **Isolation of Complexity**: Problems stay contained within modules
3. **Progressive Enhancement**: Build and test incrementally
4. **Clear Dependencies**: Know exactly what relies on what
5. **Parallel Development**: Multiple modules can be built simultaneously

### The Van Moose Way

```
KISS → YAGNI → Modular → Test → Ship
```

- **Keep It Simple, Stupid**: Each module does ONE thing well
- **You Aren't Gonna Need It**: Build only what's required NOW
- **Modular by Default**: Everything is a self-contained unit
- **Test Each Module**: Verify before integration
- **Ship Incrementally**: Deploy modules as they're ready

---

## Modular Architecture

### Standard SaaS Module Breakdown

```
my-saas/
├── CLAUDE.md                    # Living development journal
├── README.md                    # Project overview
├── modules/                     # Core functionality
│   ├── _manifest.json          # Module registry
│   ├── auth/                   # Authentication & users
│   │   ├── spec.md            # Module specification
│   │   ├── README.md          # Module docs
│   │   └── tests/             # Module tests
│   ├── billing/               # Stripe integration
│   │   ├── spec.md
│   │   └── tests/
│   ├── dashboard/             # User interface
│   │   ├── spec.md
│   │   └── tests/
│   ├── api/                   # REST/GraphQL endpoints
│   │   ├── spec.md
│   │   └── tests/
│   ├── notifications/         # Email/SMS/Push
│   │   ├── spec.md
│   │   └── tests/
│   ├── analytics/             # Usage tracking
│   │   ├── spec.md
│   │   └── tests/
│   └── admin/                 # Admin panel
│       ├── spec.md
│       └── tests/
├── shared/                     # Cross-module utilities
│   ├── types/                 # TypeScript/Pydantic models
│   ├── utils/                 # Helper functions
│   └── constants/             # Shared configuration
├── frontend/                   # Vercel deployment
├── backend/                    # DigitalOcean deployment
└── infrastructure/            # Deployment configs
```

### Module Manifest (_manifest.json)

```json
{
  "modules": {
    "auth": {
      "status": "completed",
      "dependencies": [],
      "exports": ["User", "Session", "authenticate"],
      "version": "1.0.0"
    },
    "billing": {
      "status": "in_progress",
      "dependencies": ["auth"],
      "exports": ["Subscription", "Invoice", "processPayment"],
      "version": "0.5.0"
    }
  },
  "buildOrder": ["auth", "billing", "api", "dashboard", "notifications"]
}
```

---

## Module Planning System

### Module Specification Template (spec.md)

```markdown
# MODULE: [Module Name]

## Purpose
One paragraph explaining what this module does and why it exists.

## Features
- Feature 1: Brief description
- Feature 2: Brief description
- Feature 3: Brief description

## User Stories
- As a [user type], I want to [action] so that [benefit]
- As a [user type], I want to [action] so that [benefit]

## Data Models
```yaml
User:
  id: uuid
  email: string
  created_at: timestamp
  
Session:
  id: uuid
  user_id: uuid (FK)
  token: string
  expires_at: timestamp
```

## API Endpoints
| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | /api/v1/auth/signup | Create new user | No |
| POST | /api/v1/auth/login | Authenticate user | No |
| POST | /api/v1/auth/logout | End session | Yes |

## Dependencies
- Internal: None
- External: bcrypt, jwt, email service

## Success Criteria
- [ ] All endpoints return proper status codes
- [ ] Passwords are hashed with bcrypt
- [ ] JWT tokens expire after 24 hours
- [ ] Email verification works

## Error Handling
- Invalid credentials: 401 Unauthorized
- Duplicate email: 409 Conflict
- Server error: 500 with correlation ID
```

### Module Complexity Scoring

Rate each module 1-5 on complexity to prioritize development:

| Module | Data Models | Business Logic | External APIs | UI Complexity | Total Score |
|--------|-------------|----------------|---------------|---------------|-------------|
| Auth | 3 | 3 | 2 | 2 | 10 |
| Billing | 4 | 5 | 5 | 3 | 17 |
| Dashboard | 2 | 2 | 1 | 5 | 10 |

**Build Order**: Start with lowest total score

---

## Claude Code Workflow

### Session Management Strategy

#### Session 1: Planning & Architecture
```
PROMPT: I'm building a SaaS for [purpose]. Help me break it into modules and create a development plan following Van Moose modular practices.

OUTPUT: 
- Module breakdown
- Dependency graph
- Build order
- First module spec
```

#### Session 2-N: Module Implementation
```
PROMPT: Using modules/auth/spec.md, implement the authentication module with:
- FastAPI routes in backend/routers/auth.py
- Pydantic schemas in backend/schemas/auth.py
- SQLAlchemy models in backend/models/auth.py
- Tests in backend/tests/test_auth.py

Keep each file under 500 lines. Use existing Van Moose patterns.
```

### Token Optimization Techniques

1. **Reference Don't Repeat**: "Use the User model from modules/auth/spec.md"
2. **Incremental Building**: "Add password reset to existing auth module"
3. **Focused Prompts**: "Generate only the Stripe webhook handler"
4. **Use TodoWrite**: Track progress without re-explaining

### Context Preservation Between Sessions

```markdown
# CLAUDE.md Session Log

## Session 1 (2024-01-15)
- Created module structure
- Implemented auth module
- TODO: Add OAuth support

## Session 2 (2024-01-16)
- Starting point: Auth module complete
- Goal: Implement billing module
- Dependencies: Import User from auth
```

---

## Module Templates

### 1. Authentication Module

```python
# backend/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models.auth import User
from ..schemas.auth import UserCreate, UserLogin, Token
from ..utils.auth import create_access_token, verify_password, get_password_hash

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.post("/signup", response_model=Token)
async def signup(user: UserCreate, db: Session = Depends(get_db)):
    """Create new user account."""
    # Check if user exists
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # Create user
    db_user = User(
        email=user.email,
        hashed_password=get_password_hash(user.password)
    )
    db.add(db_user)
    db.commit()
    
    # Generate token
    access_token = create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}
```

### 2. Billing Module (Stripe)

```python
# backend/routers/billing.py
import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..models.billing import Subscription
from ..utils.auth import get_current_user

stripe.api_key = settings.STRIPE_SECRET_KEY
router = APIRouter(prefix="/api/v1/billing", tags=["billing"])

@router.post("/create-subscription")
async def create_subscription(
    price_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create Stripe subscription for user."""
    try:
        # Create or get Stripe customer
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(email=current_user.email)
            current_user.stripe_customer_id = customer.id
            db.commit()
        
        # Create subscription
        subscription = stripe.Subscription.create(
            customer=current_user.stripe_customer_id,
            items=[{"price": price_id}],
            expand=["latest_invoice.payment_intent"]
        )
        
        # Save to database
        db_subscription = Subscription(
            user_id=current_user.id,
            stripe_subscription_id=subscription.id,
            status=subscription.status,
            current_period_end=subscription.current_period_end
        )
        db.add(db_subscription)
        db.commit()
        
        return {"subscription_id": subscription.id, "status": subscription.status}
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

### 3. Dashboard Module (React)

```tsx
// frontend/src/modules/dashboard/DashboardLayout.tsx
import { useAuth } from '@/modules/auth/useAuth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header user={user} onLogout={logout} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## Development Process

### Phase 1: Foundation (Week 1)
1. **Project Setup**
   - Initialize monorepo structure
   - Configure GitHub, Vercel, DigitalOcean
   - Set up Supabase project
   - Create CLAUDE.md

2. **Core Modules**
   - Auth module (2 days)
   - Database schema (1 day)
   - Basic API structure (1 day)
   - Frontend scaffold (1 day)

### Phase 2: Features (Week 2-3)
3. **Business Logic**
   - Billing integration
   - Core feature modules
   - Admin panel basics

4. **User Experience**
   - Dashboard components
   - Responsive design
   - Error handling

### Phase 3: Polish (Week 4)
5. **Production Ready**
   - E2E tests with Playwright
   - Performance optimization
   - Security audit
   - Documentation

### Daily Workflow

```bash
# Morning: Plan the day
1. Read CLAUDE.md for context
2. Check module manifest
3. Pick module to work on
4. Load spec.md into Claude

# Development: Build incrementally  
5. Implement one feature at a time
6. Test locally after each change
7. Commit working code frequently
8. Update CLAUDE.md with progress

# Evening: Review and document
9. Run full test suite
10. Update module status
11. Plan tomorrow's work
12. Push to GitHub
```

---

## Success Patterns

### 1. Progressive Enhancement Pattern

```
Basic Feature → Working Feature → Polished Feature → Optimized Feature
```

**Example**: User Authentication
1. Basic: Email/password login
2. Working: Add password reset
3. Polished: Add OAuth, 2FA
4. Optimized: Add rate limiting, audit logs

### 2. Test-First Module Development

```python
# Write test first
def test_user_can_signup():
    response = client.post("/api/v1/auth/signup", json={
        "email": "test@example.com",
        "password": "securepass123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()

# Then implement to pass test
```

### 3. Documentation-Driven Development

1. Write spec.md first
2. Get stakeholder approval
3. Generate tests from spec
4. Implement to match spec
5. Update spec if reality differs

### 4. Dependency Injection Pattern

```python
# Good: Testable and modular
class EmailService:
    def send(self, to: str, subject: str, body: str): ...

class AuthService:
    def __init__(self, email_service: EmailService):
        self.email = email_service
    
    def signup(self, email: str, password: str):
        # ... create user ...
        self.email.send(email, "Welcome!", "Thanks for signing up")

# Bad: Tightly coupled
class AuthService:
    def signup(self, email: str, password: str):
        # ... create user ...
        send_email(email, "Welcome!", "Thanks for signing up")  # Direct call
```

---

## Failure Prevention

### Common Pitfalls and Solutions

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Module Sprawl | Too many tiny modules | Combine related features |
| Circular Dependencies | Import errors | Use dependency injection |
| Overengineering | Complex abstractions | KISS principle |
| Underspecification | Unclear requirements | Detailed spec.md |
| Token Overflow | Claude loses context | Smaller, focused prompts |

### Pre-Implementation Checklist

Before coding any module:

- [ ] Is the spec.md complete?
- [ ] Are dependencies identified?
- [ ] Are error cases documented?
- [ ] Is the API contract clear?
- [ ] Are success criteria defined?

### Code Review Checklist

Before marking module complete:

- [ ] All tests pass?
- [ ] Under 500 lines per file?
- [ ] Error handling complete?
- [ ] Documentation updated?
- [ ] No hardcoded secrets?

---

## Integration Strategies

### 1. Gradual Integration

```mermaid
Module A (Complete) → Module B (Complete) → Integration Layer → Test Together
```

Never integrate incomplete modules.

### 2. Contract Testing

```python
# Test module interfaces
def test_auth_exports_user_model():
    from modules.auth import User
    assert hasattr(User, 'id')
    assert hasattr(User, 'email')

def test_billing_imports_user():
    from modules.billing import create_subscription
    # Should accept User object
```

### 3. Feature Flags

```python
# Enable gradual rollout
FEATURE_FLAGS = {
    "oauth_login": os.getenv("ENABLE_OAUTH", "false") == "true",
    "annual_billing": os.getenv("ENABLE_ANNUAL", "false") == "true",
}

if FEATURE_FLAGS["oauth_login"]:
    router.include_router(oauth_router)
```

---

## Emergency Recovery

### When Things Go Wrong

#### Module Won't Build
1. Check spec.md for missing requirements
2. Verify all dependencies installed
3. Run tests in isolation
4. Rollback to last working commit

#### Claude Loses Context
1. Summarize current state in 3 sentences
2. Reference spec.md and CLAUDE.md
3. Focus on one specific task
4. Use TodoWrite to track progress

#### Integration Failures
1. Test modules independently first
2. Check interface contracts
3. Add logging at boundaries
4. Use feature flags to disable

### Recovery Commands

```bash
# Quick diagnostics
npm run test:module auth     # Test single module
npm run lint:fix             # Auto-fix issues
git diff HEAD~1              # What changed?

# Reset and rebuild
git stash                    # Save current work
git checkout main            # Clean slate
npm clean-install            # Fresh dependencies

# Module isolation
cd modules/auth && npm test  # Test in isolation
```

---

## Metrics for Success

### Module Health Indicators

| Metric | Good | Warning | Bad |
|--------|------|---------|-----|
| Lines per file | <300 | 300-500 | >500 |
| Test coverage | >80% | 60-80% | <60% |
| Dependencies | <5 | 5-10 | >10 |
| Build time | <30s | 30-60s | >60s |
| Complexity | <10 | 10-20 | >20 |

### Project Success Metrics

1. **Deployment Frequency**: Can deploy any module independently
2. **Time to New Feature**: <1 day for simple features
3. **Bug Resolution**: <4 hours for critical bugs
4. **Developer Onboarding**: <1 day to be productive

---

## Real Van Moose Project Examples

### Example 1: E-Commerce Platform

```
modules/
├── auth/          # 2 days to complete
├── products/      # 3 days (includes search)
├── cart/          # 1 day
├── checkout/      # 2 days (Stripe integration)
├── orders/        # 2 days
├── admin/         # 3 days
└── analytics/     # 2 days

Total: 15 days from zero to production
```

### Example 2: SaaS Dashboard

```
modules/
├── auth/          # 2 days
├── workspaces/    # 2 days (multi-tenant)
├── projects/      # 3 days
├── collaboration/ # 3 days
├── billing/       # 2 days
└── api/          # 3 days

Total: 15 days with full collaboration features
```

---

## Appendix: Quick Reference

### Claude Prompts Library

```markdown
# Module Planning
"Break down a [type] SaaS into Van Moose modules with dependencies"

# Module Implementation  
"Using [module]/spec.md, implement with FastAPI/React following Van Moose patterns"

# Testing
"Generate comprehensive tests for [module] covering all spec.md requirements"

# Integration
"Create integration layer between [module A] and [module B]"

# Debugging
"Debug [error] in [module], here's the error trace: ..."
```

### Module Status Board Template

```markdown
# CLAUDE.md Module Status

| Module | Status | Progress | Blockers | Next Steps |
|--------|--------|----------|----------|------------|
| auth | ✅ Complete | 100% | None | Add OAuth |
| billing | 🚧 In Progress | 60% | Stripe webhook | Test webhooks |
| dashboard | 📋 Planned | 0% | Needs auth | Start tomorrow |
```

### Emergency Contacts

- **Vercel Issues**: Check deployment logs, use preview URLs
- **Supabase Issues**: Check connection pool, row-level security
- **DigitalOcean Issues**: Check droplet resources, logs
- **Stripe Issues**: Use test mode first, check webhook signatures

---

## Final Words

Success in modular SaaS development comes from:

1. **Discipline**: Follow the module system religiously
2. **Simplicity**: Each module does ONE thing well
3. **Testing**: Verify each module independently
4. **Documentation**: Keep spec.md and CLAUDE.md current
5. **Iteration**: Ship small, improve continuously

Remember: **A working module today beats a perfect system tomorrow.**

---

*This guide is a living document. Update it with lessons learned from each project.*