# ADR-001: Database Migration Tool Selection

**Date:** 2026-07-16
**Status:** Accepted
**Deciders:** Arbitra Engineering

---

## Context

The Arbitra AI Agent requires a PostgreSQL schema with multiple interrelated tables
(users, agreements, escrows, disputes, conversations, listings). A migration tool is
needed to version-control schema changes and enable reproducible deployments.

## Decision

**Adopt Drizzle ORM + Drizzle Kit** for schema definition and migration management.

## Options Considered

### Option A: Drizzle Kit ✅ (chosen)

| Criterion | Assessment |
|-----------|-----------|
| TypeScript-native | ✅ Schema defined in `.ts` files — type-safe at compile time |
| Migration generation | ✅ `drizzle-kit generate` produces SQL migration files |
| Migration execution | ✅ `drizzle-orm/migrator` applies migrations programmatically |
| Rollback support | ⚠️ No automatic down-migrations; rollback via journal deletion + manual SQL |
| Studio UI | ✅ `drizzle-kit studio` for local inspection |
| Bundle size | ✅ Lightweight — no runtime ORM overhead if raw SQL preferred |
| Ecosystem fit | ✅ Works well with Node.js + TypeScript + `pg` driver |

### Option B: node-pg-migrate

| Criterion | Assessment |
|-----------|-----------|
| TypeScript-native | ⚠️ JS-first; TS support requires extra config |
| Migration generation | ❌ Manual — no auto-generation from schema |
| Up/down migrations | ✅ Explicit up/down functions per migration file |
| Maturity | ✅ Battle-tested, widely used |
| Type safety | ❌ No schema-to-type inference |

### Option C: Prisma Migrate

| Criterion | Assessment |
|-----------|-----------|
| TypeScript-native | ✅ |
| Migration generation | ✅ `prisma migrate dev` |
| Type safety | ✅ Full type inference |
| Bundle size | ❌ Large runtime; Prisma Client adds ~20MB |
| Raw SQL flexibility | ⚠️ Limited compared to Drizzle |
| Drizzle compatibility | ❌ Would require migrating away from drizzle-orm |

## Rationale

Drizzle Kit was chosen because:

1. **Type safety end-to-end** — schema definitions in TypeScript are the single source
   of truth for both migrations and runtime query types.
2. **Lightweight** — no heavy runtime client; raw `pg` driver used directly.
3. **Auto-generation** — `drizzle-kit generate` diffs the schema and produces SQL,
   eliminating manual migration authoring errors.
4. **CI compatibility** — `db:migrate` script runs programmatically against a clean
   PostgreSQL instance in CI.

## Trade-offs Accepted

- No built-in down-migrations. Rollback requires manually writing compensating SQL
  and removing the journal entry. This is acceptable for the current phase.
- Drizzle Kit is newer than Prisma Migrate. Community resources are smaller but growing.

## Consequences

- All schema changes MUST go through `drizzle-kit generate` → commit the generated SQL.
- Down-migration SQL should be manually authored and stored in `db/migrations/down/`
  for any destructive change.
- CI pipeline must run `npm run db:migrate` against a clean Postgres instance.