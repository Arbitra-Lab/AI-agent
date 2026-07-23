# Arbitra AI Agent

An intelligent AI agent powering the Arbitra on-chain arbitration and escrow protocol.

The Arbitra AI Agent enables parties in two-sided agreements to automate escrow coordination, dispute resolution, contract analysis, and settlement workflows through natural language interactions.

Built for the Arbitra platform and designed to integrate with the Stellar blockchain and Soroban smart contracts, the agent combines conversational AI, arbitration intelligence, contract automation, and blockchain integration into a single assistant that works across verticals — rentals, freelance agreements, trade finance, insurance claims, and more.

---

## Features

### Escrow & Agreement Coordination

- Initiate and track escrow arrangements for any two-party agreement
- Coordinate multi-party deposits (security deposits, milestone payments, trade escrows)
- Guide through conditional release workflows
- Verify transaction status on-chain
- Support platform and referral fee splits
- Facilitate multi-currency settlements via Stellar DEX
- Automate recurring payment obligations

### Dispute Resolution Assistant

- Guide arbiters through case review
- Summarize dispute evidence and claims
- Suggest fair rulings based on precedent and similar cases
- Track arbitration timelines and appeals
- Automate case documentation
- Handle timeout-based auto-resolutions
- Support weighted voting for arbiter panels

### Contract Intelligence

- Analyze agreement terms and conditions
- Identify potential dispute triggers
- Suggest fair milestone criteria
- Generate compliance-friendly agreement templates
- Extract key obligations from natural language agreements
- Recommend arbitration clauses

### Agreement Discovery (Rental Reference Implementation)

- Search available rental properties
- Filter by location, budget, amenities, and property type
- Recommend listings based on user preferences
- AI-assisted property description generation
- Pricing suggestions based on market data
- Track rental applications and agreements

### Blockchain Integration

- Initiate Stellar payment requests via escrow contracts
- Verify transactions on-chain in real-time
- Monitor escrow release conditions
- Support trustless 2-of-3 multi-sig workflows
- Enable multi-currency settlement through Stellar DEX
- Interact with Soroban smart contracts (escrow, dispute_resolution, payment, etc.)
- Coordinate with Stellar anchors for fiat on/off-ramps

---

## Architecture

```text
User
 │
 ▼
AI Agent Interface
 │
 ├── Conversation Engine
 ├── Context Manager
 ├── Memory Layer
 ├── Tool Calling Layer
 │
 ▼
Agent Services
 │
 ├── Escrow Coordinator
 ├── Dispute Resolution Assistant
 ├── Contract Intelligence Engine
 ├── Agreement Discovery (Rental Reference)
 ├── Pricing Engine
 ├── Party Matching & Recommendations
 │
 ▼
Arbitra Backend API
 │
 ├── Agreement Registry & Indexer
 ├── User Profiles & Verification
 ├── Compliance & Moderation
 ├── Notifications & Messaging
 ├── Case Management
 │
 ▼
Stellar Network + Soroban Contracts
 │
 ├── escrow (generic 2-of-3 multi-sig)
 ├── dispute_resolution (case-agnostic arbitration)
 ├── payment, agent_registry, rent_obligation
 ├── Asset Management & DEX
 ├── Anchor Integration
```

---

## Capabilities

### Natural Language Queries

Examples:

```text
Create an escrow for a $5000 freelance milestone payment.

Show me the status of my escrow agreement on-chain.

I need to file a dispute for a failed delivery.

Help me understand this arbitration case.

What rent price should I charge for this 3BR house?

Find me a 2-bedroom apartment under $800/month.

How do I release funds from this escrow?

What's the current ruling in my dispute case?

Generate an agreement template for a freelance contract.

How do I split agent commissions through Arbitra?

What are the release conditions for this escrow?

Show me similar arbitration precedents for this case.
```

### AI-Powered Recommendations

