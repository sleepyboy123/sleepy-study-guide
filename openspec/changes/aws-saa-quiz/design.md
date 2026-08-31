# Design: AWS SAA Exam Quiz Application

## Architecture

Two-phase build:

```
Phase 1 (build-time):  PDFs -> pdftotext -> raw text -> Node parser -> questions.json
Phase 2 (runtime):     React SPA <- imports questions.json <- localStorage for state
```

The extraction script is a one-shot build tool.
The quiz app is a static SPA with no runtime dependencies beyond a browser.

## Project Structure

```
aws-study-guide/
  AWS SAA/                        # existing PDFs (gitignored)
  scripts/
    extract-questions.js          # PDF text parser, run manually
  src/
    data/
      questions.json              # generated output, checked into git
    components/
      App.jsx                     # top-level state machine (dashboard | quiz | review)
      Dashboard.jsx               # landing page with stats and controls
      Quiz.jsx                    # main quiz flow controller
      QuestionCard.jsx            # single question display with options
      Feedback.jsx                # correct/incorrect feedback with explanation
      Progress.jsx                # progress bar and running score
      ReviewQueue.jsx             # flagged questions for user review
    hooks/
      useQuizState.js             # localStorage-backed quiz state management
    main.jsx                      # React entry point
    index.css                     # styles
  index.html
  vite.config.js
  package.json
```

No routing library.
App state machine has three views: dashboard, quiz, review.
Conditional rendering based on state, not URL routes.

## Data Model

### questions.json (per question)

```json
{
  "id": 1,
  "question": "A company runs an application on Amazon EC2...",
  "options": [
    { "key": "A", "text": "Stop the instance outside..." },
    { "key": "B", "text": "Hibernate the instance..." }
  ],
  "correctAnswer": ["B"],
  "explanation": "Hibernation preserves in-memory state...",
  "isMultiSelect": false,
  "confidence": "high",
  "category": "EC2",
  "communityCorrection": false
}
```

- `correctAnswer`: Always an array. Single element for single-select, two for multi-select. Uniform interface.
- `confidence`: `"high"` | `"medium"` | `"needs-review"`. Drives the review queue.
- `communityCorrection`: `true` when question text came from a community-posted correction.
- `category`: AWS service category derived from question content during verification.

### localStorage state (key: `aws-saa-quiz-state`)

```json
{
  "answers": {
    "1": { "selected": ["B"], "correct": true, "answeredAt": "2026-08-31T..." }
  },
  "currentQuestionIndex": 15,
  "shuffleOrder": [42, 17, 3],
  "settings": {
    "shuffleQuestions": true,
    "showOnlyUnanswered": false,
    "filterCategory": null,
    "filterConfidence": null
  }
}
```

- Answers keyed by question ID, not array position. Survives reordering and filtering.
- Shuffle order persisted so the user can resume where they left off.
- Stats (score, progress %) computed on the fly from the answers map.

## Component Flow

### Dashboard
- Overall stats: X/574 answered, Y% correct, Z flagged for review
- Category breakdown showing weakest areas
- Buttons: "Continue Quiz", "Start Over", "Review Flagged Questions"
- Filter controls: by category, by unanswered only, by confidence level

### Quiz Flow
1. QuestionCard shows question text and numbered options as clickable cards
2. Multi-select questions show "(Select two)" indicator and allow exactly two selections before submit
3. User clicks "Submit Answer"
4. Feedback panel reveals: green/correct or red/incorrect, correct answer highlighted, explanation text
5. "Next Question" button advances
6. Progress bar at top shows position and running score

### Review Queue
- Lists questions where `confidence !== "high"` or `communityCorrection === true`
- Shows question, selected answer, and why it's flagged
- User can mark items as "verified" or "needs correction" (stored in localStorage)

### Keyboard Shortcuts
- 1-5 to select options (A-E)
- Enter to submit answer
- Right arrow or N for next question
- Escape to return to dashboard

## Extraction Script Design

### Input
Three PDF files processed via `pdftotext` (available on the system).

### Parsing Strategy
1. Split text on `^Question #(\d+)$` pattern (strip "Topic N" suffixes from concatenated headers)
2. Skip "Topic 1" page-break artifact lines
3. Collect question text until first `^[A-E]\.` option line
4. Collect each option until next option or `^Correct Answer:`
5. Extract "Correct Answer" - first match only, strip trailing noise (handles edge cases like "Correct Answer: C. Build a database cache...")
6. Extract community vote distribution if present (letter + percentage)
7. Assign global IDs: PDF1 as-is (1-200), PDF2 += 200 (201-400), PDF3 += 400 (401-574)
8. Filter out page headers/footers (timestamps, page numbers, ExamTopics URLs)

### Output
Raw parsed JSON with fields: `id`, `question`, `options`, `listedAnswer`, `communityVote`, `communityVotePercent`, `isMultiSelect`.

This raw output is then manually reviewed and enriched with: `correctAnswer`, `explanation`, `confidence`, `category`, `communityCorrection`.

## Error Handling

- Corrupt localStorage: catch JSON.parse failure, reset to empty state
- Multi-select validation: disable submit until exactly N options selected (where N matches question requirement)
- Missing explanation: show "No explanation available" fallback
- Browser support: modern browsers only, no polyfills

## Testing Strategy

- Parser validation: sanity-check script counts questions, checks for empty fields, validates correctAnswer references existing option keys
- Spot-check sample of verified answers during implementation
- Manual smoke test of quiz flow: answer correctly, answer incorrectly, check persistence across refresh, test multi-select, check review queue
- No unit test suite. Complexity is in the data, not the code.
