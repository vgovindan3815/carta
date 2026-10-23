# MAVEN / CARTA — Mainframe Analysis & Intelligence

On-demand dependency mapping, business rules extraction, change impact analysis, and modernization planning for COBOL estates — powered by multi-LLM AI grounded in static analysis.

## What it does

- **Dependency Graph** — deterministic call-tree, SQL table deps, CICS transactions, and dynamic call edges from CAST static analysis or LLM-inferred from source
- **Business Rules** — plain-language extraction of what each COBOL program does, grouped into sections with graph-edge citations
- **Change Impact** — blast-radius analysis rating each affected program/data store (Critical / High / Medium / Unknown)
- **Modernization Spec** — 5-section Java / Spring Boot target architecture draft, gated by engineer sign-off

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

### Required environment variables

```env
DATABASE_URL=postgres://...          # Neon or any Postgres instance
NEXTAUTH_SECRET=<random-string>      # NextAuth session signing
MAVEN_USERS=email:password:role,...  # Static user list (role: viewer|editor|admin)

# LLM providers — at least one required
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional
GITHUB_PAT=ghp_...                   # GitHub Personal Access Token for repo browsing
```

### Database setup

```bash
npm run db:push    # Push schema to Neon via drizzle-kit
```

## Architecture

- **Next.js 15** App Router — SSE streaming, API routes, server + client components
- **Neon** (serverless Postgres) + **Drizzle ORM** — stores programs, graphs, artifacts
- **LLM providers** — Groq (Llama 3.3 70B), Anthropic (Claude Sonnet), OpenAI (GPT-4o); configurable at runtime in Settings
- **Structured RAG** — SQL joins inject relevant context into prompts; no vector embeddings at current scale
- **NextAuth.js** — credentials-based auth with role-based access (viewer / editor / admin)

See [`app/architecture/page.tsx`](app/architecture/page.tsx) for the interactive reference diagram, or [`spec/MAVEN-CARTA-SYSTEM-SPEC-v2.2.md`](spec/MAVEN-CARTA-SYSTEM-SPEC-v2.2.md) for the full system specification.

## Guest access

Unauthenticated visitors can browse programs and view existing dependency graphs and artifacts without logging in. AI analysis features (Analyze, Refresh Spec, Agent Chat) require either:
- A signed-in account with LLM settings configured, **or**
- A BYOK (Bring Your Own Key) API key entered in the in-app prompt

## Project structure

```
app/               Next.js App Router pages and API routes
components/        Shared UI components (AppNav, DependencyView, etc.)
lib/               Parser, DB queries, LLM chains, agent runner
hooks/             Client-side React hooks
spec/              System specification documents
cast-reports/      Reference CAST analysis examples
```
