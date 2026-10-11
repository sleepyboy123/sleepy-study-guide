# Sleepy Study Guide

An installable PWA for practicing certification exam questions, built as a local-first SPA with per-exam progress tracking and offline support.

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
  vite.config.js                # Vite config with React, Tailwind, PWA, and @ path alias
  scripts/
    extract-questions.js        # PDF-to-JSON extraction for SAA-C02 (requires pdftotext CLI)
    enrich-questions.js         # Assigns categories and cleans up raw extraction output
    extract-saa-c03.js          # PDF-to-JSON extraction for SAA-C03 (requires pdf-parse)
    extract-images.py           # Extracts question screenshots from PDF (requires PyMuPDF)
  public/
    pwa-192x192.png             # PWA icon (192x192)
    pwa-512x512.png             # PWA icon (512x512)
    images/
      aws-saa-c03/              # Extracted question screenshots (q96.png, q253_1.png, etc.)
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
          meta.json             # Exam metadata (SAA-C02)
          questions.json        # 571 questions with explanations
        aws-saa-c03/
          meta.json             # Exam metadata (SAA-C03)
          questions.json        # 683 questions with explanations and image references
    components/
      App.jsx                   # Route definitions
      ExamPicker.jsx            # Homepage: exam cards with progress summaries
      ExamLayout.jsx            # Per-exam wrapper: loads questions, provides context to children
      NavHeader.jsx             # Persistent header with home link and breadcrumb
      Dashboard.jsx             # Stats, filters, category breakdown, reset
      Quiz.jsx                  # Question-by-question flow with keyboard shortcuts
      QuestionCard.jsx          # Single question display with option selection and screenshots
      Feedback.jsx              # Correct/incorrect feedback with explanation
      QuizProgress.jsx          # Progress bar and score display
      ReloadPrompt.jsx          # PWA update notification banner
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
| `*` | Redirect to `/` | Catch-all for unknown routes |

ExamLayout is a nested layout route.
It reads the `:slug` param, looks up the exam in the registry, dynamically imports the question data (code splitting), and passes everything to child routes via React Router's Outlet context.

### Data Flow

1. **Exam registry** (`src/data/exams/index.js`) maps each exam slug to its metadata and a lazy question loader.
2. **ExamLayout** reads the slug from the URL, calls `findExam(slug)`, and loads questions via `exam.loadQuestions()` (a dynamic import).
3. **ExamContent** (inner component of ExamLayout) instantiates `useQuizState(slug, questions)` and passes the state to child routes via `useOutletContext`.
4. **Child components** (Dashboard, Quiz) consume the context - they never import question data or state hooks directly.

### State Management

All quiz state lives in `useQuizState(slug, questions)`, which persists to localStorage under `sleepy-{slug}-quiz-state`.

State shape:
- `answers` - map of question ID to `{ selected, correct, answeredAt }`
- `currentQuestionIndex` - position in the filtered question list
- `shuffleOrder` - Fisher-Yates shuffled index array, persisted so refreshing keeps the same order
- `settings` - shuffle toggle, unanswered-only filter, category filter

Each exam's progress is fully isolated.
Resetting one exam does not affect others.

### Filtering

Dashboard exposes three filters that compose in sequence:
1. Category (e.g., S3, IAM, VPC)
2. Unanswered only
3. Shuffle on/off

Changing any filter resets to question index 0.

### Question Screenshots

Some questions (particularly in SAA-C03) include diagrams or screenshots as part of the question.
When a question has an `images` array in its JSON data, `QuestionCard` renders the images below the question text and above the answer options.

Screenshots are stored as static assets in `public/images/aws-saa-c03/` and referenced by path in the question data (e.g., `"/images/aws-saa-c03/q96.png"`).

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

### PWA / Offline Support

The app is a Progressive Web App via `vite-plugin-pwa`:

- **Installable** — can be added to the home screen on mobile or desktop
- **Offline-capable** — a service worker precaches the entire build output (all questions, images, and assets), so the app works without a network connection
- **Update notifications** — when a new version is deployed, `ReloadPrompt` shows a banner offering to update immediately or dismiss

The PWA is configured with `registerType: 'prompt'`, so updates are never applied silently — the user always chooses when to reload.

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

Questions with screenshots can include an `images` array of paths to static assets:

```json
{
  "images": ["/images/<slug>/q1.png"]
}
```

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

The `scripts/` directory contains extraction pipelines for the AWS SAA exams:

**SAA-C02 (original):**
- **`extract-questions.js`** (`npm run extract`) — parses ExamTopics PDF dumps via `pdftotext` (must be installed), extracts questions, options, answers, and community vote data, outputs to `src/data/questions-raw.json`
- **`enrich-questions.js`** (`node scripts/enrich-questions.js`) — assigns AWS service categories via regex patterns, skips broken questions, preserves hand-written explanations, outputs the final `questions.json`

**SAA-C03:**
- **`extract-saa-c03.js`** (`npm run extract:saa-c03`) — extracts questions from the SAA-C03 PDF using `pdf-parse`
- **`extract-images.py`** (`npm run extract:images`) — extracts question screenshots from the PDF using PyMuPDF, correlates them to question IDs, and saves to `public/images/aws-saa-c03/`

These scripts are specific to the AWS SAA ExamTopics format.
Other exams will need their own ingestor scripts.

## Tech Stack

- **React 19** with JSX (no TypeScript)
- **Vite 8** for build and dev server
- **react-router-dom 7** for URL-based routing
- **Tailwind CSS 4** via @tailwindcss/vite plugin
- **shadcn/ui** (new-york style) for UI primitives (Radix UI under the hood)
- **lucide-react** for icons
- **vite-plugin-pwa** for service worker and manifest generation
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
