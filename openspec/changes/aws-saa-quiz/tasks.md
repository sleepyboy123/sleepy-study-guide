# AWS SAA Quiz App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the `implementing` skill to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend-only quiz app that presents 574 verified AWS SAA-C02 questions with immediate feedback and localStorage-backed progress tracking.

**System Architecture:** Two-phase static build. Phase 1: a Node.js extraction script parses 3 ExamTopics PDFs via `pdftotext` into a structured JSON question bank with auto-verified answers. Phase 2: a React + Vite SPA imports that JSON and renders an interactive quiz with dashboard, progress tracking, and a review queue for flagged questions.

**Tech Stack:** React 19, Vite 6, shadcn/ui, Tailwind CSS 4, Node.js (extraction script only). No routing library, no test framework.

## Global Constraints

- Frontend-only: no backend, no API calls, no external services
- All state in localStorage under key `aws-saa-quiz-state`
- `correctAnswer` is always an array (single element for single-select, two for multi-select)
- `confidence` values: `"high"` | `"medium"` | `"needs-review"`
- Questions with `communityCorrection: true` must appear in the review queue
- PDFs are gitignored; `src/data/questions.json` is checked into git
- No unit test suite; validation is via script sanity checks and manual smoke tests

---

### Task 1: Project Setup + PDF Extraction Script

**Files:**
- Create: `package.json`
- Create: `scripts/extract-questions.js`

**Interfaces:**
- Consumes: 3 PDF files in `AWS SAA/` directory, `pdftotext` CLI
- Produces: `src/data/questions-raw.json` - array of objects with shape `{ id: number, question: string, options: Array<{key: string, text: string}>, listedAnswer: string[], communityVote: string[] | null, communityVotePercent: number[] | null, isMultiSelect: boolean, communityCorrection: boolean }`

- [x] **Step 1: Create package.json**

```json
{
  "name": "aws-saa-quiz",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "extract": "node scripts/extract-questions.js",
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [x] **Step 2: Write the extraction script**

Create `scripts/extract-questions.js`. The script must:

1. Run `pdftotext` on each of the 3 PDFs via `child_process.execSync` to produce text strings
2. For each PDF text, split on the regex `/^Question #(\d+)/m` to isolate question blocks
3. For each question block, parse:
   - **Question text**: everything from after the header (skipping "Topic 1" artifact lines and page header/footer lines matching `/^\d+\/\d+$/`, `/^\d+\/\d+\/\d+,/`, or `/^https:\/\/www\.examtopics\.com/`) until the first line matching `/^[A-E]\./`
   - **Options**: each line starting with `/^[A-E]\./` collects text until the next option line or `Correct Answer:`. Handle multi-line wrapping.
   - **Listed answer**: first line matching `/^Correct Answer:\s*([A-E]+)/` after the options. Extract only the leading letter(s) - strip trailing noise like `. Build a database cache...` or `(or is it really D?)`
   - **Community vote**: lines matching `/^\s*([A-E]+)\s*\((\d+)%\)/` appearing after "Community vote distribution". May have 1-2 vote lines (majority + minority).
   - **Multi-select detection**: `isMultiSelect = true` if question text contains "Select two", "Choose two", "Select THREE", or if listedAnswer has 2+ letters
   - **Community correction detection**: search the comment section for "The correct question:" or "the actual question" and if found, replace the question text with the corrected version and set `communityCorrection = true`
4. Assign global IDs: PDF1 questions keep their number (1-200), PDF2 += 200 (201-400), PDF3 += 400 (401-574)
5. Auto-assign preliminary `correctAnswer` and `confidence`:
   - If communityVote exists and top vote is >= 90%: use community answer, confidence = "high"
   - If communityVote exists and top vote is 70-89%: use community answer, confidence = "medium"
   - If communityVote exists and top vote is < 70%: use community answer, confidence = "needs-review"
   - If no communityVote: use listedAnswer, confidence = "needs-review"
6. Write output to `src/data/questions-raw.json`

The script should also print a summary to stdout:
```
Parsed: 574 questions (514 single-select, 60 multi-select)
Confidence: 320 high, 128 medium, 126 needs-review
Community corrections applied: 15
```

Key implementation details for the parser:

```javascript
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PDF_FILES = [
  { path: join(ROOT, 'AWS SAA', 'ExamTopics_AWS_SAA_C02_1_200.pdf'), offset: 0 },
  { path: join(ROOT, 'AWS SAA', 'ExamTopics_AWS_SAA_C02_201_400.pdf'), offset: 200 },
  { path: join(ROOT, 'AWS SAA', 'ExamTopics_AWS_SAA_C02_401_574.pdf'), offset: 400 },
];

function extractText(pdfPath) {
  return execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
}

function isJunkLine(line) {
  return /^\d+\/\d+$/.test(line.trim())
    || /^\d+\/\d+\/\d+,/.test(line.trim())
    || /^https:\/\/www\.examtopics\.com/.test(line.trim())
    || /^Topic \d+$/.test(line.trim())
    || /^AWS Certified Solutions Architect/.test(line.trim())
    || /^EXAMTOPICS$/i.test(line.trim())
    || /^- Expert Verified/.test(line.trim())
    || /^Custom View Settings$/.test(line.trim());
}

function parseQuestions(text, offset) {
  const blocks = [];
  const parts = text.split(/^Question #(\d+)/m);
  // parts: [preamble, num1, block1, num2, block2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const numStr = parts[i].replace(/Topic.*$/, '').trim();
    const num = parseInt(numStr, 10);
    if (isNaN(num)) continue;
    blocks.push({ localNum: num, raw: parts[i + 1] });
  }
  return blocks.map(({ localNum, raw }) => parseOneQuestion(raw, localNum + offset));
}

function parseOneQuestion(raw, globalId) {
  const lines = raw.split('\n');
  let questionLines = [];
  let options = [];
  let currentOption = null;
  let listedAnswer = null;
  let communityVote = null;
  let communityVotePercent = null;
  let phase = 'question'; // question -> options -> answer -> community
  let communityCorrection = false;
  let communitySection = [];

  for (const line of lines) {
    if (isJunkLine(line)) continue;
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (phase === 'question') {
      const optMatch = trimmed.match(/^([A-E])\.\s+(.+)/);
      if (optMatch) {
        phase = 'options';
        currentOption = { key: optMatch[1], text: optMatch[2] };
      } else {
        questionLines.push(trimmed);
      }
    }

    if (phase === 'options') {
      const answerMatch = trimmed.match(/^Correct Answer:\s*([A-E]+)/);
      if (answerMatch) {
        if (currentOption) options.push(currentOption);
        listedAnswer = answerMatch[1].split('');
        phase = 'community';
        continue;
      }
      const optMatch = trimmed.match(/^([A-E])\.\s+(.+)/);
      if (optMatch) {
        if (currentOption) options.push(currentOption);
        currentOption = { key: optMatch[1], text: optMatch[2] };
      } else if (currentOption && phase === 'options') {
        currentOption.text += ' ' + trimmed;
      }
    }

    if (phase === 'community') {
      communitySection.push(trimmed);
      const voteMatch = trimmed.match(/^\s*([A-E]+)\s*\((\d+)%\)/);
      if (voteMatch && !communityVote) {
        communityVote = [voteMatch[1]];
        communityVotePercent = [parseInt(voteMatch[2], 10)];
      } else if (voteMatch && communityVote) {
        communityVote.push(voteMatch[1]);
        communityVotePercent.push(parseInt(voteMatch[2], 10));
      }
    }
  }

  // Check for community correction
  const communityText = communitySection.join('\n');
  const correctionMatch = communityText.match(/(?:The correct question|the actual question)[:\s]*\n?([\s\S]*?)(?=\n(?:Which|What|How|upvoted|\n[A-E]\.))/i);
  let questionText = questionLines.join(' ');
  if (correctionMatch) {
    const corrected = correctionMatch[1].trim();
    if (corrected.length > 30) {
      questionText = corrected;
      communityCorrection = true;
    }
  }

  const isMultiSelect = /select two|choose two|select three/i.test(questionText)
    || (listedAnswer && listedAnswer.length > 1);

  // Auto-assign correctAnswer and confidence
  let correctAnswer;
  let confidence;
  if (communityVote && communityVotePercent) {
    correctAnswer = communityVote[0].split('');
    if (communityVotePercent[0] >= 90) confidence = 'high';
    else if (communityVotePercent[0] >= 70) confidence = 'medium';
    else confidence = 'needs-review';
  } else {
    correctAnswer = listedAnswer || [];
    confidence = 'needs-review';
  }

  return {
    id: globalId,
    question: questionText,
    options,
    listedAnswer: listedAnswer || [],
    correctAnswer,
    communityVote: communityVote || null,
    communityVotePercent: communityVotePercent || null,
    isMultiSelect,
    confidence,
    communityCorrection,
  };
}

// Main
const allQuestions = [];
for (const { path, offset } of PDF_FILES) {
  const text = extractText(path);
  const questions = parseQuestions(text, offset);
  allQuestions.push(...questions);
}

mkdirSync(join(ROOT, 'src', 'data'), { recursive: true });
writeFileSync(
  join(ROOT, 'src', 'data', 'questions-raw.json'),
  JSON.stringify(allQuestions, null, 2)
);

// Summary
const multi = allQuestions.filter(q => q.isMultiSelect).length;
const high = allQuestions.filter(q => q.confidence === 'high').length;
const med = allQuestions.filter(q => q.confidence === 'medium').length;
const review = allQuestions.filter(q => q.confidence === 'needs-review').length;
const corrections = allQuestions.filter(q => q.communityCorrection).length;

console.log(`Parsed: ${allQuestions.length} questions (${allQuestions.length - multi} single-select, ${multi} multi-select)`);
console.log(`Confidence: ${high} high, ${med} medium, ${review} needs-review`);
console.log(`Community corrections applied: ${corrections}`);
```

- [x] **Step 3: Run the extraction script and validate**

```bash
npm run extract
```

Expected: prints summary with ~574 questions. Then validate the output:

```bash
node --input-type=commonjs -e "
const q = JSON.parse(require('fs').readFileSync('src/data/questions-raw.json','utf8'));
console.log('Total:', q.length);
console.log('With empty question:', q.filter(x => !x.question || x.question.length < 10).length);
console.log('With no options:', q.filter(x => x.options.length === 0).length);
console.log('With no correctAnswer:', q.filter(x => x.correctAnswer.length === 0).length);
const badRef = q.filter(x => x.correctAnswer.some(a => !x.options.find(o => o.key === a)));
console.log('correctAnswer references nonexistent option:', badRef.length);
if (badRef.length > 0) console.log('  IDs:', badRef.map(x => x.id).join(', '));
"
```

Expected: 0 empty questions, 0 missing options, 0 missing answers, 0 bad references. If any validation fails, fix the parser and re-run.

- [x] **Step 4: Commit extraction script and raw output**

```bash
git add package.json scripts/extract-questions.js src/data/questions-raw.json
git commit -m "feat: add PDF extraction script and raw parsed question bank"
```

---

### Task 2: Build Verified questions.json

**Files:**
- Create: `scripts/enrich-questions.js`
- Create: `src/data/questions.json`
- Delete after use: `src/data/questions-raw.json` (intermediate artifact)