- Escrow term suggestions
- Dispute resolution strategies
- Fair settlement amounts
- Agreement structure optimization
- Risk assessment for contract terms
- Rental pricing suggestions (reference implementation)
- Party matching and reputation scoring

### Automation

- Escrow initiation and monitoring
- Payment condition tracking
- Dispute case filing
- Evidence collection and summarization
- Automated notifications
- Recurring payment obligations
- Multi-party settlement coordination

---

## Tech Stack

### AI

- OpenAI
- Anthropic
- LangChain
- Model Context Protocol (MCP)

### Backend

- Node.js
- TypeScript
- Express

### Database

- PostgreSQL
- Redis

### Blockchain

- Stellar SDK
- Horizon API
- Soroban Smart Contracts

---

## Requirements

- Node.js **>= 20**
- npm

## Installation

```bash
git clone https://github.com/Arbitra-Lab/AI-agent.git

cd AI-agent

npm install
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values you need:

```bash
cp .env.example .env
```

```env
PORT=3000

OPENAI_API_KEY=

DATABASE_URL=

REDIS_URL=

STELLAR_NETWORK=testnet

STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

STELLAR_SECRET_KEY=
```

---

## Project Structure

```
src/
  index.ts       # entrypoint (Express app)
  config/        # env + app config
  api/           # express routes, controllers, middleware
  agent/         # conversation engine, context, memory, tools
  services/      # escrow, dispute, contract intelligence, pricing
  blockchain/     # stellar + soroban clients
  db/            # schema, migrations, repositories
  lib/           # shared utils (logger, errors)
  types/         # shared types
tests/
```

This project uses ESM (`"type": "module"`) with the `@/*` path alias
mapped to `src/*` (e.g. `import { logger } from '@/lib/logger.js'`).

## Running Locally

```bash
npm run dev      # tsx watch — restarts on file changes
```

## Building & Running in Production

```bash
npm run build    # compiles TypeScript to dist/ and resolves path aliases
npm start         # runs the compiled server from dist/index.js
```

## Testing & Linting

```bash
npm test           # runs the test suite (node's built-in test runner)
npm run lint       # eslint
npm run lint:fix    # eslint --fix
npm run format      # prettier --write
npm run format:check # prettier --check
```

A pre-commit hook (Husky + lint-staged) runs lint/format automatically
on staged files.

---

## API Endpoints

### Chat

```http
POST /api/chat
```

Request:

```json
{
  "message": "Create an escrow for a $3000 security deposit"
}
```

### Escrow Management

```http
POST /api/escrow
GET /api/escrow/:id
POST /api/escrow/:id/release
```

### Dispute Resolution

```http
POST /api/disputes
GET /api/disputes/:id
POST /api/disputes/:id/evidence
```

### Agreement Recommendations

```http
POST /api/recommendations
```

### Contract Analysis

```http
POST /api/contracts/analyze
```

---

## Roadmap

### Phase 1

- Conversational assistant
- Escrow coordination
- Basic dispute filing
- Rental marketplace (reference implementation)

### Phase 2

- Contract intelligence and analysis
- Advanced dispute resolution workflows
- Multi-party settlement automation
- Arbiter reputation system

### Phase 3

- Autonomous escrow and payment coordination
- Cross-contract agreement templates
- On-chain transaction automation
- Appeal handling and precedent matching

### Phase 4

- Multi-agent architecture for specialized verticals
- Cross-border settlement optimization
- Anchor integration for fiat on/off-ramps
- Protocol-level analytics and insights

---

## Open Source

Arbitra AI Agent is fully open source.

Contributions are welcome from:

- AI Engineers
- Blockchain Developers
- Stellar Ecosystem Contributors
- Smart Contract Auditors
- Product Designers
- Legal and Compliance Researchers

---

## License

MIT License

---

## Arbitra

Building open trust infrastructure for two-party agreements using AI and Stellar.

**Generic escrow. Case-agnostic arbitration. Built for any vertical.**
