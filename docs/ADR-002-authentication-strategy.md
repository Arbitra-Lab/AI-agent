# ADR-002: Authentication Strategy

**Date:** 2026-07-23
**Status:** Accepted
**Deciders:** Arbitra Engineering

---

## Context

Issue #29 requires every API endpoint to authenticate its caller, authorize
by relationship (party to an agreement, assigned arbiter to a dispute — not
role), and rate-limit abuse. Every `/api/chat` call also spends real money
at an LLM provider, so an open endpoint is a financial drain, not just a
security gap.

## Decision

**Phase 1 ships conventional JWT sessions** (short-lived access token +
rotating refresh token). **SEP-10 wallet-signature auth is the intended
long-term issuance path** and is explicitly out of scope here.

The seam for that follow-up: `AuthService.issueTokenPair(user)` is the only
place that mints a first token pair. A SEP-10 challenge/response handler
just needs to resolve a verified Stellar address to an `AuthenticatedUser`
and call that method — nothing else in `authMiddleware`, `authorize`, or
the rate limiter needs to change. This repo does not yet have a
password/credential store, so no login route is included in this PR; until
SEP-10 lands, issuing the first token pair for a user is a caller
responsibility (e.g. an internal script, or whatever interim flow product
decides on).

## Authorization model

Relationship predicates (`isPartyTo`, `isAssignedArbiter`) live in
`src/auth/authorize.ts` behind an `AuthorizationRepository` interface,
Drizzle-backed in `db/adapters/authorizationRepository.ts`. Both Express
routes (`requireParty` / `requireArbiter` middleware) and agent tools
(`assertPartyTo` / `assertAssignedArbiter`) call the same predicate
functions — there is one implementation, not two.

**Known gap:** the schema has no dedicated "arbiter assigned to dispute"
table — only `dispute_votes` (cast, or pending with `vote = null`) and
`disputes.ruled_by`. `isArbiterAssignedToDispute` treats a `dispute_votes`
row as the assignment signal. That's the best fit available without
inventing a new panel-assignment table, which is a real design decision
(how arbiters get selected onto a case) that belongs to whichever issue
builds dispute-resolution routes, not this one.

## Rate limiting

Redis-backed, fixed-window via a single Lua script (INCR + conditional
PEXPIRE + PTTL) so a crash mid-request can't leave a counter incremented
without an expiry. Keyed by `req.user.id` when authenticated, else IP.
Three presets (`chat`, `read`, `mutate`) tuned differently per acceptance
criteria. On a Redis error the limiter fails **closed** — it returns 503,
not an unlimited pass-through.

## Consequences

- `db/client.ts`, `db/schema/arbiters.ts`, and the `disputes` /
  `dispute_evidence` / `dispute_votes` tables were previously unimplemented
  (empty schema file, empty client) despite being referenced by
  `db/seeds/index.ts` and documented in `docs/ERD.md`. They were filled in
  here, matching the ERD exactly, because `isAssignedArbiter` has no real
  data to check against otherwise.
- `src/**` cannot import from `db/**` — `tsconfig.json` scopes the `tsc`
  build to `src/**` only. The Drizzle-backed wiring (`AuthService` +
  concrete repositories) therefore lives in `server.ts` at the repo root,
  run via `tsx` like the other `db/*` scripts, not compiled by `npm run
build`. `src/app.ts` takes `AuthService` as a parameter instead of
  constructing it.
