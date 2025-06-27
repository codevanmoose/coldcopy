# ColdCopy - AI-Powered Sales Automation Platform

ColdCopy is a comprehensive sales automation platform with AI-powered email generation, multi-channel outreach, CRM integrations, and enterprise-grade features.

## 🚀 Features

- **Multi-Channel Outreach**: Email, LinkedIn, Twitter integration
- **AI-Powered Personalization**: GPT-4 and Claude integration
- **CRM Integrations**: HubSpot, Salesforce, Pipedrive
- **White-Label Platform**: Full customization support
- **Team Collaboration**: Shared inbox and workflows
- **GDPR Compliance**: Built-in privacy features
- **Email Deliverability**: Warm-up system and reputation monitoring
- **Advanced Analytics**: Real-time dashboards and insights

## 📋 Prerequisites

- Node.js 18+ 
- Python 3.11+ (Python 3.13 may have compatibility issues with some dependencies)
- PostgreSQL (via Supabase)
- Redis
- AWS Account (for SES)

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/coldcopy.git
cd coldcopy
```

### 2. Install Dependencies

**Frontend (Next.js):**
```bash
cd apps/web
npm install
```

**Backend (FastAPI):**
```bash
cd apps/api
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Note: If using Python 3.13, you may need to install Python 3.11 or 3.12
# Some dependencies (asyncpg, pydantic-core) have build issues with Python 3.13

pip install -r requirements.txt
```

### 3. Environment Configuration

**Frontend (.env.local):**
```bash
cd apps/web
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

**Backend (.env):**
```bash
cd apps/api
cp .env.example .env
# Edit .env with your configuration
```

Required variables:
- `DATABASE_URL`
- `REDIS_URL`
- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

### 4. Database Setup

1. Create a Supabase project at https://supabase.com
2. Run migrations:
```bash
cd supabase
npx supabase db push
```

### 5. Start Development Servers

**Frontend:**
```bash
cd apps/web
npm run dev
# Runs on http://localhost:3000
```

**Backend:**
```bash
cd apps/api
source venv/bin/activate
uvicorn main:app --reload
# Runs on http://localhost:8000
```

**Redis (using Docker):**
```bash
docker run -d -p 6379:6379 redis:alpine
```

## 🏗️ Project Structure

```
coldcopy/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # FastAPI backend
├── packages/         # Shared packages
├── infrastructure/   # Deployment configs
└── supabase/        # Database migrations
```

## 📝 Development Workflow

1. **Feature Development**: Create feature branches from `main`
2. **Testing**: Run tests before committing
   - Frontend: `npm test`
   - Backend: `pytest`
3. **Code Quality**: 
   - Frontend: `npm run lint`
   - Backend: `ruff check .` and `black .`

## 🚀 Deployment

See [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) for production deployment instructions.

## 📚 Documentation

- [API Documentation](http://localhost:8000/docs)
- [ColdCopy PRD](ColdCopy%20PRD.txt)
- [Development Guide](CLAUDE.md)

## ⚠️ Known Issues

1. **Python 3.13 Compatibility**: Some dependencies (asyncpg, pydantic-core) have build issues with Python 3.13. Use Python 3.11 or 3.12 for now.

2. **Apple Silicon (M1/M2)**: If you encounter issues building Python packages, ensure you have Xcode command line tools installed:
   ```bash
   xcode-select --install
   ```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

[Add your license here]

## 🆘 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/yourusername/coldcopy/issues)
- Documentation: See `/docs` folder