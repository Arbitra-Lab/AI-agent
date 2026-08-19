# Contributing to Arbitra AI Agent

Thanks for your interest in contributing. This project is open source and welcomes contributions from AI engineers, blockchain developers, Stellar ecosystem contributors, smart contract auditors, product designers, and legal & compliance researchers.

## Table of Contents

- [Getting Started](#getting-started)
- [Branch Naming](#branch-naming)
- [Commit Conventions](#commit-conventions)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Testing Expectations](#testing-expectations)
- [Code Style](#code-style)
- [Issue Tracking](#issue-tracking)
- [Questions & Support](#questions--support)

## Getting Started

1. Fork the repository
2. Clone your fork:

```bash
git clone https://github.com/your-username/AI-agent.git
cd AI-agent
```

3. Install dependencies:

```bash
npm install
```

4. Copy the environment file and fill in required values:

```bash
cp .env.example .env
```

Required environment variables:

| Variable             | Description                                  |
| -------------------- | -------------------------------------------- |
| `OPENAI_API_KEY`     | OpenAI API key for AI features               |
| `DATABASE_URL`       | PostgreSQL connection string                 |
| `REDIS_URL`          | Redis connection string                      |
| `STELLAR_SECRET_KEY` | Stellar secret key for blockchain operations |

5. Start the development server:

```bash
npm run dev
```

## Branch Naming

Use descriptive branch names that follow this pattern:

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `docs/short-description` — documentation changes
- `perf/short-description` — performance improvements
- `chore/short-description` — tooling, CI, maintenance
- `refactor/short-description` — code restructuring

Examples: `feat/multi-currency-settlement`, `fix/escrow-timelock-race`, `docs/api-endpoints`

## Commit Conventions

We use conventional commit messages for clarity and automated changelog generation:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `perf`, `refactor`, `chore`, `test`, `style`, `ci`, `security`

Scope examples: `agent`, `api`, `blockchain`, `data`, `infra`, `ai`, `docs`

Examples:

```
feat(agent): add escrow release confirmation flow
fix(blockchain): handle Stellar timeout on transaction status check
docs(api): document chat and escrow endpoints
chore(infra): add docker-compose for local development
```

## Development Workflow

1. Create a branch from `main` following the naming convention above
2. Make your changes with clear commit messages
3. Write or update tests for your changes
4. Run the test suite locally before pushing
5. Push your branch and open a pull request

## Pull Request Process

1. Open a PR against the `main` branch
2. Use the PR template — fill in all relevant sections
3. Ensure all CI checks pass
4. At least one approval is required before merging
5. Squash-merge commits into a clean history

Your PR should:

- Reference the issue it closes (e.g., `Closes #10`)
- Describe what was changed and why
- Include test coverage for new functionality
- Document any API or configuration changes
- Not introduce new console errors, warnings, or lint issues

## Testing Expectations

- **Unit tests**: Required for all new features and bug fixes
- **Integration tests**: Required for API and blockchain interactions
- **Coverage**: Aim to maintain or improve overall coverage
- **Test command**: `npm test`
- **Lint check**: `npm run lint`

Tests must pass before a PR is merged. If you're adding Stellar/Soroban-related code, include tests that run against testnet where possible.

## Code Style

- **TypeScript** throughout the backend
- ESLint + Prettier for consistent formatting
- Use async/await over raw promises
- Prefer explicit types over `any`
- Document public APIs with JSDoc comments
- Keep functions focused and under 50 lines where reasonable

## Issue Tracking

We use GitHub issues with the following label categories:

- **area:core** / **area:ai** / **area:api** / **area:data** / **area:blockchain** / **area:infra** — which part of the system
- **phase:0** through **phase:4** — roadmap phase alignment
- **priority:low** / **priority:medium** / **priority:high** — urgency
- **effort:small** / **effort:medium** / **effort:large** — estimated work size
- **bug** / **enhancement** / **documentation** / **performance** — issue type

## Questions & Support

- Open a [Discussion](https://github.com/Arbitra-Lab/AI-agent/discussions) for questions
- Check the [README](README.md) for architecture and feature overview
- Report security vulnerabilities to **security@arbitra.dev** — do not file a public issue