**Interfaces:**
- Consumes: `src/data/questions-raw.json` from Task 1
- Produces: `src/data/questions.json` - array of objects with shape `{ id: number, question: string, options: Array<{key: string, text: string}>, correctAnswer: string[], explanation: string, isMultiSelect: boolean, confidence: "high" | "medium" | "needs-review", category: string, communityCorrection: boolean }`

This task transforms the raw extraction output into the final verified question bank. It has two parts: an automated enrichment script (category assignment, answer verification for high-confidence questions) and a manual review pass for uncertain questions.

- [x] **Step 1: Write the enrichment script**

Create `scripts/enrich-questions.js` that reads `questions-raw.json` and:

1. **Assigns categories** by scanning question text and option text for AWS service keywords. Place this at the top of the file, before the main script logic:

```javascript
const CATEGORY_PATTERNS = [
  { category: 'EC2', patterns: [/\bEC2\b/, /\binstance[s]?\b/i, /\bAMI\b/, /\bauto.?scaling\b/i, /\belastic.?ip\b/i, /\bplacement group/i] },
  { category: 'S3', patterns: [/\bS3\b/, /\bsimple storage/i, /\bbucket[s]?\b/i, /\bobject storage/i] },
  { category: 'RDS', patterns: [/\bRDS\b/, /\bAurora\b/, /\brelational database/i, /\bMulti-AZ\b/i, /\bread replica/i] },
  { category: 'VPC', patterns: [/\bVPC\b/, /\bsubnet[s]?\b/i, /\bsecurity group/i, /\bNACL\b/, /\binternet gateway/i, /\bNAT gateway/i, /\broute table/i] },
  { category: 'IAM', patterns: [/\bIAM\b/, /\brole[s]?\b/i, /\bpolic(?:y|ies)\b/i, /\bcross.?account/i, /\bSTS\b/, /\bfederat/i] },
  { category: 'Lambda', patterns: [/\bLambda\b/, /\bserverless\b/i, /\bfunction[s]?\b/i] },
  { category: 'DynamoDB', patterns: [/\bDynamoDB\b/, /\bNoSQL\b/i, /\bpartition key/i, /\bsort key/i] },
  { category: 'CloudFront', patterns: [/\bCloudFront\b/, /\bCDN\b/, /\bedge location/i, /\bdistribution\b/i] },
  { category: 'ELB', patterns: [/\bload balancer/i, /\bALB\b/, /\bNLB\b/, /\bELB\b/, /\btarget group/i] },
  { category: 'SQS/SNS', patterns: [/\bSQS\b/, /\bSNS\b/, /\bqueue\b/i, /\bmessag(?:e|ing)\b/i, /\bdecouple/i] },
  { category: 'ECS/EKS', patterns: [/\bECS\b/, /\bEKS\b/, /\bFargate\b/, /\bcontainer[s]?\b/i, /\bKubernetes\b/i] },
  { category: 'CloudWatch', patterns: [/\bCloudWatch\b/, /\bmonitoring\b/i, /\balarm[s]?\b/i, /\blog group/i] },
  { category: 'Route 53', patterns: [/\bRoute\s*53\b/, /\bDNS\b/i, /\bhosted zone/i, /\brouting policy/i] },
  { category: 'KMS/Security', patterns: [/\bKMS\b/, /\bencrypt/i, /\bSSE\b/, /\bACM\b/, /\bWAF\b/, /\bShield\b/, /\bGuardDuty\b/, /\bMacie\b/] },
  { category: 'Storage', patterns: [/\bEBS\b/, /\bEFS\b/, /\bFSx\b/, /\bStorage Gateway\b/i, /\bSnowball\b/i, /\bGlacier\b/i] },
  { category: 'Database', patterns: [/\bElastiCache\b/, /\bRedshift\b/, /\bNeptune\b/, /\bDocumentDB\b/, /\bMemoryDB\b/] },
  { category: 'Analytics', patterns: [/\bAthena\b/, /\bKinesis\b/, /\bEMR\b/, /\bGlue\b/, /\bQuickSight\b/, /\bOpenSearch\b/] },
  { category: 'Migration', patterns: [/\bDMS\b/, /\bDatabase Migration/i, /\bServer Migration/i, /\bDataSync\b/, /\bTransfer Family/i] },
  { category: 'Networking', patterns: [/\bDirect Connect\b/, /\bVPN\b/, /\bTransit Gateway\b/i, /\bPrivateLink\b/, /\bGlobal Accelerator\b/] },
  { category: 'Other', patterns: [] },
];

function assignCategory(question) {
  const text = question.question + ' ' + question.options.map(o => o.text).join(' ');
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some(p => p.test(text))) return category;
  }
  return 'Other';
}
```

2. **Strips fields** not needed in the final output: removes `listedAnswer`, `communityVote`, `communityVotePercent`

3. **Adds a placeholder explanation** for every question: `"[Explanation pending verification]"` - these will be filled in during Step 2.

4. **Writes** `src/data/questions.json`

5. **Prints category distribution** and a list of all `needs-review` question IDs to stdout.

The complete file (`scripts/enrich-questions.js`) combines the `CATEGORY_PATTERNS`/`assignCategory` definitions above with this main script:

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const raw = JSON.parse(readFileSync(join(ROOT, 'src', 'data', 'questions-raw.json'), 'utf-8'));

const questions = raw.map(q => ({
  id: q.id,
  question: q.question,
  options: q.options,
  correctAnswer: q.correctAnswer,
  explanation: '[Explanation pending verification]',
  isMultiSelect: q.isMultiSelect,
  confidence: q.confidence,
  category: assignCategory(q),
  communityCorrection: q.communityCorrection,
}));

writeFileSync(join(ROOT, 'src', 'data', 'questions.json'), JSON.stringify(questions, null, 2));

// Print stats
const cats = {};
questions.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });
console.log('\nCategory distribution:');
Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});

