# Timer & Review Wrong Answers

## Scoping Gate

- **Tool type:** Frontend (React SPA, Vite + React 19)
- **Audience/maturity:** Personal study tool
- **Scale:** Just the author

## Why

Two features to improve exam preparation workflow:

1. **Session timer** — a count-up timer showing how long the current study burst has lasted. The AWS SAA-C03 exam is time-limited, so knowing your pacing per session helps gauge readiness. The timer is ephemeral (not persisted) — it resets when you leave the quiz and come back, since picking up a timer after a day-long break is meaningless.

2. **Review wrong answers** — a dedicated read-only mode to revisit questions answered incorrectly. Currently there's no way to focus on mistakes without resetting progress. A "Review Wrong Answers" button on the dashboard launches a read-only walkthrough of wrong questions, showing the user's wrong selection, the correct answer, and the explanation.

## Approved Design

### Session Timer
- `useRef`/`useEffect` timer in `Quiz.jsx`, starts at 0:00 on mount, counts up every second
- Displayed as `MM:SS` in `QuizProgress` bar alongside the existing score
- Purely ephemeral — not saved to localStorage, resets on navigation away

### Review Wrong Answers
- New route `/exam/:slug/review` rendering a `ReviewWrong.jsx` component
- "Review Wrong Answers" button on Dashboard, visible only when `stats.incorrect > 0`
- Read-only: shows each wrong question with the user's answer highlighted red, correct answer highlighted green, plus explanation
- Previous/Next navigation through wrong questions with progress indicator

### Files Touched
- `src/components/Quiz.jsx` — timer state, pass elapsed time to QuizProgress
- `src/components/QuizProgress.jsx` — display timer
- `src/components/Dashboard.jsx` — "Review Wrong Answers" button
- `src/components/ReviewWrong.jsx` — new read-only review component
- `src/components/App.jsx` — register `/review` route
