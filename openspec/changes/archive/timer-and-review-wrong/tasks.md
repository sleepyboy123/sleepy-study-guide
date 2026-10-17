# Timer & Review Wrong Answers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `implementing` skill to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session timer to the quiz view and a dedicated read-only review mode for wrong answers.

**System Architecture:** Two independent UI features added to the existing React SPA. Both consume existing quiz state from `useQuizState` via outlet context — no state hook or persistence changes needed. The timer is ephemeral React state; the review mode filters the existing `answers` object.

**Tech Stack:** React 19, React Router 7, Tailwind CSS 4, shadcn/ui components, Vite 8

## Global Constraints

- No new dependencies
- Follow existing component patterns (functional components, `useOutletContext()` for data)
- No localStorage changes — timer is ephemeral, review reads existing answer data
- No test framework is configured; verify features manually via `npm run dev`

---

### Task 1: Session Timer

**Files:**
- Modify: `src/components/Quiz.jsx`
- Modify: `src/components/QuizProgress.jsx`

**Interfaces:**
- Consumes: `QuizProgress` component (existing), React hooks
- Produces: `elapsedSeconds` prop on `QuizProgress`; `QuizProgress` renders it as `MM:SS`

- [x] **Step 1: Add timer state to Quiz.jsx**

Add a `useState` for elapsed seconds and a `useEffect` with `setInterval` that ticks every second. The timer starts at 0 on mount and cleans up on unmount. Add the imports and state before the existing `handleKeyDown`:

```jsx
// Add useRef to the existing import
import { useEffect, useCallback, useState, useRef } from 'react';

// Inside the Quiz component, before handleKeyDown:
const [elapsedSeconds, setElapsedSeconds] = useState(0);
const timerRef = useRef(null);

useEffect(() => {
  timerRef.current = setInterval(() => {
    setElapsedSeconds(prev => prev + 1);
  }, 1000);
  return () => clearInterval(timerRef.current);
}, []);
```

- [x] **Step 2: Pass elapsedSeconds to QuizProgress**

Update the `<QuizProgress>` JSX in Quiz.jsx to pass the new prop:

```jsx
<QuizProgress
  current={currentQuestionIndex}
  total={filteredQuestions.length}
  stats={stats}
  elapsedSeconds={elapsedSeconds}
/>
```

- [x] **Step 3: Display timer in QuizProgress.jsx**

Add a helper function to format seconds as `MM:SS` and render it between the question counter and the score:

```jsx
function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function QuizProgress({ current, total, stats, elapsedSeconds }) {
  const progressPercent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="mb-6">
      <Progress value={progressPercent} className="h-2 mb-3" />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Question {current + 1} of {total}</span>
        {elapsedSeconds != null && (
          <span className="font-mono">{formatTime(elapsedSeconds)}</span>
        )}
        <span>
          Score: {stats.correct}/{stats.answered}
          {stats.answered > 0 && ` (${stats.percentage}%)`}
        </span>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Verify timer manually**

Run `npm run dev`, navigate to an exam quiz, and confirm:
1. Timer starts at `00:00` and counts up every second
2. Timer displays between the question counter and score in the progress bar
3. Navigating back to the dashboard and returning to quiz resets the timer to `00:00`

### Task 2: Review Wrong Answers

**Files:**
- Create: `src/components/ReviewWrong.jsx`
- Modify: `src/components/Dashboard.jsx`
- Modify: `src/components/App.jsx`

**Interfaces:**
- Consumes: `useOutletContext()` providing `{ quizState, questions }` (from `ExamLayout`); existing `QuestionCard` and `Feedback` components
- Produces: `ReviewWrong` component rendered at `/exam/:slug/review`; "Review Wrong Answers" button on Dashboard

- [x] **Step 1: Create ReviewWrong.jsx**

Create `src/components/ReviewWrong.jsx`. This component:
- Gets `quizState` and `questions` from outlet context
- Filters to only questions answered incorrectly
- Navigates through them with Previous/Next buttons
- Renders each using the existing `QuestionCard` (which is already read-only when `existingAnswer` is provided) and `Feedback`

```jsx
import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import QuestionCard from './QuestionCard';
import Feedback from './Feedback';

export default function ReviewWrong() {
  const { quizState, questions } = useOutletContext();
  const navigate = useNavigate();
  const { answers } = quizState;

  const wrongQuestions = questions.filter(q => answers[q.id] && !answers[q.id].correct);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (wrongQuestions.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-4">No wrong answers to review</h2>
        <Button variant="secondary" onClick={() => navigate('..')}>Back to Dashboard</Button>
      </div>
    );
  }

  const question = wrongQuestions[currentIndex];
  const answer = answers[question.id];

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Reviewing Wrong Answers</h2>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} of {wrongQuestions.length}
        </span>
      </div>
      <QuestionCard
        key={question.id}
        question={question}
        onSubmit={() => {}}
        existingAnswer={answer}
      />
      <Feedback question={question} answer={answer} />
      <div className="flex justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(i => i - 1)}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          Previous
        </Button>
        {currentIndex < wrongQuestions.length - 1 ? (
          <Button
            onClick={() => setCurrentIndex(i => i + 1)}
            className="flex-1"
          >
            Next
          </Button>
        ) : (
          <Button onClick={() => navigate('..')} className="flex-1">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Add "Review Wrong Answers" button to Dashboard.jsx**

In `src/components/Dashboard.jsx`, add a button after the existing "Continue Quiz" / "Reset Progress" buttons. It should only appear when there are incorrect answers. Add the button inside the existing `<div className="flex flex-wrap gap-3 mb-6">` block, after the Reset Progress `AlertDialog`:

```jsx
{stats.incorrect > 0 && (
  <Button variant="outline" onClick={() => navigate('review')}>
    Review Wrong Answers ({stats.incorrect})
  </Button>
)}
```

Place this after the closing `)}` of the `{stats.answered > 0 && (` block (the AlertDialog), but before the closing `</div>` of the flex wrapper.

- [x] **Step 3: Register the review route in App.jsx**

In `src/components/App.jsx`, import `ReviewWrong` and add a route under the `/exam/:slug` layout:

Add the import at the top:
```jsx
import ReviewWrong from './ReviewWrong'
```

Add the route as a sibling of the existing `quiz` route:
```jsx
<Route path="review" element={<ReviewWrong />} />
```

The routes block should look like:
```jsx
<Route path="/exam/:slug" element={<ExamLayout />}>
  <Route index element={<Dashboard />} />
  <Route path="quiz" element={<Quiz />} />
  <Route path="review" element={<ReviewWrong />} />
</Route>
```

- [x] **Step 4: Verify review mode manually**

Run `npm run dev` and confirm:
1. Dashboard does NOT show "Review Wrong Answers" button when no questions are answered wrong
2. Answer a few questions (get at least one wrong)
3. Dashboard shows "Review Wrong Answers (N)" button with the correct count
4. Clicking it navigates to the review page
5. Review page shows only the wrong questions in read-only mode (options disabled, correct answers green, wrong answers red)
6. Previous/Next navigation works, counter shows "X of Y"
7. "Done" button on the last question returns to dashboard
8. If all answers are correct, navigating to `/review` directly shows "No wrong answers to review" with a back button