const needsReview = questions.filter(q => q.confidence === 'needs-review');
console.log(`\nNeeds review (${needsReview.length}): ${needsReview.map(q => q.id).join(', ')}`);
```

- [x] **Step 2: Run enrichment and verify answers**

```bash
node scripts/enrich-questions.js
```

After running, the implementing agent must verify answers and write explanations. Process:

1. For all `confidence: "high"` questions: spot-check a random sample of 20. If the community-voted answer is consistent with AWS knowledge, trust the rest. Write a one-sentence explanation for each based on the question content.

2. For all `confidence: "medium"` questions: review each one. Verify the community answer is correct using AWS SAA knowledge. Correct if wrong, upgrade to "high" if verified. Write a one-sentence explanation.

3. For all `confidence: "needs-review"` questions: review each one. Determine the correct answer using AWS SAA knowledge. Assign confidence "high" or "medium" based on certainty. Write a one-sentence explanation.

4. For all `communityCorrection: true` questions: verify the corrected question text makes sense with the answer options.

Update `src/data/questions.json` with all corrections and explanations. This is the most time-intensive step - use parallel subagents processing batches of ~50 questions each for efficiency.

- [x] **Step 3: Validate the final questions.json**

```bash
node --input-type=commonjs -e "
const q = JSON.parse(require('fs').readFileSync('src/data/questions.json','utf8'));
console.log('Total:', q.length);
console.log('Missing explanations:', q.filter(x => x.explanation.includes('pending')).length);
console.log('needs-review remaining:', q.filter(x => x.confidence === 'needs-review').length);
const badRef = q.filter(x => x.correctAnswer.some(a => !x.options.find(o => o.key === a)));
console.log('Bad answer references:', badRef.length);
const cats = {};
q.forEach(x => { cats[x.category] = (cats[x.category] || 0) + 1; });
console.log('Categories:', Object.keys(cats).length);
console.log('Other (uncategorized):', cats['Other'] || 0);
"
```

Expected: 0 missing explanations, 0 bad references, reasonable number of categories (15-20), "Other" count under 30. `needs-review` count is acceptable as long as every question has been reviewed once.

- [x] **Step 4: Commit verified question bank**

```bash
rm src/data/questions-raw.json
git add scripts/enrich-questions.js src/data/questions.json
git rm --cached src/data/questions-raw.json 2>/dev/null || true
git commit -m "feat: add verified question bank with explanations and categories"
```

---

### Task 3: React + Vite + shadcn/ui Scaffolding and Quiz State Hook

**Files:**
- Modify: `package.json` (add React/Vite/Tailwind dependencies)
- Create: `vite.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `src/index.css` (Tailwind directives)
- Create: `src/lib/utils.js` (shadcn cn() utility)
- Create: `components.json` (shadcn config)
- Create: `src/hooks/useQuizState.js`
- Create: `src/components/App.jsx` (shell only)

**Interfaces:**
- Consumes: `src/data/questions.json` from Task 2
- Produces: `useQuizState()` hook returning `{ questions, filteredQuestions, currentQuestion, currentQuestionIndex, answers, settings, stats, categories, submitAnswer, nextQuestion, previousQuestion, updateSettings, resetQuiz }`

- [x] **Step 1: Install dependencies**

```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite clsx tailwind-merge
```

- [x] **Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

- [x] **Step 3: Create src/lib/utils.js**

```javascript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

- [x] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AWS SAA Quiz</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [x] **Step 5: Create src/main.jsx**

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [x] **Step 6: Create src/index.css**

```css
@import "tailwindcss";
```

- [x] **Step 7: Initialize shadcn/ui**

Run `npx shadcn@latest init` and configure with these settings, or create the files manually:

Create `components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Then install the shadcn components used by this app:

```bash
npx shadcn@latest add button card badge progress select checkbox separator
```

This creates files in `src/components/ui/`. Verify they exist.

- [x] **Step 8: Create src/hooks/useQuizState.js**

This is the core state management hook. It wraps localStorage and provides all quiz operations.

