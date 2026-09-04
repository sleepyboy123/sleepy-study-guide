# Proposal: Sleepy Study Guide - Multi-Exam Platform

## Why This Change

The current app is a single-purpose AWS SAA quiz tool.
The user has other exam dumps they want to practice with in the future.
Rather than duplicating the app per exam, we refactor it into a multi-exam platform called "Sleepy Study Guide" where each exam is a first-class entity with its own data, progress, and ingestor.

## Scoping Gate

| Gate | Answer |
|------|--------|
| **Tool type** | Frontend (SPA, no backend) |
| **Audience/maturity** | Personal tool |
| **Scale** | Just you |

## Scope

### In Scope

- Rebrand from "AWS SAA Quiz" to "Sleepy Study Guide"
- Add react-router-dom for URL-based routing (`/`, `/exam/:slug`, `/exam/:slug/quiz`, `/exam/:slug/review`)
- New exam selection homepage at `/` showing exam cards with progress summaries
- Persistent nav header with "Sleepy Study Guide" home link and breadcrumb on per-exam pages
- Exam registry system: per-exam directories under `src/data/exams/` with `questions.json` + `meta.json`, and a central registry in `src/data/exams/index.js`
- Per-exam localStorage isolation with `sleepy-{slug}-*` key prefix
- One-time migration of existing `aws-saa-quiz-state` / `aws-saa-review-status` to new key format
- Move existing AWS SAA questions to `src/data/exams/aws-saa/questions.json`
- Parameterize `useQuizState` hook to accept `(slug, questions)`
- Dynamic import for exam question data (code splitting per exam)

### Out of Scope

- New ingestors for other exams (user writes these manually per exam)
- Cross-exam analytics or aggregate statistics
- Backend or API
- Dark mode
- Timed exam simulation
- Spaced repetition
