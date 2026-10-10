# Proposal: Onboard AWS SAA-C03 Exam

## Scoping Gate

- **Tool type**: Frontend (existing React + Vite SPA) + Node.js extraction script
- **Audience/maturity**: Personal tool (study aid for AWS SAA exam prep)
- **Scale**: Just the user

## Why This Change

The user has an AWS SAA-C03 practice exam PDF (684 questions) and a separate solution text file with answers and explanations. The existing quiz app already supports multiple exams via a slug-based directory structure (`src/data/exams/<slug>/`). This change adds the SAA-C03 exam as a new entry alongside the existing SAA-C02 exam.

## Source Materials

- **PDF**: `AWS Certified Solutions Architect Associate SAA-C03.pdf` — contains full questions with all answer options (A/B/C/D)
- **Solution file**: `AWS SAA-03 Solution.txt` — contains 684 numbered questions with correct answers and explanations, but typically only includes the correct option's text, not all options

Both sources are needed: the PDF provides the complete option set, the solution file provides answers and explanations.

## Data Quality Assessment

Spot-check of ~50 answers across early, middle, and late sections found answers mostly correct (standard AWS SAA topics: S3 Transfer Acceleration, Athena, PrincipalOrgID, Gateway VPC endpoints, SNS+SQS fanout, Transit Gateway peering, DAX, write-through caching). Known issues:
- Some entries are empty/broken (e.g., Q283 is blank, Q477 just says "IAM")
- Later questions (600+) become more summarized with less detail
- Full verification pass needed to catch any incorrect answers

## Scope

**In scope:**
- Node.js extraction script to parse the PDF (via `pdf-parse` npm package) and cross-reference with the solution file
- Answer verification using AWS SAA-C03 knowledge
- Category assignment by AWS service
- Create `src/data/exams/aws-saa-c03/meta.json` and `questions.json`
- Register the new exam in `src/data/exams/index.js`

**Out of scope:**
- UI changes (the app already handles multiple exams)
- Modifications to existing SAA-C02 data
- Runtime PDF processing