```javascript
import { useState, useCallback, useMemo } from 'react';
import questionsData from '../data/questions.json';

const STORAGE_KEY = 'aws-saa-quiz-state';

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateShuffleOrder(length) {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const DEFAULT_SETTINGS = {
  shuffleQuestions: true,
  showOnlyUnanswered: false,
  filterCategory: null,
  filterConfidence: null,
};

export default function useQuizState() {
  const [state, setState] = useState(() => {
    const saved = loadState();
    if (saved) return saved;
    return {
      answers: {},
      currentQuestionIndex: 0,
      shuffleOrder: generateShuffleOrder(questionsData.length),
      settings: DEFAULT_SETTINGS,
    };
  });

  const persist = useCallback((updater) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveState(next);
      return next;
    });
  }, []);

  const getFilteredQuestions = useCallback(() => {
    let filtered = questionsData;
    if (state.settings.filterCategory) {
      filtered = filtered.filter(q => q.category === state.settings.filterCategory);
    }
    if (state.settings.filterConfidence) {
      filtered = filtered.filter(q => q.confidence === state.settings.filterConfidence);
    }
    if (state.settings.showOnlyUnanswered) {
      filtered = filtered.filter(q => !state.answers[q.id]);
    }
    if (state.settings.shuffleQuestions) {
      const idSet = new Set(filtered.map(q => q.id));
      const order = state.shuffleOrder.filter(i => idSet.has(questionsData[i]?.id));
      filtered = order.map(i => questionsData[i]).filter(Boolean);
    }
    return filtered;
  }, [state.settings, state.answers, state.shuffleOrder]);

  const filteredQuestions = useMemo(() => getFilteredQuestions(), [getFilteredQuestions]);

  const currentQuestion = filteredQuestions[state.currentQuestionIndex] || null;

  const submitAnswer = useCallback((questionId, selected) => {
    const question = questionsData.find(q => q.id === questionId);
    if (!question) return;
    const correct = question.correctAnswer.length === selected.length
      && question.correctAnswer.every(a => selected.includes(a));
    persist(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: {
          selected,
          correct,
          answeredAt: new Date().toISOString(),
        },
      },
    }));
  }, [persist]);

  const nextQuestion = useCallback(() => {
    persist(prev => ({
      ...prev,
      currentQuestionIndex: Math.min(prev.currentQuestionIndex + 1, filteredQuestions.length - 1),
    }));
  }, [persist, filteredQuestions.length]);

  const previousQuestion = useCallback(() => {
    persist(prev => ({
      ...prev,
      currentQuestionIndex: Math.max(prev.currentQuestionIndex - 1, 0),
    }));
  }, [persist]);

  const updateSettings = useCallback((newSettings) => {
    persist(prev => ({
      ...prev,
      currentQuestionIndex: 0,
      settings: { ...prev.settings, ...newSettings },
    }));
  }, [persist]);

  const resetQuiz = useCallback(() => {
    persist({
      answers: {},
      currentQuestionIndex: 0,
      shuffleOrder: generateShuffleOrder(questionsData.length),
      settings: state.settings,
    });
  }, [persist, state.settings]);

  const stats = useMemo(() => {
    const answered = Object.keys(state.answers).length;
    const correctCount = Object.values(state.answers).filter(a => a.correct).length;
    return {
      total: questionsData.length,
      answered,
      correct: correctCount,
      incorrect: answered - correctCount,
      percentage: answered > 0 ? Math.round((correctCount / answered) * 100) : 0,
      filteredTotal: filteredQuestions.length,
    };
  }, [state.answers, filteredQuestions.length]);

  const categories = useMemo(() => {
    const cats = {};
    questionsData.forEach(q => { cats[q.category] = (cats[q.category] || 0) + 1; });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, []);

  return {
    questions: questionsData,
    filteredQuestions,
    currentQuestion,
    currentQuestionIndex: state.currentQuestionIndex,
    answers: state.answers,
    settings: state.settings,
    stats,
    categories,
    submitAnswer,
    nextQuestion,
    previousQuestion,
    updateSettings,
    resetQuiz,
  };
}
```

- [x] **Step 9: Create src/components/App.jsx (shell)**

A minimal shell that proves the hook loads, shadcn components render, and Tailwind works. Full view switching comes in Task 6.

