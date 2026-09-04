# Sleepy Study Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `implementing` skill to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the AWS SAA quiz app into a multi-exam platform called "Sleepy Study Guide" with URL-based routing, an exam selection homepage, and per-exam data isolation.

**Tech Stack:** React 19, Vite, react-router-dom (new), shadcn/ui, Tailwind CSS 4

## Global Constraints

- JSX (not TypeScript)
- shadcn/ui new-york style components
- Atkinson Hyperlegible font, dyslexia-friendly styling (18px base, 1.8 line height, `#faf8f3` background)
- No backend, no API, no test framework
- localStorage for persistence, per-exam key isolation with `sleepy-{slug}-*` prefix
- Dynamic imports for exam question data (code splitting per exam)

---

### Task 1: Foundation + Data Reorganization

**Files:**
- Modify: `package.json` (add react-router-dom, rename project)
- Modify: `index.html` (update title)
- Create: `src/data/exams/aws-saa/meta.json`
- Create: `src/data/exams/index.js`
- Move: `src/data/questions.json` -> `src/data/exams/aws-saa/questions.json`
- Modify: `src/hooks/useQuizState.js` (parameterize with slug + questions)
- Modify: `src/components/App.jsx` (import from new path, pass slug/questions as props)
- Modify: `src/components/Dashboard.jsx` (receive questions + slug via props)
- Modify: `src/components/ReviewQueue.jsx` (receive questions + slug via props)
- Modify: `src/main.jsx` (add localStorage migration)

**Interfaces:**
- Produces: `exams` array from `src/data/exams/index.js` — each entry has `{ slug: string, meta: object, loadQuestions: () => Promise }`
- Produces: `useQuizState(slug, questions)` hook accepting slug string and questions array
- Produces: `getStorageKey(slug)` and `getReviewStatusKey(slug)` exported from `src/hooks/useQuizState.js`

- [x] **Step 1: Install react-router-dom**

```bash
npm install react-router-dom
```

- [x] **Step 2: Rename project in package.json**

Change the `"name"` field from `"aws-saa-quiz"` to `"sleepy-study-guide"`.

- [x] **Step 3: Update index.html title**

Change the `<title>` tag from `AWS SAA Quiz` to `Sleepy Study Guide`.

- [x] **Step 4: Create exam data directory and meta.json**

```bash
mkdir -p src/data/exams/aws-saa
```

Create `src/data/exams/aws-saa/meta.json`:

```json
{
  "name": "Solutions Architect Associate",
  "provider": "AWS",
  "code": "SAA-C02",
  "questionCount": 571,
  "color": "#f97316"
}
```

- [x] **Step 5: Create exam registry**

Create `src/data/exams/index.js`:

```jsx
import awsSaaMeta from './aws-saa/meta.json'

export const exams = [
  {
    slug: 'aws-saa',
    meta: awsSaaMeta,
    loadQuestions: () => import('./aws-saa/questions.json'),
  },
]

export function findExam(slug) {
  return exams.find(e => e.slug === slug) || null
}
```

- [x] **Step 6: Move questions.json to new location**

```bash
git mv src/data/questions.json src/data/exams/aws-saa/questions.json
```

- [x] **Step 7: Add localStorage migration to main.jsx**

Read `src/main.jsx`. Add the migration block before the `createRoot` call. The migration runs once at startup, before any component mounts:

```jsx
const legacyMigrations = [
  ['aws-saa-quiz-state', 'sleepy-aws-saa-quiz-state'],
  ['aws-saa-review-status', 'sleepy-aws-saa-review-status'],
]
for (const [oldKey, newKey] of legacyMigrations) {
  const data = localStorage.getItem(oldKey)
  if (data && !localStorage.getItem(newKey)) {
    localStorage.setItem(newKey, data)
    localStorage.removeItem(oldKey)
  }
}
```

- [x] **Step 8: Parameterize useQuizState**

Read `src/hooks/useQuizState.js`. Make these changes:

1. Remove the `import questionsData from '@/data/questions.json'` line at the top.

2. Replace the hardcoded key constants with exported functions:

```jsx
export const getStorageKey = (slug) => `sleepy-${slug}-quiz-state`
export const getReviewStatusKey = (slug) => `sleepy-${slug}-review-status`
```

3. Change the function signature from `export default function useQuizState()` to `export default function useQuizState(slug, questionsData)`.

