# Arbitra Database ERD

```mermaid
erDiagram
    users {
        uuid id PK
        varchar stellar_address UK
        varchar email UK
        varchar display_name
        verification_status verification_status
        numeric reputation_score
        boolean is_active
        text metadata
        timestamptz created_at
        timestamptz updated_at
    }

    agreements {
        uuid id PK
        varchar vertical
        uuid party_a FK
        uuid party_b FK
        agreement_state state
        jsonb terms
        varchar contract_id
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    escrows {
        uuid id PK
        uuid agreement_id FK
        uuid depositor FK
        uuid beneficiary FK
        numeric amount
        varchar asset_code
        varchar asset_issuer
        escrow_state state
        varchar contract_id
        text release_conditions
        timestamptz expires_at
        timestamptz released_at
        timestamptz created_at
        timestamptz updated_at
    }

    disputes {
        uuid id PK
        uuid agreement_id FK
        uuid escrow_id FK
        uuid claimant FK
        uuid respondent FK
        dispute_state state
        text claim_summary
        text ruling
        uuid ruled_by FK
        timestamptz ruled_at
        timestamptz deadline_at
        timestamptz created_at
        timestamptz updated_at
    }

    dispute_evidence {
        uuid id PK
        uuid dispute_id FK
        uuid submitter FK
        varchar content_ref
        varchar content_hash
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    arbiters {
        uuid id PK
        uuid user_id FK UK
        varchar specialisations
        integer weight
        varchar is_active
        timestamptz created_at
        timestamptz updated_at
    }

    dispute_votes {
        uuid id PK
        uuid dispute_id FK
        uuid arbiter_id FK
        dispute_vote vote
        integer weight
        text rationale
        timestamptz created_at
        timestamptz updated_at
    }

    conversations {
        uuid id PK
        uuid user_id FK
        uuid context_id
        varchar context_type
        varchar title
        timestamptz created_at
        timestamptz updated_at
    }

    messages {
        uuid id PK
        uuid conversation_id FK
        message_role role
        text content
        varchar tool_name
        varchar tokens_used
        timestamptz created_at
        timestamptz updated_at
    }

    listings {
        uuid id PK
        uuid owner_id FK
        varchar title
        text description
        varchar location
        numeric rent_amount
        varchar asset_code
        varchar asset_issuer
        listing_status status
        text amenities
        varchar bedroom_count
        boolean is_available
        timestamptz created_at
        timestamptz updated_at
    }

    users ||--o{ agreements : "party_a / party_b"
    users ||--o{ escrows : "depositor / beneficiary"
    users ||--o{ disputes : "claimant / respondent"
    users ||--o| arbiters : "user_id"
    users ||--o{ dispute_evidence : "submitter"
    users ||--o{ conversations : "user_id"
    users ||--o{ listings : "owner_id"

    agreements ||--o{ escrows : "agreement_id"
    agreements ||--o{ disputes : "agreement_id"

    escrows ||--o{ disputes : "escrow_id"

    disputes ||--o{ dispute_evidence : "dispute_id"
    disputes ||--o{ dispute_votes : "dispute_id"

    arbiters ||--o{ dispute_votes : "arbiter_id"

    conversations ||--o{ messages : "conversation_id"
```

## Table Descriptions

| Table              | Purpose                                                                     |
| ------------------ | --------------------------------------------------------------------------- |
| `users`            | Identity, verification status, Stellar address, reputation                  |
| `agreements`       | Generic two-party agreement with `vertical` discriminator and JSONB `terms` |
| `escrows`          | On-chain escrow with NUMERIC money, asset code/issuer, state machine        |
| `disputes`         | Case-agnostic arbitration with timeline and ruling                          |
| `dispute_evidence` | Tamper-evident evidence with content hash                                   |
| `arbiters`         | Verified arbiters with weighted voting                                      |
| `dispute_votes`    | Arbiter votes with weight snapshot                                          |
| `conversations`    | Agent chat sessions with optional context linkage                           |
| `messages`         | Individual chat messages with role and tool support                         |
| `listings`         | **Rental reference implementation** — isolated from core tables             |

## Design Principles

- **Money**: Always `NUMERIC`, never `FLOAT`. Asset code + issuer stored alongside amount.
- **State machines**: Enforced via `pgEnum` CHECK constraints at DB level.
- **Vertical-agnostic**: Core tables contain no rental-specific columns. Rental data lives in `listings` and in `agreements.terms` (JSONB).
- **Indexes**: All FK columns and high-cardinality lookup columns are indexed.
- **Timestamps**: `created_at` and `updated_at` on every table.