```jsx
import { useState } from 'react';
import useQuizState from '@/hooks/useQuizState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function App() {
  const [view, setView] = useState('dashboard');
  const quizState = useQuizState();

  return (
    <div className="max-w-4xl mx-auto p-5">
      <Card>
        <CardHeader>
          <CardTitle>AWS SAA Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Loaded {quizState.stats.total} questions
          </p>
          <Button onClick={() => setView('quiz')}>Start Quiz</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [x] **Step 10: Verify the app starts**

```bash
npm run dev
```

Open the browser. Confirm:
- Page loads without errors
- Shows "AWS SAA Quiz" card with shadcn styling (rounded corners, proper typography)
- Tailwind classes are applied (centered layout, spacing)
- Shows "Loaded 574 questions" (or whatever the final count is)
- shadcn Button renders with proper styling
- No console errors

- [x] **Step 11: Commit scaffolding, shadcn, and state hook**

```bash
git add vite.config.js index.html src/ components.json package.json package-lock.json
git commit -m "feat: add React/Vite/shadcn scaffolding and useQuizState hook"
```

---

### Task 4: Core Quiz Components (QuestionCard, Feedback, Quiz, Progress)

**Files:**
- Create: `src/components/QuestionCard.jsx`
- Create: `src/components/Feedback.jsx`
- Create: `src/components/Quiz.jsx`
- Create: `src/components/QuizProgress.jsx`

**Interfaces:**
- Consumes: `useQuizState()` hook from Task 3 (specifically: `currentQuestion`, `answers`, `submitAnswer`, `nextQuestion`, `previousQuestion`, `currentQuestionIndex`, `filteredQuestions`, `stats`). Also uses shadcn `Button`, `Card`, `Badge`, `Progress` components from Task 3.
- Produces: `<Quiz />` component that renders the full question-answer-feedback flow. Props: `quizState` (the return value of `useQuizState()`), `onExit` (callback to return to dashboard)

- [x] **Step 1: Create QuestionCard component**

Create `src/components/QuestionCard.jsx`:

```jsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function QuestionCard({ question, onSubmit, existingAnswer }) {
  const [selected, setSelected] = useState(existingAnswer?.selected || []);
  const submitted = !!existingAnswer;
  const requiredSelections = question.isMultiSelect ? question.correctAnswer.length : 1;

  function handleOptionClick(key) {
    if (submitted) return;
    if (question.isMultiSelect) {
      setSelected(prev =>
        prev.includes(key)
          ? prev.filter(k => k !== key)
          : prev.length < requiredSelections
            ? [...prev, key]
            : prev
      );
    } else {
      setSelected([key]);
    }
  }

  function handleSubmit() {
    if (selected.length === requiredSelections && !submitted) {
      onSubmit(question.id, selected);
    }
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <p className="text-base leading-7 mb-5">{question.question}</p>
        {question.isMultiSelect && (
          <Badge variant="secondary" className="mb-4">
            Select {requiredSelections} answers
          </Badge>
        )}
        <div className="flex flex-col gap-2.5 mb-4">
          {question.options.map(opt => {
            const isSelected = selected.includes(opt.key);
            const isCorrect = submitted && question.correctAnswer.includes(opt.key);
            const isWrong = submitted && isSelected && !isCorrect;
            return (
              <button
                key={opt.key}
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-lg border-2 text-left text-sm transition-colors',
                  'bg-muted/50 border-transparent',
                  !submitted && 'hover:bg-accent hover:border-accent',
                  isSelected && !submitted && 'bg-accent border-primary',
                  isCorrect && 'bg-green-50 border-green-500',
                  isWrong && 'bg-red-50 border-red-500',
                  submitted && 'cursor-default'
                )}
                onClick={() => handleOptionClick(opt.key)}
                disabled={submitted}
                data-option={opt.key}
              >
                <span className="font-bold min-w-[24px] text-muted-foreground">{opt.key}</span>
                <span className="flex-1">{opt.text}</span>
              </button>
            );
          })}
        </div>
        {!submitted && (
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={selected.length !== requiredSelections}
          >
            Submit Answer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [x] **Step 2: Create Feedback component**

Create `src/components/Feedback.jsx`:

```jsx
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function Feedback({ question, answer }) {
  if (!answer) return null;

  return (
    <div className={cn(
      'rounded-xl p-5 mb-4 border',
      answer.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    )}>
      <p className={cn(
        'text-lg font-bold mb-2',
        answer.correct ? 'text-green-700' : 'text-red-700'
      )}>
        {answer.correct ? 'Correct!' : 'Incorrect'}
      </p>
      <p className="text-sm mb-2">
        <span className="font-semibold">Correct answer: </span>
        {question.correctAnswer.join(', ')}
      </p>
      <p className="text-sm leading-6 text-foreground/80">
        {question.explanation}
      </p>
      {question.confidence !== 'high' && (
        <Badge variant="outline" className="mt-3">
          {question.confidence} confidence
        </Badge>
      )}
    </div>
  );
}
```

- [x] **Step 3: Create QuizProgress component**

Create `src/components/QuizProgress.jsx` (named `QuizProgress` to avoid conflicting with shadcn's `Progress` component):

```jsx
import { Progress } from '@/components/ui/progress';

export default function QuizProgress({ current, total, stats }) {
  const progressPercent = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <div className="mb-5">
      <Progress value={progressPercent} className="h-1.5 mb-2" />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Question {current + 1} of {total}</span>
        <span>
          Score: {stats.correct}/{stats.answered}
          {stats.answered > 0 && ` (${stats.percentage}%)`}
        </span>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Create Quiz component**

Create `src/components/Quiz.jsx` that wires together QuestionCard, Feedback, and QuizProgress:

```jsx
import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import QuestionCard from './QuestionCard';
import Feedback from './Feedback';
import QuizProgress from './QuizProgress';

export default function Quiz({ quizState, onExit }) {
  const {
    currentQuestion,
    currentQuestionIndex,
    filteredQuestions,
    answers,
    stats,
    submitAnswer,
    nextQuestion,
    previousQuestion,
  } = quizState;

  const existingAnswer = currentQuestion ? answers[currentQuestion.id] : null;
  const isLastQuestion = currentQuestionIndex >= filteredQuestions.length - 1;

  const handleKeyDown = useCallback((e) => {
    if (!currentQuestion) return;

    if (e.key === 'Escape') {
      onExit();
      return;
    }

    if (existingAnswer) {
      if ((e.key === 'ArrowRight' || e.key === 'n') && !isLastQuestion) {
        nextQuestion();
      }
      if (e.key === 'ArrowLeft' || e.key === 'p') {
        previousQuestion();
      }
      return;
    }

    const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
    if (keyMap[e.key]) {
      const optKey = keyMap[e.key];
      if (currentQuestion.options.find(o => o.key === optKey)) {
        document.querySelector(`[data-option="${optKey}"]`)?.click();
      }
    }

    if (e.key === 'Enter') {
      document.querySelector('[data-submit]')?.click();
    }
  }, [currentQuestion, existingAnswer, isLastQuestion, nextQuestion, previousQuestion, onExit]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!currentQuestion) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-4">No questions match your filters</h2>
        <Button variant="secondary" onClick={onExit}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-5">
      <QuizProgress
        current={currentQuestionIndex}
        total={filteredQuestions.length}
        stats={stats}
      />
      <QuestionCard
        key={currentQuestion.id}
        question={currentQuestion}
        onSubmit={submitAnswer}
        existingAnswer={existingAnswer}
      />
      <Feedback question={currentQuestion} answer={existingAnswer} />
      {existingAnswer && (
        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            onClick={previousQuestion}
            disabled={currentQuestionIndex === 0}
            className="flex-1"
          >
            Previous
          </Button>
          {!isLastQuestion ? (
            <Button onClick={nextQuestion} className="flex-1">
              Next Question
            </Button>
          ) : (
            <Button onClick={onExit} className="flex-1">
              Finish
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

Note: The submit button in QuestionCard uses `data-submit` attribute for keyboard Enter handling. Add `data-submit` to the Button in QuestionCard:

In QuestionCard's submit Button, add the attribute:
```jsx
<Button className="w-full" size="lg" onClick={handleSubmit} disabled={selected.length !== requiredSelections} data-submit>
```

- [x] **Step 5: Wire Quiz into App.jsx**

Update `src/components/App.jsx`:

```jsx
import { useState } from 'react';
import useQuizState from '@/hooks/useQuizState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Quiz from './Quiz';

export default function App() {
  const [view, setView] = useState('dashboard');
  const quizState = useQuizState();

  if (view === 'quiz') {
    return <Quiz quizState={quizState} onExit={() => setView('dashboard')} />;
  }

  return (
    <div className="max-w-4xl mx-auto p-5">
      <Card>
        <CardHeader>
          <CardTitle>AWS SAA Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-2">
            Loaded {quizState.stats.total} questions
          </p>
          <p className="text-muted-foreground mb-4">
            {quizState.stats.answered} answered, {quizState.stats.percentage}% correct
          </p>
          <Button onClick={() => setView('quiz')}>Start Quiz</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [x] **Step 6: Verify in browser**
- Click an option - it highlights with primary color border
- Click "Submit Answer" - see green/red feedback with explanation
- Click "Next Question" - advances to next question
- Press Escape - returns to dashboard
- Refresh the page - progress is preserved (answered count persists)
- Test keyboard: press 1-4 to select, Enter to submit, right arrow for next

- [x] **Step 7: Commit core quiz components**

```bash
git add src/components/QuestionCard.jsx src/components/Feedback.jsx src/components/QuizProgress.jsx src/components/Quiz.jsx src/components/App.jsx
git commit -m "feat: add core quiz components with question/feedback/progress flow"
```

---

### Task 5: Dashboard Component

**Files:**
- Create: `src/components/Dashboard.jsx`
- Modify: `src/components/App.jsx`

**Interfaces:**
- Consumes: `useQuizState()` from Task 3 (specifically: `stats`, `categories`, `answers`, `settings`, `updateSettings`, `resetQuiz`). Also uses shadcn `Button`, `Card`, `Select`, `Checkbox`, `Progress`, `Separator` components.
- Produces: `<Dashboard />` component. Props: `quizState` (return value of `useQuizState()`), `onStartQuiz` (callback), `onOpenReview` (callback)

- [x] **Step 1: Create Dashboard component**

Create `src/components/Dashboard.jsx`:

```jsx
import questionsData from '@/data/questions.json';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export default function Dashboard({ quizState, onStartQuiz, onOpenReview }) {
  const { stats, categories, answers, settings, updateSettings, resetQuiz } = quizState;

  const categoryStats = categories.map(([cat, total]) => {
    const catQuestions = questionsData.filter(q => q.category === cat);
    const answered = catQuestions.filter(q => answers[q.id]).length;
    const correct = catQuestions.filter(q => answers[q.id]?.correct).length;
    return { cat, total, answered, correct };
  });

  const needsReviewCount = questionsData.filter(
    q => q.confidence !== 'high' || q.communityCorrection
  ).length;

  return (
    <div className="max-w-4xl mx-auto p-5">
      <h1 className="text-3xl font-bold mb-5">AWS SAA Quiz</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { value: `${stats.answered}/${stats.total}`, label: 'Questions Answered' },
          { value: `${stats.percentage}%`, label: 'Correct Rate' },
          { value: stats.correct, label: 'Correct' },
          { value: stats.incorrect, label: 'Incorrect' },
        ].map(({ value, label }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold text-primary">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Button onClick={onStartQuiz}>
          {stats.answered > 0 ? 'Continue Quiz' : 'Start Quiz'}
        </Button>
        <Button variant="secondary" onClick={onOpenReview}>
          Review Flagged ({needsReviewCount})
        </Button>
        {stats.answered > 0 && (
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm('Reset all progress? This cannot be undone.')) {
                resetQuiz();
              }
            }}
          >
            Reset Progress
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="shuffle"
              checked={settings.shuffleQuestions}
              onCheckedChange={checked => updateSettings({ shuffleQuestions: checked })}
            />
            <label htmlFor="shuffle" className="text-sm">Shuffle questions</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="unanswered"
              checked={settings.showOnlyUnanswered}
              onCheckedChange={checked => updateSettings({ showOnlyUnanswered: checked })}
            />
            <label htmlFor="unanswered" className="text-sm">Show only unanswered</label>
          </div>
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Category:</label>
              <Select
                value={settings.filterCategory || 'all'}
                onValueChange={val => updateSettings({ filterCategory: val === 'all' ? null : val })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(([cat, count]) => (
                    <SelectItem key={cat} value={cat}>{cat} ({count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categoryStats.map(({ cat, total, answered, correct }) => (
              <div key={cat} className="grid grid-cols-[140px_100px_1fr] items-center gap-3">
                <span className="text-sm font-medium truncate">{cat}</span>
                <span className="text-xs text-muted-foreground text-right">
                  {answered}/{total}
                  {answered > 0 && ` (${Math.round((correct / answered) * 100)}%)`}
                </span>
                <Progress value={(answered / total) * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [x] **Step 2: Wire Dashboard into App.jsx**

Update `src/components/App.jsx` to use Dashboard:

```jsx
import { useState } from 'react';
import useQuizState from '@/hooks/useQuizState';
import Quiz from './Quiz';
import Dashboard from './Dashboard';

export default function App() {
  const [view, setView] = useState('dashboard');
  const quizState = useQuizState();

  if (view === 'quiz') {
    return <Quiz quizState={quizState} onExit={() => setView('dashboard')} />;
  }

  return (
    <Dashboard
      quizState={quizState}
      onStartQuiz={() => setView('quiz')}
      onOpenReview={() => setView('review')}
    />
  );
}
```

- [x] **Step 3: Verify in browser**
- Category breakdown lists all AWS service categories with shadcn Progress bars
- Filter dropdowns work (shadcn Select components) - select a category, toggle checkboxes
- "Start Quiz" navigates to the quiz, Escape returns to dashboard
- After answering some questions, dashboard stats update on return
- "Reset Progress" prompts confirmation and clears all progress

- [x] **Step 4: Commit dashboard**

```bash
git add src/components/Dashboard.jsx src/components/App.jsx
git commit -m "feat: add dashboard with stats, category breakdown, and filters"
```

---

### Task 6: Review Queue and Final Integration

**Files:**
- Create: `src/components/ReviewQueue.jsx`
- Modify: `src/components/App.jsx` (add review view)

**Interfaces:**
- Consumes: `useQuizState()` from Task 3, all components from Tasks 4-5, shadcn `Button`, `Card`, `Badge` components
- Produces: Complete application with all three views (dashboard, quiz, review) working

- [x] **Step 1: Create ReviewQueue component**

Create `src/components/ReviewQueue.jsx`:

```jsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import questionsData from '@/data/questions.json';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ReviewQueue({ quizState, onExit }) {
  const { answers } = quizState;
  const [reviewStatus, setReviewStatus] = useState(() => {
    try {
      const stored = localStorage.getItem('aws-saa-review-status');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const flaggedQuestions = questionsData.filter(
    q => q.confidence !== 'high' || q.communityCorrection
  );

  function updateReviewStatus(id, status) {
    const next = { ...reviewStatus, [id]: status };
    setReviewStatus(next);
    localStorage.setItem('aws-saa-review-status', JSON.stringify(next));
  }

  const verified = flaggedQuestions.filter(q => reviewStatus[q.id] === 'verified').length;
  const needsCorrection = flaggedQuestions.filter(q => reviewStatus[q.id] === 'needs-correction').length;
  const unreviewed = flaggedQuestions.length - verified - needsCorrection;

  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Review Queue</h1>
        <Button variant="secondary" onClick={onExit}>Back to Dashboard</Button>
      </div>

      <div className="flex gap-4 mb-5 text-sm text-muted-foreground">
        <span>{flaggedQuestions.length} flagged</span>
        <span>{verified} verified</span>
        <span>{needsCorrection} needs correction</span>
        <span>{unreviewed} unreviewed</span>
      </div>

      <div className="flex flex-col gap-4">
        {flaggedQuestions.map(q => {
          const answer = answers[q.id];
          const status = reviewStatus[q.id];
          return (
            <Card
              key={q.id}
              className={cn(
                'border-l-4',
                status === 'verified' && 'border-l-green-500',
                status === 'needs-correction' && 'border-l-red-500',
                !status && 'border-l-muted'
              )}
            >
              <CardContent className="pt-5">
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="default">Q{q.id}</Badge>
                  <Badge variant="secondary">{q.category}</Badge>
                  <Badge variant="outline">{q.confidence}</Badge>
                  {q.communityCorrection && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      community-corrected
                    </Badge>
                  )}
                </div>
                <p className="text-sm leading-6 mb-3">{q.question}</p>
                <div className="mb-3 space-y-1">
                  {q.options.map(opt => (
                    <div
                      key={opt.key}
                      className={cn(
                        'text-sm px-2.5 py-1.5 rounded',
                        q.correctAnswer.includes(opt.key) && 'bg-green-50'
                      )}
                    >
                      <strong>{opt.key}.</strong> {opt.text}
                    </div>
                  ))}
                </div>
                <p className="text-sm mb-2">
                  <span className="font-semibold">Answer:</span> {q.correctAnswer.join(', ')}
                  {answer && (
                    <span className={answer.correct ? 'text-green-600' : 'text-red-600'}>
                      {' '}(you answered: {answer.selected.join(', ')})
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mb-3">{q.explanation}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={status === 'verified' ? 'default' : 'outline'}
                    onClick={() => updateReviewStatus(q.id, 'verified')}
                  >
                    Verified
                  </Button>
                  <Button
                    size="sm"
                    variant={status === 'needs-correction' ? 'destructive' : 'outline'}
                    onClick={() => updateReviewStatus(q.id, 'needs-correction')}
                  >
                    Needs Correction
                  </Button>
                  {status && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateReviewStatus(q.id, undefined)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Complete App.jsx with all three views**

Update `src/components/App.jsx`:

```jsx
import { useState } from 'react';
import useQuizState from '@/hooks/useQuizState';
import Dashboard from './Dashboard';
import Quiz from './Quiz';
import ReviewQueue from './ReviewQueue';

export default function App() {
  const [view, setView] = useState('dashboard');
  const quizState = useQuizState();

  switch (view) {
    case 'quiz':
      return <Quiz quizState={quizState} onExit={() => setView('dashboard')} />;
    case 'review':
      return <ReviewQueue quizState={quizState} onExit={() => setView('dashboard')} />;
    default:
      return (
        <Dashboard
          quizState={quizState}
          onStartQuiz={() => setView('quiz')}
          onOpenReview={() => setView('review')}
        />
      );
  }
}
```

- [x] **Step 3: (No custom CSS needed)**

All styling is handled by shadcn/ui components and Tailwind utility classes. The `src/index.css` file only needs the Tailwind import directive (`@import "tailwindcss"`) which was already created in Task 3. No additional styles are required.

- [x] **Step 4: Verify the complete application**

Run `npm run dev` and do a full smoke test:

1. **Dashboard**: loads with 0/574 stats, category breakdown visible, all filters work
2. **Quiz flow**: click Start Quiz, answer a question correctly (see green feedback), answer one incorrectly (see red feedback with explanation), navigate with Next/Previous, press Escape to return
3. **Keyboard shortcuts**: 1-4 select options, Enter submits, arrow keys navigate, Escape exits
4. **Persistence**: refresh the page - answered questions and progress are preserved
5. **Filters**: select a category on dashboard, start quiz - only shows that category's questions. Check "unanswered only" - already-answered questions are skipped
6. **Review Queue**: click "Review Flagged" - see all flagged questions. Click "Verified"/"Needs Correction" buttons - they persist on refresh
7. **Multi-select**: find a multi-select question - confirm it requires exactly 2 selections before submit
8. **Reset**: click "Reset Progress" on dashboard, confirm dialog - all progress clears

- [x] **Step 5: Commit review queue and final integration**

```bash
git add src/components/ReviewQueue.jsx src/components/App.jsx
git commit -m "feat: add review queue and wire up all three views"
```