4. Inside the hook, replace every use of the old `STORAGE_KEY` constant with `getStorageKey(slug)` and every use of `REVIEW_STATUS_KEY` with `getReviewStatusKey(slug)`. The `questionsData` variable name stays the same (it was the import name, now it's the parameter name), so all existing references to `questionsData` inside the hook continue to work without changes.

- [x] **Step 9: Update App.jsx to use new data path**

Read `src/components/App.jsx`. Make these changes:

1. Add a static import for questions from the new path (temporary, replaced in Task 2):

```jsx
import questionsData from '@/data/exams/aws-saa/questions.json'
```

2. Update the `useQuizState()` call to pass slug and questions:

```jsx
const quizState = useQuizState('aws-saa', questionsData)
```

3. Pass `questions` and `slug` as additional props to Dashboard and ReviewQueue:

```jsx
case 'dashboard':
  return <Dashboard quizState={quizState} questions={questionsData} slug="aws-saa" onStartQuiz={() => setView('quiz')} onOpenReview={() => setView('review')} />
```

```jsx
case 'review':
  return <ReviewQueue quizState={quizState} questions={questionsData} slug="aws-saa" onExit={() => setView('dashboard')} />
```

- [x] **Step 10: Update Dashboard.jsx to receive questions and slug via props**

Read `src/components/Dashboard.jsx`. Make these changes:

1. Remove the `import questionsData from '@/data/questions.json'` line.

2. Replace the `import { REVIEW_STATUS_KEY }` (or similar constant import) from useQuizState with:

```jsx
import { getReviewStatusKey } from '@/hooks/useQuizState'
```

3. Update the component signature to receive `questions` and `slug` props, and destructure `questionsData` from `questions` for minimal internal changes:

```jsx
export default function Dashboard({ quizState, questions: questionsData, slug, onStartQuiz, onOpenReview }) {
```

4. Replace every use of `REVIEW_STATUS_KEY` with `getReviewStatusKey(slug)`.

5. Change the hardcoded title `"AWS SAA Quiz"` to use a generic title or the exam name. For now in Task 1, use `"Quiz"` as a placeholder (Task 2 will pass the full exam name from meta.json).

- [x] **Step 11: Update ReviewQueue.jsx to receive questions and slug via props**

Read `src/components/ReviewQueue.jsx`. Make these changes:

1. Remove the `import questionsData from '@/data/questions.json'` line.

2. Replace the REVIEW_STATUS_KEY constant import with:

```jsx
import { getReviewStatusKey } from '@/hooks/useQuizState'
```

3. Update the component signature:

```jsx
export default function ReviewQueue({ quizState, questions: questionsData, slug, onExit }) {
```

4. Replace every use of `REVIEW_STATUS_KEY` with `getReviewStatusKey(slug)`.

- [x] **Step 12: Verify the app works**

```bash
npm run dev
```

Open the app in a browser. Verify:
- The page title shows "Sleepy Study Guide"
- The quiz dashboard loads and displays questions correctly
- If you had existing progress, it was migrated (check localStorage for `sleepy-aws-saa-quiz-state`)
- Starting a quiz, answering questions, and viewing the review queue all work
- Check the browser console for any import errors

- [x] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: reorganize data for multi-exam support and parameterize state hook"
```

---

### Task 2: Routing + NavHeader + ExamLayout

**Files:**
- Create: `src/components/NavHeader.jsx`
- Create: `src/components/ExamLayout.jsx`
- Modify: `src/main.jsx` (wrap with BrowserRouter)
- Modify: `src/components/App.jsx` (replace state machine with Routes)
- Modify: `src/components/Dashboard.jsx` (useOutletContext, router links, exam name)
- Modify: `src/components/Quiz.jsx` (useOutletContext, useNavigate)
- Modify: `src/components/ReviewQueue.jsx` (useOutletContext, useNavigate)

**Interfaces:**
- Consumes: `exams` and `findExam(slug)` from `src/data/exams/index.js` (Task 1)
- Consumes: `useQuizState(slug, questions)` from `src/hooks/useQuizState.js` (Task 1)
- Consumes: `getReviewStatusKey(slug)` from `src/hooks/useQuizState.js` (Task 1)
- Produces: `NavHeader` component — props: `examName?: string`
- Produces: `ExamLayout` component — provides `{ quizState, questions, exam, slug }` via React Router's Outlet context
- Produces: All views accessible via URL routes (`/exam/:slug`, `/exam/:slug/quiz`, `/exam/:slug/review`)

- [x] **Step 1: Create NavHeader.jsx**

Create `src/components/NavHeader.jsx`:

```jsx
import { Link } from 'react-router-dom'

export default function NavHeader({ examName }) {
  return (
    <header className="bg-white border-b border-border px-6 py-3 flex items-center gap-2.5">
      <Link to="/" className="flex items-center gap-2 no-underline text-inherit hover:opacity-80 transition-opacity">
        <span className="text-xl">😴</span>
        <span className="font-bold text-base text-foreground">Sleepy Study Guide</span>
      </Link>
      {examName && (
        <>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="font-medium text-sm text-muted-foreground">{examName}</span>
        </>
      )}
    </header>
  )
}
```

- [x] **Step 2: Create ExamLayout.jsx**

Create `src/components/ExamLayout.jsx`. This component handles dynamic question loading and provides exam data to child routes via Outlet context. It splits into two components so `useQuizState` is not called conditionally (rules of hooks):

```jsx
import { useState, useEffect } from 'react'
import { useParams, Navigate, Outlet } from 'react-router-dom'
import { findExam } from '@/data/exams'
import useQuizState from '@/hooks/useQuizState'
import NavHeader from './NavHeader'

function ExamContent({ slug, exam, questions }) {
  const quizState = useQuizState(slug, questions)
  return (
    <>
      <NavHeader examName={exam.meta.name} />
      <Outlet context={{ quizState, questions, exam, slug }} />
    </>
  )
}

export default function ExamLayout() {
  const { slug } = useParams()
  const exam = findExam(slug)
  const [questions, setQuestions] = useState(null)

  useEffect(() => {
    if (!exam) return
    let cancelled = false
    exam.loadQuestions().then(mod => {
      if (!cancelled) setQuestions(mod.default)
    })
    return () => { cancelled = true }
  }, [exam])

  if (!exam) return <Navigate to="/" replace />

  if (!questions) {
    return (
      <>
        <NavHeader />
        <div className="flex justify-center p-16">
          <p className="text-muted-foreground">Loading questions...</p>
        </div>
      </>
    )
  }

  return <ExamContent slug={slug} exam={exam} questions={questions} />
}
```

- [x] **Step 3: Wrap app with BrowserRouter in main.jsx**

Read `src/main.jsx`. Wrap the `<App />` component with `<BrowserRouter>`:

```jsx
import { BrowserRouter } from 'react-router-dom'
```

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
```

- [x] **Step 4: Rewrite App.jsx with Routes**

Replace the entire contents of `src/components/App.jsx`. Remove the `useState` state machine, the `useQuizState` call, the `questionsData` import, and all the callback props. Replace with route definitions:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import NavHeader from './NavHeader'
import ExamLayout from './ExamLayout'
import Dashboard from './Dashboard'
import Quiz from './Quiz'
import ReviewQueue from './ReviewQueue'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<><NavHeader /><Navigate to="/exam/aws-saa" replace /></>} />
      <Route path="/exam/:slug" element={<ExamLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="review" element={<ReviewQueue />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

Note: The `/` route temporarily redirects to `/exam/aws-saa`. Task 3 replaces this with the ExamPicker homepage.

- [x] **Step 5: Update Dashboard.jsx for router navigation**

Read `src/components/Dashboard.jsx`. Make these changes:

1. Remove the `onStartQuiz` and `onOpenReview` callback props.

2. Remove the `questions` and `slug` props added in Task 1. Replace with `useOutletContext`:

```jsx
import { useOutletContext, useNavigate } from 'react-router-dom'
```

```jsx
export default function Dashboard() {
  const { quizState, questions: questionsData, exam, slug } = useOutletContext()
  const navigate = useNavigate()
```

3. Update the title from the Task 1 placeholder to the exam name:

```jsx
<h2 className="...">{exam.meta.name} Quiz</h2>
```

4. Replace `onClick={onStartQuiz}` with `onClick={() => navigate('quiz')}` (relative route).

5. Replace `onClick={onOpenReview}` with `onClick={() => navigate('review')}` (relative route).

- [x] **Step 6: Update Quiz.jsx for router navigation**

Read `src/components/Quiz.jsx`. Make these changes:

1. Remove the `onExit` prop.

2. Add router imports and get context:

```jsx
import { useOutletContext, useNavigate } from 'react-router-dom'
```

```jsx
export default function Quiz() {
  const { quizState } = useOutletContext()
  const navigate = useNavigate()
```

3. Replace every `onExit()` call with `navigate('..')` (navigates up to the exam dashboard). This includes:
   - The Escape key handler
   - The "Back to Dashboard" button
   - The "Finish" button on the last question

4. Remove `onExit` from any `useCallback` dependency arrays.

- [x] **Step 7: Update ReviewQueue.jsx for router navigation**

Read `src/components/ReviewQueue.jsx`. Make these changes:

1. Remove the `onExit` prop and the `questions`/`slug` props added in Task 1.

2. Add router imports and get context:

```jsx
import { useOutletContext, useNavigate } from 'react-router-dom'
```

```jsx
export default function ReviewQueue() {
  const { quizState, questions: questionsData, slug } = useOutletContext()
  const navigate = useNavigate()
```

3. Replace `onClick={onExit}` with `onClick={() => navigate('..')}`.

- [x] **Step 8: Verify routing works**

```bash
npm run dev
```

Open the app in a browser. Verify:
- Navigating to `http://localhost:5173/` redirects to `/exam/aws-saa`
- The NavHeader shows "Sleepy Study Guide / Solutions Architect Associate"
- Clicking "Sleepy Study Guide" in the header navigates to `/` (which redirects back for now)
- The dashboard loads with correct stats and exam name
- "Continue Quiz" navigates to `/exam/aws-saa/quiz`
- "Review Flagged" navigates to `/exam/aws-saa/review`
- Browser back/forward buttons work correctly
- Directly navigating to `/exam/aws-saa/quiz` loads the quiz
- Directly navigating to `/exam/nonexistent` redirects to `/`
- Escape key in quiz navigates back to the dashboard
- Keyboard shortcuts (1-5, Enter, arrow keys) still work in the quiz

- [x] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add URL routing with NavHeader and ExamLayout"
```

---

### Task 3: ExamPicker Homepage

**Files:**
- Create: `src/components/ExamPicker.jsx`
- Modify: `src/components/App.jsx` (replace redirect with ExamPicker)

**Interfaces:**
- Consumes: `exams` from `src/data/exams/index.js` (Task 1)
- Consumes: `getStorageKey(slug)` from `src/hooks/useQuizState.js` (Task 1) — to read per-exam progress from localStorage
- Consumes: `NavHeader` from `src/components/NavHeader.jsx` (Task 2) — rendered without breadcrumb on the homepage

- [x] **Step 1: Create ExamPicker.jsx**

Create `src/components/ExamPicker.jsx`:

```jsx
import { Link } from 'react-router-dom'
import { exams } from '@/data/exams'
import { getStorageKey } from '@/hooks/useQuizState'
import NavHeader from './NavHeader'

function getExamProgress(slug) {
  try {
    const raw = localStorage.getItem(getStorageKey(slug))
    if (!raw) return null
    const state = JSON.parse(raw)
    const answers = state.answers || {}
    const total = Object.keys(answers).length
    const correct = Object.values(answers).filter(a => a.correct).length
    return { answered: total, correct, rate: total > 0 ? Math.round((correct / total) * 100) : 0 }
  } catch {
    return null
  }
}

export default function ExamPicker() {
  return (
    <>
      <NavHeader />
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-foreground mb-1">Choose an Exam</h2>
        <p className="text-sm text-muted-foreground mb-6">Select an exam to start studying</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {exams.map(exam => {
            const progress = getExamProgress(exam.slug)
            return (
              <Link
                key={exam.slug}
                to={`/exam/${exam.slug}`}
                className="no-underline text-inherit"
              >
                <div className="bg-white border border-border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-white text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ backgroundColor: exam.meta.color }}
                    >
                      {exam.meta.provider}
                    </span>
                    <span className="font-semibold text-[15px] text-foreground">{exam.meta.name}</span>
                  </div>
                  <p className="text-muted-foreground text-[13px] mb-3">
                    {exam.meta.code} — {exam.meta.questionCount} questions
                  </p>
                  {progress ? (
                    <>
                      <div className="bg-muted rounded-md h-1.5 overflow-hidden mb-1.5">
                        <div
                          className="bg-green-500 h-full rounded-md transition-all"
                          style={{ width: `${(progress.answered / exam.meta.questionCount) * 100}%` }}
                        />
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {progress.answered} answered — {progress.rate}% correct
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-xs">Not started</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
```


- [x] **Step 2: Replace redirect with ExamPicker in App.jsx**

Read `src/components/App.jsx`. Replace the temporary `/` route that redirects to `/exam/aws-saa`:

Old:
```jsx
<Route path="/" element={<><NavHeader /><Navigate to="/exam/aws-saa" replace /></>} />
```

New:
```jsx
<Route path="/" element={<ExamPicker />} />
```

Add the import at the top:
```jsx
import ExamPicker from './ExamPicker'
```

Remove the `NavHeader` import from App.jsx if it's no longer used there (ExamPicker and ExamLayout each render their own NavHeader). Also remove the `Navigate` import if it's no longer used (check the catch-all route - if it still uses `Navigate`, keep it).

- [x] **Step 3: Verify the homepage**

```bash
npm run dev
```

Open the app in a browser. Verify:
- `http://localhost:5173/` shows the exam selection homepage
- The NavHeader shows "Sleepy Study Guide" without a breadcrumb
- The AWS SAA exam card shows with the orange "AWS" provider badge
- If you have existing progress, the card shows the progress bar and stats
- If no progress exists, the card shows "Not started"
- Clicking the exam card navigates to `/exam/aws-saa`
- The per-exam dashboard shows correctly with the breadcrumb header
- Clicking "Sleepy Study Guide" in the per-exam header navigates back to `/`
- The full flow works: homepage -> exam dashboard -> quiz -> answer questions -> back to dashboard -> homepage (all via clicking/navigation)

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add ExamPicker homepage for multi-exam selection"
```
