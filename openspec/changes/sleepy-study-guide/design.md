# Design: Sleepy Study Guide - Multi-Exam Platform

## Approach

React Router with an explicit exam registry.
Chosen over auto-discovery (glob imports - magic, harder to attach metadata) and custom router (reinventing solved problems).

## Routing

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `ExamPicker` | Exam selection homepage |
| `/exam/:slug` | `ExamLayout` > `Dashboard` | Per-exam dashboard |
| `/exam/:slug/quiz` | `ExamLayout` > `Quiz` | Quiz view |
| `/exam/:slug/review` | `ExamLayout` > `ReviewQueue` | Review queue |

`App.jsx` becomes a `<BrowserRouter>` with `<Routes>` instead of the current `useState` state machine.

`ExamLayout` is a shared wrapper for all `/exam/:slug/*` routes.
It reads the slug from the URL, looks it up in the exam registry, lazy-loads the questions via dynamic import, renders the nav header with breadcrumb, and provides exam data to child routes via props or outlet context.
If the slug doesn't match any registered exam, redirect to `/`.

## Navigation Header

A persistent `NavHeader` component appears on every page:
- Top-left: sleep emoji + "Sleepy Study Guide" text, always links to `/`
- On per-exam pages: breadcrumb separator + exam name after the logo
- Used by both ExamPicker (no breadcrumb) and ExamLayout (with exam name)

## Data Organization

```
src/data/exams/
  index.js              # Exam registry
  aws-saa/
    questions.json      # Moved from src/data/questions.json
    meta.json           # Exam metadata
```

### meta.json

```json
{
  "name": "Solutions Architect Associate",
  "provider": "AWS",
  "code": "SAA-C02",
  "description": "571 questions",
  "color": "#f97316"
}
```

### Exam Registry (src/data/exams/index.js)

```js
import awsSaaMeta from './aws-saa/meta.json'

export const exams = [
  {
    slug: 'aws-saa',
    meta: awsSaaMeta,
    loadQuestions: () => import('./aws-saa/questions.json'),
  },
]
```

Adding a new exam: create the folder with `questions.json` + `meta.json`, add one entry to the registry.
Dynamic import keeps each exam's questions in a separate chunk.

## State Management

### Per-Exam localStorage Keys

| Key pattern | Purpose |
|-------------|---------|
| `sleepy-{slug}-quiz-state` | Answers, settings, shuffle order, current index |
| `sleepy-{slug}-review-status` | Review queue verdicts |

Each exam's progress is fully isolated.
Reset only clears the current exam's keys.

### useQuizState Hook Changes

The hook accepts `(slug, questions)` instead of importing questions directly and hardcoding the key.
Internal logic (shuffle, filtering, persistence, stats) is unchanged.

### Migration

One-time check on first load: if old keys (`aws-saa-quiz-state`, `aws-saa-review-status`) exist and new keys don't, copy the data to `sleepy-aws-saa-quiz-state` / `sleepy-aws-saa-review-status` and remove the old keys.

## Component Changes

### New Components

- **`ExamPicker.jsx`** - Homepage at `/`. Imports exam registry, reads each exam's localStorage for progress summaries, renders exam cards in a 2-column grid (stacks on mobile), links to `/exam/:slug`
- **`ExamLayout.jsx`** - Wrapper for `/exam/:slug/*` routes. Reads slug, loads exam data, renders NavHeader with breadcrumb, provides data to child routes
- **`NavHeader.jsx`** - Persistent header. Home link top-left (emoji + name), optional breadcrumb for per-exam pages

### Adapted Components

- **`App.jsx`** - State machine replaced with `<BrowserRouter>` and `<Routes>`
- **`Dashboard.jsx`** - Receives exam name and questions as props. Title uses exam name instead of hardcoded "AWS SAA Quiz"
- **`Quiz.jsx`** - Navigation uses `useNavigate` instead of callback props
- **`ReviewQueue.jsx`** - "Back to Dashboard" becomes a router link to `/exam/:slug`
- **`useQuizState.js`** - Parameterized with `(slug, questions)`, uses `sleepy-{slug}-*` keys

### Unchanged

- `QuestionCard.jsx`, `Feedback.jsx`, `QuizProgress.jsx` - no changes needed
- All `src/components/ui/` shadcn components - unchanged
- `scripts/extract-questions.js`, `scripts/enrich-questions.js` - stay in place
- `src/data/questions-raw.json` - stays in place (build artifact, not moved)

## Branding

- `index.html` page title changes to "Sleepy Study Guide"
- App header text changes to "Sleepy Study Guide" with a sleep emoji (😴)
- Per-exam dashboard titles use the exam name from `meta.json` instead of hardcoded "AWS SAA Quiz"

## Verification

- Homepage renders with at least the AWS SAA exam card showing correct progress
- Clicking an exam card navigates to `/exam/aws-saa` and shows the dashboard
- Quiz and review routes work (`/exam/aws-saa/quiz`, `/exam/aws-saa/review`)
- Nav header home button returns to `/` from any page
- Existing localStorage progress is migrated and preserved
- Browser back/forward navigation works correctly
- Direct URL access (e.g., bookmarking `/exam/aws-saa/quiz`) works
- Reset only affects the current exam
