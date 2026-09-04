# Proposal: Remove Review Queue Feature

## Scoping Gate

- **Tool type:** Frontend (React SPA)
- **Audience/maturity:** Personal tool
- **Scale:** Just you

## Why

The ReviewQueue is developer-side data-quality triage tooling that leaked into the production app.
It lets a user mark questions as "verified" or "needs correction" via localStorage, but never persists those decisions back to the source JSON files.
All 571 questions are already marked `"verified"` confidence, so the review queue only surfaces the 6 community-corrected questions, and even those can only be triaged locally with no lasting effect.

End users should not see or interact with this feature.
The confidence badge on individual questions (shown in Feedback.jsx when `confidence !== 'high'`) is the only review-related UI worth keeping, as honest signal to the user that an answer may be imperfect.

## Scope

Remove:
- `ReviewQueue.jsx` component (delete file)
- ReviewQueue route and import in `App.jsx`
- "Review Flagged" button, review status localStorage read, flaggedQuestions/needsReviewCount logic, and Confidence filter dropdown in `Dashboard.jsx`
- `getReviewStatusKey` export, `filterConfidence` default setting, and confidence filtering logic in `useQuizState.js`
- Legacy migration entry for `aws-saa-review-status` in `main.jsx`

Keep:
- Confidence badge in `Feedback.jsx`
- `confidence` and `communityCorrection` fields in question JSON data
