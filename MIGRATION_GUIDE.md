# Migration Guide - New Environment Setup

> This guide walks you through setting up the freee_audit project on a new PC/environment
> from scratch. Follow each step in order.

---

## Prerequisites

### Required Software

| Software | Version | Check Command | Install Link |
|----------|---------|---------------|--------------|
| Node.js | >=20.0.0 (LTS recommended) | `node --version` | https://nodejs.org/ |
| pnpm | >=8.0.0 | `pnpm --version` | `npm install -g pnpm` |
| Git | >=2.x | `git --version` | https://git-scm.com/ |
| Python | >=3.11 (for microservices) | `python --version` | https://www.python.org/ |
| R | >=4.3 (for statistical service) | `R --version` | https://cran.r-project.org/ |
| Docker | Latest (for OCR service) | `docker --version` | https://www.docker.com/ |

### Optional Software

| Software | Purpose |
|----------|---------|
| VS Code | Recommended editor |
| PostgreSQL 16+ | Production database (SQLite for dev) |
| Redis | Distributed rate limiting (optional) |
| Prisma Studio | Database GUI (`pnpm db:studio`) |

---

## Step 1: Clone the Repository

### Option A: From GitHub

```bash
git clone https://github.com/mizunotaro/freee_audit.git
cd freee_audit
```

### Option B: From ZIP (offline migration)

1. Copy `freee_audit_migration.zip` to the new PC
2. Extract to your desired location (e.g., `C:\src\freee_audit`)
3. Open a terminal in the extracted directory

```bash
cd C:\src\freee_audit
```

---

## Step 2: Install Node.js Dependencies

```bash
pnpm install
```

This installs all 100+ dependencies defined in `package.json`.

---

## Step 3: Configure Environment Variables

### 3.1 Create .env.local from template

```bash
cp .env.example .env.local
```

### 3.2 Generate required secrets

Run these commands and paste the output into `.env.local`:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CSRF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# AUDIT_HASH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.3 Configure key variables in `.env.local`

**Minimum for mock development (no external APIs needed):**

```bash
DATABASE_URL="file:./dev.db"
FREEE_MOCK_MODE="true"
AI_MOCK_MODE="true"
BOX_MOCK_MODE="true"
ENCRYPTION_KEY="<64-char-hex-string>"
JWT_SECRET="<generated>"
CSRF_SECRET="<generated>"
AUDIT_HASH_SECRET="<generated>"
```

**For production with real APIs:**

```bash
FREEE_MOCK_MODE="false"
AI_MOCK_MODE="false"
FREEE_CLIENT_ID="your-real-client-id"
FREEE_CLIENT_SECRET="your-real-client-secret"
OPENAI_API_KEY="sk-..."          # or ANTHROPIC_API_KEY / GEMINI_API_KEY
```

> **If migrating from ZIP**: Copy your existing `.env` and `.env.local` files
> from the old PC directly. They contain your actual secrets.

---

## Step 4: Initialize Database

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations (creates SQLite database)
pnpm db:migrate

# Seed initial data (creates admin user)
pnpm db:seed
```

### Seed Login Credentials
- Email: `admin@example.com`
- Password: `admin123`

### Reset Database (if needed)

```bash
pnpm db:reset    # WARNING: deletes all data
pnpm db:seed     # re-seed
```

---

## Step 5: Verify Main Application

```bash
# Start development server
pnpm dev
```

Open http://localhost:3000 in your browser. You should see the login page.

Login with the seed credentials above.

---

## Step 6: Set Up Python Service (Optional)

The Python service provides advanced financial calculations.

```bash
cd python-service

# Create virtual environment
python -m venv venv

# Activate (Windows PowerShell)
venv\Scripts\Activate.ps1
# Activate (Windows CMD)
venv\Scripts\activate.bat
# Activate (Linux/macOS)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the service
uvicorn app.main:app --reload --port 8000

cd ..
```

Verify: Open http://localhost:8000/docs - you should see the FastAPI Swagger UI.

---

## Step 7: Set Up R Service (Optional)

The R service provides statistical analysis.

```bash
cd r-service

# Install R packages (first time only)
Rscript setup.R

# Or use the setup script
# Windows PowerShell:
.\setup.ps1
# Windows CMD:
.\setup.bat

# Start the service
.\start_service.bat
# Or manually:
Rscript -e "plumber::plumb('plumber.R')\$run(port=8001)"

cd ..
```

Verify: The service should be running on http://localhost:8001.

> If R service is unavailable, set `ENABLE_R_SERVICE="false"` and
> `FALLBACK_TO_TYPESCRIPT="true"` in `.env.local`.

---

## Step 8: Set Up OCR Service (Optional)

The OCR service processes receipts and documents using NDLOCR/YomiTaku.

```bash
# Using Docker (recommended)
cd docker/ndlocr
docker-compose up -d
cd ../..

# Or run the Python OCR server directly
cd ocr-server
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
cd ..
```

> Set `YOMITOKU_ENABLED="false"` in `.env.local` if you don't need OCR.

---

## Step 9: Run Quality Gates

Verify the codebase is healthy:

```bash
pnpm typecheck      # TypeScript type check (0 errors expected)
pnpm lint           # ESLint (0 errors, 0 warnings expected)
pnpm test           # All tests should pass
pnpm build          # Production build should succeed
```

---

## Step 10: Verify Full Stack

### Quick Health Check

```bash
# Check application health
curl http://localhost:3000/api/health
```

### With All Services

| Service | URL | Health Check |
|---------|-----|-------------|
| Next.js App | http://localhost:3000 | Login page loads |
| Python Service | http://localhost:8000/docs | Swagger UI loads |
| R Service | http://localhost:8001 | Responds to requests |
| OCR Server | http://localhost:8001 | Responds to requests |
| Prisma Studio | `pnpm db:studio` | GUI opens at http://localhost:5555 |

---

## Troubleshooting

### `pnpm install` fails

```bash
# Clear pnpm store and retry
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Database migration errors

```bash
# Reset everything
pnpm db:reset
pnpm db:seed
```

### Port already in use

```bash
# Find process on port 3000
# Windows:
netstat -ano | findstr :3000
# Kill it:
taskkill /F /PID <PID>

# Linux/macOS:
lsof -i :3000
kill -9 <PID>
```

### Next.js cache issues (404 errors, missing pages)

```bash
# Clear .next cache (Windows PowerShell)
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
pnpm dev
```

### Python service import errors

```bash
cd python-service
# Ensure virtual environment is activated
pip install -r requirements.txt --upgrade
```

### R service package errors

```bash
cd r-service
# Reinstall all packages
Rscript setup.R
```

---

## File Locations After Setup

```
freee_audit/
├── .env.local              # Your environment variables (from Step 3)
├── prisma/dev.db           # SQLite database (from Step 4)
├── node_modules/           # Dependencies (from Step 2)
├── .next/                  # Next.js build cache (auto-generated)
├── python-service/venv/    # Python virtual env (from Step 6)
└── r-service/renv/         # R package env (from Step 7)
```

---

## Next Steps

After setup is complete, read **[START_HERE.md](./START_HERE.md)** for the
AI assistant session initialization prompt.

For the full project overview, read **[CLAUDE.md](./CLAUDE.md)**.
