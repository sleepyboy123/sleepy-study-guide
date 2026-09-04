# Remove Review Queue Feature - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `implementing` skill to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the developer-side ReviewQueue triage feature from the production app while keeping the confidence badge on individual question feedback.

**Tech Stack:** React, React Router, Vite

## Global Constraints

- Keep `Feedback.jsx` confidence badge untouched (lines 25-29)
- Keep `confidence` and `communityCorrection` fields in question JSON data untouched
- No new dependencies or abstractions

---

### Task 1: Remove Review Queue Feature

**Files:**
- Delete: `src/components/ReviewQueue.jsx`
- Modify: `src/components/App.jsx:6,15`
- Modify: `src/components/Dashboard.jsx:3,17-31,64-65,128-144`
- Modify: `src/hooks/useQuizState.js:4,41,69-71`
- Modify: `src/main.jsx:9`

**Interfaces:**
- Consumes: nothing new
- Produces: nothing new (pure removal)

- [x] **Step 1: Delete ReviewQueue.jsx**

```bash
rm src/components/ReviewQueue.jsx
```

- [x] **Step 2: Remove ReviewQueue import and route from App.jsx**

Remove line 6 (`import ReviewQueue from './ReviewQueue'`) and line 15 (`<Route path="review" element={<ReviewQueue />} />`).

Result should be:

```jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import ExamPicker from './ExamPicker'
import ExamLayout from './ExamLayout'
import Dashboard from './Dashboard'
import Quiz from './Quiz'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ExamPicker />} />
      <Route path="/exam/:slug" element={<ExamLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="quiz" element={<Quiz />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
```

- [x] **Step 3: Remove review-related code from Dashboard.jsx**

Remove these four blocks:

1. **Line 3** - the `getReviewStatusKey` import:
   ```jsx
   import { getReviewStatusKey } from '@/hooks/useQuizState';
   ```

2. **Lines 17-31** - the review status localStorage read, `flaggedQuestions`, and `needsReviewCount`:
   ```jsx
   const [reviewStatus] = useState(() => {
     try {
       const stored = localStorage.getItem(getReviewStatusKey(slug));
       return stored ? JSON.parse(stored) : {};
     } catch {
       return {};
     }
   });

   const flaggedQuestions = questionsData.filter(
     q => q.confidence !== 'high' || q.communityCorrection
   );
   const needsReviewCount = flaggedQuestions.filter(
     q => reviewStatus[q.id] !== 'verified'
   ).length;
   ```

3. **Lines 64-65** - the "Review Flagged" button:
   ```jsx
   <Button variant="outline" onClick={() => navigate('review')}>
     Review Flagged ({needsReviewCount})
   </Button>
   ```

4. **Lines 128-144** - the Confidence filter dropdown:
   ```jsx
   <div className="flex items-center gap-2">
     <label className="text-sm font-medium">Confidence:</label>
     <Select
       value={settings.filterConfidence || 'all'}
       onValueChange={val => updateSettings({ filterConfidence: val === 'all' ? null : val })}
     >
       <SelectTrigger className="w-48">
         <SelectValue />
       </SelectTrigger>
       <SelectContent>
         <SelectItem value="all">All levels</SelectItem>
         <SelectItem value="high">High confidence</SelectItem>
         <SelectItem value="medium">Medium confidence</SelectItem>
         <SelectItem value="needs-review">Needs review</SelectItem>
       </SelectContent>
     </Select>
   </div>
   ```

After these removals, also remove the now-unused `useState` import (only `getReviewStatusKey` used it in Dashboard - check if any other state uses `useState` first; the reviewStatus state was the only `useState` call, so remove it from the import).

Note: the `Select` component imports must stay - the Category filter dropdown still uses them.

- [x] **Step 4: Remove filterConfidence from useQuizState.js**

1. **Line 4** - delete the `getReviewStatusKey` export:
   ```js
   export const getReviewStatusKey = (slug) => `sleepy-${slug}-review-status`
   ```

2. **Line 41** - remove `filterConfidence: null,` from `DEFAULT_SETTINGS`

3. **Lines 69-71** - remove the confidence filtering block:
   ```js
   if (state.settings.filterConfidence) {
     filtered = filtered.filter(q => q.confidence === state.settings.filterConfidence);
   }
   ```

- [x] **Step 5: Remove legacy review-status migration from main.jsx**

Remove line 9 from the `legacyMigrations` array:
```js
['aws-saa-review-status', 'sleepy-aws-saa-review-status'],
```

- [x] **Step 6: Verify the app compiles and runs**

```bash
npm run build
```

If build succeeds, start the dev server and verify:
1. Dashboard loads without the "Review Flagged" button
2. Dashboard Filters card no longer has a Confidence dropdown
3. Quiz still works (navigate to quiz, answer a question)
4. Feedback confidence badge still appears on non-high-confidence questions
5. Navigating to `/exam/aws-saa/review` redirects to `/` (caught by the `*` route)

- [x] **Step 7: Commit**

Stage all changed files and the deleted file. Ask the user before committing.
