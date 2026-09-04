# Sleepy Study Guide

A multi-exam study platform for practicing certification exam questions, built as a local-first SPA with per-exam progress tracking.

## Getting Started

Prerequisites: Node.js 18+

```bash
npm install
npm run dev
```

Open http://localhost:5173/ to see the exam selection homepage.

## Project Structure

```
sleepy-study-guide/
  index.html                    # Vite entry HTML with CSP and font loading
  vite.config.js                # Vite config with React, Tailwind, and @ path alias
  scripts/
    extract-questions.js        # PDF-to-JSON extraction (requires pdftotext CLI)
    enrich-questions.js         # Assigns categories and cleans up raw extraction output
  src/
    main.jsx                    # React entry point, BrowserRouter, legacy localStorage migration
    index.css                   # Tailwind imports and dyslexia-friendly base styles
    lib/
      utils.js                  # cn() helper (clsx + tailwind-merge)
    hooks/
      useQuizState.js           # Core state hook: localStorage persistence, filtering, shuffling
    data/
      questions-raw.json        # Intermediate extraction artifact (not used at runtime)
      exams/
        index.js                # Exam registry: slug, metadata, dynamic question loader
        aws-saa/
          meta.json             # Exam metadata (name, provider, code, questionCount, color)
          questions.json        # 571 verified questions with explanations
    components/
      App.jsx                   # Route definitions
      ExamPicker.jsx            # Homepage: exam cards with progress summaries
      ExamLayout.jsx            # Per-exam wrapper: loads questions, provides context to children
      NavHeader.jsx             # Persistent header with home link and breadcrumb
      Dashboard.jsx             # Stats, filters, category breakdown, reset
      Quiz.jsx                  # Question-by-question flow with keyboard shortcuts
      ReviewQueue.jsx           # Flagged/low-confidence question review
      QuestionCard.jsx          # Single question display with option selection
      Feedback.jsx              # Correct/incorrect feedback with explanation
      QuizProgress.jsx          # Progress bar and score display
      ui/                       # shadcn/ui primitives (alert-dialog, badge, button, card, etc.)
```

## How It Works

### Routing

The app uses react-router-dom with this route structure:

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | ExamPicker | Exam selection homepage with progress cards |
| `/exam/:slug` | ExamLayout > Dashboard | Per-exam stats, filters, category breakdown |
| `/exam/:slug/quiz` | ExamLayout > Quiz | Question-by-question quiz flow |
| `/exam/:slug/review` | ExamLayout > ReviewQueue | Flagged question review |

ExamLayout is a nested layout route.
It reads the `:slug` param, looks up the exam in the registry, dynamically imports the question data (code splitting), and passes everything to child routes via React Router's Outlet context.

### Data Flow

1. **Exam registry** (`src/data/exams/index.js`) maps each exam slug to its metadata and a lazy question loader.
2. **ExamLayout** reads the slug from the URL, calls `findExam(slug)`, and loads questions via `exam.loadQuestions()` (a dynamic import).
3. **ExamContent** (inner component of ExamLayout) instantiates `useQuizState(slug, questions)` and passes the state to child routes via `useOutletContext`.
4. **Child components** (Dashboard, Quiz, ReviewQueue) consume the context - they never import question data or state hooks directly.

### State Management

All quiz state lives in `useQuizState(slug, questions)`, which persists to localStorage under `sleepy-{slug}-quiz-state`.

State shape:
- `answers` - map of question ID to `{ selected, correct, answeredAt }`
- `currentQuestionIndex` - position in the filtered question list
- `shuffleOrder` - Fisher-Yates shuffled index array, persisted so refreshing keeps the same order
- `settings` - shuffle toggle, unanswered-only filter, category filter, confidence filter

Review status is stored separately under `sleepy-{slug}-review-status`.

Each exam's progress is fully isolated.
Resetting one exam does not affect others.

### Filtering

Dashboard exposes four filters that compose in sequence:
1. Category (e.g., S3, IAM, VPC)
2. Confidence level (high, medium, needs-review)
3. Unanswered only
4. Shuffle on/off

Changing any filter resets to question index 0.

### Keyboard Shortcuts (Quiz View)

| Key | Action |
|-----|--------|
| 1-5 | Select option A-E |
| Enter | Submit answer |
| Arrow Right / N | Next question |
| Arrow Left / P | Previous question |
| Escape | Back to dashboard |

### Accessibility

The app uses Atkinson Hyperlegible (loaded from Google Fonts) for dyslexia-friendly readability, with 18px base font size, 1.8 line height, 0.02em letter spacing, and a 70ch max line width.
Background is a warm off-white (#faf8f3).

## Adding a New Exam

Each exam needs a question JSON file, a metadata file, and one line in the registry.

### 1. Prepare questions

Write an extraction/ingestor script for your exam source (PDF, CSV, etc.) and output a JSON array matching this shape:

```json
{
  "id": 1,
  "question": "Question text...",
  "options": [
    { "key": "A", "text": "Option A text" },
    { "key": "B", "text": "Option B text" }
  ],
  "correctAnswer": ["B"],
  "explanation": "Why B is correct...",
  "isMultiSelect": false,
  "confidence": "high",
  "category": "Topic Name",
  "communityCorrection": false
}
```

`correctAnswer` is always an array (single-select has one element, multi-select has multiple).
`confidence` is one of `"high"`, `"medium"`, or `"needs-review"`.

### 2. Create exam directory

```bash
mkdir -p src/data/exams/<slug>
```

Place `questions.json` there.
Create `meta.json`:

```json
{
  "name": "Exam Display Name",
  "provider": "Provider",
  "code": "EXAM-CODE",
  "questionCount": 100,
  "color": "#3b82f6"
}
```

`color` is used for the provider badge on the homepage.

### 3. Register the exam

Add an entry to `src/data/exams/index.js`:

```js
import newMeta from './<slug>/meta.json'

export const exams = [
  // ... existing exams
  {
    slug: '<slug>',
    meta: newMeta,
    loadQuestions: () => import('./<slug>/questions.json'),
  },
]
```

The exam will appear on the homepage on next page load.

## Existing Ingestor Scripts

The `scripts/` directory contains the extraction pipeline for the AWS SAA exam:

- **`extract-questions.js`** (`npm run extract`) - parses ExamTopics PDF dumps via `pdftotext` (must be installed), extracts questions, options, answers, and community vote data, outputs to `src/data/questions-raw.json`
- **`enrich-questions.js`** (`node scripts/enrich-questions.js`) - assigns AWS service categories via regex patterns, skips broken questions, preserves hand-written explanations, outputs the final `questions.json`

These scripts are specific to the AWS SAA ExamTopics format.
Other exams will need their own ingestor scripts.

## Tech Stack

- **React 19** with JSX (no TypeScript)
- **Vite 8** for build and dev server
- **react-router-dom 7** for URL-based routing
- **Tailwind CSS 4** via @tailwindcss/vite plugin
- **shadcn/ui** (new-york style) for UI primitives (Radix UI under the hood)
- **Atkinson Hyperlegible** font via Google Fonts

No backend, no API, no database.
All data is bundled at build time and state persists in localStorage.

## Testing

There is no test framework.
Verification is manual: run the dev server, exercise the quiz flow, check localStorage, and confirm the build passes.

```bash
npm run build    # verify production build succeeds
npm run dev      # run locally and test in browser
```
