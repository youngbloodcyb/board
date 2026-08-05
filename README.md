# Oat

A canvas for ideas. Drop links, text, images, and PDFs onto an infinite board, arrange them freely, and search across everything semantically.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Better Auth** (email/password, Drizzle adapter)
- **Drizzle ORM** + **PostgreSQL** (pgvector for embeddings)
- **Vercel Blob** (private object storage for images and PDFs)
- **Vercel Workflows** (async embedding pipeline)
- **React Flow** + **Zustand** (canvas + interaction cache)

## Getting started

```bash
bun install
bun run db:generate   # generate Drizzle migration
bun run db:migrate    # apply to Postgres
bun run dev
```

You'll need these environment variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Auth session signing secret |
| `SITE_URL` | App base URL |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob access token |
| `AI_GATEWAY_API_KEY` | Local AI Gateway authentication for Gemini Embedding 2 (deployments can use Vercel OIDC) |

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start dev server |
| `bun run build` | Production build |
| `bun run test` | Run Vitest suite |
| `bun run lint` | Biome check |
| `bun run db:generate` | Generate Drizzle migration |
| `bun run db:migrate` | Apply migrations to Postgres |
| `bun run db:studio` | Open Drizzle Studio |
