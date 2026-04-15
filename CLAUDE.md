# CLAUDE.md - Claude Code / AI Assistant Context

> This file is the primary entry point for any AI assistant (Claude Code, Cursor, etc.)
> accessing this repository for the first time. Read this file completely before starting work.

---

## 1. Project Overview

**freee_audit** is a full-stack AI-powered financial audit, analysis, and accounting standard
conversion platform integrated with [freee accounting software](https://www.freee.co.jp/).

It serves Japanese businesses needing:

- Automated journal auditing with AI receipt verification
- Monthly/quarterly financial report generation (BS/PL/CF)
- KPI analysis, cash flow forecasting, and Runway/Burn Rate tracking
- Tax management, social insurance scheduling
- DD (Due Diligence) checklists for IPO/M&A
- IR reporting, board meeting document generation
- JGAAP-to-IFRS/USGAAP accounting standard conversion
- Company valuation (DCF, Monte Carlo, comparable analysis)
- Investor portal for read-only report access

### Target Users

| Role | Purpose |
|------|---------|
| Admin | Full access, settings, user management |
| Accountant | Audit execution, report creation, budget input |
| Viewer | Read-only report access |
| Investor | Investor portal (restricted read-only) |

---

## 2. Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x |
| Frontend | React, Tailwind CSS, shadcn/ui (44 components) | React 19 |
| Database | Prisma ORM (SQLite dev / PostgreSQL prod) | Prisma 5.x |
| AI/LLM | OpenAI, Claude, Gemini, OpenRouter + 9 more providers | 30+ models |
| i18n | next-intl (Japanese default + English) | 3.x |
| Auth | JWT + bcrypt (RBAC: 4 roles) | - |
| Encryption | AES-256-GCM | - |
| Charts | Recharts, Plotly.js, D3 | - |
| Export | @react-pdf/renderer, pptxgenjs, exceljs | - |
| Testing | Vitest (unit/integration), Playwright (E2E) | Vitest 4.x |
| Package Manager | pnpm | >=8.0.0 |
| Runtime | Node.js | >=20.0.0 |

### Microservices

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| Python Service | FastAPI | 8000 | Financial calculations |
| R Service | Plumber | 8001 | Statistical analysis, time series |
| OCR Server | FastAPI (YomiTaku/NDLOCR) | 8001-8002 | Document OCR processing |

---

## 3. Directory Map

```
freee_audit/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Root redirect to /ja/login
│   │   ├── (dashboard)/              # Legacy dashboard group
│   │   │   ├── analysis/page.tsx
│   │   │   └── chat/page.tsx
│   │   ├── [locale]/                 # i18n locale prefix (ja/en, always present)
│   │   │   ├── login/                # Login page
│   │   │   ├── investor/             # Investor portal (accept invite)
│   │   │   ├── settings/             # AI settings, freee connection
│   │   │   └── (authenticated)/      # Protected route group (all main pages)
│   │   │       ├── dashboard/
│   │   │       ├── audit/            # journal/, journals/, results/
│   │   │       ├── reports/          # monthly/, periodic/, kpi/, cashflow/, budget/, business/, ir/
│   │   │       ├── analysis/
│   │   │       ├── chat/             # AI chat interface
│   │   │       ├── journal-proposal/ # AI journal proposal workflow
│   │   │       ├── conversion/       # projects/, mappings/, coa/
│   │   │       ├── valuation/        # Company valuation
│   │   │       ├── financial-dd/     # Due diligence
│   │   │       ├── board/            # Board meetings
│   │   │       ├── board-reports/    # Board report viewer
│   │   │       ├── tax/              # Tax management
│   │   │       ├── social-insurance/
│   │   │       ├── deferred-accrual/
│   │   │       ├── inventory/
│   │   │       ├── import/           # journals/
│   │   │       └── settings/         # main, peer-companies/, market-data/, kpi/, prompts/
│   │   └── api/                      # 100+ API route endpoints (see Section 4)
│   │
│   ├── components/                   # React components (13 categories)
│   │   ├── ui/                       # 44 shadcn/ui components
│   │   ├── analysis/
│   │   ├── audit/
│   │   ├── board/
│   │   ├── chat/
│   │   ├── common/
│   │   ├── conversion/
│   │   ├── dashboard/
│   │   ├── import/
│   │   ├── journal-proposal/
│   │   ├── reports/                  # includes ir/ subcategory
│   │   ├── settings/
│   │   ├── shared/
│   │   └── valuation/
│   │
│   ├── services/                     # Business logic (34 subdirectories)
│   │   ├── account-items/
│   │   ├── ai/analyzers/             # Category analysis, ratio analysis
│   │   ├── analytics/
│   │   ├── audit/                    # Journal auditing
│   │   ├── benchmark/                # Industry benchmark comparison
│   │   ├── board/                    # Board meeting management
│   │   ├── budget/                   # Budget vs actual tracking
│   │   ├── cashflow/                 # Cash flow analysis
│   │   ├── closing/                  # Closing entries
│   │   ├── conversion/               # Accounting standard conversion
│   │   ├── currency/                 # Currency/exchange rate
│   │   ├── dd/                       # Due diligence (validators/, reports/)
│   │   ├── debt/                     # Debt schedule management
│   │   ├── deferred-accrual/         # Prepaid/accrued expenses
│   │   ├── export/                   # PDF, Excel, CSV, PPTX export
│   │   ├── external-info/            # External information (sources/, cache/)
│   │   ├── fixed-assets/             # Fixed asset + depreciation
│   │   ├── freee/                    # freee API integration
│   │   ├── import/ai/                # Data import with AI assistance
│   │   ├── inventory/                # Inventory tracking
│   │   ├── investor/                 # Investor access management
│   │   ├── journal-proposal/         # AI journal proposal workflow
│   │   ├── kpi/                      # KPI definitions + records
│   │   ├── market-data/              # Market data provider integration
│   │   ├── ocr/                      # OCR processing (NDLOCR/YomiTaku)
│   │   ├── peer-companies/           # Peer company comparison
│   │   ├── report/                   # General report generation
│   │   ├── reports/                  # business-report/, ir/
│   │   ├── secrets/                  # Secret management
│   │   ├── social-insurance/         # Social insurance schedule
│   │   ├── storage/                  # File storage
│   │   ├── tax/                      # Tax schedule management
│   │   ├── validation/               # Data validation
│   │   └── valuation/                # Company valuation (monte-carlo/, qa/)
│   │
│   ├── lib/                          # Core libraries (23 items)
│   │   ├── ai/
│   │   │   ├── config/               # Model config service, defaults, registry
│   │   │   ├── orchestrator/         # AI workflow orchestration (9 workflows)
│   │   │   ├── personas/             # Expert personas (CPA, Tax, CFO, Analyst, Big4)
│   │   │   ├── prompts/              # Prompt template engine
│   │   │   ├── context/              # Context management
│   │   │   ├── tokenizer/            # Token counting, cost estimation
│   │   │   └── security/             # Prompt guard, fact-checker, output sandbox
│   │   ├── integrations/
│   │   │   ├── ai/                   # LLM providers (OpenAI, Claude, Gemini, OpenRouter, etc.)
│   │   │   │   ├── openai.ts, claude.ts, gemini.ts, openrouter.ts
│   │   │   │   ├── openai-compatible.ts  # DeepSeek, Kimi, Qwen, Groq
│   │   │   │   ├── fallback-provider.ts  # Fallback chain
│   │   │   │   ├── circuit-breaker.ts    # Circuit breaker pattern
│   │   │   │   ├── mock.ts               # Mock provider for testing
│   │   │   │   ├── provider-registry.ts  # Provider registration
│   │   │   │   └── factory.ts            # Provider factory
│   │   │   ├── freee/                # freee API client (OAuth2, journals, deals, trial balance)
│   │   │   ├── box/                  # Box cloud storage
│   │   │   └── slack/                # Slack notifications
│   │   ├── security/
│   │   │   ├── csrf-protection.ts
│   │   │   ├── input-sanitizer.ts
│   │   │   ├── rate-limit-middleware.ts
│   │   │   ├── rate-limit-hybrid.ts
│   │   │   ├── pii-detector.ts
│   │   │   ├── anomaly-detector.ts
│   │   │   └── secure-storage.ts
│   │   ├── audit/audit-logger.ts     # Blockchain-style integrity chain
│   │   ├── auth.ts                   # JWT auth (24h expiry, bcrypt, lockout)
│   │   ├── auth-edge.ts             # Edge-compatible JWT verification
│   │   ├── crypto.ts                # AES-256-GCM encryption
│   │   ├── db.ts                    # Prisma client singleton
│   │   ├── secrets/                 # Pluggable secret providers (local, env, GCP, AWS, Azure, 1Password)
│   │   └── storage/                 # Pluggable storage providers (local, S3, GCS, Azure, MinIO)
│   │
│   ├── types/                        # TypeScript type definitions (20 files)
│   │   ├── index.ts                  # Core domain types (User, Company, ApiResponse<T>, etc.)
│   │   ├── result.ts                 # Result<T, E> pattern (success/failure union)
│   │   ├── conversion.ts             # Accounting conversion types (1113 lines)
│   │   ├── journal-proposal.ts       # AI journal proposal types (304 lines)
│   │   ├── ocr.ts                    # OCR engine types
│   │   ├── ir-report.ts             # IR report types (358 lines)
│   │   ├── accounting-standard.ts    # JGAAP/USGAAP/IFRS config types
│   │   └── reports/                  # 7 report type files (business, periodic, kpi, ir, cashflow, budget, common)
│   │
│   ├── hooks/                        # Custom React hooks (7 files)
│   ├── config/                       # Configuration files
│   ├── contexts/                     # React contexts (PageContext provider)
│   ├── i18n/                         # i18n routing and request config
│   └── jobs/                         # Scheduled jobs (node-cron)
│       └── scheduler.ts             # 5 scheduled jobs (see Section 8)
│
├── prisma/
│   ├── schema.prisma                 # Database schema (1846 lines, 60+ models)
│   ├── migrations/
│   └── seed.ts                       # Seed data (admin@example.com / admin123)
│
├── python-service/                   # FastAPI microservice (port 8000)
├── r-service/                        # R Plumber microservice (port 8001)
├── ocr-server/                       # OCR microservice (YomiTaku/NDLOCR, ports 8001-8002)
│
├── messages/                         # i18n message files
│   ├── ja.json                       # Japanese (443 lines, default)
│   └── en.json                       # English
│
├── tests/                            # Test files
│   ├── unit/                         # Unit tests (mirrors src/ structure)
│   ├── integration/                  # Integration tests (mirrors API routes)
│   └── e2e/                          # E2E tests (Playwright)
│
├── middleware.ts                      # Auth + i18n routing (public paths: /login, /api/auth/*, /api/health)
├── types/                            # Additional type definitions
├── docker/                           # Docker configurations
├── infrastructure/                   # Infrastructure setup (terraform/, docker/)
├── scripts/                          # Utility scripts
├── docs/                             # Documentation (see Section 12)
├── AGENTS.md                         # AI agent rules (opencode / Codex)
└── CLAUDE.md                         # This file
```

---

## 4. API Routes (100+ Endpoints)

### Authentication
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`

### Core Business
- `GET /api/dashboard`, `GET /api/journals`, `GET /api/health`
- `GET /api/inventory`, `GET /api/board-reports`, `GET /api/kpi/custom`

### freee Integration
- `GET /api/freee/auth`, `GET /api/freee/callback`, `POST /api/freee/refresh`
- `GET /api/freee/companies`, `GET /api/freee/journals`, `GET /api/freee/receipts`
- `GET /api/freee/reports/trial`, `GET /api/freee/documents/[id]/download`
- `GET /api/freee/journals/[id]/receipts`, `POST /api/freee/sync`

### Audit
- `GET /api/audit/journals`, `POST /api/audit/journal`, `GET /api/audit/results`

### Analysis
- `POST /api/analysis`, `POST /api/analysis/financial`, `GET /api/analysis/ratios`
- `POST /api/analysis/benchmark`, `POST /api/analysis/report`

### Reports
- `GET /api/reports/monthly`, `GET /api/reports/periodic`, `GET /api/reports/kpi`
- `GET /api/reports/cashflow`, `GET /api/reports/budget`
- `POST /api/reports/business/generate`, `POST /api/reports/business/export`
- `POST /api/reports/ir/*` (CRUD + sections + publish + export + shareholders + events + FAQ)

### Accounting Standard Conversion
- `GET /api/conversion/standards`
- `/api/conversion/coa/*` (CRUD + items + import + validate + templates + export)
- `/api/conversion/mappings/*` (CRUD + batch + suggest + statistics + export)
- `/api/conversion/projects/*` (CRUD + execute + abort + progress + results)
- `GET /api/conversion/export/[projectId]`

### Journal Proposal
- `POST /api/journal-proposal/` (CRUD), `POST /api/journal-proposal/upload`
- `POST /api/journal-proposal/analyze`
- `POST /api/journal-proposal/[id]/approve|reject|regenerate|export`

### Export
- `POST /api/export/pdf`, `POST /api/export/excel`, `POST /api/export/csv`, `POST /api/export/pptx`

### Tax & Insurance
- `GET/POST /api/tax/settings`, `GET/POST /api/tax/schedules`, `POST /api/tax/generate`
- `GET/POST /api/social-insurance/schedules`, `GET/POST /api/social-insurance/payments`

### Board
- `POST /api/board/meetings/*`, `GET/PUT /api/board/items/[id]/*`

### Due Diligence
- `POST /api/dd/checklists/*`

### Investor
- `POST /api/investor/invite`, `POST /api/investor/accept`, `GET /api/investor/access-log`

### Debt & Deferred
- `POST /api/debt/forecast`
- `GET/POST /api/deferred-accrual/prepaid`, `GET/POST /api/deferred-accrual/accrual`

### Settings
- `GET/PUT /api/settings/`, `GET/PUT /api/settings/ai`
- `GET/PUT /api/settings/api-keys/[provider]`
- `GET/POST /api/settings/peer-companies/*`, `GET/POST /api/settings/market-data/*`
- `GET/POST /api/prompts/*`

### Chat
- `POST /api/chat`, `POST /api/chat/stream` (SSE)

### Valuation
- `POST /api/valuation/qa`

### Import
- `POST /api/import/journals`, `POST /api/import/account-items`, `POST /api/import/monthly-balances`

---

## 5. Database Schema (60+ Prisma Models)

The Prisma schema is at `prisma/schema.prisma` (1846 lines).

### Core Models
`User` (4 roles), `Company`, `Session`, `AuditLog` (blockchain-style chain integrity)

### Journals & Audit
`Journal`, `AuditResult`, `MonthlyBalance`

### Reports & Analysis
`BudgetEntry`, `BudgetCategory`, `KPIDefinition`, `KPIRecord`, `CustomKPI`, `BenchmarkData`

### Accounting Standard Conversion
`AccountingStandard`, `ChartOfAccount`, `ChartOfAccountItem`, `AccountMapping`,
`ConversionProject`, `ConversionResult`, `ConversionExport`, `ConversionRationale`,
`RationaleAuditTrail`, `AdjustingEntry` (10 types), `ApprovalWorkflow`,
`DisclosureDocument`, `StandardReference`

### Tax, Insurance, Assets
`TaxSchedule`, `TaxPayment`, `SocialInsuranceSchedule`, `SocialInsurancePayment`,
`FixedAsset`, `DepreciationSchedule`, `InventoryItem`, `InventoryTransaction`
`PrepaidExpense`, `AccruedExpense`

### Board & IR
`BoardMeeting`, `BoardItem`, `BoardAnalysis`, `IRReport`, `IRReportSection`,
`ShareholderComposition`, `IREvent`, `FAQ`

### DD & Valuation
`DDChecklist`, `DDChecklistItem`, `DDFinding`, `DDReport`, `DDConversion`
`Valuation`, `ValuationDCF`, `ValuationComparable`, `PeerCompany`, `MarketDataProvider`

### Other
`CompanySettings` (OCR engine, AI provider/model/temperature/tokens),
`ReceiptDocument`, `JournalProposal`, `CashFlowForecast`, `DebtSchedule`,
`ExchangeRate`, `CustomPrompt`, `InvestorAccess`, `InvestorAccessLog`, `Secret`

---

## 6. AI Architecture

### Model Registry (30+ models across 13 providers)

| Provider | Default Model | Key Feature |
|----------|--------------|-------------|
| openai | gpt-5.4-nano | Lowest cost |
| claude | claude-sonnet-4-6-20250514 | Highest quality |
| gemini | gemini-2.5-flash-preview-05-20 | Best cost-performance |
| openrouter | openai/gpt-5.4-nano | Multi-model routing |
| deepseek | deepseek-chat | Reasoning |
| kimi | moonshot-v1-8k | Long context (up to 128k) |
| qwen | qwen-turbo | Fast |
| groq | llama-3.3-70b | Fastest inference |
| azure/aws/gcp | (varies) | Cloud-native |
| freee/custom | (varies) | Custom endpoints |

### Config Resolution Priority
1. **Database** - User/company-specific overrides
2. **Environment Variables** - e.g., `OPENAI_MODEL`, `AI_TEMPERATURE`
3. **Hardcoded Defaults** - `src/lib/ai/config/defaults.ts`

### Orchestrator (9 Workflows)
Defined in `src/lib/ai/orchestrator/orchestrator.ts`:
- `comprehensive_analysis` (4 personas in parallel)
- `tax_focused`, `strategic_analysis`, `compliance_review`
- `ratio_focused`, `cashflow_focused`, `budget_analysis`
- `forecast_analysis`, `general_consultation`

Pipeline: Classify Intent -> Select Workflow -> Select Model -> Execute Steps -> Synthesize

### Expert Personas (`src/lib/ai/personas/`)
| Persona | Focus |
|---------|-------|
| CPA (公認会計士) | Financial analysis, compliance audit, JGAAP/IFRS |
| Tax Accountant (税理士) | Tax implications,法人税法/消費税法 |
| CFO | Strategic overview, cash flow, funding |
| Financial Analyst (財務アナリスト) | Ratio analysis, market analysis, valuation |
| Big4 Auditor | Audit risk assessment |

### AI Provider Code Pattern
```typescript
// All AI operations use the Result<T, E> pattern
import { success, failure, type Result } from '@/types/result'

// Provider creation
import { createAIProviderFromEnv } from '@/lib/integrations/ai'
const provider = createAIProviderFromEnv('openai')

// With config service
import { createAIProviderWithConfig } from '@/lib/integrations/ai'
const { provider, config } = await createAIProviderWithConfig('openrouter', {
  userId: 'user123',
  companyId: 'company456'
})
```

---

## 7. Key Code Patterns

### Result Type Pattern (mandatory for all functions)
```typescript
// src/types/result.ts
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// Usage
function analyze(data: string): Result<AnalysisOutput> {
  if (invalid) return failure(new Error('...'))
  return success(result)
}
```

### Options Object Pattern (3+ arguments)
```typescript
interface AnalyzeOptions {
  data: string
  model?: string
  temperature?: number
}
```

### API Route Pattern
```typescript
// src/app/api/[endpoint]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Extract user context from headers (set by middleware)
  const userId = request.headers.get('x-user-id')
  const userRole = request.headers.get('x-user-role')
  const companyId = request.headers.get('x-user-company-id')

  // 2. Validate input with Zod
  const body = await request.json()

  // 3. Call service layer
  const result = await someService({ ...body, companyId })

  // 4. Return result
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result.data)
}
```

### Blockchain Audit Trail
Each `AuditLog` entry is chained via `contentHash + previousHash` (HMAC-SHA256).
Integrity verification: `src/lib/audit/audit-logger.ts`

---

## 8. Scheduled Jobs

Defined in `src/jobs/scheduler.ts` (node-cron, Asia/Tokyo timezone):

| Job | Schedule | Purpose |
|-----|----------|---------|
| journal-sync | Daily 1:00 AM | Sync journals from freee |
| audit-job | Daily 2:00 AM | Run automated audit |
| exchange-rate-fetch | Weekdays 11:00 AM | Fetch BOJ exchange rates |
| weekly-audit | Monday 2:00 AM | Weekly comprehensive audit |
| monthly-audit | 1st of month 2:00 AM | Monthly comprehensive audit |

---

## 9. Security Architecture

### Authentication (`src/lib/auth.ts`)
- JWT tokens with 24h expiry, bcrypt password hashing (12 rounds)
- Session management in database
- Account lockout (5 attempts, 15-min lockout)
- Edge-compatible JWT verification at `src/lib/auth-edge.ts`

### Middleware (`middleware.ts`)
- Public paths: `/login`, `/api/auth/*`, `/api/health`
- All other routes require valid session cookie
- Injects `x-user-id`, `x-user-role`, `x-user-company-id` headers
- i18n locale routing (ja/en always prefixed)

### Encryption (`src/lib/crypto.ts`)
- AES-256-GCM with 16-byte IV
- SHA-256 hashing, secure token generation
- `ENCRYPTION_KEY` env var (64-char hex string)

### Security Modules (`src/lib/security/`)
CSRF protection, input sanitization (Zod), rate limiting, PII detection,
anomaly detection, secure encrypted storage

---

## 10. Internationalization

- **Locales**: `ja` (default), `en`
- **Locale prefix**: always (e.g., `/ja/dashboard`, `/en/dashboard`)
- **Message files**: `messages/ja.json` (443 lines), `messages/en.json`
- **Config**: `src/i18n/routing.ts`, `src/i18n/request.ts`

---

## 11. Development Commands

```bash
# Development
pnpm dev                    # Start dev server
pnpm build                  # Production build
pnpm start                  # Start production server

# Quality Assurance (MUST pass before commit)
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint auto-fix
pnpm typecheck              # TypeScript check
pnpm format:check           # Prettier check

# Testing
pnpm test                   # Run all tests (vitest)
pnpm test:unit              # Unit tests only
pnpm test:integration       # Integration tests only
pnpm test:coverage          # Tests with coverage
pnpm test:watch             # Watch mode
pnpm e2e                    # Playwright E2E tests

# Database
pnpm db:generate            # Generate Prisma client
pnpm db:migrate             # Run migrations
pnpm db:push                # Push schema directly
pnpm db:seed                # Seed data
pnpm db:studio              # Prisma Studio GUI
pnpm db:reset               # Full database reset
```

### Mock Mode (Development without external APIs)
Set in `.env.local`:
```bash
FREEE_MOCK_MODE=true
AI_MOCK_MODE=true
DATABASE_URL="file:./dev.db"
```

### Seed Data Login
- Email: `admin@example.com`
- Password: `admin123`

---

## 12. Documentation Map

### Project-level
| File | Content |
|------|---------|
| `README.md` | Full project README (business overview, setup, features) |
| `PROJECT.md` | Project scope, constraints, success metrics |
| `CLAUDE.md` | This file - AI assistant context |
| `AGENTS.md` | AI agent rules (quality gates, code patterns, commit rules) |
| `BACKLOG.md` | Backlog and technical debt |

### Design & Architecture
| File | Content |
|------|---------|
| `docs/DESIGN.md` | System architecture, security design, non-functional requirements |
| `docs/API_DESIGN.md` | API endpoint specifications |
| `docs/DATABASE_DESIGN.md` | ER diagram, schema definitions |
| `docs/FEATURES.md` | Detailed feature specifications (audit, reports, KPIs, etc.) |
| `docs/DEPLOYMENT.md` | Infrastructure setup and operations |
| `docs/roadmap.md` | Development schedule and milestones |

### Development
| File | Content |
|------|---------|
| `docs/DEVELOPMENT.md` | Development workflow, CI/CD, testing strategy |
| `docs/TEST_STRATEGY.md` | Test methodology |
| `docs/SECURITY.md` | Security guidelines |
| `docs/COMMIT_FAILURE_LESSONS.md` | Lessons learned from commit failures |

### AI Feature
| File | Content |
|------|---------|
| `docs/ai/README.md` | AI architecture overview |
| `docs/ai/TASKS.md` | AI implementation tasks |
| `docs/ai/QUALITY_STANDARDS.md` | 10 quality criteria checklist (61 items) |
| `docs/ai/CONSTRAINTS.md` | LLM constraints, input validation, output format |
| `docs/ai/IMPLEMENTATION_GUIDE.md` | Implementation guide |
| `docs/ai/DEVELOPMENT_LOG.md` | Development log |
| `docs/ai/IMPLEMENTATION_PROMPTS.md` | Implementation prompts |
| `docs/ai/ANALYSIS_API_IMPROVEMENT_PLAN.md` | Analysis API improvement plan |

### Accounting Standard Conversion
| File | Content |
|------|---------|
| `docs/conversion/README.md` | Conversion overview |
| `docs/conversion/ARCHITECTURE.md` | Conversion architecture |
| `docs/conversion/API.md` | Conversion API spec |
| `docs/conversion/TROUBLESHOOTING.md` | Conversion troubleshooting |

### Microservices
| File | Content |
|------|---------|
| `python-service/README.md` | Python service documentation |
| `r-service/README.md` | R service documentation |

---

## 13. Important Rules for AI Assistants

### Quality Gate (MUST pass before completing any task)
```bash
pnpm typecheck              # 0 errors
pnpm lint                   # 0 errors, 0 warnings
pnpm test                   # All tests pass
pnpm build                  # Build succeeds
```

### Code Style
- **No comments** unless explicitly requested
- Follow existing code patterns (Result type, options object, Zod validation)
- Use kebab-case for files, PascalCase for components, camelCase for functions
- Import order: external -> internal components -> utilities -> types

### Commit Message Format
```
<type>(<scope>): <description>

[optional body]
```
Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

### CrystalBall Policy
- `free_only`: Use only free/public APIs
- `audit required`: All API calls must have audit logs
- `uncertain isolated`: Isolate uncertain items with "要確認" flag
- `rate control`: User-Agent header + rate limiting on all external calls

### Must-Read Documents Before Implementation
1. `docs/ai/QUALITY_STANDARDS.md` - 10 quality criteria
2. `docs/ai/CONSTRAINTS.md` - LLM constraints and patterns
3. `docs/ai/TASKS.md` - Task breakdown and dependencies
4. `AGENTS.md` - Full agent rules and quality gate process
