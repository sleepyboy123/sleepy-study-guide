# Proposal: AWS SAA Exam Quiz Application

## Scoping Gate

- **Tool type**: Frontend (React + Vite SPA)
- **Audience/maturity**: Personal tool (study aid for AWS SAA exam prep)
- **Scale**: Just the user

## Why This Change

The user has 3 ExamTopics PDF dumps containing 574 AWS Solutions Architect Associate (SAA-C02) practice questions.
These PDFs have serious data quality issues:

- ~48% of listed "Correct Answer" values disagree with community consensus
- ~22% of questions have no community vote data at all
- ~5-10% of questions in PDF1 have mismatched question text and answer options
- Community members have posted corrections for ~15 mismatched questions

The user needs a clean, verified question bank presented as an interactive quiz with immediate feedback, progress tracking, and a review queue for flagged/uncertain answers.

## Scope

**In scope:**
- Node.js extraction script to parse PDFs into structured JSON via `pdftotext`
- Manual answer verification using AWS knowledge + community consensus signals
- React + Vite frontend-only quiz app
- One-question-at-a-time flow with immediate correct/incorrect feedback and explanations
- localStorage-backed progress and score persistence
- Review queue for questions flagged as `needs-review` or `communityCorrection`
- Category-based filtering (by AWS service)
- Keyboard shortcuts for fast studying

**Out of scope:**
- Exam simulation / timed mode
- Backend, user accounts, cross-device sync
- Spaced repetition algorithm
- Runtime PDF processing
- Answer correction UI (edit JSON directly)
- Dark mode, animations beyond feedback reveal

## Data Quality Strategy

Answer verification priority (highest confidence first):
1. Community vote with 90%+ agreement + consistent with AWS knowledge: high confidence
2. Community vote with 70-89% + verified: medium confidence
3. Community vote with 50-69% or split: needs independent verification, flag as needs-review
4. No community vote: verify independently, flag as needs-review if uncertain
5. All answers cross-checked against AWS SAA domain knowledge regardless of community signal

For mismatched questions: use community-corrected question text where available (15 known corrections in PDF1).
All community-corrected questions flagged with `communityCorrection: true` for user review.

## User Decisions Made

- Embed question JSON in the app bundle (no separate fetch)
- Use community corrections for mismatched questions (with review flag)
- React + Vite stack with shadcn/ui components and Tailwind CSS
- One-at-a-time immediate feedback mode
- Flag uncertain answers as "needs review" rather than skipping or guessing
